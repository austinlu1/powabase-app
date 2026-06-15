"use client";

import { useState, useRef, KeyboardEvent, useEffect } from "react";
import { PaperAirplaneIcon } from "@heroicons/react/24/solid";
import {
  PlusCircleIcon,
  DocumentTextIcon,
  GlobeAltIcon,
  XMarkIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

export interface SessionAttachment {
  id: string;
  name: string;
  type: "file" | "url";
  loading?: boolean;
  error?: string;
}

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
  placeholder?: string;
  attachments?: SessionAttachment[];
  onAttachFile?: (file: File) => Promise<void>;
  onAttachUrl?: (url: string) => Promise<void>;
  onRemoveAttachment?: (id: string) => void;
  limitReached?: boolean;
}

export default function MessageInput({
  onSend,
  disabled,
  placeholder,
  attachments = [],
  onAttachFile,
  onAttachUrl,
  onRemoveAttachment,
  limitReached = false,
}: MessageInputProps) {
  const [value, setValue] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [urlMode, setUrlMode] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [attaching, setAttaching] = useState(false);

  const isDisabled = disabled || limitReached;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
        setUrlMode(false);
        setUrlInput("");
      }
    }
    if (popoverOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [popoverOpen]);

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || isDisabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInput() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !onAttachFile) return;
    e.target.value = "";
    setPopoverOpen(false);
    setAttaching(true);
    try { await onAttachFile(file); } finally { setAttaching(false); }
  }

  async function handleUrlImport() {
    const url = urlInput.trim();
    if (!url || !onAttachUrl) return;
    setAttaching(true);
    setUrlMode(false);
    setPopoverOpen(false);
    setUrlInput("");
    try { await onAttachUrl(url); } finally { setAttaching(false); }
  }

  const canAttach = !!(onAttachFile || onAttachUrl);

  return (
    <div className="border-t border-white/10 bg-[#111827] px-4 py-4">
      <div className="max-w-3xl mx-auto space-y-2">

        {/* Session limit banner */}
        {limitReached && (
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-sm">
            <span className="text-base leading-none">⚠</span>
            <span>Session limit reached — start a <strong>New Chat</strong> to continue.</span>
          </div>
        )}

        {/* Attachment chips */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1">
            {attachments.map((a) => (
              <div
                key={a.id}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${
                  a.error
                    ? "bg-red-600/20 border-red-500/30 text-red-300"
                    : "bg-blue-600/20 border-blue-500/30 text-blue-300"
                }`}
              >
                {a.loading ? (
                  <ArrowPathIcon className="w-3 h-3 animate-spin" />
                ) : a.error ? (
                  <span className="w-3 h-3 text-red-400 font-bold leading-none">!</span>
                ) : a.type === "url" ? (
                  <GlobeAltIcon className="w-3 h-3" />
                ) : (
                  <DocumentTextIcon className="w-3 h-3" />
                )}
                <span className="max-w-[180px] truncate" title={a.error ?? a.name}>{a.error ? `${a.name} — ${a.error}` : a.name}</span>
                {!a.loading && onRemoveAttachment && (
                  <button
                    onClick={() => onRemoveAttachment(a.id)}
                    className="text-blue-400/60 hover:text-blue-300 transition-colors ml-0.5"
                  >
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Input row */}
        <div className="flex items-end gap-3 bg-[#1f2937] rounded-2xl px-4 py-3 border border-white/10 focus-within:border-white/30 transition-colors">

          {/* + button with popover */}
          {canAttach && (
            <div className="relative shrink-0" ref={popoverRef}>
              <button
                onClick={() => { setPopoverOpen(!popoverOpen); setUrlMode(false); setUrlInput(""); }}
                disabled={attaching}
                className="text-white/30 hover:text-white/70 transition-colors disabled:opacity-40"
                title="Attach context"
              >
                {attaching
                  ? <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  : <PlusCircleIcon className="w-5 h-5" />
                }
              </button>

              {popoverOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-52 bg-[#1f2937] border border-white/10 rounded-xl shadow-xl overflow-hidden z-10">
                  {!urlMode ? (
                    <>
                      <p className="px-3 pt-2.5 pb-1 text-xs text-white/30 font-medium uppercase tracking-wider">
                        Add to this chat
                      </p>
                      {onAttachFile && (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                        >
                          <DocumentTextIcon className="w-4 h-4 shrink-0" />
                          Upload File
                        </button>
                      )}
                      {onAttachUrl && (
                        <button
                          onClick={() => setUrlMode(true)}
                          className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                        >
                          <GlobeAltIcon className="w-4 h-4 shrink-0" />
                          Import URL
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="p-3 space-y-2">
                      <p className="text-xs text-white/40">Paste a URL</p>
                      <input
                        autoFocus
                        type="url"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleUrlImport(); }}
                        placeholder="https://example.com"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-blue-500"
                      />
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => { setUrlMode(false); setUrlInput(""); }}
                          className="flex-1 py-1.5 rounded-lg text-xs text-white/40 hover:bg-white/5 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleUrlImport}
                          disabled={!urlInput.trim()}
                          className="flex-1 py-1.5 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-colors"
                        >
                          Import
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                accept=".pdf,.docx,.doc,.txt,.md,.csv,.pptx,.xlsx,.png,.jpg,.jpeg"
              />
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            disabled={isDisabled}
            placeholder={limitReached ? "Session limit reached — start a new chat" : placeholder ?? (disabled ? "Waiting for response…" : "Message… (Shift+Enter for newline)")}
            rows={1}
            className="flex-1 resize-none bg-transparent text-white placeholder-white/30 text-sm outline-none leading-relaxed max-h-[200px] disabled:opacity-50"
          />

          <button
            onClick={handleSend}
            disabled={isDisabled || !value.trim()}
            className="shrink-0 w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-white/10 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            title="Send (Enter)"
          >
            <PaperAirplaneIcon className="w-4 h-4 text-white" />
          </button>
        </div>

        <p className="text-center text-white/20 text-xs">
          Powered by Powabase · RAG-enabled
        </p>
      </div>
    </div>
  );
}
