"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CpuChipIcon,
  ChatBubbleLeftIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
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

export default function UsagePage() {
  const router = useRouter();
  const [agents, setAgents] = useState<AgentStat[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/usage");
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

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
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
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">By Agent</h2>
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
              {agents.map(a => (
                <div key={a.agentId} className="grid grid-cols-4 px-4 py-3 items-center hover:bg-white/5 transition-colors">
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
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-white/20 text-center">
          Token estimates use a 4 characters per token approximation and are for reference only.
        </p>
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
