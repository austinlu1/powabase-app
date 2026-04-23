"use client";

/**
 * Main page — the full ChatGPT-like shell.
 *
 * How it works:
 * 1. On load, GET /api/agents to find (or create) the default agent in Powabase.
 * 2. Each "New Chat" starts fresh — session is auto-created by Powabase on first message.
 * 3. Messages stream back via SSE from POST /api/chat (thin proxy to Powabase).
 * 4. Sessions are stored in Powabase — we list them to rebuild the sidebar.
 * 5. File uploads → POST /api/upload → Powabase Source + KB (RAG handled by Powabase).
 */

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import ChatArea from "@/components/ChatArea";
import MessageInput from "@/components/MessageInput";
import FileUpload from "@/components/FileUpload";
import { Conversation, Message } from "@/lib/types";

const DEFAULT_AGENT_NAME = "powabase-chat";
const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful AI assistant. When the user provides documents, use your knowledge_search tool to find relevant information before answering. Be concise, accurate, and friendly.";

export default function Home() {
  const [agentId, setAgentId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(true);

  // ── Bootstrap: get or create the default Powabase agent ─────────────────

  const loadConversations = useCallback(async (aid: string) => {
    try {
      const res = await fetch(`/api/sessions?agentId=${aid}`);
      const data = await res.json();
      const sessions: { session_id: string; created_at: string; first_message?: string }[] =
        data.sessions ?? [];

      const convs: Conversation[] = sessions.map((s, i) => ({
        sessionId: s.session_id,
        agentId: aid,
        title: s.first_message ?? `Conversation ${sessions.length - i}`,
        createdAt: s.created_at,
      }));

      convs.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setConversations(convs);
    } catch (e) {
      console.error("Failed to load sessions:", e);
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/api/agents");
        const data = await res.json();
        const agents: { id: string; name: string }[] = data.agents ?? [];

        let agent = agents.find((a) => a.name === DEFAULT_AGENT_NAME);

        if (!agent) {
          const created = await fetch("/api/agents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: DEFAULT_AGENT_NAME,
              system_prompt: DEFAULT_SYSTEM_PROMPT,
              model: "gpt-4o-mini",
            }),
          });
          agent = await created.json();
        }

        setAgentId(agent!.id);
        await loadConversations(agent!.id);
      } catch (e) {
        console.error("Init error:", e);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [loadConversations]);

  // ── Select an existing conversation → load its run history from Powabase ─

  async function selectConversation(conv: Conversation) {
    setActiveSessionId(conv.sessionId);
    setMessages([]);
    setStreamingContent("");

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
        if (userMsg) msgs.push({ role: "user", content: userMsg.content });
        if (assistantMsg) msgs.push({ role: "assistant", content: assistantMsg.content });
      }
      setMessages(msgs);
    } catch (e) {
      console.error("Failed to load runs:", e);
    }
  }

  // ── New chat: clear local state; Powabase creates session on first message

  function newChat() {
    setActiveSessionId(null);
    setMessages([]);
    setStreamingContent("");
  }

  // ── Delete a conversation (Powabase deletes the session) ─────────────────

  async function deleteConversation(conv: Conversation) {
    try {
      await fetch(
        `/api/sessions?agentId=${conv.agentId}&sessionId=${conv.sessionId}`,
        { method: "DELETE" }
      );
      setConversations((prev) => prev.filter((c) => c.sessionId !== conv.sessionId));
      if (activeSessionId === conv.sessionId) newChat();
    } catch (e) {
      console.error("Delete error:", e);
    }
  }

  // ── Send message → Powabase streams SSE response ─────────────────────────

  async function sendMessage(text: string) {
    if (!agentId || streaming) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setStreaming(true);
    setStreamingContent("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          message: text,
          sessionId: activeSessionId ?? undefined,
        }),
      });

      if (!res.body) throw new Error("No response body");

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

            // Powabase returns session_id in both start and complete events
            if (event.session_id && !newSessionId) {
              newSessionId = event.session_id;
            }

            // "chunk" events carry LLM token output
            if (event.event === "chunk" && event.content) {
              fullContent += event.content;
              setStreamingContent(fullContent);
            }
          } catch {
            // non-JSON line — skip
          }
        }
      }

      // Commit the full assistant message to state
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: fullContent },
      ]);

      // Register new conversation in the sidebar
      if (newSessionId && newSessionId !== activeSessionId) {
        setActiveSessionId(newSessionId);
        const newConv: Conversation = {
          sessionId: newSessionId,
          agentId,
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
      <Sidebar
        conversations={conversations}
        activeSessionId={activeSessionId}
        onNew={newChat}
        onSelect={selectConversation}
        onDelete={deleteConversation}
        onUploadClick={() => setShowUpload(true)}
      />

      <main className="flex flex-col flex-1 overflow-hidden">
        <ChatArea
          messages={messages}
          streaming={streaming}
          streamingContent={streamingContent}
        />
        <MessageInput onSend={sendMessage} disabled={streaming} />
      </main>

      {showUpload && (
        <FileUpload agentId={agentId} onClose={() => setShowUpload(false)} />
      )}
    </div>
  );
}
