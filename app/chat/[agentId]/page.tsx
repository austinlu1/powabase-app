"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { PaperAirplaneIcon } from "@heroicons/react/24/solid";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function PublicChatPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const agentId = params.agentId as string;

  // Display info encoded in URL query params by the share link
  const displayName = searchParams.get("name") || "Agent";
  const avatarColor = searchParams.get("color") || "#2563eb";
  const avatarEmoji = searchParams.get("emoji") || "";
  const welcomeMessage =
    searchParams.get("welcome") || `Hi there! I'm ${displayName}. How can I help you today?`;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const initial = displayName.charAt(0).toUpperCase();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setStreaming(true);
    setStreamingContent("");
    setError("");

    try {
      const body: Record<string, string> = { agentId, message: text };
      if (sessionId) body.session_id = sessionId;

      const res = await fetch("/api/widget/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok || !res.body) {
        setError("Something went wrong. Please try again.");
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let newSessionId = sessionId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === "[DONE]") continue;
          try {
            const event = JSON.parse(raw);
            if (event.session_id && !newSessionId) {
              newSessionId = event.session_id;
              setSessionId(newSessionId);
            }
            if (event.event === "content_delta" && event.delta) {
              fullContent += event.delta;
              setStreamingContent(fullContent);
            }
          } catch { /* skip */ }
        }
      }

      setMessages((prev) => [...prev, { role: "assistant", content: fullContent }]);
    } catch {
      setError("Network error. Please try again.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setStreaming(false);
      setStreamingContent("");
    }
  }

  return (
    <div className="flex flex-col h-screen bg-[#0f0f0f] text-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-[#1a1a1a] shrink-0">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-base font-bold shrink-0"
          style={{ backgroundColor: `${avatarColor}28`, border: `1.5px solid ${avatarColor}60` }}
        >
          {avatarEmoji || <span style={{ color: avatarColor }}>{initial}</span>}
        </div>
        <div>
          <p className="font-semibold text-white text-sm leading-tight">{displayName}</p>
          <p className="text-xs text-white/30 leading-tight">Powered by Powabase</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
        {/* Welcome message */}
        <AssistantBubble
          content={welcomeMessage}
          avatarColor={avatarColor}
          avatarEmoji={avatarEmoji}
          initial={initial}
        />

        {messages.map((m, i) =>
          m.role === "user" ? (
            <UserBubble key={i} content={m.content} />
          ) : (
            <AssistantBubble
              key={i}
              content={m.content}
              avatarColor={avatarColor}
              avatarEmoji={avatarEmoji}
              initial={initial}
            />
          )
        )}

        {/* Streaming bubble */}
        {streaming && (
          <AssistantBubble
            content={streamingContent}
            avatarColor={avatarColor}
            avatarEmoji={avatarEmoji}
            initial={initial}
            isStreaming
          />
        )}

        {error && (
          <p className="text-xs text-red-400 text-center">{error}</p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-4 border-t border-white/10 bg-[#1a1a1a] shrink-0">
        <div className="flex items-end gap-3 max-w-2xl mx-auto">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={`Message ${displayName}…`}
            rows={1}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-white/25 resize-none transition-colors"
            style={{ maxHeight: 160 }}
          />
          <button
            onClick={send}
            disabled={streaming || !input.trim()}
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors disabled:opacity-30"
            style={{ backgroundColor: avatarColor }}
          >
            <PaperAirplaneIcon className="w-4 h-4 text-white" />
          </button>
        </div>
        <p className="text-center text-xs text-white/15 mt-2">
          Powered by <span className="text-white/25">Powabase</span>
        </p>
      </div>
    </div>
  );
}

function AssistantBubble({
  content,
  avatarColor,
  avatarEmoji,
  initial,
  isStreaming,
}: {
  content: string;
  avatarColor: string;
  avatarEmoji: string;
  initial: string;
  isStreaming?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
        style={{ backgroundColor: `${avatarColor}28`, border: `1px solid ${avatarColor}55` }}
      >
        {avatarEmoji || <span style={{ color: avatarColor }}>{initial}</span>}
      </div>
      <div className="bg-white/8 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
        {content ? (
          <p className="text-sm text-white/85 leading-relaxed whitespace-pre-wrap">{content}</p>
        ) : (
          <span className="inline-flex gap-1 items-center h-5">
            <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: "300ms" }} />
          </span>
        )}
        {isStreaming && content && (
          <span className="inline-block w-0.5 h-3.5 bg-white/40 ml-0.5 animate-pulse align-middle" />
        )}
      </div>
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="bg-white/10 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]">
        <p className="text-sm text-white/85 leading-relaxed whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}
