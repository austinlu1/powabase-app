"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserAgent } from "@/lib/types";
import { AgentPrefs, AVATAR_COLORS } from "@/lib/agentPrefs";
import {
  ChatBubbleLeftIcon,
  ChevronLeftIcon,
  SignalIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  CircleStackIcon,
  PaintBrushIcon,
  TableCellsIcon,
  MapPinIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import { MapPinIcon as MapPinSolid } from "@heroicons/react/24/solid";

const MIN_WIDTH = 160;
const MAX_WIDTH = 480;
const DEFAULT_PINNED_WIDTH = 256; // w-64

type Panel = "sessions" | "sources" | "golive" | "settings" | "customizations" | "collected" | null;

interface SidebarProps {
  activeAgent: UserAgent;
  activePanel: Panel;
  onSetPanel: (panel: Panel) => void;
  onBackToAgents: () => void;
  agentPrefs?: AgentPrefs;
}

export default function Sidebar({
  activeAgent,
  activePanel,
  onSetPanel,
  onBackToAgents,
  agentPrefs,
}: SidebarProps) {
  const router = useRouter();
  const [pinned, setPinned] = useState(false);
  const [pinnedWidth, setPinnedWidth] = useState(DEFAULT_PINNED_WIDTH);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(DEFAULT_PINNED_WIDTH);

  function toggle(panel: Panel) {
    onSetPanel(activePanel === panel ? null : panel);
  }

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!pinned) return;
    e.preventDefault();
    draggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = pinnedWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [pinned, pinnedWidth]);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!draggingRef.current) return;
      const delta = e.clientX - startXRef.current;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidthRef.current + delta));
      setPinnedWidth(next);
    }
    function onMouseUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const labelVisible = pinned ? "opacity-100" : "opacity-0 group-hover/sidebar:opacity-100";

  const asideStyle = pinned
    ? { width: pinnedWidth, minWidth: pinnedWidth, maxWidth: pinnedWidth }
    : undefined;

  return (
    <aside
      className={`group/sidebar relative flex flex-col h-full bg-[#272727] border-r border-white/10 text-white shrink-0 overflow-hidden ${pinned ? "" : "w-16 hover:w-64 transition-[width] duration-200"}`}
      style={asideStyle}
    >
      {/* Back */}
      <div className="border-b border-white/10 shrink-0">
        <NavItem icon={ChevronLeftIcon} label="All Agents" onClick={onBackToAgents} labelVisible={labelVisible} />
      </div>

      {/* Agent name + pin */}
      <div className="border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3 px-3 py-3">
          {(() => {
            const color = agentPrefs?.avatarColor ?? AVATAR_COLORS[0];
            const emoji = agentPrefs?.avatarEmoji;
            return (
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg font-bold"
                style={{ backgroundColor: `${color}22`, border: `1px solid ${color}55` }}
              >
                {emoji ? (
                  <span>{emoji}</span>
                ) : (
                  <span style={{ color }}>{activeAgent.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
            );
          })()}
          <span className={`flex-1 text-sm font-semibold text-white truncate transition-opacity duration-150 whitespace-nowrap ${labelVisible}`}>
            {activeAgent.name}
          </span>
          <button
            onClick={() => setPinned((p) => !p)}
            title={pinned ? "Unpin sidebar" : "Pin sidebar"}
            className={`shrink-0 transition-opacity duration-150 ${labelVisible} ${pinned ? "text-white/70 hover:text-white" : "text-white/30 hover:text-white/60"}`}
          >
            {pinned ? <MapPinSolid className="w-4 h-4" /> : <MapPinIcon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col py-3 gap-1 overflow-hidden">
        <NavItem
          icon={ChatBubbleLeftIcon}
          label="Sessions"
          active={activePanel === "sessions"}
          onClick={() => toggle("sessions")}
          labelVisible={labelVisible}
        />
        <NavItem
          icon={CircleStackIcon}
          label="Sources"
          active={activePanel === "sources"}
          onClick={() => toggle("sources")}
          labelVisible={labelVisible}
        />
        <NavItem
          icon={TableCellsIcon}
          label="Collected Data"
          active={activePanel === "collected"}
          onClick={() => toggle("collected")}
          labelVisible={labelVisible}
        />
        <NavItem
          icon={PaintBrushIcon}
          label="Customizations"
          active={activePanel === "customizations"}
          onClick={() => toggle("customizations")}
          labelVisible={labelVisible}
        />
        <NavItem
          icon={SignalIcon}
          label="Go Live"
          active={activePanel === "golive"}
          onClick={() => toggle("golive")}
          emerald
          labelVisible={labelVisible}
          badge={agentPrefs?.visibility !== "public" ? <LockClosedIcon className="w-3 h-3 text-amber-400/70" /> : undefined}
        />
        <NavItem
          icon={Cog6ToothIcon}
          label="Agent Settings"
          active={activePanel === "settings"}
          onClick={() => toggle("settings")}
          labelVisible={labelVisible}
        />
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 shrink-0">
        <NavItem icon={ChartBarIcon} label="Usage Dashboard" onClick={() => router.push("/usage")} labelVisible={labelVisible} />
      </div>

      {/* Resize handle — only when pinned */}
      {pinned && (
        <div
          onMouseDown={onMouseDown}
          className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize group/handle z-10 flex items-center justify-center"
        >
          <div className="w-0.5 h-12 rounded-full bg-white/10 group-hover/handle:bg-white/30 transition-colors" />
        </div>
      )}
    </aside>
  );
}

function NavItem({
  icon: Icon,
  label,
  active = false,
  onClick,
  emerald = false,
  labelVisible,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick?: () => void;
  emerald?: boolean;
  labelVisible: string;
  badge?: React.ReactNode;
}) {
  const iconClass = emerald
    ? active
      ? "text-emerald-400"
      : "text-emerald-400/50 group-hover/sidebar:text-emerald-400"
    : active
    ? "text-white"
    : "text-white/40 group-hover/sidebar:text-white";

  return (
    <button
      onClick={onClick}
      className={`group/navitem flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-colors mx-0 ${
        active ? "bg-white/15" : "hover:bg-white/10"
      }`}
    >
      <div className="relative shrink-0">
        <Icon className={`w-5 h-5 transition-all duration-200 group-hover/navitem:translate-x-0.5 group-hover/navitem:-translate-y-0.5 ${iconClass}`} />
        {badge && (
          <div className="absolute -top-1 -right-1">{badge}</div>
        )}
      </div>
      <span className={`text-sm font-medium whitespace-nowrap transition-opacity duration-150 ${labelVisible} ${
        emerald ? (active ? "text-emerald-400" : "text-emerald-400/70") : active ? "text-white" : "text-white/50"
      }`}>
        {label}
      </span>
    </button>
  );
}
