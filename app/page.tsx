"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import AgentsScreen from "@/components/AgentsScreen";
import ChatArea from "@/components/ChatArea";
import MessageInput, { SessionAttachment } from "@/components/MessageInput";
import TokenRefresher from "@/components/TokenRefresher";
import SourcesPanel from "@/components/SourcesPanel";
import SessionsPanel from "@/components/SessionsPanel";
import GoLivePanel from "@/components/GoLivePanel";
import AgentSettingsPanel from "@/components/AgentSettingsPanel";
import CustomizationsPanel from "@/components/CustomizationsPanel";
import CollectedDataPanel from "@/components/CollectedDataPanel";
import { Conversation, Message, UserAgent } from "@/lib/types";
import { getAgentPrefs, saveAgentPrefs, AgentPrefs, touchAgentLastActive, AVATAR_COLORS } from "@/lib/agentPrefs";
import {
  getAgentVariables,
  getSessionCollectedData,
  saveSessionCollectedData,
  deleteSessionCollectedData,
  CollectedData,
} from "@/lib/agentVariables";

type Panel = "sessions" | "sources" | "golive" | "settings" | "customizations" | "collected" | null;


export default function Home() {
  const router = useRouter();

  const [user, setUser] = useState<{ id: string; email: string; username?: string } | null>(null);
  const [agents, setAgents] = useState<UserAgent[]>([]);
  const [activeAgent, setActiveAgent] = useState<UserAgent | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [sessionLimitReached, setSessionLimitReached] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activePanel, setActivePanel] = useState<Panel>(null);
  const [agentPrefs, setAgentPrefs] = useState<Record<string, AgentPrefs>>({});
  const [collectedData, setCollectedData] = useState<Record<string, CollectedData>>({});
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

      // Load any previously collected variable data for these sessions
      const loaded: Record<string, CollectedData> = {};
      for (const c of convs) {
        const data = getSessionCollectedData(c.sessionId);
        if (data) loaded[c.sessionId] = data;
      }
      setCollectedData(loaded);
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
      const prefs: Record<string, AgentPrefs> = {};
      for (const a of list) prefs[a.id] = getAgentPrefs(a.id);
      setAgentPrefs(prefs);
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
    setActivePanel(null);
    setCollectedData({});
    await loadConversations(agent.id);
  }

  // ── Create new agent ──────────────────────────────────────────────────────

  async function createAgent(name: string, systemPrompt: string, welcomeMessage?: string): Promise<string | null> {
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, system_prompt: systemPrompt }),
      });
      if (res.status === 401) { router.replace("/login?reason=session_expired"); return null; }
      if (!res.ok) return null;
      const newAgent: UserAgent = await res.json();
      setAgents((prev) => [...prev, newAgent]);
      if (welcomeMessage?.trim()) {
        saveAgentPrefs(newAgent.id, { welcomeMessage: welcomeMessage.trim() });
      }
      const prefs = getAgentPrefs(newAgent.id);
      setAgentPrefs((prev) => ({ ...prev, [newAgent.id]: prefs }));
      // Don't switch immediately — the create flow has a step 2 that needs to
      // stay on AgentsScreen. handleComplete in AgentsScreen calls onSelectAgent.
      return newAgent.id;
    } catch {
      return null;
    }
  }

  // ── Update agent (prompt and/or display name) ─────────────────────────────

  async function updateAgent(agent: UserAgent, updates: { system_prompt?: string; display_name?: string; knowledge_mode?: "ai" | "kb" }): Promise<boolean> {
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.status === 401) { router.replace("/login?reason=session_expired"); return false; }
      if (!res.ok) return false;
      const updated = await res.json();
      setAgents((prev) =>
        prev.map((a) => a.id === agent.id ? { ...a, system_prompt: updated.system_prompt ?? a.system_prompt, name: updated.name ?? a.name } : a)
      );
      if (activeAgent?.id === agent.id) {
        setActiveAgent((prev) => prev ? { ...prev, system_prompt: updated.system_prompt ?? prev.system_prompt, name: updated.name ?? prev.name } : prev);
      }
      return true;
    } catch {
      return false;
    }
  }

  // ── Delete agent ──────────────────────────────────────────────────────────

  async function deleteAgent(agent: UserAgent) {
    try {
      const res = await fetch(`/api/agents/${agent.id}`, { method: "DELETE" });
      if (!res.ok) { console.error("Delete agent failed:", await res.text()); return; }
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

  // ── Duplicate agent ───────────────────────────────────────────────────────

  async function duplicateAgent(name: string, systemPrompt: string): Promise<boolean> {
    return (await createAgent(name, systemPrompt)) !== null;
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
    setActivePanel(null);

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
    setActivePanel(null);
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
    setActivePanel(null);
    setCollectedData({});
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
      await fetch(`/api/sessions?sessionId=${conv.sessionId}&agentId=${conv.agentId}`, { method: "DELETE" });
      localStorage.removeItem(`conv_title_${conv.sessionId}`);
      deleteSessionCollectedData(conv.sessionId);
      setConversations((prev) => prev.filter((c) => c.sessionId !== conv.sessionId));
      setCollectedData((prev) => {
        const next = { ...prev };
        delete next[conv.sessionId];
        return next;
      });
      if (activeSessionId === conv.sessionId) newChat();
    } catch (e) {
      console.error("Delete error:", e);
    }
  }

  // ── Extract variables from a session in the background ────────────────────

  async function triggerExtraction(sessionId: string, agentId: string) {
    const vars = getAgentVariables(agentId);
    if (!vars.length) return;
    try {
      const res = await fetch("/api/extract-variables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, sessionId, variables: vars }),
      });
      if (!res.ok) return;
      const { data } = await res.json();
      if (!data || typeof data !== "object") return;
      saveSessionCollectedData(sessionId, data as CollectedData);
      setCollectedData((prev) => ({ ...prev, [sessionId]: data as CollectedData }));
    } catch { /* best effort — never block the chat */ }
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
      const tempMap = { precise: 0.2, balanced: 0.7, creative: 1.0 };
      const temperaturePref = agentPrefs[activeAgent.id]?.temperature ?? "balanced";
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: activeAgent.id,
          message: messageWithContext,
          sessionId: activeSessionId ?? undefined,
          temperature: tempMap[temperaturePref],
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

      // Stamp the agent as active right now so the agents screen shows correct last-active time
      touchAgentLastActive(activeAgent.id);

      // Trigger variable extraction in background — doesn't block the UI
      const extractSessionId = newSessionId ?? activeSessionId;
      if (extractSessionId && activeAgent) {
        triggerExtraction(extractSessionId, activeAgent.id);
      }

      if (newSessionId && newSessionId !== activeSessionId) {
        setActiveSessionId(newSessionId);
        const words = text.trim().split(/\s+/);
        const titleWords = words.slice(0, 7);
        const title = titleWords.join(" ") + (words.length > 7 ? "…" : "");
        const newConv: Conversation = {
          sessionId: newSessionId,
          agentId: activeAgent.id,
          title: title.charAt(0).toUpperCase() + title.slice(1),
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
      <div className="flex flex-1 items-center justify-center bg-[#1a1a1a] text-white/50 text-sm">
        Connecting to Powabase…
      </div>
    );
  }

  return (
    <div className="flex flex-1 bg-[#1a1a1a] text-white overflow-hidden">
      <TokenRefresher />

      {activeAgent && (
        <Sidebar
          activeAgent={activeAgent}
          activePanel={activePanel}
          onSetPanel={setActivePanel}
          onBackToAgents={backToAgents}
          agentPrefs={agentPrefs[activeAgent.id]}
        />
      )}

      <main className="flex flex-col flex-1 overflow-hidden">
        {!activeAgent ? (
          <AgentsScreen
            agents={agents}
            agentPrefs={agentPrefs}
            onSelectAgent={switchAgent}
            onCreateAgent={createAgent}
            onDeleteAgent={deleteAgent}
            onDuplicateAgent={duplicateAgent}
            onRenameAgent={(agent, newName) => updateAgent(agent, { display_name: newName })}
          />
        ) : activePanel === "sessions" ? (
          <SessionsPanel
            conversations={conversations}
            activeSessionId={activeSessionId}
            onNewChat={newChat}
            onSelectConversation={selectConversation}
            onDeleteConversation={deleteConversation}
            onRenameConversation={renameConversation}
          />
        ) : activePanel === "collected" ? (
          <CollectedDataPanel
            conversations={conversations}
            collectedData={collectedData}
          />
        ) : activePanel === "sources" ? (
          <SourcesPanel
            agentId={activeAgent.id}
            agentName={activeAgent.name}
            onClose={() => setActivePanel(null)}
          />
        ) : activePanel === "customizations" ? (
          <CustomizationsPanel agentId={activeAgent.id} />
        ) : activePanel === "golive" ? (
          <GoLivePanel
            agentId={activeAgent.id}
            agentName={activeAgent.name}
            agentPrefs={agentPrefs[activeAgent.id]}
            onOpenSettings={() => setActivePanel("settings")}
          />
        ) : activePanel === "settings" ? (
          <AgentSettingsPanel
            agent={activeAgent}
            onUpdateAgent={updateAgent}
            onDeleteAgent={deleteAgent}
            onDuplicateAgent={duplicateAgent}
            onClose={() => setActivePanel(null)}
            onBackToAgents={backToAgents}
            onPrefsChange={(id, prefs) => setAgentPrefs((prev) => ({ ...prev, [id]: prefs }))}
            fullPage
          />
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Chat header bar */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-white/8 bg-[#1c1c1c] shrink-0">
              {(() => {
                const prefs = agentPrefs[activeAgent.id];
                const color = prefs?.avatarColor ?? AVATAR_COLORS[0];
                const emoji = prefs?.avatarEmoji;
                const isPublic = prefs?.visibility === "public";
                return (
                  <>
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ backgroundColor: `${color}22`, border: `1px solid ${color}55` }}
                    >
                      {emoji ? (
                        <span>{emoji}</span>
                      ) : (
                        <span style={{ color }}>{activeAgent.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <span className="font-medium text-sm text-white">{agentPrefs[activeAgent.id]?.displayName || activeAgent.name}</span>
                    {isPublic ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">Public</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white/40">Private</span>
                    )}
                  </>
                );
              })()}
            </div>
            <ChatArea
              messages={messages}
              streaming={streaming}
              streamingContent={streamingContent}
              welcomeMessage={activeSessionId ? undefined : agentPrefs[activeAgent.id]?.welcomeMessage}
              agent={activeAgent}
              agentPrefs={agentPrefs[activeAgent.id]}
              onSendPrompt={sendMessage}
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
          </div>
        )}
      </main>
    </div>
  );
}
