"use client";

import { useState } from "react";
import { Conversation } from "@/lib/types";
import {
  PlusIcon,
  ChatBubbleLeftIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  ArrowDownTrayIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

interface SessionsPanelProps {
  conversations: Conversation[];
  activeSessionId: string | null;
  onNewChat: () => void;
  onSelectConversation: (conv: Conversation) => void;
  onDeleteConversation: (conv: Conversation) => void;
  onRenameConversation: (conv: Conversation, newTitle: string) => void;
}

export default function SessionsPanel({
  conversations,
  activeSessionId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
}: SessionsPanelProps) {
  const [search, setSearch] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  async function exportConversation(conv: Conversation) {
    try {
      const res = await fetch(`/api/sessions/runs?sessionId=${conv.sessionId}`);
      if (!res.ok) return;
      const data = await res.json();
      const runs: Array<{
        input_messages: { role: string; content: string }[];
        output_messages: { role: string; content: string }[];
      }> = data.runs ?? [];
      const sep = "\n\n---\n\n";

      const seenSources = new Set<string>();
      const sourceNames: string[] = [];
      for (const run of runs) {
        const userMsg = run.input_messages?.find((m) => m.role === "user");
        const raw = userMsg?.content ?? "";
        const lastSepIdx = raw.lastIndexOf(sep);
        if (lastSepIdx === -1) continue;
        const contextBlock = raw.slice(0, lastSepIdx);
        for (const entry of contextBlock.split(sep)) {
          const match = entry.match(/^\[Context:[^\]]+?—\s*(.+?)\]/);
          if (match) {
            const name = match[1].trim();
            if (!seenSources.has(name)) { seenSources.add(name); sourceNames.push(name); }
          }
        }
      }

      const lines: string[] = [`# ${conv.title}`, `Session: ${conv.sessionId}`, `Exported: ${new Date().toLocaleString()}`, ""];
      if (sourceNames.length > 0) {
        lines.push("Attached Sources");
        for (const name of sourceNames) lines.push(`  - ${name}`);
        lines.push("", "---", "");
      }
      for (const run of runs) {
        const userMsg = run.input_messages?.find((m) => m.role === "user");
        const assistantMsg = run.output_messages?.find((m) => m.role === "assistant");
        if (userMsg) {
          const raw = userMsg.content ?? "";
          const lastSepIdx = raw.lastIndexOf(sep);
          lines.push("You");
          lines.push(lastSepIdx !== -1 ? raw.slice(lastSepIdx + sep.length) : raw);
          lines.push("");
        }
        if (assistantMsg) { lines.push("Assistant"); lines.push(assistantMsg.content ?? ""); lines.push(""); }
      }

      const blob = new Blob([lines.join("\n")], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${conv.title.replace(/[^a-z0-9]/gi, "_")}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* silently fail */ }
  }

  const filtered = search.trim()
    ? conversations.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
    : conversations;

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-[#1a1a1a]">
      {/* Header */}
      <div className="flex items-center justify-center px-8 py-6 border-b border-white/10 shrink-0 relative">
        <h2 className="text-3xl font-semibold text-white">Sessions</h2>
        <button
          onClick={onNewChat}
          className="absolute right-8 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          New Session
        </button>
      </div>

      <SessionsList
        conversations={filtered}
        allConversations={conversations}
        activeSessionId={activeSessionId}
        search={search}
        onSearchChange={setSearch}
        renamingId={renamingId}
        renameValue={renameValue}
        onStartRename={(conv) => { setRenamingId(conv.sessionId); setRenameValue(conv.title); }}
        onConfirmRename={(conv) => { onRenameConversation(conv, renameValue); setRenamingId(null); }}
        onCancelRename={() => setRenamingId(null)}
        onRenameValueChange={setRenameValue}
        onSelectConversation={onSelectConversation}
        onDeleteConversation={onDeleteConversation}
        onExportConversation={exportConversation}
      />
    </div>
  );
}

// ── Sessions list ─────────────────────────────────────────────────────────────

function SessionsList({
  conversations,
  allConversations,
  activeSessionId,
  search,
  onSearchChange,
  renamingId,
  renameValue,
  onStartRename,
  onConfirmRename,
  onCancelRename,
  onRenameValueChange,
  onSelectConversation,
  onDeleteConversation,
  onExportConversation,
}: {
  conversations: Conversation[];
  allConversations: Conversation[];
  activeSessionId: string | null;
  search: string;
  onSearchChange: (v: string) => void;
  renamingId: string | null;
  renameValue: string;
  onStartRename: (conv: Conversation) => void;
  onConfirmRename: (conv: Conversation) => void;
  onCancelRename: () => void;
  onRenameValueChange: (v: string) => void;
  onSelectConversation: (conv: Conversation) => void;
  onDeleteConversation: (conv: Conversation) => void;
  onExportConversation: (conv: Conversation) => void;
}) {
  return (
    <>
      <div className="flex justify-center px-10 py-5 shrink-0">
        <div className="relative w-full max-w-3xl">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search sessions…"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-base text-white placeholder-white/25 outline-none focus:border-white/25 transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-10 pb-10 flex flex-col items-center">
        <div className="w-full max-w-3xl">
          {allConversations.length === 0 && (
            <p className="text-white/30 text-base mt-4">No sessions yet — start a new one above.</p>
          )}
          {conversations.length === 0 && allConversations.length > 0 && (
            <p className="text-white/30 text-base mt-4">No sessions match &ldquo;{search}&rdquo;</p>
          )}
          <div className="space-y-2.5">
            {conversations.map((conv) => {
              const isActive = conv.sessionId === activeSessionId;
              return (
                <div
                  key={conv.sessionId}
                  className={`rounded-xl border transition-colors overflow-hidden ${
                    isActive
                      ? "border-blue-500/40 bg-blue-600/10"
                      : "border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20"
                  }`}
                >
                  {renamingId === conv.sessionId ? (
                    <div className="flex items-center gap-2 px-5 py-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => onRenameValueChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") onConfirmRename(conv);
                          if (e.key === "Escape") onCancelRename();
                        }}
                        onBlur={() => onConfirmRename(conv)}
                        className="flex-1 min-w-0 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-base text-white outline-none focus:border-blue-500"
                      />
                    </div>
                  ) : (
                    <div
                      onClick={() => onSelectConversation(conv)}
                      className="group/row flex items-center justify-between px-5 py-4 cursor-pointer"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <ChatBubbleLeftIcon className="w-5 h-5 shrink-0 text-white/40" />
                        <span className="text-base text-white truncate">{conv.title}</span>
                      </div>
                      <div className="flex items-center gap-1.5 opacity-0 group-hover/row:opacity-100 transition-opacity ml-3 shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); onStartRename(conv); }}
                          className="p-2 text-white/40 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                          title="Rename"
                        >
                          <PencilSquareIcon className="w-4.5 h-4.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onExportConversation(conv); }}
                          className="p-2 text-white/40 hover:text-blue-400 rounded-lg hover:bg-white/10 transition-colors"
                          title="Export"
                        >
                          <ArrowDownTrayIcon className="w-4.5 h-4.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteConversation(conv); }}
                          className="p-2 text-white/40 hover:text-red-400 rounded-lg hover:bg-white/10 transition-colors"
                          title="Delete"
                        >
                          <TrashIcon className="w-4.5 h-4.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

