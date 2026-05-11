"use client";

import { useState } from "react";
import { Conversation } from "@/lib/types";
import {
  PlusIcon,
  TrashIcon,
  ChatBubbleLeftIcon,
  FolderIcon,
  PowerIcon,
} from "@heroicons/react/24/outline";
import {
  ChatBubbleLeftIcon as ChatBubbleLeftIconSolid,
  FolderIcon as FolderIconSolid,
} from "@heroicons/react/24/solid";
import FilesPanel from "./FilesPanel";

type Panel = "chat" | "files";

interface SidebarProps {
  conversations: Conversation[];
  activeSessionId: string | null;
  agentId: string | null;
  user: { id: string; email: string } | null;
  onNew: () => void;
  onSelect: (conv: Conversation) => void;
  onDelete: (conv: Conversation) => void;
  onLogout: () => void;
}

export default function Sidebar({
  conversations,
  activeSessionId,
  agentId,
  user,
  onNew,
  onSelect,
  onDelete,
  onLogout,
}: SidebarProps) {
  const [activePanel, setActivePanel] = useState<Panel>("chat");

  return (
    <aside className="flex h-screen bg-[#111827] border-r border-white/10 text-white">

      {/* ── Icon rail ──────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-2 w-14 py-4 border-r border-white/10">
        {/* App logo / wordmark */}
        <div className="mb-4 text-white/60 font-bold text-xs tracking-widest select-none">PB</div>

        <NavIcon
          label="Chat"
          active={activePanel === "chat"}
          onClick={() => setActivePanel("chat")}
          icon={activePanel === "chat"
            ? <ChatBubbleLeftIconSolid className="w-5 h-5" />
            : <ChatBubbleLeftIcon className="w-5 h-5" />}
        />

        <NavIcon
          label="Files"
          active={activePanel === "files"}
          onClick={() => setActivePanel("files")}
          icon={activePanel === "files"
            ? <FolderIconSolid className="w-5 h-5" />
            : <FolderIcon className="w-5 h-5" />}
        />

        {/* Logout button pushed to bottom */}
        <div className="flex-1" />
        <button
          onClick={onLogout}
          title={`Sign out${user ? ` (${user.email})` : ""}`}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-white/40 hover:bg-white/10 hover:text-red-400 transition-colors"
        >
          <PowerIcon className="w-5 h-5" />
        </button>
      </div>

      {/* ── Panel ──────────────────────────────────────────────── */}
      <div className="flex flex-col w-56 overflow-hidden">
        {activePanel === "chat" ? (
          <ChatPanel
            conversations={conversations}
            activeSessionId={activeSessionId}
            user={user}
            onNew={onNew}
            onSelect={onSelect}
            onDelete={onDelete}
          />
        ) : (
          <FilesPanel agentId={agentId} />
        )}
      </div>
    </aside>
  );
}

// ── Small icon button for the rail ──────────────────────────────────────────

function NavIcon({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
        active
          ? "bg-white/20 text-white"
          : "text-white/40 hover:bg-white/10 hover:text-white"
      }`}
    >
      {icon}
    </button>
  );
}

// ── Chat panel (sessions list) ───────────────────────────────────────────────

function ChatPanel({
  conversations,
  activeSessionId,
  user,
  onNew,
  onSelect,
  onDelete,
}: {
  conversations: Conversation[];
  activeSessionId: string | null;
  user: { id: string; email: string } | null;
  onNew: () => void;
  onSelect: (conv: Conversation) => void;
  onDelete: (conv: Conversation) => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-4 border-b border-white/10">
        <p className="text-sm font-semibold">Conversations</p>
        {user && (
          <p className="text-xs text-white/30 truncate mt-0.5">{user.email}</p>
        )}
      </div>

      {/* New chat */}
      <div className="px-3 pt-3">
        <button
          onClick={onNew}
          className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-xs font-medium bg-white/10 hover:bg-white/20 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          New Chat
        </button>
      </div>

      {/* Session list */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {conversations.length === 0 && (
          <p className="text-xs text-white/30 px-1 py-2">No conversations yet</p>
        )}
        {conversations.map((conv) => (
          <div
            key={conv.sessionId}
            onClick={() => onSelect(conv)}
            className={`group flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer text-xs transition-colors ${
              conv.sessionId === activeSessionId
                ? "bg-white/20 text-white"
                : "text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <ChatBubbleLeftIcon className="w-3.5 h-3.5 shrink-0 opacity-50" />
              <span className="truncate">{conv.title}</span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(conv); }}
              className="shrink-0 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity ml-1"
              title="Delete"
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </nav>
    </div>
  );
}
