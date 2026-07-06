"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { UserAgent } from "@/lib/types";
import { AgentPrefs, AVATAR_COLORS, getAgentLastActive, saveAgentPrefs } from "@/lib/agentPrefs";
import {
  PlusIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
  BarsArrowDownIcon,
  CheckIcon,
  FingerPrintIcon,
  TagIcon,
  EyeIcon,
  LockClosedIcon,
  BuildingOfficeIcon,
  PhoneIcon,
  BookOpenIcon,
  SparklesIcon,
  EllipsisHorizontalIcon,
  PencilIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  LinkIcon,
  ClipboardDocumentIcon,
} from "@heroicons/react/24/outline";

interface Props {
  agents: UserAgent[];
  agentPrefs: Record<string, AgentPrefs>;
  onSelectAgent: (agent: UserAgent) => void;
  onCreateAgent: (name: string, systemPrompt: string, welcomeMessage?: string) => Promise<string | null>;
  onDeleteAgent?: (agent: UserAgent) => void;
  onDuplicateAgent?: (name: string, systemPrompt: string) => Promise<boolean>;
  onRenameAgent?: (agent: UserAgent, newName: string) => Promise<boolean>;
  user?: { id: string; email: string; username?: string } | null;
  onLogout?: () => void;
}

type SortOption = "custom" | "az" | "za" | "most-recent" | "least-recent" | "newest" | "oldest";

interface SessionMeta {
  count: number;
  lastActive: string | null; // ISO date of most recent session
}

const SORT_LABELS: Record<SortOption, string> = {
  custom: "Custom Order",
  az: "A → Z",
  za: "Z → A",
  "most-recent": "Most Active",
  "least-recent": "Least Active",
  newest: "Newest Agent",
  oldest: "Oldest Agent",
};

const INACTIVE_DAYS = 7;

function fmtBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function daysAgo(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function formatLastActive(dateStr: string | null): string {
  const days = daysAgo(dateStr);
  if (days === null) return "No sessions";
  if (days === 0) return "Active today";
  if (days === 1) return "Active yesterday";
  if (days < 30) return `Active ${days}d ago`;
  const months = Math.floor(days / 30);
  return `Active ${months}mo ago`;
}

export default function AgentsScreen({
  agents,
  agentPrefs,
  onSelectAgent,
  onCreateAgent,
  onDeleteAgent,
  onDuplicateAgent,
  onRenameAgent,
}: Props) {
  const router = useRouter();
  const [agentSearch, setAgentSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newWelcomeMessage, setNewWelcomeMessage] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [newAvatarColor, setNewAvatarColor] = useState(AVATAR_COLORS[0]);
  const [newAvatarEmoji, setNewAvatarEmoji] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  // Step 2 state
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newSupportContact, setNewSupportContact] = useState("");
  const [newKnowledgeMode, setNewKnowledgeMode] = useState<"ai" | "kb">("ai");
  const [sortBy, setSortBy] = useState<SortOption>("custom");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sessionMeta, setSessionMeta] = useState<Record<string, SessionMeta>>({});
  const [storageInfo, setStorageInfo] = useState<Record<string, number>>({});
  const [customOrder, setCustomOrder] = useState<string[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const dragOverIndexRef = useRef<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [copiedShareId, setCopiedShareId] = useState<string | null>(null);
  const [shareAgent, setShareAgent] = useState<{ agent: UserAgent; link: string } | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");
  const [confirmDeleteAgent, setConfirmDeleteAgent] = useState<UserAgent | null>(null);

  // Load custom order from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("agents_custom_order");
      if (saved) setCustomOrder(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  // Fetch session counts and storage for all agents
  useEffect(() => {
    if (agents.length === 0) return;
    const fetchMeta = async () => {
      // Initialize storage as loading (-1) for each agent
      setStorageInfo(Object.fromEntries(agents.map((a) => [a.id, -1])));

      const [sessionResults, storageResults] = await Promise.all([
        Promise.allSettled(
          agents.map((a) =>
            fetch(`/api/sessions?agentId=${a.id}`)
              .then((r) => r.json())
              .then((data) => {
                const sessions: { created_at: string }[] = data.sessions ?? [];
                const sorted = [...sessions].sort(
                  (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );
                return { id: a.id, count: sessions.length, lastActive: sorted[0]?.created_at ?? null };
              })
          )
        ),
        Promise.allSettled(
          agents.map((a) =>
            fetch(`/api/sources?agentId=${a.id}`)
              .then((r) => r.json())
              .then((data) => {
                const sources: { file_size?: number }[] = data.sources ?? data ?? [];
                const total = sources.reduce((sum, s) => sum + (s.file_size ?? 0), 0);
                return { id: a.id, bytes: total };
              })
          )
        ),
      ]);

      const meta: Record<string, SessionMeta> = {};
      sessionResults.forEach((r, i) => {
        const agentId = agents[i].id;
        const localLastActive = getAgentLastActive(agentId);
        if (r.status === "fulfilled") {
          // Prefer the locally-tracked timestamp (updated on every message sent)
          // over session.created_at (which only reflects when the session was first started)
          const sessionLastActive = r.value.lastActive;
          const lastActive = [localLastActive, sessionLastActive]
            .filter(Boolean)
            .sort()
            .pop() ?? null;
          meta[agentId] = { count: r.value.count, lastActive };
        } else {
          meta[agentId] = { count: 0, lastActive: localLastActive };
        }
      });
      setSessionMeta(meta);

      const storage: Record<string, number> = {};
      storageResults.forEach((r, i) => {
        const agentId = agents[i].id;
        if (r.status === "fulfilled") {
          storage[agentId] = r.value.bytes;
        } else {
          storage[agentId] = -2;
        }
      });
      setStorageInfo(storage);
    };
    fetchMeta();
  }, [agents]);

  async function handleCreate() {
    if (!newName.trim()) { setCreateError("Agent name is required."); return; }
    setCreating(true);
    setCreateError("");
    const newId = await onCreateAgent(newName.trim(), newPrompt.trim(), newWelcomeMessage.trim() || undefined);
    setCreating(false);
    if (newId) {
      saveAgentPrefs(newId, { avatarColor: newAvatarColor, avatarEmoji: newAvatarEmoji || undefined });
      setCreatedAgentId(newId);
      setCreateStep(2);
    } else {
      setCreateError("Failed to create. Try again.");
    }
  }

  async function handleComplete() {
    if (createdAgentId) {
      saveAgentPrefs(createdAgentId, {
        companyName: newCompanyName.trim() || undefined,
        supportContact: newSupportContact.trim() || undefined,
        knowledgeMode: newKnowledgeMode,
      });
      // If KB mode was chosen, patch the agent so the strict KB-only instruction is
      // stored on the server. Agents are created with the "ai" instruction by default
      // in step 1, so we only need to PATCH when the user picked "kb".
      if (newKnowledgeMode === "kb") {
        try {
          await fetch(`/api/agents/${createdAgentId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              system_prompt: newPrompt.trim(),
              knowledge_mode: "kb",
            }),
          });
        } catch { /* best effort — localStorage prefs are saved; mode will sync on next settings save */ }
      }
    }
    // Navigate to the new agent — find it from the current agents list
    const agentToSelect = agents.find((a) => a.id === createdAgentId);

    // Reset all create state
    setShowCreate(false);
    setCreateStep(1);
    setCreatedAgentId(null);
    setNewName(""); setNewWelcomeMessage(""); setNewPrompt("");
    setNewAvatarColor(AVATAR_COLORS[0]); setNewAvatarEmoji("");
    setNewCompanyName(""); setNewSupportContact(""); setNewKnowledgeMode("ai");

    if (agentToSelect) onSelectAgent(agentToSelect);
  }

  // Sorted + filtered agents
  const getOrderedAgents = () => {
    let list = [...agents];

    if (sortBy === "custom") {
      if (customOrder.length > 0) {
        const orderMap = new Map(customOrder.map((id, i) => [id, i]));
        list.sort((a, b) => {
          const ai = orderMap.has(a.id) ? orderMap.get(a.id)! : 9999;
          const bi = orderMap.has(b.id) ? orderMap.get(b.id)! : 9999;
          return ai - bi;
        });
      }
    } else if (sortBy === "az") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "za") {
      list.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortBy === "most-recent") {
      list.sort((a, b) => {
        const la = sessionMeta[a.id]?.lastActive ?? "";
        const lb = sessionMeta[b.id]?.lastActive ?? "";
        return lb.localeCompare(la);
      });
    } else if (sortBy === "least-recent") {
      list.sort((a, b) => {
        const la = sessionMeta[a.id]?.lastActive ?? "9999";
        const lb = sessionMeta[b.id]?.lastActive ?? "9999";
        return la.localeCompare(lb);
      });
    } else if (sortBy === "newest") {
      list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    } else if (sortBy === "oldest") {
      list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    }

    return list;
  };

  const orderedAgents = getOrderedAgents();
  const filteredAgents = agentSearch.trim()
    ? orderedAgents.filter((a) => a.name.toLowerCase().includes(agentSearch.toLowerCase()))
    : orderedAgents;

  // Drag-to-reorder handlers (only active when sort=custom)
  function handleDragStart(index: number) {
    dragIndexRef.current = index;
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragOverIndexRef.current !== index) {
      dragOverIndexRef.current = index;
      setDragOverIndex(index);
    }
  }

  function handleDragEnd() {
    dragIndexRef.current = null;
    dragOverIndexRef.current = null;
    setDragIndex(null);
    setDragOverIndex(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const from = dragIndexRef.current;
    const to = dragOverIndexRef.current;
    if (from !== null && to !== null && from !== to) {
      const newOrder = [...orderedAgents.map((a) => a.id)];
      const [moved] = newOrder.splice(from, 1);
      newOrder.splice(to, 0, moved);
      setCustomOrder(newOrder);
      localStorage.setItem("agents_custom_order", JSON.stringify(newOrder));
    }
    handleDragEnd();
  }

  if (showCreate) {
    const previewName = newName.trim() || "Agent Name";
    const previewWelcome = newWelcomeMessage.trim() || "Hello! How can I help you today?";

    function resetCreate() {
      setShowCreate(false); setCreateStep(1); setCreatedAgentId(null);
      setCreateError(""); setNewName(""); setNewWelcomeMessage(""); setNewPrompt("");
      setNewAvatarColor(AVATAR_COLORS[0]); setNewAvatarEmoji("");
      setNewCompanyName(""); setNewSupportContact(""); setNewKnowledgeMode("ai");
    }

    // ── STEP 2 ────────────────────────────────────────────────────────────
    if (createStep === 2) {
      return (
        <div className="flex-1 flex flex-col bg-[#1a1a1a] overflow-hidden" style={{ fontFamily: "'Trebuchet MS', sans-serif" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-10 py-5 border-b border-white/8 shrink-0">
            {/* Step indicator */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center">
                  <CheckIcon className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <span className="text-xs text-white/30">Agent Created</span>
              </div>
              <div className="w-6 h-px bg-white/10" />
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                  <span className="text-xs text-white font-bold">2</span>
                </div>
                <span className="text-xs text-white/60">Setup</span>
              </div>
            </div>
            <button
              onClick={handleComplete}
              className="px-6 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
            >
              Complete
            </button>
          </div>

          {/* Two-column body */}
          <div className="flex-1 flex overflow-hidden">

            {/* Left — step 2 form */}
            <div className="flex-1 overflow-y-auto px-12 py-10">
              <div className="max-w-lg mx-auto space-y-8">
                <div>
                  <h1 className="text-3xl font-semibold text-white">Almost there</h1>
                  <p className="text-white/40 text-sm mt-1">A few more details to help your agent serve users better. You can change these later in Agent Settings.</p>
                </div>

                {/* Company / Product */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-white/60 uppercase tracking-widest">
                    <BuildingOfficeIcon className="w-4 h-4" />
                    Company / Product Represented
                  </label>
                  <input
                    autoFocus
                    type="text"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="e.g. Acme Corp, My SaaS Product…"
                    className="w-full bg-white/5 border border-white/10 rounded-md px-5 py-3.5 text-base text-white placeholder-white/20 outline-none focus:border-blue-500 transition-colors"
                  />
                  <p className="text-xs text-white/25">Helps the agent introduce itself and stay on-brand.</p>
                </div>

                {/* Support Contact */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-white/60 uppercase tracking-widest">
                    <PhoneIcon className="w-4 h-4" />
                    Support Team Contact
                  </label>
                  <input
                    type="text"
                    value={newSupportContact}
                    onChange={(e) => setNewSupportContact(e.target.value)}
                    placeholder="support@example.com or +1 555-000-0000"
                    className="w-full bg-white/5 border border-white/10 rounded-md px-5 py-3.5 text-base text-white placeholder-white/20 outline-none focus:border-blue-500 transition-colors"
                  />
                  <p className="text-xs text-white/25">The agent can share this when users need to reach a human.</p>
                </div>

                {/* Knowledge Mode */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-white/60 uppercase tracking-widest">
                    <BookOpenIcon className="w-4 h-4" />
                    AI Knowledge Base Answering
                  </label>
                  <p className="text-sm text-white/40 leading-relaxed">
                    Should the AI use its own knowledge, or rely on the knowledge you provide?
                    <span className="text-white/25"> You can change this later.</span>
                  </p>

                  <div className="space-y-3">
                    {/* Option: AI's own knowledge */}
                    <button
                      onClick={() => setNewKnowledgeMode("ai")}
                      className={`w-full text-left rounded-md border px-5 py-4 transition-all ${
                        newKnowledgeMode === "ai"
                          ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30"
                          : "border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          newKnowledgeMode === "ai" ? "border-blue-400" : "border-white/20"
                        }`}>
                          {newKnowledgeMode === "ai" && <div className="w-2 h-2 rounded-full bg-blue-400" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <SparklesIcon className="w-4 h-4 text-blue-400 shrink-0" />
                            <span className="text-sm font-semibold text-white">AI's Own Knowledge</span>
                          </div>
                          <p className="text-xs text-white/40 leading-relaxed">
                            The AI searches your knowledge base first, then supplements answers with its own training knowledge to fill any gaps.
                          </p>
                        </div>
                      </div>
                    </button>

                    {/* Option: Knowledge Base only */}
                    <button
                      onClick={() => setNewKnowledgeMode("kb")}
                      className={`w-full text-left rounded-md border px-5 py-4 transition-all ${
                        newKnowledgeMode === "kb"
                          ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30"
                          : "border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          newKnowledgeMode === "kb" ? "border-blue-400" : "border-white/20"
                        }`}>
                          {newKnowledgeMode === "kb" && <div className="w-2 h-2 rounded-full bg-blue-400" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <BookOpenIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span className="text-sm font-semibold text-white">Your Knowledge Base</span>
                          </div>
                          <p className="text-xs text-white/40 leading-relaxed">
                            The AI relies only on documents and content you upload. Best for precise, domain-specific support.
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleComplete}
                  className="w-full py-3.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-base font-semibold transition-colors"
                >
                  Complete Setup
                </button>
              </div>
            </div>

            {/* Right — summary of step 1 */}
            <div className="w-96 shrink-0 border-l border-white/8 bg-[#141414] flex flex-col overflow-hidden">
              <div className="px-6 py-4 border-b border-white/8 shrink-0">
                <p className="text-xs font-semibold text-white/30 uppercase tracking-widest">Your New Agent</p>
              </div>
              <div className="px-6 py-6 flex-1 overflow-y-auto space-y-5">
                {/* Avatar + name */}
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 font-bold"
                    style={{ backgroundColor: `${newAvatarColor}22`, border: `2px solid ${newAvatarColor}55` }}
                  >
                    {newAvatarEmoji || <span style={{ color: newAvatarColor }}>{previewName.charAt(0).toUpperCase()}</span>}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-base">{previewName}</p>
                    <p className="text-xs text-white/30 mt-0.5">Just created</p>
                  </div>
                </div>

                {/* Welcome message */}
                <div className="rounded-md border border-white/8 bg-white/3 px-4 py-3">
                  <p className="text-xs text-white/30 uppercase tracking-widest mb-1.5">Welcome Message</p>
                  <p className="text-sm text-white/60 leading-relaxed">{previewWelcome}</p>
                </div>

                {/* System prompt */}
                {newPrompt.trim() && (
                  <div className="rounded-md border border-white/8 bg-white/3 px-4 py-3">
                    <p className="text-xs text-white/30 uppercase tracking-widest mb-1.5">System Prompt</p>
                    <p className="text-sm text-white/50 leading-relaxed line-clamp-5">{newPrompt.trim()}</p>
                  </div>
                )}

                <p className="text-xs text-white/20 leading-relaxed">
                  Fill in the details on the left to finish setting up your agent. These help it provide a better experience to your users.
                </p>
              </div>
            </div>

          </div>
        </div>
      );
    }

    // ── STEP 1 ────────────────────────────────────────────────────────────
    return (
      <div className="flex-1 flex flex-col bg-[#1a1a1a] overflow-hidden" style={{ fontFamily: "'Trebuchet MS', sans-serif" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-10 py-5 border-b border-white/8 shrink-0">
          <button onClick={resetCreate} className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm">
            <XMarkIcon className="w-5 h-5" />
            Cancel
          </button>
          {/* Step indicator */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                <span className="text-xs text-white font-bold">1</span>
              </div>
              <span className="text-xs text-white/60">Agent Setup</span>
            </div>
            <div className="w-6 h-px bg-white/10" />
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                <span className="text-xs text-white/30 font-bold">2</span>
              </div>
              <span className="text-xs text-white/25">Configuration</span>
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="px-6 py-2 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
          >
            {creating ? "Creating…" : "Create Agent →"}
          </button>
        </div>

        {/* Two-column body */}
        <div className="flex-1 flex overflow-hidden">

          {/* Left — form */}
          <div className="flex-1 overflow-y-auto px-12 py-10">
            <div className="max-w-lg mx-auto space-y-8">
              <div>
                <h1 className="text-3xl font-semibold text-white">New Agent</h1>
                <p className="text-white/40 text-sm mt-1">Set up your agent below. Preview updates live on the right.</p>
              </div>

              {/* Avatar (optional) */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-white/60 uppercase tracking-widest">
                  Avatar <span className="normal-case font-normal text-white/25 tracking-normal">— optional</span>
                </label>
                <div className="flex items-center gap-4">
                  {/* Preview */}
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 font-bold"
                    style={{ backgroundColor: `${newAvatarColor}22`, border: `2px solid ${newAvatarColor}55` }}
                  >
                    {newAvatarEmoji || <span style={{ color: newAvatarColor }}>{previewName.charAt(0).toUpperCase()}</span>}
                  </div>
                  <input
                    type="text"
                    value={newAvatarEmoji}
                    onChange={(e) => setNewAvatarEmoji(e.target.value.slice(0, 2))}
                    placeholder="Emoji (optional)"
                    className="w-36 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-base text-white placeholder-white/25 outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {AVATAR_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewAvatarColor(color)}
                      className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                      style={{ backgroundColor: color }}
                    >
                      {newAvatarColor === color && <CheckIcon className="w-4 h-4 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Agent Name */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-white/60 uppercase tracking-widest">Agent Name</label>
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={(e) => { setNewName(e.target.value); setCreateError(""); }}
                  placeholder="e.g. Support Bot, Sales Assistant…"
                  className="w-full bg-white/5 border border-white/10 rounded-md px-5 py-3.5 text-base text-white placeholder-white/20 outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Welcome Message */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-white/60 uppercase tracking-widest">Welcome Message</label>
                <textarea
                  value={newWelcomeMessage}
                  onChange={(e) => setNewWelcomeMessage(e.target.value)}
                  placeholder="The first message users see when they open a chat…"
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-md px-5 py-3.5 text-base text-white placeholder-white/20 outline-none focus:border-blue-500 transition-colors resize-none"
                />
              </div>

              {/* Agent Prompt */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-white/60 uppercase tracking-widest">Agent Prompt</label>
                <textarea
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  placeholder="Describe how this agent should behave, its tone, and its purpose… (optional)"
                  rows={5}
                  className="w-full bg-white/5 border border-white/10 rounded-md px-5 py-3.5 text-base text-white placeholder-white/20 outline-none focus:border-blue-500 transition-colors resize-none"
                />
              </div>

              {createError && <p className="text-red-400 text-sm">{createError}</p>}

              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="w-full py-3.5 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-base font-semibold transition-colors"
              >
                {creating ? "Creating…" : "Create Agent →"}
              </button>
            </div>
          </div>

          {/* Right — live preview */}
          <div className="w-96 shrink-0 border-l border-white/8 bg-[#141414] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-white/8 shrink-0">
              <p className="text-xs font-semibold text-white/30 uppercase tracking-widest">Preview</p>
            </div>

            {/* Card preview */}
            <div className="px-6 pt-6 shrink-0">
              <p className="text-xs text-white/25 mb-3">Agent Card</p>
              <div className="rounded-md border border-white/10 bg-[#272727] p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-lg shrink-0 font-bold"
                    style={{ backgroundColor: `${newAvatarColor}22`, border: `1px solid ${newAvatarColor}60` }}
                  >
                    {newAvatarEmoji || <span style={{ color: newAvatarColor }}>{previewName.charAt(0).toUpperCase()}</span>}
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <p className="font-semibold text-white text-sm truncate">{previewName}</p>
                    <p className="text-xs text-white/30 mt-0.5 line-clamp-2 leading-relaxed">
                      {newPrompt.trim() || <span className="italic text-white/20">No system prompt</span>}
                    </p>
                  </div>
                </div>
                <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                  <span className="text-xs text-white/25 bg-white/5 px-2 py-0.5 rounded-sm">gpt-4o-mini</span>
                  <span className="text-xs text-white/20">0 sessions</span>
                </div>
              </div>
            </div>

            {/* Chat preview */}
            <div className="px-6 pt-6 flex-1 overflow-hidden flex flex-col">
              <p className="text-xs text-white/25 mb-3">Chat Preview</p>
              <div className="flex-1 rounded-md border border-white/10 bg-[#0f0f0f] flex flex-col overflow-hidden">
                {/* Fake chat header */}
                <div className="px-4 py-3 border-b border-white/8 flex items-center gap-2.5 shrink-0">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 font-bold"
                    style={{ backgroundColor: `${newAvatarColor}22`, border: `1px solid ${newAvatarColor}55` }}
                  >
                    {newAvatarEmoji || <span style={{ color: newAvatarColor }}>{previewName.charAt(0).toUpperCase()}</span>}
                  </div>
                  <span className="text-sm font-medium text-white truncate">{previewName}</span>
                </div>

                {/* Welcome bubble */}
                <div className="flex-1 p-4 overflow-y-auto">
                  <div className="flex gap-2.5 items-start">
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-xs shrink-0 font-bold mt-0.5"
                      style={{ backgroundColor: `${newAvatarColor}22`, border: `1px solid ${newAvatarColor}55` }}
                    >
                      {newAvatarEmoji || <span style={{ color: newAvatarColor }}>{previewName.charAt(0).toUpperCase()}</span>}
                    </div>
                    <div className="bg-white/8 rounded-xl rounded-tl-sm px-3 py-2 max-w-[85%]">
                      <p className="text-sm text-white/80 leading-relaxed">{previewWelcome}</p>
                    </div>
                  </div>
                </div>

                {/* Fake input */}
                <div className="px-3 py-3 border-t border-white/8 shrink-0">
                  <div className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-xs text-white/20">
                    Message {previewName}…
                  </div>
                </div>
              </div>
            </div>
            <div className="h-6 shrink-0" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 overflow-y-auto px-6 py-8 bg-[#1a1a1a]" style={{ fontFamily: "'Trebuchet MS', sans-serif" }}>
      <div className="w-full">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold text-white">Your Agents</h1>
          </div>

        </div>

        {/* Search + New Agent + Sort row */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-md bg-white/10 hover:bg-white/15 text-white text-base font-medium transition-colors shrink-0"
          >
            <PlusIcon className="w-5 h-5" />
            Create New Agent
          </button>
          <div className="relative w-72">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
            <input
              type="text"
              value={agentSearch}
              onChange={(e) => setAgentSearch(e.target.value)}
              placeholder="Search agents…"
              className="w-full bg-white/5 border border-white/10 rounded-md pl-9 pr-4 py-2.5 text-base text-white placeholder-white/25 outline-none focus:border-white/25 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => router.push("/usage")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-md bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-colors text-sm font-medium"
            >
              <ChartBarIcon className="w-4 h-4" />
              Usage Dashboard
            </button>
            {agents.length > 0 && (
              <span className="text-base text-white/35 font-medium">
                {agents.length} Agents
              </span>
            )}
          </div>

          {/* Sort dropdown */}
          <div className="relative ml-auto">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-md bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 text-sm font-medium transition-colors"
            >
              <BarsArrowDownIcon className="w-4 h-4" />
              {SORT_LABELS[sortBy]}
            </button>
            {showSortMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                <div className="absolute right-0 top-12 z-20 w-48 bg-[#272727] border border-white/10 rounded-md shadow-xl overflow-hidden py-1">
                  {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => { setSortBy(opt); setShowSortMenu(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        sortBy === opt
                          ? "text-blue-400 bg-blue-500/10"
                          : "text-white/60 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {SORT_LABELS[opt]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {sortBy === "custom" && agents.length > 1 && (
          <p className="text-xs text-white/20 mb-6">Drag cards to reorder</p>
        )}


        {/* Grid */}
        {agents.length === 0 ? (
          <EmptyState onCreate={() => setShowCreate(true)} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

            {filteredAgents.map((agent, index) => {
              const meta = sessionMeta[agent.id];
              const days = daysAgo(meta?.lastActive ?? null);
              const isActive = days !== null && days < INACTIVE_DAYS;
              const isDragging = sortBy === "custom" && dragIndex === index;
              const isDropTarget = sortBy === "custom" && dragOverIndex === index && dragIndex !== index;
              const accentColor = agentPrefs[agent.id]?.avatarColor ?? AVATAR_COLORS[0];

              const isEditingName = editingNameId === agent.id;
              const menuOpen = openMenuId === agent.id;

              return (
                <div
                  key={agent.id}
                  onClick={() => {
                    if (isDragging || isEditingName || menuOpen) return;
                    onSelectAgent(agent);
                  }}
                  draggable={sortBy === "custom"}
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  className={`group/card relative rounded-md border bg-[#272727] transition-all duration-200 cursor-pointer select-none overflow-visible
                    ${isDragging ? "opacity-40 border-white/10 scale-95" : ""}
                    ${isDropTarget ? "border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/30 scale-[1.02]" : ""}
                    ${!isDragging && !isDropTarget ? "border-white/8 hover:border-white/30 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_4px_24px_rgba(0,0,0,0.5)]" : ""}
                  `}
                >
                  <div className="p-6">
                    {/* Card header */}
                    <div className="flex items-start gap-4 min-w-0 mb-4">
                      <AgentIcon prefs={agentPrefs[agent.id]} name={agent.name} color={accentColor} />
                      <div className="flex-1 min-w-0 pt-1">
                        {isEditingName ? (
                          <input
                            autoFocus
                            type="text"
                            value={editingNameValue}
                            onChange={(e) => setEditingNameValue(e.target.value)}
                            onKeyDown={async (e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const trimmed = editingNameValue.trim();
                                if (trimmed && trimmed !== agent.name) {
                                  await onRenameAgent?.(agent, trimmed);
                                }
                                setEditingNameId(null);
                              }
                              if (e.key === "Escape") setEditingNameId(null);
                            }}
                            onBlur={async () => {
                              const trimmed = editingNameValue.trim();
                              if (trimmed && trimmed !== agent.name) {
                                await onRenameAgent?.(agent, trimmed);
                              }
                              setEditingNameId(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full bg-white/8 border border-blue-500/60 rounded-md px-2 py-1 text-base font-semibold text-white outline-none"
                          />
                        ) : (
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-semibold text-white text-lg truncate">
                              <HighlightedText text={agent.name} query={agentSearch} />
                            </span>
                            {/* Status dot — right of name */}
                            <div className="relative shrink-0" title={isActive ? "Active" : "Inactive (no sessions in 7 days)"}>
                              {isActive && <div className="absolute inset-0 rounded-full animate-ping bg-green-400/50" />}
                              <div className={`relative w-2 h-2 rounded-full ${isActive ? "bg-green-400" : "bg-white/15"}`} />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 3-dot menu button — visible on card hover */}
                      <div className="relative shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(menuOpen ? null : agent.id);
                          }}
                          className={`p-1 rounded-md transition-all ${
                            menuOpen
                              ? "opacity-100 bg-white/10 text-white"
                              : "opacity-0 group-hover/card:opacity-100 text-white/50 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          <EllipsisHorizontalIcon className="w-5 h-5" />
                        </button>

                        {/* Dropdown */}
                        {menuOpen && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); }} />
                            <div className="absolute right-0 top-8 z-40 w-44 bg-[#2e2e2e] border border-white/10 rounded-md shadow-xl overflow-hidden py-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(null);
                                  setEditingNameId(agent.id);
                                  setEditingNameValue(agent.name);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/8 transition-colors text-left"
                              >
                                <PencilIcon className="w-4 h-4 shrink-0" />
                                Edit Name
                              </button>
                              {onDuplicateAgent && (
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    setOpenMenuId(null);
                                    await onDuplicateAgent(`${agent.name} (Copy)`, agent.system_prompt ?? "");
                                  }}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/8 transition-colors text-left"
                                >
                                  <DocumentDuplicateIcon className="w-4 h-4 shrink-0" />
                                  Duplicate
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(null);
                                  const prefs = agentPrefs[agent.id];
                                  const name = prefs?.displayName || agent.name;
                                  const color = prefs?.avatarColor || AVATAR_COLORS[0];
                                  const emoji = prefs?.avatarEmoji || "";
                                  const welcome = prefs?.welcomeMessage || "";
                                  const p = new URLSearchParams({ name });
                                  if (color) p.set("color", color);
                                  if (emoji) p.set("emoji", emoji);
                                  if (welcome) p.set("welcome", welcome);
                                  const link = `${window.location.origin}/chat/${agent.id}?${p.toString()}`;
                                  setShareAgent({ agent, link });
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/8 transition-colors text-left"
                              >
                                <LinkIcon className="w-4 h-4 shrink-0" />
                                Share
                              </button>
                              {onDeleteAgent && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuId(null);
                                    setConfirmDeleteAgent(agent);
                                  }}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-left"
                                >
                                  <TrashIcon className="w-4 h-4 shrink-0" />
                                  Delete
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Metadata rows */}
                    <div className="mt-4 space-y-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <FingerPrintIcon className="w-3.5 h-3.5 text-white/35 shrink-0" />
                        <span className="text-sm text-white/40 shrink-0">UUID</span>
                        <div className="flex-1 min-w-0 overflow-x-auto ml-1">
                          <span className="text-xs text-white/65 font-mono whitespace-nowrap">{agent.id}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <TagIcon className="w-3.5 h-3.5 text-white/35 shrink-0" />
                        <span className="text-sm text-white/40">Display Name</span>
                        <span className="text-sm text-white/65 ml-1 truncate">{agentPrefs[agent.id]?.displayName || agent.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {agentPrefs[agent.id]?.visibility === "public"
                          ? <EyeIcon className="w-3.5 h-3.5 text-white/35 shrink-0" />
                          : <LockClosedIcon className="w-3.5 h-3.5 text-white/35 shrink-0" />
                        }
                        <span className="text-sm text-white/40">Visibility</span>
                        <span className="text-sm text-white/65 ml-1 flex items-center gap-1.5">
                          {agentPrefs[agent.id]?.visibility === "public" ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                              Public
                            </>
                          ) : (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-white/40 inline-block" />
                              Private
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {agents.length > 0 && filteredAgents.length === 0 && (
          <p className="text-center text-white/20 text-base mt-12">No agents match &ldquo;{agentSearch}&rdquo;</p>
        )}
      </div>

      {/* Usage dashboard button — bottom left */}

      {/* Share modal */}
      {shareAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => { setShareAgent(null); setCopiedShareId(null); }}
          />
          <div className="relative w-full max-w-md bg-[#222] border border-white/10 rounded-xl shadow-2xl p-6 space-y-4">
            {/* Close */}
            <button
              onClick={() => { setShareAgent(null); setCopiedShareId(null); }}
              className="absolute top-4 right-4 text-white/30 hover:text-white/70 transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>

            {/* Icon + title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0">
                <LinkIcon className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Share Agent</h2>
                <p className="text-xs text-white/40 mt-0.5">{shareAgent.agent.name}</p>
              </div>
            </div>

            <p className="text-sm text-white/50 leading-relaxed">
              Anyone with this link can open a full-screen chat with this agent in their browser.
            </p>

            {/* Link display + copy */}
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 overflow-x-auto">
                <span className="text-xs text-white/50 font-mono whitespace-nowrap">{shareAgent.link}</span>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareAgent.link);
                  setCopiedShareId(shareAgent.agent.id);
                  setTimeout(() => setCopiedShareId(null), 2000);
                }}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-medium transition-colors"
              >
                {copiedShareId === shareAgent.agent.id ? (
                  <><CheckIcon className="w-4 h-4 text-emerald-400" /><span className="text-emerald-400">Copied!</span></>
                ) : (
                  <><ClipboardDocumentIcon className="w-4 h-4 text-white/60" /><span className="text-white/60">Copy</span></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDeleteAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirmDeleteAgent(null)}
          />
          {/* Dialog */}
          <div className="relative w-full max-w-sm bg-[#222] border border-white/10 rounded-xl shadow-2xl p-6 space-y-4">
            {/* Icon */}
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/15 border border-red-500/25 mx-auto">
              <TrashIcon className="w-6 h-6 text-red-400" />
            </div>

            <div className="text-center space-y-1.5">
              <h2 className="text-base font-semibold text-white">Delete Agent?</h2>
              <p className="text-sm text-white/50 leading-relaxed">
                <span className="text-white/80 font-medium">{confirmDeleteAgent.name}</span> will be permanently deleted along with its knowledge base and all sessions.
              </p>
              <p className="text-xs text-red-400/80">This cannot be undone.</p>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmDeleteAgent(null)}
                className="flex-1 py-2.5 rounded-md text-sm font-medium text-white/50 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteAgent?.(confirmDeleteAgent);
                  setConfirmDeleteAgent(null);
                }}
                className="flex-1 py-2.5 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-500 transition-colors"
              >
                Delete Agent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <svg
        width="80" height="80" viewBox="0 0 80 80" fill="none"
        className="mb-6 opacity-30"
      >
        <rect x="10" y="20" width="60" height="44" rx="8" stroke="white" strokeWidth="2" />
        <rect x="22" y="32" width="20" height="3" rx="1.5" fill="white" />
        <rect x="22" y="40" width="36" height="3" rx="1.5" fill="white" />
        <rect x="22" y="48" width="28" height="3" rx="1.5" fill="white" />
        <circle cx="58" cy="18" r="10" fill="#1e1e1e" stroke="white" strokeWidth="2" />
        <line x1="58" y1="14" x2="58" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <line x1="54" y1="18" x2="62" y2="18" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <p className="text-white/40 text-lg font-medium mb-2">No agents yet</p>
      <p className="text-white/20 text-sm mb-8">Create your first agent to get started</p>
      <button
        onClick={onCreate}
        className="flex items-center gap-2 px-5 py-3 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
      >
        <PlusIcon className="w-4 h-4" />
        Create Agent
      </button>
    </div>
  );
}

function AgentIcon({ prefs, name, color: colorProp }: { prefs?: AgentPrefs; name: string; color?: string }) {
  const color = colorProp ?? prefs?.avatarColor ?? AVATAR_COLORS[0];
  const emoji = prefs?.avatarEmoji;
  return (
    <div className="relative shrink-0">
      {/* Glow behind icon */}
      <div
        className="absolute inset-0 rounded-2xl blur-md opacity-40"
        style={{ backgroundColor: color }}
      />
      <div
        className="relative w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold"
        style={{ backgroundColor: `${color}28`, border: `1px solid ${color}60` }}
      >
        {emoji ? (
          <span>{emoji}</span>
        ) : (
          <span style={{ color }}>{name.charAt(0).toUpperCase()}</span>
        )}
      </div>
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
