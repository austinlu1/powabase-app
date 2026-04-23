"use client";

import { Conversation } from "@/lib/types";
import { PlusIcon, TrashIcon, ChatBubbleLeftIcon } from "@heroicons/react/24/outline";

interface SidebarProps {
  conversations: Conversation[];
  activeSessionId: string | null;
  onNew: () => void;
  onSelect: (conv: Conversation) => void;
  onDelete: (conv: Conversation) => void;
  onUploadClick: () => void;
}

export default function Sidebar({
  conversations,
  activeSessionId,
  onNew,
  onSelect,
  onDelete,
  onUploadClick,
}: SidebarProps) {
  return (
    <aside className="flex flex-col w-64 min-h-screen bg-[#111827] border-r border-white/10 text-white">
      {/* Logo / brand */}
      <div className="px-4 py-5 border-b border-white/10">
        <span className="text-lg font-semibold tracking-tight">Powabase Chat</span>
      </div>

      {/* New chat button */}
      <div className="px-3 pt-4">
        <button
          onClick={onNew}
          className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm font-medium bg-white/10 hover:bg-white/20 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          New Chat
        </button>
      </div>

      {/* Conversation list */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {conversations.length === 0 && (
          <p className="text-xs text-white/40 px-2 py-2">No conversations yet</p>
        )}
        {conversations.map((conv) => (
          <div
            key={conv.sessionId}
            onClick={() => onSelect(conv)}
            className={`group flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer text-sm transition-colors ${
              conv.sessionId === activeSessionId
                ? "bg-white/20 text-white"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <ChatBubbleLeftIcon className="w-4 h-4 shrink-0 opacity-60" />
              <span className="truncate">{conv.title}</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conv);
              }}
              className="shrink-0 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity ml-1"
              title="Delete conversation"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
      </nav>

      {/* Upload documents */}
      <div className="px-3 pb-5 border-t border-white/10 pt-4">
        <button
          onClick={onUploadClick}
          className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        >
          <span>📎</span>
          Upload Document (RAG)
        </button>
      </div>
    </aside>
  );
}
