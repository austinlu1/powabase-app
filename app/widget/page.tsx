"use client";

import { useState, useEffect, useRef, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Attachment {
  id: string;
  name: string;
  type: "file" | "url";
  extractedText: string;
  loading?: boolean;
  error?: string;
}

interface SessionMeta {
  sessionId: string;
  title: string;
  createdAt: string;
}

// ── localStorage helpers ──────────────────────────────────────────────────────

const SESSIONS_KEY = (agentId: string) => `widget_sessions_${agentId}`;
const TITLE_KEY = (sessionId: string) => `widget_title_${sessionId}`;

function loadSessions(agentId: string): SessionMeta[] {
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY(agentId)) ?? "[]");
  } catch { return []; }
}

function saveSessions(agentId: string, sessions: SessionMeta[]) {
  localStorage.setItem(SESSIONS_KEY(agentId), JSON.stringify(sessions));
}

function getTitle(s: SessionMeta): string {
  return localStorage.getItem(TITLE_KEY(s.sessionId)) ?? s.title;
}

// ── Highlighted text ──────────────────────────────────────────────────────────

function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-amber-400/40 text-white rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────

function WidgetChat() {
  const searchParams = useSearchParams();
  const agentId = searchParams.get("agentId") ?? "";

  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Attachments
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [urlMode, setUrlMode] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [attaching, setAttaching] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Load sessions list on mount
  useEffect(() => {
    if (!agentId) return;
    const stored = loadSessions(agentId);
    setSessions(stored);
  }, [agentId]);

  // Fetch history for a session
  const loadHistory = useCallback(async (sessionId: string) => {
    setLoadingHistory(true);
    setMessages([]);
    try {
      const res = await fetch(`/api/sessions/runs?sessionId=${sessionId}`);
      if (!res.ok) return;
      const data = await res.json();
      const runs: {
        input_messages: { role: string; content: string }[];
        output_messages: { role: string; content: string }[];
      }[] = data.runs ?? [];

      const msgs: Message[] = [];
      for (const run of runs) {
        const userMsg = run.input_messages?.find((m) => m.role === "user");
        const assistantMsg = run.output_messages?.find((m) => m.role === "assistant");
        if (userMsg) {
          const raw = userMsg.content ?? "";
          const sep = "\n\n---\n\n";
          const lastSep = raw.lastIndexOf(sep);
          msgs.push({ role: "user", content: lastSep !== -1 ? raw.slice(lastSep + sep.length) : raw });
        }
        if (assistantMsg) msgs.push({ role: "assistant", content: assistantMsg.content });
      }
      setMessages(msgs);
    } catch { /* silently fail */ } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Close popover on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
        setUrlMode(false);
        setUrlInput("");
      }
    }
    if (popoverOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [popoverOpen]);

  // Focus rename input when it opens
  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  function selectSession(s: SessionMeta) {
    setActiveSessionId(s.sessionId);
    setAttachments([]);
    setSidebarOpen(false);
    loadHistory(s.sessionId);
  }

  function newSession() {
    setActiveSessionId(null);
    setMessages([]);
    setStreamingContent("");
    setAttachments([]);
    setSidebarOpen(false);
  }

  function startRename(s: SessionMeta) {
    setRenamingId(s.sessionId);
    setRenameValue(getTitle(s));
  }

  function commitRename(sessionId: string) {
    const trimmed = renameValue.trim();
    if (trimmed) {
      localStorage.setItem(TITLE_KEY(sessionId), trimmed);
      setSessions((prev) => prev.map((s) => s.sessionId === sessionId ? { ...s, title: trimmed } : s));
    }
    setRenamingId(null);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setPopoverOpen(false);
    setAttaching(true);
    const tempId = crypto.randomUUID();
    setAttachments((prev) => [...prev, { id: tempId, name: file.name, type: "file", extractedText: "", loading: true }]);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/widget/attach-file", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setAttachments((prev) => prev.map((a) => a.id === tempId ? { ...a, loading: false, error: data.message ?? data.error ?? "Attach failed" } : a));
      } else {
        setAttachments((prev) => prev.map((a) => a.id === tempId ? { ...a, id: data.id, extractedText: data.extractedText, loading: false } : a));
      }
    } catch (e: unknown) {
      setAttachments((prev) => prev.map((a) => a.id === tempId ? { ...a, loading: false, error: String(e) } : a));
    } finally {
      setAttaching(false);
    }
  }

  async function handleUrlImport() {
    const url = urlInput.trim();
    if (!url) return;
    setUrlMode(false);
    setPopoverOpen(false);
    setUrlInput("");
    setAttaching(true);
    const tempId = crypto.randomUUID();
    setAttachments((prev) => [...prev, { id: tempId, name: url, type: "url", extractedText: "", loading: true }]);
    try {
      const res = await fetch("/api/widget/attach-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAttachments((prev) => prev.map((a) => a.id === tempId ? { ...a, loading: false, error: data.error ?? "Import failed" } : a));
      } else {
        setAttachments((prev) => prev.map((a) => a.id === tempId ? { ...a, id: data.id, extractedText: data.extractedText, loading: false } : a));
      }
    } catch (e: unknown) {
      setAttachments((prev) => prev.filter((a) => a.id !== tempId));
      console.error(e);
    } finally {
      setAttaching(false);
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  async function send() {
    const text = input.trim();
    if (!text || streaming || !agentId) return;

    const ready = attachments.filter((a) => !a.loading && !a.error && a.extractedText);
    const contextBlock = ready.length > 0
      ? ready.map((a) => `[Context: ${a.type === "url" ? "Website" : "File"} — ${a.name}]\n${a.extractedText}`).join("\n\n---\n\n") + "\n\n---\n\n"
      : "";
    const messageWithContext = contextBlock + text;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setStreaming(true);
    setStreamingContent("");

    try {
      const res = await fetch("/api/widget/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, message: messageWithContext, sessionId: activeSessionId }),
      });

      if (!res.ok || !res.body) throw new Error("Failed to connect");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let newSessionId = activeSessionId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === "[DONE]") continue;
          try {
            const event = JSON.parse(raw);
            if (event.session_id && !newSessionId) {
              newSessionId = event.session_id;
              setActiveSessionId(newSessionId);
              // Add to sessions list
              const newMeta: SessionMeta = {
                sessionId: newSessionId!,
                title: text.slice(0, 40) + (text.length > 40 ? "…" : ""),
                createdAt: new Date().toISOString(),
              };
              setSessions((prev) => {
                const updated = [newMeta, ...prev];
                saveSessions(agentId, updated);
                return updated;
              });
            }
            if (event.event === "content_delta" && event.delta) {
              fullContent += event.delta;
              setStreamingContent(fullContent);
            }
          } catch { /* skip */ }
        }
      }

      setMessages((prev) => [...prev, { role: "assistant", content: fullContent }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Please try again." }]);
    } finally {
      setStreaming(false);
      setStreamingContent("");
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  if (!agentId) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0d1117] text-white/40 text-sm">
        No agent configured.
      </div>
    );
  }

  const filteredSessions = sessions.filter((s) =>
    getTitle(s).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen bg-[#0d1117] text-white overflow-hidden relative">

      {/* ── Sidebar ── */}
      {/* Backdrop */}
      {sidebarOpen && (
        <div
          className="absolute inset-0 z-20 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Panel */}
      <div className={`absolute top-0 left-0 h-full w-60 bg-[#111827] border-r border-white/10 z-30 flex flex-col transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {/* Sidebar header */}
        <div className="shrink-0 px-3 pt-3 pb-2 border-b border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Conversations</p>
            <button
              onClick={newSession}
              title="New session"
              className="text-white/30 hover:text-white/70 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-6 pr-2 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto py-1">
          {filteredSessions.length === 0 && (
            <p className="text-xs text-white/25 text-center mt-6 px-3">
              {sessions.length === 0 ? "No conversations yet." : "No results."}
            </p>
          )}
          {filteredSessions.map((s) => {
            const title = getTitle(s);
            const isActive = s.sessionId === activeSessionId;
            const isRenaming = renamingId === s.sessionId;
            return (
              <div
                key={s.sessionId}
                className={`group flex items-center gap-1.5 px-3 py-2 cursor-pointer transition-colors ${isActive ? "bg-white/10" : "hover:bg-white/5"}`}
                onClick={() => !isRenaming && selectSession(s)}
              >
                {isRenaming ? (
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(s.sessionId);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    onBlur={() => commitRename(s.sessionId)}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 min-w-0 bg-white/10 border border-blue-500 rounded px-1.5 py-0.5 text-xs text-white outline-none"
                  />
                ) : (
                  <span className="flex-1 min-w-0 text-xs text-white/70 truncate">
                    <Highlighted text={title} query={search} />
                  </span>
                )}
                {!isRenaming && (
                  <button
                    onClick={(e) => { e.stopPropagation(); startRename(s); }}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-white/30 hover:text-white/70 transition-all"
                    title="Rename"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Header ── */}
      <div className="shrink-0 px-4 py-3 border-b border-white/10 bg-[#111827] flex items-center justify-between">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          title="Conversations"
          className="text-white/40 hover:text-white/70 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <p className="text-sm font-semibold text-white">Chat</p>
        <button
          onClick={newSession}
          disabled={streaming}
          title="New session"
          className="text-white/40 hover:text-white/70 disabled:opacity-30 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/>
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
          </svg>
        </button>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loadingHistory && (
          <p className="text-xs text-white/30 text-center">Loading history…</p>
        )}
        {!loadingHistory && messages.length === 0 && !streaming && (
          <p className="text-xs text-white/30 text-center mt-8">Send a message to get started.</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
              msg.role === "user"
                ? "bg-blue-600 text-white rounded-br-sm whitespace-pre-wrap"
                : "bg-white/10 text-white/90 rounded-bl-sm"
            }`}>
              {msg.role === "user" ? msg.content : (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
        {streaming && streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm leading-relaxed bg-white/10 text-white/90">
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{streamingContent}</ReactMarkdown>
              </div>
              <span className="inline-block w-1.5 h-3.5 bg-white/50 ml-0.5 animate-pulse rounded-sm" />
            </div>
          </div>
        )}
        {streaming && !streamingContent && (
          <div className="flex justify-start">
            <div className="bg-white/10 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
              {[0, 1, 2].map((i) => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div className="shrink-0 px-4 py-3 border-t border-white/10 bg-[#111827] space-y-2">

        {/* Attachment chips */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {attachments.map((a) => (
              <div
                key={a.id}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${
                  a.error ? "bg-red-600/20 border-red-500/30 text-red-300" : "bg-blue-600/20 border-blue-500/30 text-blue-300"
                }`}
              >
                {a.loading ? (
                  <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                ) : a.error ? (
                  <span className="font-bold text-red-400">!</span>
                ) : a.type === "url" ? (
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                ) : (
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                )}
                <span className="max-w-[140px] truncate" title={a.error ?? a.name}>
                  {a.error ? `${a.name} — ${a.error}` : a.name}
                </span>
                {!a.loading && (
                  <button onClick={() => removeAttachment(a.id)} className="text-blue-400/60 hover:text-blue-300 transition-colors ml-0.5">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Input row */}
        <div className="flex items-end gap-2">

          {/* + button */}
          <div className="relative shrink-0" ref={popoverRef}>
            <button
              onClick={() => { setPopoverOpen(!popoverOpen); setUrlMode(false); setUrlInput(""); }}
              disabled={attaching}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors disabled:opacity-40"
              title="Attach file or URL"
            >
              {attaching ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              )}
            </button>

            {popoverOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#1f2937] border border-white/10 rounded-xl shadow-xl overflow-hidden z-10">
                {!urlMode ? (
                  <>
                    <p className="px-3 pt-2.5 pb-1 text-xs text-white/30 font-medium uppercase tracking-wider">Add context</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                      </svg>
                      Upload File
                    </button>
                    <button
                      onClick={() => setUrlMode(true)}
                      className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                      </svg>
                      Import URL
                    </button>
                  </>
                ) : (
                  <div className="p-3 space-y-2">
                    <p className="text-xs text-white/40">Paste a URL</p>
                    <input
                      autoFocus
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleUrlImport(); }}
                      placeholder="https://example.com"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-blue-500"
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => { setUrlMode(false); setUrlInput(""); }}
                        className="flex-1 py-1.5 rounded-lg text-xs text-white/40 hover:bg-white/5 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleUrlImport}
                        disabled={!urlInput.trim()}
                        className="flex-1 py-1.5 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-colors"
                      >
                        Import
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept=".pdf,.docx,.doc,.txt,.md,.csv,.pptx,.xlsx,.png,.jpg,.jpeg"
            />
          </div>

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            rows={1}
            disabled={streaming}
            className="flex-1 resize-none bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-blue-500 disabled:opacity-50 max-h-32 overflow-y-auto"
            style={{ lineHeight: "1.5" }}
          />
          <button
            onClick={send}
            disabled={streaming || !input.trim()}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4 text-white rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-white/20 text-center">Powered by Powabase</p>
      </div>
    </div>
  );
}

export default function WidgetPage() {
  return (
    <Suspense>
      <WidgetChat />
    </Suspense>
  );
}
