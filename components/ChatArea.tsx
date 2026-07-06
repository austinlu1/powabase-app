"use client";

import { useEffect, useRef, useState } from "react";
import { Message } from "@/lib/types";
import { AgentPrefs, AVATAR_COLORS } from "@/lib/agentPrefs";
import ReactMarkdown from "react-markdown";
import { ClipboardIcon, CheckIcon } from "@heroicons/react/24/outline";

const STARTER_PROMPTS = [
  "Summarize a document for me",
  "Help me brainstorm ideas",
  "Explain a concept step by step",
  "Draft a professional email",
];

interface ChatAreaProps {
  messages: Message[];
  streaming: boolean;
  streamingContent: string;
  welcomeMessage?: string;
  agent?: { id: string; name: string };
  agentPrefs?: AgentPrefs;
  onSendPrompt?: (text: string) => void;
}

export default function ChatArea({
  messages,
  streaming,
  streamingContent,
  welcomeMessage,
  agent,
  agentPrefs,
  onSendPrompt,
}: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Empty state
  if (messages.length === 0 && !streaming) {
    if (welcomeMessage) {
      return (
        <div className="flex-1 overflow-y-auto bg-[#1a1a1a] px-4 py-6 space-y-6">
          <MessageBubble message={{ role: "assistant", content: welcomeMessage }} />
          <div ref={bottomRef} />
        </div>
      );
    }

    const color = agentPrefs?.avatarColor ?? AVATAR_COLORS[0];
    const emoji = agentPrefs?.avatarEmoji;
    const initial = agent?.name?.charAt(0).toUpperCase() ?? "A";

    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#1a1a1a] select-none px-6">
        {/* Agent avatar */}
        <div className="relative mb-4">
          <div
            className="absolute inset-0 rounded-3xl blur-xl opacity-30"
            style={{ backgroundColor: color }}
          />
          <div
            className="relative w-20 h-20 rounded-3xl flex items-center justify-center text-3xl font-bold"
            style={{ backgroundColor: `${color}28`, border: `1px solid ${color}60` }}
          >
            {emoji ? <span>{emoji}</span> : <span style={{ color }}>{initial}</span>}
          </div>
        </div>

        <p className="text-white text-xl font-semibold mb-1">{agent?.name ?? "Agent"}</p>
        <p className="text-white/30 text-sm mb-8">Start a conversation</p>

        {/* Starter prompt chips */}
        {onSendPrompt && (
          <div className="flex flex-wrap gap-2 justify-center max-w-lg">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => onSendPrompt(prompt)}
                className="px-4 py-2 rounded-full border border-white/10 bg-white/5 text-white/50 text-sm hover:bg-white/10 hover:text-white/80 hover:border-white/20 transition-all"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#1a1a1a] px-4 py-6 space-y-6">
      {messages.map((msg, i) => (
        <MessageBubble key={i} message={msg} agentPrefs={agentPrefs} agentName={agent?.name} />
      ))}

      {/* Streaming bubble */}
      {streaming && (
        streamingContent
          ? <MessageBubble message={{ role: "assistant", content: streamingContent }} isStreaming agentPrefs={agentPrefs} agentName={agent?.name} />
          : <TypingIndicator agentPrefs={agentPrefs} agentName={agent?.name} />
      )}

      <div ref={bottomRef} />
    </div>
  );
}

interface AgentAvatarSmallProps {
  agentPrefs?: AgentPrefs;
  agentName?: string;
}

function AgentAvatarSmall({ agentPrefs, agentName }: AgentAvatarSmallProps) {
  const color = agentPrefs?.avatarColor ?? AVATAR_COLORS[0];
  const emoji = agentPrefs?.avatarEmoji;
  const initial = agentName?.charAt(0).toUpperCase() ?? "A";
  return (
    <div
      className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold"
      style={{ backgroundColor: `${color}28`, border: `1px solid ${color}60` }}
    >
      {emoji
        ? <span className="text-sm">{emoji}</span>
        : <span style={{ color }}>{initial}</span>
      }
    </div>
  );
}

function TypingIndicator({ agentPrefs, agentName }: AgentAvatarSmallProps) {
  return (
    <div className="flex gap-3">
      <AgentAvatarSmall agentPrefs={agentPrefs} agentName={agentName} />
      <div className="bg-[#2a2a2a] rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  isStreaming,
  agentPrefs,
  agentName,
}: {
  message: Message;
  isStreaming?: boolean;
  agentPrefs?: AgentPrefs;
  agentName?: string;
}) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      {isUser ? (
        <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-blue-600 text-white">
          You
        </div>
      ) : (
        <AgentAvatarSmall agentPrefs={agentPrefs} agentName={agentName} />
      )}

      {/* Bubble + copy button wrapper */}
      <div className={`group flex items-start gap-2 max-w-[75%] ${isUser ? "flex-row-reverse" : "flex-row"}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? "bg-blue-600 text-white rounded-tr-sm"
              : `bg-[#2a2a2a] text-white/90 rounded-tl-sm ${isStreaming ? "animate-pulse" : ""}`
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Copy button — only on assistant messages, visible on hover */}
        {!isUser && !isStreaming && (
          <button
            onClick={handleCopy}
            className="mt-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-white/25 hover:text-white/60"
            title="Copy response"
          >
            {copied
              ? <CheckIcon className="w-4 h-4 text-emerald-400" />
              : <ClipboardIcon className="w-4 h-4" />
            }
          </button>
        )}
      </div>
    </div>
  );
}
