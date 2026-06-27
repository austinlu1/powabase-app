"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserAgent } from "@/lib/types";
import {
  CpuChipIcon,
  PlusIcon,
  TrashIcon,
  PencilSquareIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
  PowerIcon,
} from "@heroicons/react/24/outline";

interface Props {
  agents: UserAgent[];
  onSelectAgent: (agent: UserAgent) => void;
  onCreateAgent: (name: string, systemPrompt: string) => Promise<boolean>;
  onUpdateAgent: (agent: UserAgent, newPrompt: string) => Promise<boolean>;
  onDeleteAgent: (agent: UserAgent) => void;
  user: { id: string; email: string; username?: string } | null;
  onLogout: () => void;
}

export default function AgentsScreen({
  agents,
  onSelectAgent,
  onCreateAgent,
  onUpdateAgent,
  onDeleteAgent,
  user,
  onLogout,
}: Props) {
  const router = useRouter();
  const [agentSearch, setAgentSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  async function handleCreate() {
    if (!newName.trim()) { setCreateError("Name required"); return; }
    setCreating(true);
    setCreateError("");
    const ok = await onCreateAgent(newName.trim(), newPrompt.trim());
    setCreating(false);
    if (ok) { setNewName(""); setNewPrompt(""); setShowCreate(false); }
    else setCreateError("Failed to create. Try again.");
  }

  const filteredAgents = agentSearch.trim()
    ? agents.filter((a) => a.name.toLowerCase().includes(agentSearch.toLowerCase()))
    : agents;

  async function handleSave(agent: UserAgent) {
    setSaving(agent.id);
    await onUpdateAgent(agent, editPrompt[agent.id] ?? agent.system_prompt ?? "");
    setSaving(null);
    setEditingId(null);
  }

  const initial = (user?.username ?? user?.email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="relative flex-1 overflow-y-auto bg-[#0d1117] px-8 py-10">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <h1 className="text-4xl font-bold text-white">Agents</h1>
          <div className="flex items-center gap-3">
            <div className="relative w-56">
              <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
              <input
                type="text"
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                placeholder="Search agents…"
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-7 pr-3 py-1.5 text-sm text-white placeholder-white/25 outline-none focus:border-white/25 transition-colors"
              />
            </div>

            {/* User avatar */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold hover:bg-blue-500 transition-colors shrink-0"
                title={user?.email}
              >
                {initial}
              </button>

              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 top-10 z-20 w-48 bg-[#1f2937] border border-white/10 rounded-xl shadow-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/10">
                      <p className="text-xs text-white/40 truncate">{user?.email}</p>
                    </div>
                    <button
                      onClick={() => { setShowUserMenu(false); onLogout(); }}
                      className="flex items-center gap-2 w-full px-4 py-3 text-sm text-white/60 hover:text-red-400 hover:bg-white/5 transition-colors"
                    >
                      <PowerIcon className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* New Agent button */}
        {!showCreate ? (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 mb-8 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            New Agent
          </button>
        ) : (
          <div className="mb-8 rounded-2xl border border-blue-500/40 bg-[#1f2937] p-5 space-y-3 max-w-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">New Agent</p>
              <button
                onClick={() => { setShowCreate(false); setCreateError(""); setNewName(""); setNewPrompt(""); }}
                className="text-white/30 hover:text-white transition-colors"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              placeholder="Agent name"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-blue-500"
            />
            <textarea
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              placeholder="System prompt (optional)"
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-blue-500 resize-none"
            />
            {createError && <p className="text-red-400 text-xs">{createError}</p>}
            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg py-2 transition-colors"
            >
              {creating ? "Creating…" : "Create Agent"}
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Agent cards */}
          {filteredAgents.map((agent) => (
            <div
              key={agent.id}
              className={`group relative rounded-2xl border bg-[#1f2937] transition-all ${
                editingId === agent.id
                  ? "border-blue-500/50"
                  : "border-white/10 hover:border-blue-500/40 hover:bg-[#243044]"
              }`}
            >
              <div
                onClick={() => editingId !== agent.id && onSelectAgent(agent)}
                className={`p-5 ${editingId !== agent.id ? "cursor-pointer" : ""}`}
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                      <CpuChipIcon className="w-4 h-4 text-blue-400" />
                    </div>
                    <span className="font-semibold text-white text-sm truncate">
                      <HighlightedText text={agent.name} query={agentSearch} />
                    </span>
                  </div>

                  {editingId !== agent.id && (
                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(agent.id);
                          setEditPrompt((prev) => ({ ...prev, [agent.id]: agent.system_prompt ?? "" }));
                        }}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                        title="Edit prompt"
                      >
                        <PencilSquareIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteAgent(agent); }}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"
                        title="Delete agent"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {editingId !== agent.id ? (
                  <>
                    <p className="text-sm text-white/40 line-clamp-2 leading-relaxed min-h-[40px]">
                      {agent.system_prompt
                        ? agent.system_prompt
                        : <span className="italic">No system prompt</span>
                      }
                    </p>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xs text-white/25 bg-white/5 px-2 py-0.5 rounded-full">
                        {agent.model ?? "default"}
                      </span>
                      <span className="text-xs text-blue-400/60 group-hover:text-blue-400 transition-colors">
                        Chat →
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2.5 mt-1" onClick={(e) => e.stopPropagation()}>
                    <p className="text-xs text-white/40">System Prompt</p>
                    <textarea
                      autoFocus
                      value={editPrompt[agent.id] ?? ""}
                      onChange={(e) => setEditPrompt((prev) => ({ ...prev, [agent.id]: e.target.value }))}
                      placeholder="System prompt (optional)"
                      rows={4}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-blue-500 resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex-1 py-1.5 rounded-lg text-sm text-white/40 hover:bg-white/5 transition-colors border border-white/10"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSave(agent)}
                        disabled={saving === agent.id}
                        className="flex-1 py-1.5 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors"
                      >
                        {saving === agent.id ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

        </div>

        {agents.length === 0 && !showCreate && (
          <p className="text-center text-white/20 text-sm mt-12">
            No agents yet — create your first one above.
          </p>
        )}
        {agents.length > 0 && filteredAgents.length === 0 && (
          <p className="text-center text-white/20 text-sm mt-12">No agents match &ldquo;{agentSearch}&rdquo;</p>
        )}
      </div>

      {/* Usage dashboard button — bottom left */}
      <button
        onClick={() => router.push("/usage")}
        className="fixed bottom-6 left-6 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-colors text-sm"
      >
        <ChartBarIcon className="w-4 h-4" />
        Usage Dashboard
      </button>
    </div>
  );
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-400/30 text-yellow-200 rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}
