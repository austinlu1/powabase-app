"use client";

import { useState, useEffect } from "react";
import {
  ClipboardDocumentIcon,
  CheckIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  XMarkIcon,
  LockClosedIcon,
  Cog6ToothIcon,
  LinkIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import { AgentPrefs, AVATAR_COLORS } from "@/lib/agentPrefs";

interface GoLivePanelProps {
  agentId: string;
  agentName: string;
  agentPrefs?: AgentPrefs;
  onOpenSettings?: () => void;
}

export default function GoLivePanel({ agentId, agentName, agentPrefs, onOpenSettings }: GoLivePanelProps) {
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const snippet = `<script>\n  window.PowabaseChat = { agentId: "${agentId}" }\n</script>\n<script src="${origin}/widget.js" defer></script>`;

  function copy() {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const avatarColor = agentPrefs?.avatarColor ?? AVATAR_COLORS[0];
  const avatarEmoji = agentPrefs?.avatarEmoji;
  const resolvedName = agentPrefs?.displayName || agentName;
  const welcomeMessage = agentPrefs?.welcomeMessage || `Hi there! I'm ${resolvedName}. How can I help you today?`;
  const initial = resolvedName.charAt(0).toUpperCase();
  const isPublic = agentPrefs?.visibility === "public";

  // Share link — encodes display params so public visitors see the right branding
  const shareParams = new URLSearchParams();
  shareParams.set("name", resolvedName);
  if (avatarColor) shareParams.set("color", avatarColor);
  if (avatarEmoji) shareParams.set("emoji", avatarEmoji);
  if (agentPrefs?.welcomeMessage) shareParams.set("welcome", agentPrefs.welcomeMessage);
  const shareLink = `${origin}/chat/${agentId}?${shareParams.toString()}`;

  function copyLink() {
    navigator.clipboard.writeText(shareLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-[#1a1a1a]">
      <div className="flex items-center justify-center px-8 py-6 border-b border-white/10 shrink-0">
        <h2 className="text-3xl font-semibold text-emerald-400">Go Live</h2>
      </div>

      {/* Private-agent gate */}
      {!isPublic && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6">
            <LockClosedIcon className="w-8 h-8 text-white/30" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Agent is Private</h3>
          <p className="text-white/50 text-sm leading-relaxed max-w-sm mb-2">
            Only <span className="text-white font-medium">Public</span> agents can be embedded on external websites via Go Live.
          </p>
          <p className="text-white/30 text-sm leading-relaxed max-w-sm mb-8">
            Set this agent&apos;s visibility to <span className="text-emerald-400 font-medium">Public</span> in Agent Settings to enable the embed snippet.
          </p>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-2 px-5 py-2.5 rounded-md bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
            >
              <Cog6ToothIcon className="w-4 h-4" />
              Open Agent Settings
            </button>
          )}
        </div>
      )}

      {isPublic && (
      <div className="flex-1 overflow-y-auto px-8 py-8 flex flex-col items-center">
        <div className="w-full max-w-2xl space-y-8">

          {/* Share Link */}
          <div className="rounded-xl border border-blue-500/25 bg-blue-500/8 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-blue-400 shrink-0" />
              <h3 className="text-white font-semibold text-base">Shareable Chat Link</h3>
            </div>
            <p className="text-white/50 text-sm leading-relaxed">
              Share this link with anyone. When opened in a browser, it launches a full-screen chat with this agent.
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-lg px-3 py-2 overflow-x-auto">
                <span className="text-xs text-white/50 font-mono whitespace-nowrap">{shareLink}</span>
              </div>
              <button
                onClick={copyLink}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-medium transition-colors"
              >
                {linkCopied ? (
                  <><CheckIcon className="w-4 h-4 text-emerald-400" /><span className="text-emerald-400">Copied!</span></>
                ) : (
                  <><ClipboardDocumentIcon className="w-4 h-4 text-white/60" /><span className="text-white/60">Copy</span></>
                )}
              </button>
              <a
                href={shareLink}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                title="Open in new tab"
              >
                <ArrowTopRightOnSquareIcon className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* What is Go Live */}
          <div>
            <h3 className="text-white font-semibold text-base mb-2">What is Go Live?</h3>
            <p className="text-white/50 text-sm leading-relaxed">
              Go Live lets you embed this agent as a floating chat widget on any external website.
              Visitors can open the widget and chat with this agent in real time, without ever leaving the page.
            </p>
          </div>

          {/* What it looks like */}
          <div>
            <h3 className="text-white font-semibold text-base mb-4">What it looks like</h3>

            {/* Preview mockup */}
            <div className="rounded-2xl border border-white/10 bg-[#111] overflow-hidden">
              {/* Fake browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8 bg-white/3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-white/10" />
                  <div className="w-3 h-3 rounded-full bg-white/10" />
                  <div className="w-3 h-3 rounded-full bg-white/10" />
                </div>
                <div className="flex-1 mx-4 bg-white/5 rounded-md h-5 text-[10px] text-white/20 flex items-center px-2">
                  yourwebsite.com
                </div>
              </div>

              {/* Website body with widget */}
              <div className="relative h-72 bg-gradient-to-br from-[#0d0d0d] to-[#161616]">
                {/* Fake page content lines */}
                <div className="absolute top-6 left-6 right-32 space-y-2 opacity-20">
                  <div className="h-2.5 bg-white/30 rounded w-3/4" />
                  <div className="h-2 bg-white/20 rounded w-full" />
                  <div className="h-2 bg-white/20 rounded w-5/6" />
                  <div className="h-2 bg-white/20 rounded w-4/5" />
                </div>

                {/* Open chat panel preview */}
                <div
                  className="absolute bottom-20 right-6 w-64 rounded-2xl overflow-hidden shadow-2xl border border-white/10"
                  style={{ background: "#1e1e1e" }}
                >
                  {/* Panel header */}
                  <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/10" style={{ background: "#161616" }}>
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ backgroundColor: `${avatarColor}33`, border: `1px solid ${avatarColor}66` }}
                    >
                      {avatarEmoji ? (
                        <span className="text-sm leading-none">{avatarEmoji}</span>
                      ) : (
                        <span style={{ color: avatarColor }}>{initial}</span>
                      )}
                    </div>
                    <span className="text-white text-xs font-semibold truncate flex-1">{resolvedName}</span>
                    <XMarkIcon className="w-3.5 h-3.5 text-white/30 shrink-0" />
                  </div>

                  {/* Welcome message bubble */}
                  <div className="px-3 py-3">
                    <div className="flex items-start gap-2">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5"
                        style={{ backgroundColor: `${avatarColor}33`, border: `1px solid ${avatarColor}55` }}
                      >
                        {avatarEmoji ? (
                          <span className="text-[10px] leading-none">{avatarEmoji}</span>
                        ) : (
                          <span style={{ color: avatarColor }}>{initial}</span>
                        )}
                      </div>
                      <div className="bg-white/8 rounded-xl rounded-tl-sm px-2.5 py-2 max-w-[160px]">
                        <p className="text-white/80 text-[10px] leading-relaxed line-clamp-3">{welcomeMessage}</p>
                      </div>
                    </div>
                  </div>

                  {/* Input bar */}
                  <div className="px-3 pb-3">
                    <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 flex items-center gap-2">
                      <span className="text-white/20 text-[10px] flex-1">Message…</span>
                      <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: avatarColor }}>
                        <svg className="w-2 h-2" viewBox="0 0 24 24" fill="white">
                          <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chat bubble button */}
                <div
                  className="absolute bottom-5 right-6 w-12 h-12 rounded-full flex items-center justify-center shadow-lg cursor-pointer"
                  style={{ backgroundColor: avatarColor }}
                >
                  <ChatBubbleOvalLeftEllipsisIcon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <p className="text-white/30 text-xs mt-3 leading-relaxed">
              A floating button appears in the bottom-right corner of your page. Visitors click it to open a chat panel powered by this agent.
            </p>
          </div>

          {/* How to implement */}
          <div>
            <h3 className="text-white font-semibold text-base mb-3">How to implement</h3>
            <ol className="space-y-3 text-sm text-white/50 leading-relaxed list-none">
              {[
                { step: "1", text: <>Copy the snippet below.</> },
                { step: "2", text: <>Paste it into the <code className="text-white/70 bg-white/5 px-1.5 py-0.5 rounded">&lt;head&gt;</code> or just before the closing <code className="text-white/70 bg-white/5 px-1.5 py-0.5 rounded">&lt;/body&gt;</code> tag of your HTML.</> },
                { step: "3", text: <>Deploy your site. The chat bubble will appear automatically — no build step or npm package required.</> },
                { step: "4", text: <>To customise the widget appearance (colors, position, greeting text), add optional keys to <code className="text-white/70 bg-white/5 px-1.5 py-0.5 rounded">window.PowabaseChat</code> before the script loads.</> },
              ].map(({ step, text }) => (
                <li key={step} className="flex gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center mt-0.5">{step}</span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Snippet */}
          <div>
            <h3 className="text-white font-semibold text-base mb-3">Embed snippet</h3>
            <div className="relative rounded-lg bg-black/40 border border-white/10 p-6">
              <pre className="text-sm text-emerald-300 whitespace-pre-wrap break-all leading-relaxed font-mono pr-24">
                {snippet}
              </pre>
              <button
                onClick={copy}
                className="absolute top-4 right-4 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors"
              >
                {copied ? (
                  <>
                    <CheckIcon className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <ClipboardDocumentIcon className="w-4 h-4" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 px-5 py-4">
            <p className="text-xs text-white/40 font-mono break-all">Agent ID: {agentId}</p>
          </div>

        </div>
      </div>
      )}
    </div>
  );
}
