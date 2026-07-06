"use client";

import { useState, useEffect } from "react";
import { XMarkIcon, CheckIcon, ClipboardIcon, DocumentDuplicateIcon, EyeIcon, LockClosedIcon, BuildingOfficeIcon, PhoneIcon, BookOpenIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { UserAgent } from "@/lib/types";
import { getAgentPrefs, saveAgentPrefs, AVATAR_COLORS, AgentPrefs, stripKnowledgeInstruction } from "@/lib/agentPrefs";

interface AgentSettingsPanelProps {
  agent: UserAgent;
  onUpdateAgent: (agent: UserAgent, updates: { system_prompt?: string; display_name?: string; knowledge_mode?: "ai" | "kb" }) => Promise<boolean>;
  onDeleteAgent: (agent: UserAgent) => void;
  onDuplicateAgent?: (name: string, systemPrompt: string) => Promise<boolean>;
  onClose: () => void;
  onBackToAgents: () => void;
  onPrefsChange?: (agentId: string, prefs: AgentPrefs) => void;
  fullPage?: boolean;
}

export default function AgentSettingsPanel({
  agent,
  onUpdateAgent,
  onDeleteAgent,
  onDuplicateAgent,
  onClose,
  onBackToAgents,
  onPrefsChange,
  fullPage = false,
}: AgentSettingsPanelProps) {
  const [name, setName] = useState(agent.name);
  const [prompt, setPrompt] = useState(stripKnowledgeInstruction(agent.system_prompt ?? ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [idCopied, setIdCopied] = useState(false);

  // Prefs (localStorage)
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [avatarEmoji, setAvatarEmoji] = useState("");
  const [temperature, setTemperature] = useState<"precise" | "balanced" | "creative">("balanced");
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [companyName, setCompanyName] = useState("");
  const [supportContact, setSupportContact] = useState("");
  const [knowledgeMode, setKnowledgeMode] = useState<"ai" | "kb">("ai");

  useEffect(() => {
    setName(agent.name);
    setPrompt(stripKnowledgeInstruction(agent.system_prompt ?? ""));
    setError("");
    setSaved(false);
    setConfirmDelete(false);

    const prefs = getAgentPrefs(agent.id);
    setWelcomeMessage(prefs.welcomeMessage ?? "");
    setDisplayName(prefs.displayName ?? "");
    setAvatarColor(prefs.avatarColor ?? AVATAR_COLORS[0]);
    setAvatarEmoji(prefs.avatarEmoji ?? "");
    setTemperature(prefs.temperature ?? "balanced");
    setVisibility(prefs.visibility ?? "private");
    setCompanyName(prefs.companyName ?? "");
    setSupportContact(prefs.supportContact ?? "");
    setKnowledgeMode(prefs.knowledgeMode ?? "ai");
  }, [agent.id]);

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);

    // Save to Powabase — always send system_prompt + knowledge_mode so the
    // correct knowledge instruction is appended even if only the mode changed.
    const updates: { system_prompt?: string; display_name?: string; knowledge_mode?: "ai" | "kb" } = {
      system_prompt: prompt,
      knowledge_mode: knowledgeMode,
    };
    if (name.trim() !== agent.name) updates.display_name = name.trim();
    const ok = await onUpdateAgent(agent, updates);
    if (!ok) { setSaving(false); setError("Failed to save. Try again."); return; }

    // Save prefs to localStorage
    const prefs: AgentPrefs = { welcomeMessage, displayName, avatarColor, avatarEmoji, temperature, visibility, companyName: companyName.trim() || undefined, supportContact: supportContact.trim() || undefined, knowledgeMode };
    saveAgentPrefs(agent.id, prefs);
    onPrefsChange?.(agent.id, prefs);

    setSaving(false);
    setSaved(true);
  }

  function handleDelete() {
    onDeleteAgent(agent);
    onBackToAgents();
  }

  async function handleDuplicate() {
    if (!onDuplicateAgent) return;
    setDuplicating(true);
    await onDuplicateAgent(`${agent.name} (Copy)`, stripKnowledgeInstruction(agent.system_prompt ?? ""));
    setDuplicating(false);
  }

  function handleCopyId() {
    navigator.clipboard.writeText(agent.id).then(() => {
      setIdCopied(true);
      setTimeout(() => setIdCopied(false), 2000);
    });
  }

  const form = (
    <div className="space-y-8">

      {/* Avatar */}
      <div className="space-y-4">
        <div>
          <p className="text-lg font-bold text-white">Agent Avatar</p>
          <p className="text-base text-white/40 mt-0.5">Choose a color and optional emoji to represent this agent.</p>
        </div>

        {/* Preview */}
        <div className="flex items-center gap-5">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shrink-0"
            style={{ backgroundColor: `${avatarColor}22`, border: `2px solid ${avatarColor}55` }}
          >
            {avatarEmoji || <span style={{ color: avatarColor }} className="text-3xl font-bold">{(name || agent.name).charAt(0).toUpperCase()}</span>}
          </div>
          <input
            type="text"
            value={avatarEmoji}
            onChange={(e) => { setAvatarEmoji(e.target.value.slice(0, 2)); setSaved(false); }}
            placeholder="Emoji (optional)"
            className="w-44 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-base text-white placeholder-white/30 outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Color swatches */}
        <div className="flex gap-3 flex-wrap">
          {AVATAR_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => { setAvatarColor(color); setSaved(false); }}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-110"
              style={{ backgroundColor: color }}
            >
              {avatarColor === color && <CheckIcon className="w-4.5 h-4.5 text-white" />}
            </button>
          ))}
        </div>
      </div>

      {/* Agent Name */}
      <div className="space-y-2.5">
        <div>
          <p className="text-lg font-bold text-white">Agent Name</p>
          <p className="text-base text-white/40 mt-0.5">The internal name shown on the agents screen.</p>
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setSaved(false); }}
          placeholder="Agent name"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder-white/30 outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {/* Display Name */}
      <div className="space-y-2.5">
        <div>
          <p className="text-lg font-bold text-white">Display Name</p>
          <p className="text-base text-white/40 mt-0.5">The name shown at the top of the chat and in the Go Live embed. Falls back to Agent Name if blank.</p>
        </div>
        <input
          type="text"
          value={displayName}
          onChange={(e) => { setDisplayName(e.target.value); setSaved(false); }}
          placeholder={name || agent.name}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder-white/30 outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {/* Welcome Message */}
      <div className="space-y-2.5">
        <div>
          <p className="text-lg font-bold text-white">Welcome Message</p>
          <p className="text-base text-white/40 mt-0.5">The first message shown when a user opens a new session with this agent.</p>
        </div>
        <textarea
          value={welcomeMessage}
          onChange={(e) => { setWelcomeMessage(e.target.value); setSaved(false); }}
          placeholder="Hello! How can I help you today?"
          rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder-white/30 outline-none focus:border-blue-500 transition-colors resize-none"
        />
      </div>

      {/* System Prompt */}
      <div className="space-y-2.5">
        <div>
          <p className="text-lg font-bold text-white">System Prompt</p>
          <p className="text-base text-white/40 mt-0.5">Instructions that shape how this agent responds. Leave blank for default behavior.</p>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => { setPrompt(e.target.value); setSaved(false); }}
          placeholder="System prompt (optional)"
          rows={6}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder-white/30 outline-none focus:border-blue-500 transition-colors resize-none"
        />
      </div>

      {/* Response Style */}
      <div className="space-y-3">
        <div>
          <p className="text-lg font-bold text-white">Response Style</p>
          <p className="text-base text-white/40 mt-0.5">Controls how creative or precise this agent's responses are.</p>
        </div>
        <div className="flex rounded-xl overflow-hidden border border-white/10 bg-white/5">
          {(["precise", "balanced", "creative"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => { setTemperature(opt); setSaved(false); }}
              className={`flex-1 py-3 text-base font-medium capitalize transition-colors ${
                temperature === opt
                  ? "bg-blue-600 text-white"
                  : "text-white/40 hover:text-white/70 hover:bg-white/5"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
        <p className="text-sm text-white/25">
          {temperature === "precise" && "Consistent, factual answers. Best for Q&A and document lookup."}
          {temperature === "balanced" && "Default mix of accuracy and variety. Works for most use cases."}
          {temperature === "creative" && "More expressive and varied. Best for brainstorming and writing."}
        </p>
      </div>

      {/* Visibility */}
      <div className="space-y-3">
        <div>
          <p className="text-lg font-bold text-white">Visibility</p>
          <p className="text-base text-white/40 mt-0.5">Control who can access this agent.</p>
        </div>
        <div className="flex rounded-xl overflow-hidden border border-white/10 bg-white/5">
          {(["public", "private"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => { setVisibility(opt); setSaved(false); }}
              className={`flex-1 py-3 text-base font-medium capitalize transition-colors flex items-center justify-center gap-2 ${
                visibility === opt
                  ? "bg-blue-600 text-white"
                  : "text-white/40 hover:text-white/70 hover:bg-white/5"
              }`}
            >
              {opt === "public" ? <EyeIcon className="w-4.5 h-4.5" /> : <LockClosedIcon className="w-4.5 h-4.5" />}
              {opt}
            </button>
          ))}
        </div>
        {/* Go Live requirement callout */}
        <div className={`flex items-start gap-3 rounded-xl px-4 py-3 border transition-colors ${
          visibility === "public"
            ? "border-emerald-500/30 bg-emerald-500/8"
            : "border-amber-500/30 bg-amber-500/8"
        }`}>
          {visibility === "public"
            ? <EyeIcon className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            : <LockClosedIcon className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          }
          <p className={`text-sm leading-relaxed ${visibility === "public" ? "text-emerald-300/80" : "text-amber-300/80"}`}>
            {visibility === "public"
              ? "Go Live embedding is enabled. This agent can be embedded on external websites."
              : "Go Live embedding is disabled. Only Public agents can be embedded on external websites."
            }
          </p>
        </div>
      </div>

      {/* Company / Product */}
      <div className="space-y-2.5">
        <div>
          <p className="text-lg font-bold text-white flex items-center gap-2">
            <BuildingOfficeIcon className="w-5 h-5 text-white/50" />
            Company / Product Represented
          </p>
          <p className="text-base text-white/40 mt-0.5">The company or product this agent speaks on behalf of.</p>
        </div>
        <input
          type="text"
          value={companyName}
          onChange={(e) => { setCompanyName(e.target.value); setSaved(false); }}
          placeholder="e.g. Acme Corp, My SaaS Product…"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder-white/30 outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {/* Support Contact */}
      <div className="space-y-2.5">
        <div>
          <p className="text-lg font-bold text-white flex items-center gap-2">
            <PhoneIcon className="w-5 h-5 text-white/50" />
            Support Team Contact
          </p>
          <p className="text-base text-white/40 mt-0.5">Email or phone the agent can share when users need a human.</p>
        </div>
        <input
          type="text"
          value={supportContact}
          onChange={(e) => { setSupportContact(e.target.value); setSaved(false); }}
          placeholder="support@example.com or +1 555-000-0000"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder-white/30 outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {/* Knowledge Mode */}
      <div className="space-y-3">
        <div>
          <p className="text-lg font-bold text-white flex items-center gap-2">
            <BookOpenIcon className="w-5 h-5 text-white/50" />
            AI Knowledge Base Answering
          </p>
          <p className="text-base text-white/40 mt-0.5">Should the AI use its own knowledge, or rely on the knowledge you provide?</p>
        </div>
        <div className="space-y-2.5">
          {([
            { value: "ai" as const, label: "AI's Own Knowledge", desc: "Searches your knowledge base first, then supplements with built-in training knowledge to fill any gaps.", icon: <SparklesIcon className="w-4 h-4 text-blue-400 shrink-0" /> },
            { value: "kb" as const, label: "Your Knowledge Base", desc: "Relies only on content you upload. Best for precise, domain-specific support.", icon: <BookOpenIcon className="w-4 h-4 text-emerald-400 shrink-0" /> },
          ] as const).map(({ value, label, desc, icon }) => (
            <button
              key={value}
              onClick={() => { setKnowledgeMode(value); setSaved(false); }}
              className={`w-full text-left rounded-xl border px-5 py-4 transition-all ${
                knowledgeMode === value
                  ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/20"
                  : "border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/5"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  knowledgeMode === value ? "border-blue-400" : "border-white/20"
                }`}>
                  {knowledgeMode === value && <div className="w-2 h-2 rounded-full bg-blue-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {icon}
                    <span className="text-base font-semibold text-white">{label}</span>
                  </div>
                  <p className="text-sm text-white/40 leading-relaxed">{desc}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-base text-red-400">{error}</p>}
      {saved && <p className="text-base text-emerald-400">Saved successfully.</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3.5 rounded-xl text-base bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold transition-colors"
      >
        {saving ? "Saving…" : "Save Changes"}
      </button>

      {/* Agent ID */}
      <div className="pt-2 border-t border-white/10 space-y-3">
        <p className="text-sm font-semibold text-white/40 uppercase tracking-wide">Agent ID</p>
        <div className="flex items-center gap-3">
          <code className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/40 font-mono truncate">
            {agent.id}
          </code>
          <button
            onClick={handleCopyId}
            className="shrink-0 p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            title="Copy agent ID"
          >
            {idCopied ? <CheckIcon className="w-5 h-5 text-emerald-400" /> : <ClipboardIcon className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Duplicate */}
      {onDuplicateAgent && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-white/40 uppercase tracking-wide">Duplicate</p>
          <button
            onClick={handleDuplicate}
            disabled={duplicating}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-base text-white/70 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white disabled:opacity-50 transition-colors"
          >
            <DocumentDuplicateIcon className="w-5 h-5" />
            {duplicating ? "Duplicating…" : "Duplicate Agent"}
          </button>
          <p className="text-sm text-white/25">Creates a copy with the same name and system prompt.</p>
        </div>
      )}

      <div className="pt-2 border-t border-white/10 space-y-4">
        <div>
          <p className="text-lg font-bold text-white">Danger Zone</p>
          <p className="text-base text-white/40 mt-0.5">Permanently deletes this agent and its knowledge base. This cannot be undone.</p>
        </div>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-full py-3 rounded-xl text-base text-white bg-red-600 hover:bg-red-500 transition-colors"
          >
            Delete Agent
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-white/40 text-center">This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2.5 rounded-xl text-sm text-white/40 hover:bg-white/5 border border-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-xl text-sm bg-red-600 hover:bg-red-500 text-white transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden bg-[#1a1a1a]">
        <div className="flex items-center justify-center px-8 py-6 border-b border-white/10 shrink-0">
          <h2 className="text-3xl font-semibold text-white">Agent Settings</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-10 py-10 flex flex-col items-center">
          <div className="w-full max-w-2xl">{form}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 shrink-0 flex flex-col bg-[#141414] border-l border-white/10 overflow-y-auto">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
        <h2 className="text-sm font-semibold text-white">Agent Settings</h2>
        <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 px-5 py-5">{form}</div>
    </div>
  );
}
