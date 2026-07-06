"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  CpuChipIcon,
  ChatBubbleLeftIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
  BoltIcon,
  DocumentTextIcon,
  CircleStackIcon,
  ClockIcon,
  SparklesIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

interface AgentStat {
  agentId: string;
  name: string;
  sessionCount: number;
  runCount: number;
  estimatedTokens: number;
}

interface Totals {
  totalSessions: number;
  totalRuns: number;
  totalTokens: number;
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

const ORDER_KEY = "usage_agent_order";

export default function UsagePage() {
  const router = useRouter();
  const [agents, setAgents] = useState<AgentStat[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const dragOverIndexRef = useRef<number | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/usage", { cache: "no-store" });
      if (res.status === 401) { router.replace("/login?reason=session_expired"); return; }
      if (!res.ok) { setError("Failed to load usage data."); return; }
      const data = await res.json();
      setAgents(data.agents ?? []);
      setTotals(data.totals ?? null);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ORDER_KEY);
      if (saved) setOrder(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  const orderedAgents = (() => {
    if (order.length === 0) return agents;
    const map = new Map(order.map((id, i) => [id, i]));
    return [...agents].sort((a, b) => {
      const ai = map.has(a.agentId) ? map.get(a.agentId)! : 9999;
      const bi = map.has(b.agentId) ? map.get(b.agentId)! : 9999;
      return ai - bi;
    });
  })();

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

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const from = dragIndexRef.current;
    const to = dragOverIndexRef.current;
    if (from !== null && to !== null && from !== to) {
      const ids = orderedAgents.map((a) => a.agentId);
      const [moved] = ids.splice(from, 1);
      ids.splice(to, 0, moved);
      setOrder(ids);
      localStorage.setItem(ORDER_KEY, JSON.stringify(ids));
    }
    dragIndexRef.current = null;
    dragOverIndexRef.current = null;
    setDragIndex(null);
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    dragIndexRef.current = null;
    dragOverIndexRef.current = null;
    setDragIndex(null);
    setDragOverIndex(null);
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:bg-white/10 hover:text-white transition-colors"
            title="Back"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-bold text-base">Usage Dashboard</h1>
            <p className="text-xs text-white/30">Estimated token usage across all agents</p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors disabled:opacity-40"
        >
          <ArrowPathIcon className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {error && (
          <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-4 py-3">{error}</p>
        )}

        {/* Totals */}
        {totals && (
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Total Sessions" value={fmt(totals.totalSessions)} />
            <StatCard label="Total Exchanges" value={fmt(totals.totalRuns)} />
            <StatCard label="Est. Tokens Used" value={fmt(totals.totalTokens)} note="~4 chars/token" />
          </div>
        )}

        {/* Per-agent table */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">By Agent</h2>
            {agents.length > 1 && (
              <span className="text-xs text-white/20">Drag to reorder</span>
            )}
          </div>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : agents.length === 0 ? (
            <p className="text-sm text-white/30 py-6 text-center">No agents found.</p>
          ) : (
            <div className="rounded-xl border border-white/10 overflow-hidden divide-y divide-white/5">
              <div className="grid grid-cols-4 px-4 py-2 text-xs text-white/30 font-medium bg-white/5">
                <span>Agent</span>
                <span className="text-right">Sessions</span>
                <span className="text-right">Exchanges</span>
                <span className="text-right">Est. Tokens</span>
              </div>
              {orderedAgents.map((a, index) => {
                const isDragging = dragIndex === index;
                const isDropTarget = dragOverIndex === index && dragIndex !== index;
                return (
                  <div
                    key={a.agentId}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    className={`grid grid-cols-4 px-4 py-3 items-center transition-all cursor-grab active:cursor-grabbing select-none
                      ${isDragging ? "opacity-40 bg-white/5" : ""}
                      ${isDropTarget ? "bg-blue-500/10 border-l-2 border-blue-500" : "hover:bg-white/5"}
                    `}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded-md bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                        <CpuChipIcon className="w-3 h-3 text-blue-400" />
                      </div>
                      <span className="text-sm truncate">{a.name}</span>
                    </div>
                    <span className="text-right text-sm text-white/60">{fmt(a.sessionCount)}</span>
                    <div className="flex items-center justify-end gap-1.5 text-sm text-white/60">
                      <ChatBubbleLeftIcon className="w-3.5 h-3.5 text-white/20" />
                      {fmt(a.runCount)}
                    </div>
                    <span className="text-right text-sm font-mono text-emerald-400">{fmt(a.estimatedTokens)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-xs text-white/20 text-center">
          Token estimates use a 4 characters per token approximation and are for reference only.
        </p>

        {/* Platform Limits */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <ExclamationTriangleIcon className="w-4 h-4 text-amber-400/70" />
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Platform Limits</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <LimitCard
              icon={<BoltIcon className="w-5 h-5 text-amber-400" />}
              title="Session Token Limit"
              value="50,000 tokens"
              detail="~200,000 characters per conversation. When reached, start a new session to continue."
              color="amber"
            />
            <LimitCard
              icon={<DocumentTextIcon className="w-5 h-5 text-blue-400" />}
              title="Document Page Limit"
              value="25 pages per file"
              detail="Files exceeding 25 pages are rejected at upload time. Split large documents before uploading."
              color="blue"
            />
            <LimitCard
              icon={<MagnifyingGlassIcon className="w-5 h-5 text-emerald-400" />}
              title="Knowledge Base Retrieval"
              value="Top 10 chunks per query"
              detail="Each user message retrieves up to 10 most relevant content chunks (2,000 chars each) from the knowledge base."
              color="emerald"
            />
            <LimitCard
              icon={<ClockIcon className="w-5 h-5 text-violet-400" />}
              title="File Extraction Timeout"
              value="60 seconds"
              detail="If a file takes longer than 60 seconds to process, the upload will fail. Try a smaller or simpler document."
              color="violet"
            />
            <LimitCard
              icon={<SparklesIcon className="w-5 h-5 text-sky-400" />}
              title="AI Model"
              value="GPT-4o Mini"
              detail="128,000 token context window. Optimised for speed and cost while maintaining strong reasoning."
              color="sky"
            />
            <LimitCard
              icon={<CircleStackIcon className="w-5 h-5 text-rose-400" />}
              title="Chunk Size"
              value="2,000 characters"
              detail="Documents are split into 2,000-character chunks with a 50-character overlap when indexed into the knowledge base."
              color="rose"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-4">
      <p className="text-xs text-white/40 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {note && <p className="text-xs text-white/20 mt-0.5">{note}</p>}
    </div>
  );
}

const COLOR_MAP: Record<string, { border: string; bg: string; iconBg: string }> = {
  amber:   { border: "border-amber-500/20",   bg: "bg-amber-500/5",   iconBg: "bg-amber-500/10" },
  blue:    { border: "border-blue-500/20",    bg: "bg-blue-500/5",    iconBg: "bg-blue-500/10" },
  emerald: { border: "border-emerald-500/20", bg: "bg-emerald-500/5", iconBg: "bg-emerald-500/10" },
  violet:  { border: "border-violet-500/20",  bg: "bg-violet-500/5",  iconBg: "bg-violet-500/10" },
  sky:     { border: "border-sky-500/20",     bg: "bg-sky-500/5",     iconBg: "bg-sky-500/10" },
  rose:    { border: "border-rose-500/20",    bg: "bg-rose-500/5",    iconBg: "bg-rose-500/10" },
};

function LimitCard({
  icon,
  title,
  value,
  detail,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  detail: string;
  color: string;
}) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.blue;
  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} px-5 py-4 space-y-3`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg ${c.iconBg} flex items-center justify-center shrink-0`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-white/40 font-medium uppercase tracking-wide">{title}</p>
          <p className="text-base font-bold text-white mt-0.5">{value}</p>
        </div>
      </div>
      <p className="text-xs text-white/35 leading-relaxed">{detail}</p>
    </div>
  );
}
