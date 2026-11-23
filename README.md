# Clausewise · MERN contract review assistant

Contract review app for the IntelliBooks take-home. The frontend and backend are separate applications:

- `client/` — React 19 + Vite + Clerk React, written in JavaScript/JSX.
- `server/` — Node.js + Express + Clerk Express + MongoDB/Mongoose, written in JavaScript.
- OpenRouter — grounded checklist review, batched embeddings, and streamed chat.

## Run locally

Requirements: Node.js 20+, Docker, and Clerk/OpenRouter credentials.

1. Copy `.env.example` to `.env`; configure the keys below.
2. Start MongoDB: `docker compose up -d mongo`
3. Install both workspaces from the repository root: `npm install`
4. Start client and API together: `npm run dev`
5. Open `http://localhost:5173` (API: `http://localhost:4000`).

You can also start them independently from the root:

```bash
npm run dev -w server
npm run dev -w client
```

The Vite client reads root `.env` through `envDir`; the Express server loads `../.env` from its workspace directory.

### Clerk setup

Create an app at [clerk.com](https://clerk.com), enable your chosen sign-in methods, and add the publishable key as `VITE_CLERK_PUBLISHABLE_KEY`. Add the same value as `CLERK_PUBLISHABLE_KEY` and your secret key as `CLERK_SECRET_KEY` for Express. Set the allowed development origin to `http://localhost:5173` and keep `CLIENT_ORIGIN` aligned with it. The React app obtains a Clerk session token and sends it as a Bearer token. Express `clerkMiddleware()` verifies it, and every contract route obtains the authenticated `userId` with `getAuth()`.

### OpenRouter setup

Create an API key at [openrouter.ai/keys](https://openrouter.ai/keys) and set `OPENROUTER_API_KEY`. Models can be changed with `OPENROUTER_CHAT_MODEL` and `OPENROUTER_EMBED_MODEL`. Defaults use `google/gemma-4-31b-it:free` and `nvidia/nemotron-3.5-embed-1b:free`; availability and free-tier limits can change. The API returns a clear rate-limit message. When embeddings fail for a non-rate-limit reason, hybrid retrieval falls back to lexical matching.

## Architecture

```text
client/ React + Vite + Clerk
  └── Bearer session JWT over HTTP / SSE
       └── server/ Express + @clerk/express
            ├── Verify session and scope every contract by Clerk userId
            ├── MongoDB / Mongoose: Contract, Chunk, Finding, Message
            └── OpenRouter: embeddings, JSON review, streamed chat
```

MongoDB stores contract metadata, extracted page/section chunks, JSON embedding vectors, findings, and chat messages in separate collections. This keeps documents with many embeddings below MongoDB's 16 MB per-document limit. User ID is taken only from the verified Clerk token. Contract detail, delete, and chat routes first confirm ownership; chunk/finding/message queries use the owned contract's database id.

## Review pipeline

PDF, DOCX, and TXT uploads are limited to 20 MB. `pdf-parse` and Mammoth extract text; scanned PDFs without extractable text are rejected. Text chunks preserve form-feed page breaks and likely numbered or uppercase section headings, with long sections split near 1,300 characters. Chunk embeddings are sent to OpenRouter in batches of 64. For each checklist item, retrieval combines keyword overlap and cosine similarity. Chat uses the same hybrid ranking for the question.

The checklist is parties; start date and term; payment terms; termination; limitation of liability; confidentiality; governing law; and auto-renewal. The review prompt restricts the model to retrieved passages. Before saving a `found` finding, the backend verifies that the quoted excerpt and full clause each occur verbatim inside a stored chunk. Unsupported quote/full-clause output is marked `unclear`; uncovered items are `not found` with “Not found in the contract.” The chat response streams OpenRouter SSE through Express and persists the exchange per contract.

## Limitations

- Scanned PDFs need OCR.
- PDF page locations rely on form-feed boundaries emitted by text extraction; otherwise text is assigned page one.
- Upload processing is synchronous and uses in-memory upload buffers, bounded at 20 MB. A production version should use a job queue and object storage.
- Vectors are stored as arrays in MongoDB and cosine-ranked in application memory per contract. Atlas Vector Search would scale retrieval for larger datasets.
- Quote checks validate exact contiguous text, not legal clause boundaries. The tool is an aid and does not replace legal review.

## AI tools

Built with OpenAI Codex as an AI coding assistant for scaffolding, implementation, and documentation. Review the code and understand the design choices before the follow-up call.
