"use client";

import { useState } from "react";
import { Conversation } from "@/lib/types";
import { CollectedData } from "@/lib/agentVariables";
import {
  ChatBubbleLeftIcon,
  ChevronDownIcon,
  TableCellsIcon,
} from "@heroicons/react/24/outline";

interface CollectedDataPanelProps {
  conversations: Conversation[];
  collectedData: Record<string, CollectedData>;
}

export default function CollectedDataPanel({
  conversations,
  collectedData,
}: CollectedDataPanelProps) {
  const [openDataIds, setOpenDataIds] = useState<Set<string>>(new Set());

  const sessionsWithData = conversations.filter(
    (c) => collectedData[c.sessionId] && Object.keys(collectedData[c.sessionId]).length > 0
  );

  function toggleData(sessionId: string) {
    setOpenDataIds((prev) => {
      const next = new Set(prev);
      next.has(sessionId) ? next.delete(sessionId) : next.add(sessionId);
      return next;
    });
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-[#1a1a1a]">
      {/* Header */}
      <div className="flex items-center justify-center px-8 py-6 border-b border-white/10 shrink-0">
        <h2 className="text-3xl font-semibold text-white">Collected Data</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6 flex flex-col items-center">
        <div className="w-full max-w-lg">
          {sessionsWithData.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 py-12 text-center mt-2">
              <TableCellsIcon className="w-8 h-8 text-white/15 mx-auto mb-3" />
              <p className="text-white/30 text-sm">No data collected yet.</p>
              <p className="text-white/20 text-xs mt-1 leading-relaxed max-w-xs mx-auto">
                Define variables in Customizations, then start a conversation — the agent will extract values automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-white/25 text-xs mb-4">
                {sessionsWithData.length} session{sessionsWithData.length !== 1 ? "s" : ""} with collected data
              </p>

              {sessionsWithData.map((conv) => {
                const data = collectedData[conv.sessionId];
                const entries = Object.entries(data);
                const isOpen = openDataIds.has(conv.sessionId);
                const date = new Date(conv.createdAt);
                const dateStr = date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

                return (
                  <div key={conv.sessionId} className="rounded-xl border border-white/10 bg-white/3 overflow-hidden">
                    <button
                      onClick={() => toggleData(conv.sessionId)}
                      className="flex items-center gap-3 w-full px-4 py-3.5 text-left hover:bg-white/4 transition-colors"
                    >
                      <ChatBubbleLeftIcon className="w-4 h-4 text-white/30 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/80 font-medium truncate">{conv.title}</p>
                        <p className="text-xs text-white/25 mt-0.5">{dateStr}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-semibold bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded">
                          {entries.length} value{entries.length !== 1 ? "s" : ""}
                        </span>
                        <ChevronDownIcon
                          className={`w-4 h-4 text-white/20 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
                        />
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-white/8">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-white/6">
                              <th className="text-left px-4 py-2 text-[10px] font-semibold text-white/25 uppercase tracking-wider w-2/5">
                                Variable
                              </th>
                              <th className="text-left px-4 py-2 text-[10px] font-semibold text-white/25 uppercase tracking-wider">
                                Collected Value
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {entries.map(([key, value], i) => (
                              <tr
                                key={key}
                                className={i < entries.length - 1 ? "border-b border-white/4" : ""}
                              >
                                <td className="px-4 py-2.5 text-xs font-mono text-violet-400/80 align-top">
                                  {`{{${key}}}`}
                                </td>
                                <td className="px-4 py-2.5 text-xs text-white/55 align-top">
                                  {value === null || value === undefined ? (
                                    <span className="text-white/20 italic">null</span>
                                  ) : typeof value === "boolean" ? (
                                    <span className={value ? "text-emerald-400" : "text-red-400"}>
                                      {String(value)}
                                    </span>
                                  ) : (
                                    String(value)
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
