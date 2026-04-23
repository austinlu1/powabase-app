"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { PaperAirplaneIcon } from "@heroicons/react/24/solid";

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export default function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
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

  return (
    <div className="border-t border-white/10 bg-[#111827] px-4 py-4">
      <div className="max-w-3xl mx-auto flex items-end gap-3 bg-[#1f2937] rounded-2xl px-4 py-3 border border-white/10 focus-within:border-white/30 transition-colors">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          disabled={disabled}
          placeholder={disabled ? "Waiting for response…" : "Message Powabase Chat… (Shift+Enter for newline)"}
          rows={1}
          className="flex-1 resize-none bg-transparent text-white placeholder-white/30 text-sm outline-none leading-relaxed max-h-[200px] disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className="shrink-0 w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-white/10 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          title="Send (Enter)"
        >
          <PaperAirplaneIcon className="w-4 h-4 text-white" />
        </button>
      </div>
      <p className="text-center text-white/20 text-xs mt-2">
        Powered by Powabase · RAG-enabled
      </p>
    </div>
  );
}
