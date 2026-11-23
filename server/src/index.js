import dotenv from 'dotenv';
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || '../.env' });

import cors from 'cors';
import express from 'express';
import { clerkMiddleware, getAuth } from '@clerk/express';
import mammoth from 'mammoth';
import mongoose from 'mongoose';
import multer from 'multer';
import pdf from 'pdf-parse';
import { Chunk, Contract, Finding, Message, objectId } from './models.js';
import { askModel, createReview, makeChunks, saveChunks } from './review.js';

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
});

// Clerk middleware verifies the session token and attaches auth context to each request.
app.use(clerkMiddleware());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '1mb' }));

function requireUser(req, res, next) {
  const auth = getAuth(req);
  if (!auth.isAuthenticated || !auth.userId) {
    res.status(401).json({ error: 'Sign in to continue.' });
    return;
  }
  res.locals.userId = auth.userId;
  next();
}

const contracts = express.Router();
contracts.use(requireUser);

contracts.get('/', async (_req, res, next) => {
  try {
    const rows = await Contract.find({ userId: res.locals.userId })
      .select('name size status createdAt')
      .sort({ createdAt: -1 })
      .lean();
    res.json(rows);
  } catch (error) { next(error); }
});

contracts.post('/', upload.single('file'), async (req, res) => {
  let contract = null;
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Choose a contract file.' });
      return;
    }

    const extension = file.originalname.toLowerCase().split('.').pop();
    if (!['pdf', 'docx', 'txt'].includes(extension || '')) {
      res.status(400).json({ error: 'Upload a PDF, DOCX, or TXT file.' });
      return;
    }

    let text = '';
    if (extension === 'pdf') text = (await pdf(file.buffer)).text;
    else if (extension === 'docx') text = (await mammoth.extractRawText({ buffer: file.buffer })).value;
    else text = file.buffer.toString('utf8');
    text = text.replace(/\r/g, '').trim();
    if (!text) {
      res.status(422).json({ error: 'No readable text found. Scanned PDFs need OCR.' });
      return;
    }

    contract = await Contract.create({
      userId: res.locals.userId,
      name: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      status: 'processing',
    });
    const pieces = makeChunks(text);
    if (pieces.length) {
      const indexedPieces = await saveChunks(String(contract._id), pieces);
      await createReview(String(contract._id), indexedPieces);
    }
    contract.status = 'reviewed';
    await contract.save();
    res.status(201).json({ id: String(contract._id) });
  } catch (error) {
    if (contract) {
      contract.status = 'failed';
      await contract.save().catch(() => undefined);
    }
    const message = error instanceof Error ? error.message : 'Could not process this contract.';
    res.status(message.includes('rate limited') ? 429 : 500).json({
      id: contract ? String(contract._id) : undefined,
      error: message,
    });
  }
});

contracts.get('/:id', async (req, res, next) => {
  try {
    if (!objectId(req.params.id)) {
      res.status(404).json({ error: 'Contract not found.' });
      return;
    }
    const contract = await Contract.findOne({ _id: req.params.id, userId: res.locals.userId }).lean();
    if (!contract) {
      res.status(404).json({ error: 'Contract not found.' });
      return;
    }
    const [findings, messages] = await Promise.all([
      Finding.find({ contractId: contract._id }).sort({ createdAt: 1 }).lean(),
      Message.find({ contractId: contract._id }).sort({ createdAt: 1 }).lean(),
    ]);
    res.json({ ...contract, findings, messages });
  } catch (error) { next(error); }
});

contracts.delete('/:id', async (req, res, next) => {
  try {
    if (!objectId(req.params.id)) {
      res.status(404).json({ error: 'Contract not found.' });
      return;
    }
    const contract = await Contract.findOneAndDelete({ _id: req.params.id, userId: res.locals.userId });
    if (!contract) {
      res.status(404).json({ error: 'Contract not found.' });
      return;
    }
    await Promise.all([
      Chunk.deleteMany({ contractId: contract._id }),
      Finding.deleteMany({ contractId: contract._id }),
      Message.deleteMany({ contractId: contract._id }),
    ]);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

contracts.post('/:id/chat', async (req, res, next) => {
  try {
    if (!objectId(req.params.id)) {
      res.status(404).json({ error: 'Contract not found.' });
      return;
    }
    const contract = await Contract.findOne({ _id: req.params.id, userId: res.locals.userId }).select('_id');
    if (!contract) {
      res.status(404).json({ error: 'Contract not found.' });
      return;
    }
    const question = req.body?.question;
    if (typeof question !== 'string' || !question.trim() || question.length > 1000) {
      res.status(400).json({ error: 'Enter a question up to 1,000 characters.' });
      return;
    }
    if (!process.env.OPENROUTER_API_KEY) {
      res.status(503).json({ error: 'OpenRouter API key is not configured.' });
      return;
    }

    const contractId = contract._id;
    await Message.create({ contractId, role: 'user', content: question.trim() });
    const chunks = await Chunk.find({ contractId }).sort({ ordinal: 1 }).lean();
    const pieces = chunks.map(chunk => ({
      text: chunk.text,
      locator: chunk.locator,
      ordinal: chunk.ordinal,
      embedding: chunk.embedding,
    }));
    const { selected, response } = await askModel(question.trim(), pieces);
    if (!response.ok || !response.body) {
      res.status(response.status === 429 ? 429 : 502).json({
        error: response.status === 429 ? 'AI service is rate limited. Please retry shortly.' : 'AI request failed. Please retry.',
      });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let answer = '';
    let pending = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const collectLine = (line) => {
      if (!line.startsWith('data: ') || line === 'data: [DONE]') return;
      try { answer += JSON.parse(line.slice(6)).choices?.[0]?.delta?.content || ''; } catch { /* Ignore incomplete events. */ }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const data = decoder.decode(value, { stream: true });
        pending += data;
        const lines = pending.split('\n');
        pending = lines.pop() || '';
        lines.forEach(collectLine);
        res.write(data);
      }
      pending += decoder.decode();
      if (pending) collectLine(pending);
    } finally { reader.releaseLock(); }

    const quoted = answer.match(/“([^”]+)”|"([^\"]+)"/)?.slice(1).find(Boolean) || '';
    const source = selected.find(piece => quoted && piece.text.includes(quoted));
    await Message.create({
      contractId,
      role: 'assistant',
      content: answer,
      quote: source ? quoted : '',
      locator: source?.locator || '',
    });
    res.end();
  } catch (error) {
    if (res.headersSent) { res.end(); return; }
    next(error);
  }
});

app.use('/api/contracts', contracts);
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use((error, _req, res, _next) => {
  console.error(error);
  if (error instanceof multer.MulterError) {
    res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
      error: error.code === 'LIMIT_FILE_SIZE' ? 'Files must be 20 MB or smaller.' : 'Upload could not be processed.',
    });
    return;
  }
  const message = error instanceof Error ? error.message : 'Unexpected server error.';
  res.status(message.includes('rate limited') ? 429 : 500).json({ error: message });
});

const port = Number(process.env.PORT || 4000);
await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/clausewise');
app.listen(port, '0.0.0.0', () => console.log(`Clausewise API listening on http://localhost:${port}`));
