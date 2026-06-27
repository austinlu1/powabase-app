"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import AgentsScreen from "@/components/AgentsScreen";
import ChatArea from "@/components/ChatArea";
import MessageInput, { SessionAttachment } from "@/components/MessageInput";
import TokenRefresher from "@/components/TokenRefresher";
import { Conversation, Message, UserAgent } from "@/lib/types";

export default function Home() {
  const router = useRouter();

  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [agents, setAgents] = useState<UserAgent[]>([]);
  const [activeAgent, setActiveAgent] = useState<UserAgent | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [sessionLimitReached, setSessionLimitReached] = useState(false);
  const [loading, setLoading] = useState(true);
  // Session-scoped attachments — extracted text lives here, not in the KB
  const [attachmentData, setAttachmentData] = useState<(SessionAttachment & { extractedText: string; persisted: boolean })[]>([]);
  const sessionAttachments: SessionAttachment[] = attachmentData.map(
    ({ id, name, type, loading, error }) => ({ id, name, type, loading, error })
  );

  // ── Load conversations for a given agent ─────────────────────────────────

  const loadConversations = useCallback(async (agentId: string) => {
    try {
      const res = await fetch(`/api/sessions?agentId=${agentId}`);
      const data = await res.json();
      const sessions: { session_id: string; created_at: string; first_message?: string }[] =
        data.sessions ?? [];

      const convs: Conversation[] = sessions.map((s, i) => {
        const custom = localStorage.getItem(`conv_title_${s.session_id}`);
        return {
          sessionId: s.session_id,
          agentId,
          title: custom ?? s.first_message ?? `Conversation ${sessions.length - i}`,
          createdAt: s.created_at,
        };
      });

      convs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setConversations(convs);
    } catch (e) {
      console.error("Failed to load sessions:", e);
    }
  }, []);

  // ── Load all user agents ──────────────────────────────────────────────────

  const loadAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      const data = await res.json();
      const list: UserAgent[] = data.agents ?? [];
      setAgents(list);
      return list;
    } catch (e) {
      console.error("Failed to load agents:", e);
      return [];
    }
  }, []);

  // ── Bootstrap ─────────────────────────────────────────────────────────────

  const initRan = useRef(false);

  useEffect(() => {
    if (initRan.current) return;
    initRan.current = true;

    async function init() {
      try {
        // Verify auth + create first agent if this is a new user
        const setupRes = await fetch("/api/user/setup");
        if (setupRes.status === 401) { router.replace("/login?reason=session_expired"); return; }
        if (!setupRes.ok) { router.replace("/login"); return; }

        const setupData = await setupRes.json();
        setUser(setupData.user);

        // Load all agents — user chooses from the agents screen
        await loadAgents();
      } catch (e) {
        console.error("Init error:", e);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [loadAgents, router]);

  // ── Switch active agent ───────────────────────────────────────────────────

  async function switchAgent(agent: UserAgent) {
    setActiveAgent(agent);
    setActiveSessionId(null);
    setMessages([]);
    setStreamingContent("");
    setAttachmentData([]);
    setSessionLimitReached(false);
    await loadConversations(agent.id);
  }

  // ── Create new agent ──────────────────────────────────────────────────────

  async function createAgent(name: string, systemPrompt: string): Promise<boolean> {
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, system_prompt: systemPrompt }),
      });
      if (res.status === 401) { router.replace("/login?reason=session_expired"); return false; }
      if (!res.ok) return false;
      const newAgent: UserAgent = await res.json();
      const updated = [...agents, newAgent];
      setAgents(updated);
      await switchAgent(newAgent);
      return true;
    } catch {
      return false;
    }
  }

  // ── Update agent system prompt ────────────────────────────────────────────

  async function updateAgent(agent: UserAgent, newPrompt: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system_prompt: newPrompt }),
      });
      if (res.status === 401) { router.replace("/login?reason=session_expired"); return false; }
      if (!res.ok) return false;
      const updated = await res.json();
      setAgents((prev) =>
        prev.map((a) => a.id === agent.id ? { ...a, system_prompt: updated.system_prompt } : a)
      );
      if (activeAgent?.id === agent.id) {
        setActiveAgent((prev) => prev ? { ...prev, system_prompt: updated.system_prompt } : prev);
      }
      newChat();
      return true;
    } catch {
      return false;
    }
  }

  // ── Delete agent ──────────────────────────────────────────────────────────

  async function deleteAgent(agent: UserAgent) {
    try {
      await fetch(`/api/agents/${agent.id}`, { method: "DELETE" });
      const updated = agents.filter((a) => a.id !== agent.id);
      setAgents(updated);

      if (activeAgent?.id === agent.id) {
        setActiveAgent(null);
        setActiveSessionId(null);
        setConversations([]);
        setMessages([]);
        setAttachmentData([]);
        setSessionLimitReached(false);
      }
    } catch (e) {
      console.error("Delete agent error:", e);
    }
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  // ── Select conversation ───────────────────────────────────────────────────

  async function selectConversation(conv: Conversation) {
    setActiveSessionId(conv.sessionId);
    setMessages([]);
    setStreamingContent("");
    setAttachmentData([]);
    setSessionLimitReached(false);

    // Restore session attachments from DB
    try {
      const res = await fetch(`/api/session-sources?sessionId=${conv.sessionId}`);
      if (res.ok) {
        const data = await res.json();
        const rows: { id: string; name: string; type: string; extracted_text: string }[] = data.sources ?? [];
        setAttachmentData(rows.map((r) => ({
          id: r.id,
          name: r.name,
          type: r.type as "file" | "url",
          extractedText: r.extracted_text,
          loading: false,
          persisted: true,
        })));
      }
    } catch { /* silently fail */ }

    try {
      const res = await fetch(`/api/sessions/runs?sessionId=${conv.sessionId}`);
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
          // Strip injected context block (everything before the final "---\n\n" separator)
          const raw = userMsg.content ?? "";
          const sep = "\n\n---\n\n";
          const lastSep = raw.lastIndexOf(sep);
          const displayContent = lastSep !== -1 ? raw.slice(lastSep + sep.length) : raw;
          msgs.push({ role: "user", content: displayContent });
        }
        if (assistantMsg) msgs.push({ role: "assistant", content: assistantMsg.content });
      }
      setMessages(msgs);
    } catch (e) {
      console.error("Failed to load runs:", e);
    }
  }

  // ── New chat ──────────────────────────────────────────────────────────────

  function newChat() {
    setActiveSessionId(null);
    setMessages([]);
    setStreamingContent("");
    setAttachmentData([]);
    setSessionLimitReached(false);
  }

  // ── Back to agents screen ─────────────────────────────────────────────────

  function backToAgents() {
    setActiveAgent(null);
    setActiveSessionId(null);
    setMessages([]);
    setStreamingContent("");
    setAttachmentData([]);
    setSessionLimitReached(false);
    setConversations([]);
  }

  // ── Rename conversation ───────────────────────────────────────────────────

  function renameConversation(conv: Conversation, newTitle: string) {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    localStorage.setItem(`conv_title_${conv.sessionId}`, trimmed);
    setConversations((prev) =>
      prev.map((c) => c.sessionId === conv.sessionId ? { ...c, title: trimmed } : c)
    );
  }

  // ── Delete conversation ───────────────────────────────────────────────────

  async function deleteConversation(conv: Conversation) {
    try {
      await fetch(`/api/sessions?sessionId=${conv.sessionId}`, { method: "DELETE" });
      localStorage.removeItem(`conv_title_${conv.sessionId}`);
      setConversations((prev) => prev.filter((c) => c.sessionId !== conv.sessionId));
      if (activeSessionId === conv.sessionId) newChat();
    } catch (e) {
      console.error("Delete error:", e);
    }
  }

  // ── Session attachments ───────────────────────────────────────────────────

  async function persistAttachment(sessionId: string, a: SessionAttachment & { extractedText: string }) {
    try {
      await fetch("/api/session-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          source_id: a.id,
          name: a.name,
          type: a.type,
          extracted_text: a.extractedText,
        }),
      });
    } catch { /* best effort */ }
  }

  async function attachFile(file: File) {
    const tempId = crypto.randomUUID();
    setAttachmentData((prev) => [...prev, { id: tempId, name: file.name, type: "file", extractedText: "", loading: true, persisted: false }]);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/session-sources/attach-file", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.message ?? data.error ?? "Attach failed";
        setAttachmentData((prev) => prev.map((a) =>
          a.id === tempId ? { ...a, loading: false, error: errMsg } : a
        ));
        return;
      }
      setAttachmentData((prev) => prev.map((a) =>
        a.id === tempId ? { ...a, id: data.id, extractedText: data.extractedText, loading: false } : a
      ));
      // Persist immediately if we already have a session
      if (activeSessionId) {
        await persistAttachment(activeSessionId, { ...data, persisted: false });
        setAttachmentData((prev) => prev.map((a) => a.id === data.id ? { ...a, persisted: true } : a));
      }
    } catch (e: unknown) {
      setAttachmentData((prev) => prev.map((a) =>
        a.id === tempId ? { ...a, loading: false, error: String(e) } : a
      ));
    }
  }

  async function attachUrl(url: string) {
    const tempId = crypto.randomUUID();
    setAttachmentData((prev) => [...prev, { id: tempId, name: url, type: "url", extractedText: "", loading: true, persisted: false }]);
    try {
      const res = await fetch("/api/session-sources/attach-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Attach failed");
      setAttachmentData((prev) => prev.map((a) =>
        a.id === tempId ? { ...a, id: data.id, extractedText: data.extractedText, loading: false } : a
      ));
      if (activeSessionId) {
        await persistAttachment(activeSessionId, { ...data, persisted: false });
        setAttachmentData((prev) => prev.map((a) => a.id === data.id ? { ...a, persisted: true } : a));
      }
    } catch {
      setAttachmentData((prev) => prev.filter((a) => a.id !== tempId));
    }
  }

  async function removeAttachment(id: string) {
    setAttachmentData((prev) => prev.filter((a) => a.id !== id));
    if (activeSessionId) {
      try { await fetch(`/api/session-sources/${id}`, { method: "DELETE" }); } catch { /* best effort */ }
    }
  }

  // ── Send message ──────────────────────────────────────────────────────────

  async function sendMessage(text: string) {
    if (!activeAgent || streaming) return;

    // Build message with session context injected
    const readyAttachments = attachmentData.filter((a) => !a.loading && !a.error && a.extractedText);
    const contextBlock = readyAttachments.length > 0
      ? readyAttachments.map((a) =>
          `[Context: ${a.type === "url" ? "Website" : "File"} — ${a.name}]\n${a.extractedText}`
        ).join("\n\n---\n\n") + "\n\n---\n\n"
      : "";
    const messageWithContext = contextBlock + text;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setStreaming(true);
    setStreamingContent("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: activeAgent.id,
          message: messageWithContext,
          sessionId: activeSessionId ?? undefined,
        }),
      });

      if (res.status === 401) { router.replace("/login?reason=session_expired"); return; }
      if (res.status === 429) {
        setSessionLimitReached(true);
        // Remove the user message we optimistically appended — it was never processed
        setMessages((prev) => prev.slice(0, -1));
        return;
      }
      if (!res.ok || !res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let newSessionId = activeSessionId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === "[DONE]") continue;

          try {
            const event = JSON.parse(raw);

            // session_id is in the "start" and "complete" events
            if (event.session_id && !newSessionId) {
              newSessionId = event.session_id;
              // Persist any unpersisted attachments now that we have a session ID
              const unpersisted = attachmentData.filter((a) => !a.persisted && !a.loading && !a.error && a.extractedText);
              for (const a of unpersisted) {
                persistAttachment(newSessionId!, a);
              }
              setAttachmentData((prev) => prev.map((a) => ({ ...a, persisted: true })));
            }

            // "content_delta" events carry real-time streaming tokens
            if (event.event === "content_delta" && event.delta) {
              fullContent += event.delta;
              setStreamingContent(fullContent);
            }
          } catch {
            // non-JSON line — skip
          }
        }
      }

      setMessages((prev) => [...prev, { role: "assistant", content: fullContent }]);

      if (newSessionId && newSessionId !== activeSessionId) {
        setActiveSessionId(newSessionId);
        const newConv: Conversation = {
          sessionId: newSessionId,
          agentId: activeAgent.id,
          title: text.slice(0, 40) + (text.length > 40 ? "…" : ""),
          createdAt: new Date().toISOString(),
        };
        setConversations((prev) => [newConv, ...prev]);
      }
    } catch (e) {
      console.error("Chat error:", e);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setStreaming(false);
      setStreamingContent("");
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0d1117] text-white/50 text-sm">
        Connecting to Powabase…
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0d1117] text-white overflow-hidden">
      <TokenRefresher />

      <Sidebar
        activeAgent={activeAgent}
        conversations={conversations}
        activeSessionId={activeSessionId}
        user={user}
        onNewChat={newChat}
        onSelectConversation={selectConversation}
        onDeleteConversation={deleteConversation}
        onRenameConversation={renameConversation}
        onBackToAgents={backToAgents}
        onLogout={logout}
      />

      <main className="flex flex-col flex-1 overflow-hidden">
        {!activeAgent ? (
          <AgentsScreen
            agents={agents}
            onSelectAgent={switchAgent}
            onCreateAgent={createAgent}
            onUpdateAgent={updateAgent}
            onDeleteAgent={deleteAgent}
          />
        ) : (
          <>
            <ChatArea
              messages={messages}
              streaming={streaming}
              streamingContent={streamingContent}
            />
            <MessageInput
              onSend={sendMessage}
              disabled={streaming}
              placeholder={`Message ${activeAgent.name}…`}
              attachments={sessionAttachments}
              onAttachFile={attachFile}
              onAttachUrl={attachUrl}
              onRemoveAttachment={removeAttachment}
              limitReached={sessionLimitReached}
            />
          </>
        )}
      </main>
    </div>
  );
}
