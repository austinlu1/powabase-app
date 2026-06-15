"use client";

import { useState, useEffect } from "react";
import { Conversation, UserAgent } from "@/lib/types";
import {
  PlusIcon,
  TrashIcon,
  ChatBubbleLeftIcon,
  PowerIcon,
  CpuChipIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  SignalIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import SourcesModal from "./SourcesModal";

interface SidebarProps {
  activeAgent: UserAgent | null;
  conversations: Conversation[];
  activeSessionId: string | null;
  user: { id: string; email: string } | null;
  onNewChat: () => void;
  onSelectConversation: (conv: Conversation) => void;
  onDeleteConversation: (conv: Conversation) => void;
  onRenameConversation: (conv: Conversation, newTitle: string) => void;
  onBackToAgents: () => void;
  onLogout: () => void;
}

export default function Sidebar({
  activeAgent,
  conversations,
  activeSessionId,
  user,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onBackToAgents,
  onLogout,
}: SidebarProps) {
  const [convOpen, setConvOpen] = useState(true);
  const [goLiveOpen, setGoLiveOpen] = useState(false);
  const [sourcesModalOpen, setSourcesModalOpen] = useState(false);
  const [convSearch, setConvSearch] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Reset section state when switching agents
  useEffect(() => {
    setConvOpen(true);
    setGoLiveOpen(false);
    setSourcesModalOpen(false);
    setConvSearch("");
    setRenamingId(null);
  }, [activeAgent?.id]);

  const filteredConversations = convSearch.trim()
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(convSearch.toLowerCase())
      )
    : conversations;

  return (
    <aside className="flex flex-col w-72 h-screen bg-[#111827] border-r border-white/10 text-white shrink-0">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/10 shrink-0">
        <div className="min-w-0">
          <p className="font-bold text-sm">Powabase Chat</p>
          {user && <p className="text-xs text-white/30 truncate mt-0.5">{user.email}</p>}
        </div>
        <button
          onClick={onLogout}
          title="Sign out"
          className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-white/40 hover:bg-white/10 hover:text-red-400 transition-colors ml-2"
        >
          <PowerIcon className="w-5 h-5" />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto">

        {!activeAgent ? (
          /* No agent selected */
          <div className="px-4 pt-5">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Agents</p>
            <p className="text-sm text-white/25 leading-relaxed">
              Select an agent from the main screen to get started.
            </p>
          </div>
        ) : (
          /* Inside an agent */
          <>

            {/* ── Back + agent name ── */}
            <div className="border-b border-white/10">
              <button
                onClick={onBackToAgents}
                className="flex items-center gap-1.5 w-full px-4 py-3 text-xs text-white/40 hover:text-white hover:bg-white/5 transition-colors"
              >
                <ChevronLeftIcon className="w-3.5 h-3.5" />
                <span>All Agents</span>
              </button>
              <div className="flex items-center gap-2.5 px-4 pb-3">
                <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                  <CpuChipIcon className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <span className="font-semibold text-white text-sm truncate">{activeAgent.name}</span>
              </div>
            </div>

            {/* ── Conversations ── */}
            <div className="border-b border-white/10">
              <button
                onClick={() => setConvOpen(!convOpen)}
                className="flex items-center justify-between w-full px-4 pt-4 pb-2 hover:bg-white/5 transition-colors"
              >
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Conversations</p>
                <div className="flex items-center gap-2">
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); onNewChat(); }}
                    className="w-5 h-5 flex items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white transition-colors"
                    title="New chat"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                  </span>
                  <ChevronDownIcon className={`w-4 h-4 text-white/30 transition-transform ${convOpen ? "" : "-rotate-90"}`} />
                </div>
              </button>

              {convOpen && (
                <div className="px-2 pb-3 space-y-1">
                  {/* Search */}
                  {conversations.length > 0 && (
                    <div className="relative mb-2">
                      <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
                      <input
                        type="text"
                        value={convSearch}
                        onChange={(e) => setConvSearch(e.target.value)}
                        placeholder="Search conversations…"
                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white placeholder-white/25 outline-none focus:border-white/25 transition-colors"
                      />
                    </div>
                  )}

                  {conversations.length === 0 && (
                    <p className="text-sm text-white/30 px-2 py-2">No conversations yet</p>
                  )}
                  {filteredConversations.length === 0 && conversations.length > 0 && (
                    <p className="text-xs text-white/30 px-2 py-2">No matches</p>
                  )}
                  {filteredConversations.map((conv) => (
                    <div
                      key={conv.sessionId}
                      className={`group rounded-lg text-sm transition-colors ${
                        renamingId === conv.sessionId
                          ? "bg-white/10"
                          : conv.sessionId === activeSessionId
                          ? "bg-white/20 text-white"
                          : "text-white/60 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {renamingId === conv.sessionId ? (
                        <div className="flex items-center gap-1.5 px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { onRenameConversation(conv, renameValue); setRenamingId(null); }
                              if (e.key === "Escape") setRenamingId(null);
                            }}
                            onBlur={() => { onRenameConversation(conv, renameValue); setRenamingId(null); }}
                            className="flex-1 min-w-0 bg-white/10 border border-white/20 rounded-md px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                          />
                        </div>
                      ) : (
                        <div
                          onClick={() => onSelectConversation(conv)}
                          className="flex items-center justify-between px-3 py-2.5 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <ChatBubbleLeftIcon className="w-4 h-4 shrink-0 opacity-50" />
                            <span className="truncate">
                              <HighlightedTitle title={conv.title} query={convSearch} />
                            </span>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); setRenamingId(conv.sessionId); setRenameValue(conv.title); }}
                              className="p-1 hover:text-white transition-colors"
                              title="Rename"
                            >
                              <PencilSquareIcon className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onDeleteConversation(conv); }}
                              className="p-1 hover:text-red-400 transition-colors"
                              title="Delete"
                            >
                              <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Sources ── */}
            <div className="border-b border-white/10">
              <button
                onClick={() => setSourcesModalOpen(true)}
                className="flex items-center justify-between w-full px-4 py-4 hover:bg-white/5 transition-colors"
              >
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Sources</p>
                <span className="text-xs text-white/30 hover:text-white/60 transition-colors">View →</span>
              </button>
            </div>

            {sourcesModalOpen && (
              <SourcesModal
                agentId={activeAgent.id}
                agentName={activeAgent.name}
                onClose={() => setSourcesModalOpen(false)}
              />
            )}

            {/* ── Go Live ── */}
            <div>
              <button
                onClick={() => setGoLiveOpen(!goLiveOpen)}
                className="flex items-center justify-between w-full px-4 pt-4 pb-2 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <SignalIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Go Live</p>
                </div>
                <ChevronDownIcon className={`w-4 h-4 text-white/30 transition-transform ${goLiveOpen ? "" : "-rotate-90"}`} />
              </button>

              {goLiveOpen && <GoLiveSection agentId={activeAgent.id} />}
            </div>

          </>
        )}
      </div>
    </aside>
  );
}

// ── Highlighted title ─────────────────────────────────────────────────────────

function HighlightedTitle({ title, query }: { title: string; query: string }) {
  if (!query.trim()) return <>{title}</>;

  const idx = title.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{title}</>;

  return (
    <>
      {title.slice(0, idx)}
      <mark className="bg-yellow-400/30 text-yellow-200 rounded-sm px-0.5">
        {title.slice(idx, idx + query.length)}
      </mark>
      {title.slice(idx + query.length)}
    </>
  );
}

// ── Go Live section ───────────────────────────────────────────────────────────

function GoLiveSection({ agentId }: { agentId: string }) {
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const snippet = `<script>
  window.PowabaseChat = { agentId: "${agentId}" }
</script>
<script src="${origin}/widget.js" defer></script>`;

  function copy() {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="px-3 pb-4 space-y-3">
      <p className="text-xs text-white/40 px-1">
        Embed this agent as a chat widget on any website.
      </p>
      <div className="relative rounded-xl bg-black/40 border border-white/10 p-3">
        <pre className="text-xs text-emerald-300 whitespace-pre-wrap break-all leading-relaxed font-mono">
          {snippet}
        </pre>
        <button
          onClick={copy}
          className="absolute top-2 right-2 flex items-center gap-1 rounded-lg px-2 py-1 text-xs bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors"
          title="Copy snippet"
        >
          {copied ? (
            <><CheckIcon className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">Copied</span></>
          ) : (
            <><ClipboardDocumentIcon className="w-3.5 h-3.5" /><span>Copy</span></>
          )}
        </button>
      </div>
      <p className="text-xs text-white/25 px-1 leading-relaxed">
        Paste into the <code className="text-white/40">&lt;head&gt;</code> or end of <code className="text-white/40">&lt;body&gt;</code> of your site.
      </p>
    </div>
  );
}
