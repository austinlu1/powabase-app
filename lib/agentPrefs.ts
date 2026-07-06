// Appended server-side to every system prompt. Never shown to users in the UI.

/** "AI" mode — always searches the KB first, then supplements with own training knowledge */
export const KNOWLEDGE_SEARCH_INSTRUCTION_AI =
  "\n\n[System] You have access to a knowledge_search tool. Always call knowledge_search first to find relevant information from the knowledge base before composing your answer. After retrieving results, you may also draw on your own training knowledge to expand, clarify, or fill gaps in the response.";

/** "KB" mode — AI must only answer from the uploaded knowledge base */
export const KNOWLEDGE_SEARCH_INSTRUCTION_KB =
  "\n\n[System] You have access to a knowledge_search tool. You must ONLY answer questions using information retrieved via knowledge_search from the provided knowledge base. Do not draw from your own training knowledge — if the answer is not in the knowledge base, tell the user you don't have that information rather than guessing.";

/** Legacy alias kept so existing import sites still compile */
export const KNOWLEDGE_SEARCH_INSTRUCTION = KNOWLEDGE_SEARCH_INSTRUCTION_AI;

/** Returns the correct instruction to append based on the chosen mode */
export function getKnowledgeInstruction(mode?: "ai" | "kb"): string {
  return mode === "kb" ? KNOWLEDGE_SEARCH_INSTRUCTION_KB : KNOWLEDGE_SEARCH_INSTRUCTION_AI;
}

export function stripKnowledgeInstruction(prompt: string): string {
  return prompt
    .replace(KNOWLEDGE_SEARCH_INSTRUCTION_AI, "")
    .replace(KNOWLEDGE_SEARCH_INSTRUCTION_KB, "")
    .trimEnd();
}

export interface AgentPrefs {
  welcomeMessage?: string;
  avatarColor?: string; // hex e.g. "#2563eb"
  avatarEmoji?: string;
  temperature?: "precise" | "balanced" | "creative";
  visibility?: "public" | "private";
  displayName?: string; // name shown in chat, Go Live embed — separate from the agent's internal name
  companyName?: string; // company or product this agent represents
  supportContact?: string; // email or phone for the support team
  knowledgeMode?: "ai" | "kb"; // "ai" = AI's own training knowledge, "kb" = rely only on uploaded knowledge base
}

export function getAgentPrefs(agentId: string): AgentPrefs {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`agent_prefs_${agentId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveAgentPrefs(agentId: string, prefs: Partial<AgentPrefs>) {
  const current = getAgentPrefs(agentId);
  localStorage.setItem(`agent_prefs_${agentId}`, JSON.stringify({ ...current, ...prefs }));
}

export function touchAgentLastActive(agentId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`agent_last_active_${agentId}`, new Date().toISOString());
}

export function getAgentLastActive(agentId: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(`agent_last_active_${agentId}`);
}

export const AVATAR_COLORS = [
  "#2563eb", // blue
  "#7c3aed", // violet
  "#059669", // emerald
  "#e11d48", // rose
  "#d97706", // amber
  "#db2777", // pink
  "#0891b2", // cyan
  "#64748b", // slate
];
