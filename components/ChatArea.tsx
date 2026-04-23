"use client";

import { useEffect, useRef } from "react";
import { Message } from "@/lib/types";
import ReactMarkdown from "react-markdown";

interface ChatAreaProps {
  messages: Message[];
  streaming: boolean;
  streamingContent: string;
}

export default function ChatArea({ messages, streaming, streamingContent }: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  if (messages.length === 0 && !streaming) {
    return (
      <div className="flex-1 flex items-center justify-center text-white/30 text-sm select-none">
        <div className="text-center space-y-2">
          <p className="text-4xl">💬</p>
          <p>Start a conversation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
      {messages.map((msg, i) => (
        <MessageBubble key={i} message={msg} />
      ))}

      {/* Streaming bubble — shows while Powabase is mid-response */}
      {streaming && (
        <MessageBubble
          message={{ role: "assistant", content: streamingContent || "…" }}
          isStreaming
        />
      )}

      <div ref={bottomRef} />
    </div>
  );
}

function MessageBubble({
  message,
  isStreaming,
}: {
  message: Message;
  isStreaming?: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
          isUser ? "bg-blue-600 text-white" : "bg-emerald-600 text-white"
        }`}
      >
        {isUser ? "You" : "AI"}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-blue-600 text-white rounded-tr-sm"
            : "bg-[#1f2937] text-white/90 rounded-tl-sm"
        } ${isStreaming ? "animate-pulse" : ""}`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
