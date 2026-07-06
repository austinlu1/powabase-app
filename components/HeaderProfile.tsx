"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckIcon, PencilIcon, XMarkIcon } from "@heroicons/react/24/outline";

export default function HeaderProfile() {
  const router = useRouter();
  const [user, setUser] = useState<{ email?: string; user_metadata?: { username?: string } } | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.user) setUser(data.user); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setEditingName(false);
        setNameError("");
      }
    }
    if (showMenu) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMenu]);

  if (!user) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/60 hover:text-white/90 text-sm font-medium transition-colors"
      >
        Sign in
      </Link>
    );
  }

  const displayName = user.user_metadata?.username ?? user.email ?? "?";
  const initial = displayName.charAt(0).toUpperCase();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  async function saveName() {
    if (!nameInput.trim()) return;
    setNameSaving(true);
    setNameError("");
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: nameInput.trim() }),
      });
      if (!res.ok) { setNameError("Failed to save."); return; }
      const data = await res.json();
      setUser(data.user);
      setEditingName(false);
    } catch {
      setNameError("Network error.");
    } finally {
      setNameSaving(false);
    }
  }

  function startEdit() {
    setNameInput(user?.user_metadata?.username ?? "");
    setNameError("");
    setEditingName(true);
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setShowMenu((v) => !v)}
        className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold hover:bg-blue-500 transition-colors"
        title={displayName}
      >
        {initial}
      </button>

      {showMenu && (
        <div className="absolute right-0 top-11 z-50 w-64 bg-[#1e1e1e] border border-white/10 rounded-xl shadow-xl overflow-hidden">
          {/* User info */}
          <div className="px-4 py-3 border-b border-white/10 space-y-1">
            {/* Display name row */}
            {editingName ? (
              <div className="space-y-1.5">
                <input
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                  placeholder="Display name"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/30 outline-none focus:border-blue-500"
                />
                {nameError && <p className="text-xs text-red-400">{nameError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={saveName}
                    disabled={nameSaving || !nameInput.trim()}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs transition-colors"
                  >
                    <CheckIcon className="w-3 h-3" />
                    {nameSaving ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={() => setEditingName(false)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 text-xs transition-colors"
                  >
                    <XMarkIcon className="w-3 h-3" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-white font-medium truncate">
                  {user.user_metadata?.username ?? <span className="text-white/40 italic">No display name</span>}
                </p>
                <button
                  onClick={startEdit}
                  className="shrink-0 p-1 rounded text-white/30 hover:text-white hover:bg-white/10 transition-colors"
                  title="Edit display name"
                >
                  <PencilIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <p className="text-xs text-white/35 truncate">{user.email}</p>
          </div>

          <button
            onClick={() => { setShowMenu(false); logout(); }}
            className="flex items-center gap-2 w-full px-4 py-3 text-sm text-white/60 hover:text-red-400 hover:bg-white/5 transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
