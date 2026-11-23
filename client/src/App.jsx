import { useCallback, useEffect, useRef, useState } from "react";
import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
  useUser,
} from "@clerk/react";
import {
  ArrowLeft,
  ArrowUpRight,
  AlertCircle,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  LoaderCircle,
  MessageCircle,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const items = [
  "Parties",
  "Start date and term",
  "Payment terms",
  "Termination",
  "Limitation of liability",
  "Confidentiality",
  "Governing law",
  "Auto-renewal",
];
const sizeLabel = (n) =>
  n < 1024 * 1024
    ? `${Math.max(1, Math.round(n / 1024))} KB`
    : `${(n / 1024 / 1024).toFixed(1)} MB`;
const slug = (s) => s.replaceAll(" ", "-");

function Landing() {
  return (
    <main className="landing">
      <nav className="topnav">
        <a className="brand" href="#">
          <span className="brand-icon">
            <BookOpen size={20} />
          </span>{" "}
          clausewise
        </a>
        <div className="nav-buttons">
          <SignInButton mode="modal">
            <button className="text-button">
              Sign in <ArrowUpRight size={15} />
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="button primary small">Create account</button>
          </SignUpButton>
        </div>
      </nav>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="dot" /> CONTRACT INTELLIGENCE, MADE CLEAR
          </div>
          <h1>
            Know what
            <br />
            you’re <em>signing.</em>
          </h1>
          <p className="lead">
            A calmer way to review contracts. Find the terms that matter, see
            the exact language, and ask questions grounded in the document.
          </p>
          <SignUpButton mode="modal">
            <button className="button primary">
              Review a contract <ArrowUpRight size={16} />
            </button>
          </SignUpButton>
          <div className="trust">
            <ShieldCheck size={16} /> Private by design <span /> Every answer
            cites the contract
          </div>
        </div>
        <div className="hero-art">
          <div className="art-circle circle-a" />
          <div className="art-circle circle-b" />
          <div className="doc-card">
            <div className="doc-head">
              <span className="doc-stamp">
                <FileText size={15} />
              </span>
              <div>
                <b>Service Agreement</b>
                <small>REVIEW COMPLETE · 8 CHECKS</small>
              </div>
              <span className="mini-check">✓</span>
            </div>
            <div className="doc-rule" />
            <div className="sample-finding found">
              <div>
                <b>Payment terms</b>
                <span className="pill found">FOUND</span>
              </div>
              <p>Invoices due within 30 days of receipt.</p>
              <small>§ 4.1 · “Customer shall pay each invoice…”</small>
            </div>
            <div className="sample-finding missing">
              <div>
                <b>Auto-renewal</b>
                <span className="pill not-found">NOT FOUND</span>
              </div>
              <p>No auto-renewal clause in the contract.</p>
            </div>
            <div className="doc-footer">✦ &nbsp;Grounded in your document</div>
          </div>
          <div className="floating-note">
            “Show me where the liability cap is.” <span>↗</span>
          </div>
        </div>
      </section>
      <section className="features">
        <div>
          <span>01</span>
          <b>Every clause, accounted for</b>
          <small>Eight essential terms, checked consistently.</small>
        </div>
        <div>
          <span>02</span>
          <b>Evidence you can verify</b>
          <small>Open the exact words and find their location.</small>
        </div>
        <div>
          <span>03</span>
          <b>Answers without guesswork</b>
          <small>Ask follow-ups. If it’s missing, we’ll say so.</small>
        </div>
      </section>
      <footer>
        CLAUSEWISE <span>© 2026 · Built for clarity</span>
      </footer>
    </main>
  );
}
function Dashboard() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [contracts, setContracts] = useState([]),
    [detail, setDetail] = useState(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [search, setSearch] = useState(""),
    [question, setQuestion] = useState(""),
    [expanded, setExpanded] = useState(""),
    [sending, setSending] = useState(false);
  const input = useRef(null),
    end = useRef(null);
  const request = useCallback(
    async (path, init = {}) => {
      const token = await getToken();
      return fetch(`${API}${path}`, {
        ...init,
        headers: {
          ...(init.body instanceof FormData
            ? {}
            : { "Content-Type": "application/json" }),
          ...(init.headers || {}),
          Authorization: `Bearer ${token}`,
        },
      });
    },
    [getToken],
  );
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await request("/api/contracts");
      if (r.ok) setContracts(await r.json());
      else setNotice("Could not load contracts.");
    } catch {
      setNotice(
        "Could not connect to the API. Check that the backend is running.",
      );
    } finally {
      setLoading(false);
    }
  }, [request]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.messages.length, sending]);
  const open = async (id) => {
    setNotice("");
    try {
      const r = await request(`/api/contracts/${id}`);
      if (!r.ok) throw new Error("Could not open this contract.");
      setDetail(await r.json());
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not open contract.");
    }
  };
  const remove = async (id) => {
    if (!window.confirm("Delete this contract and its review?")) return;
    try {
      const r = await request(`/api/contracts/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Could not delete this contract.");
      if (detail?._id === id) setDetail(null);
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not delete contract.");
    }
  };
  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    setNotice("");
    const form = new FormData();
    form.append("file", file);
    try {
      const r = await request("/api/contracts", { method: "POST", body: form });
      const data = await r.json();
      if (!r.ok) {
        await load();
        throw new Error(data.error || "Upload failed.");
      }
      await load();
      await open(data.id);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  const ask = async (e) => {
    e.preventDefault();
    if (!detail || !question.trim() || sending) return;
    const prompt = question.trim();
    setQuestion("");
    setSending(true);
    setNotice("");
    const userMessage = {
      _id: `user-${Date.now()}`,
      role: "user",
      content: prompt,
      quote: "",
      locator: "",
    };
    setDetail((d) =>
      d ? { ...d, messages: [...d.messages, userMessage] } : d,
    );
    try {
      const r = await request(`/api/contracts/${detail._id}/chat`, {
        method: "POST",
        body: JSON.stringify({ question: prompt }),
      });
      if (!r.ok) {
        const data = await r.json();
        throw new Error(data.error || "Chat request failed.");
      }
      const reader = r.body.getReader(),
        decoder = new TextDecoder();
      let answer = "",
        pending = "";
      const answerId = `assistant-${Date.now()}`;
      setDetail((d) =>
        d
          ? {
              ...d,
              messages: [
                ...d.messages,
                {
                  _id: answerId,
                  role: "assistant",
                  content: "",
                  quote: "",
                  locator: "",
                },
              ],
            }
          : d,
      );
      const consume = (line) => {
        if (!line.startsWith("data: ") || line === "data: [DONE]") return;
        try {
          answer +=
            JSON.parse(line.slice(6)).choices?.[0]?.delta?.content || "";
          setDetail((d) =>
            d
              ? {
                  ...d,
                  messages: d.messages.map((m) =>
                    m._id === answerId ? { ...m, content: answer } : m,
                  ),
                }
              : d,
          );
        } catch {}
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        const lines = pending.split("\n");
        pending = lines.pop() || "";
        lines.forEach(consume);
      }
      pending += decoder.decode();
      if (pending) consume(pending);
      await open(detail._id);
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "Could not answer that question.",
      );
    } finally {
      setSending(false);
    }
  };
  const filtered = contracts.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase()),
    ),
    name = user?.firstName || user?.username || "there";
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#">
          <span className="brand-icon">
            <BookOpen size={19} />
          </span>{" "}
          clausewise
        </a>
        <div className="side-section">WORKSPACE</div>
        <button
          className={`side-link ${!detail ? "active" : ""}`}
          onClick={() => setDetail(null)}
        >
          <FileText size={16} /> My contracts{" "}
          <span className="side-count">{contracts.length}</span>
        </button>
        <div className="sidebar-bottom">
          <div className="privacy-note">
            <ShieldCheck size={17} />
            <div>
              <b>Your documents stay yours</b>
              <small>Private to your account</small>
            </div>
          </div>
          <div className="user-row">
            <UserButton />
            <div>
              <b>{name}</b>
              <small>Personal workspace</small>
            </div>
          </div>
        </div>
      </aside>
      <section className="main-area">
        {detail ? (
          <>
            <header className="dash-header detail-header">
              <button className="back-button" onClick={() => setDetail(null)}>
                <ArrowLeft size={16} />
              </button>
              <div className="crumb">
                My contracts <ChevronRight size={13} /> <b>{detail.name}</b>
              </div>
              <div className="header-actions">
                <span className={`status ${detail.status}`}>
                  <i /> {detail.status}
                </span>
                <button
                  className="icon-button danger"
                  onClick={() => remove(detail._id)}
                  title="Delete contract"
                >
                  <Trash2 size={17} />
                </button>
                <UserButton />
              </div>
            </header>
            <div className="detail-wrap">
              <div className="detail-title">
                <div>
                  <div className="eyebrow">CONTRACT REVIEW</div>
                  <h1>{detail.name}</h1>
                  <p>
                    {sizeLabel(detail.size)} <span>·</span> Added{" "}
                    {new Date(detail.createdAt).toLocaleDateString(undefined, {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <span className={`status ${detail.status}`}>
                  <i /> {detail.status}
                </span>
              </div>
              {detail.status === "processing" ? (
                <div className="empty-state">
                  <LoaderCircle className="spin" /> Review is processing…
                </div>
              ) : detail.status === "failed" ? (
                <div className="notice error">
                  <AlertCircle size={16} />
                  {notice ||
                    "This contract could not be reviewed. Check your AI configuration and retry."}
                </div>
              ) : (
                <div className="review-layout">
                  <div className="review-column">
                    <div className="section-heading">
                      <div>
                        <h2>Review checklist</h2>
                        <p>Eight key terms, grounded in your contract</p>
                      </div>
                      <span className="count-chip">
                        {
                          detail.findings.filter((f) => f.status === "found")
                            .length
                        }{" "}
                        / 8 found
                      </span>
                    </div>
                    <div className="finding-list">
                      {items.map((item) => {
                        const f = detail.findings.find((x) => x.item === item),
                          status = f?.status || "not found",
                          isOpen = expanded === item;
                        return (
                          <article
                            key={item}
                            className={`result-card ${slug(status)}`}
                          >
                            <button
                              className="result-main"
                              onClick={() =>
                                f?.quote && setExpanded(isOpen ? "" : item)
                              }
                            >
                              <span className={`result-icon ${slug(status)}`}>
                                {status === "found" ? (
                                  <Check size={15} />
                                ) : status === "unclear" ? (
                                  <AlertCircle size={15} />
                                ) : (
                                  <X size={15} />
                                )}
                              </span>
                              <span className="result-content">
                                <span className="result-label">
                                  {item}
                                  <span className={`pill ${slug(status)}`}>
                                    {status === "found"
                                      ? "FOUND"
                                      : status === "unclear"
                                        ? "UNCLEAR"
                                        : "NOT FOUND"}
                                  </span>
                                </span>
                                <span className="result-summary">
                                  {f?.summary || "Not found in the contract"}
                                </span>
                                {f?.quote && (
                                  <>
                                    <span className="quote-line">
                                      “{f.quote}”
                                    </span>
                                    <span className="locator">
                                      {f.locator || "Contract text"}
                                    </span>
                                  </>
                                )}
                              </span>
                              <ChevronRight
                                className={`result-chevron ${isOpen ? "open" : ""}`}
                                size={17}
                              />
                            </button>
                            {isOpen && (
                              <div className="full-clause">
                                <b>Full clause</b>
                                <p>{f?.fullClause || f?.quote}</p>
                                <span>
                                  <FileText size={13} />
                                  {f?.locator}
                                </span>
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </div>
                  <aside className="chat-card">
                    <div className="chat-head">
                      <span className="chat-icon">
                        <MessageCircle size={17} />
                      </span>
                      <div>
                        <b>Ask about this contract</b>
                        <small>Answers cite the document</small>
                      </div>
                    </div>
                    <div className="chat-messages">
                      {detail.messages.length === 0 && !sending && (
                        <div className="chat-empty">
                          <span>✦</span>
                          <b>What would you like to know?</b>
                          <p>
                            Ask about a clause, date, obligation, or anything
                            else in the contract.
                          </p>
                          <button
                            onClick={() =>
                              setQuestion("What are the payment terms?")
                            }
                          >
                            What are the payment terms?
                          </button>
                          <button
                            onClick={() =>
                              setQuestion("Is there a liability cap?")
                            }
                          >
                            Is there a liability cap?
                          </button>
                        </div>
                      )}
                      {detail.messages.map((m) => (
                        <div key={m._id} className={`chat-message ${m.role}`}>
                          <div>
                            {m.content}
                            {m.role === "assistant" && m.quote && (
                              <div className="chat-citation">
                                “{m.quote}”<small>{m.locator}</small>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {sending && (
                        <div className="typing">
                          <i />
                          <i />
                          <i />
                        </div>
                      )}
                      <div ref={end} />
                    </div>
                    <form className="chat-form" onSubmit={ask}>
                      <input
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="Ask a question…"
                        maxLength={1000}
                      />
                      <button
                        disabled={!question.trim() || sending}
                        aria-label="Send question"
                      >
                        {sending ? (
                          <LoaderCircle size={17} className="spin" />
                        ) : (
                          <Send size={17} />
                        )}
                      </button>
                    </form>
                    <small className="chat-foot">
                      Answers are based only on this contract
                    </small>
                  </aside>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <header className="dash-header">
              <div className="welcome">
                <div className="eyebrow">YOUR WORKSPACE</div>
                <h1>
                  Good day, {name} <span>✳</span>
                </h1>
                <p>Your contracts, reviewed with care.</p>
              </div>
              <div className="header-actions">
                <button
                  className="button primary upload-top"
                  onClick={() => input.current?.click()}
                >
                  <Plus size={17} /> Upload contract
                </button>
                <UserButton />
              </div>
            </header>
            <div className="list-wrap">
              {notice && (
                <div className="notice error">
                  <AlertCircle size={16} />
                  {notice}
                  <button onClick={() => setNotice("")}>
                    <X size={15} />
                  </button>
                </div>
              )}
              <div className="list-toolbar">
                <div>
                  <h2>
                    Your contracts <span>{contracts.length}</span>
                  </h2>
                  <p>Review status and details for each document</p>
                </div>
                <label className="search-box">
                  <Search size={16} />
                  <input
                    placeholder="Search contracts"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
              </div>
              {loading ? (
                <div className="loading-state">
                  <LoaderCircle className="spin" /> Loading contracts…
                </div>
              ) : filtered.length === 0 ? (
                contracts.length === 0 ? (
                  <div className="upload-empty">
                    <div className="upload-illustration">
                      <UploadCloud size={27} />
                    </div>
                    <h3>Start with a contract</h3>
                    <p>
                      Upload a PDF, DOCX, or TXT file. We’ll check eight key
                      terms and show you the exact clauses.
                    </p>
                    <button
                      className="button primary"
                      onClick={() => input.current?.click()}
                    >
                      <Plus size={16} /> Upload your first contract
                    </button>
                    <small>Up to 20 MB · Your files stay private</small>
                  </div>
                ) : (
                  <div className="no-results">
                    No contracts match “{search}”.
                  </div>
                )
              ) : (
                <div className="contract-table">
                  <div className="table-head">
                    <span>CONTRACT</span>
                    <span>SIZE</span>
                    <span>UPLOADED</span>
                    <span>STATUS</span>
                    <span />
                  </div>
                  {filtered.map((c) => (
                    <div className="contract-row" key={c._id}>
                      <button
                        className="contract-name"
                        onClick={() => open(c._id)}
                      >
                        <span className="file-icon">
                          <FileText size={17} />
                        </span>
                        <span>
                          <b>{c.name}</b>
                          <small>Contract document</small>
                        </span>
                      </button>
                      <span className="table-size">{sizeLabel(c.size)}</span>
                      <span className="table-date">
                        <Clock3 size={14} />
                        {new Date(c.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span className={`status ${c.status}`}>
                        <i />
                        {c.status}
                      </span>
                      <div className="row-actions">
                        <button
                          className="icon-button danger"
                          title="Delete"
                          onClick={() => remove(c._id)}
                        >
                          <Trash2 size={16} />
                        </button>
                        <button
                          className="open-link"
                          onClick={() => open(c._id)}
                        >
                          <ChevronRight size={17} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>
      <input
        ref={input}
        type="file"
        accept=".pdf,.docx,.txt,application/pdf,text/plain"
        hidden
        onChange={(e) => upload(e.target.files?.[0])}
      />
      {busy && (
        <div className="busy-overlay">
          <div className="busy-dialog">
            <span className="busy-spinner">
              <LoaderCircle size={27} />
            </span>
            <b>Reading your contract</b>
            <p>
              Extracting clauses and checking the review checklist. This may
              take a moment.
            </p>
            <div className="progress-track">
              <i />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
export default function App() {
  return (
    <>
      <Show when="signed-out">
        <Landing />
      </Show>
      <Show when="signed-in">
        <Dashboard />
      </Show>
    </>
  );
}
