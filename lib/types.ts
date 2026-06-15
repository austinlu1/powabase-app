// ── Agents ───────────────────────────────────────────────────────────────────

export interface UserAgent {
  id: string;           // agent_id from Powabase
  kb_id: string;        // kb_id from Powabase
  name: string;         // display name from user_agents table
  system_prompt: string;
  model: string;
  created_at: string;
}

// ── Sessions ─────────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  agent_id: string;
  created_at: string;
}

// ── Messages ─────────────────────────────────────────────────────────────────

export interface Run {
  id: string;
  session_id: string;
  user_message: string;
  assistant_message: string;
  created_at: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}

// ── Sources ───────────────────────────────────────────────────────────────────

export interface Source {
  id: string;
  name: string;
  status: "pending" | "processing" | "completed" | "failed";
  created_at: string;
}

// ── Knowledge Bases ───────────────────────────────────────────────────────────

export interface KnowledgeBase {
  id: string;
  name: string;
  created_at: string;
}

// ── UI ────────────────────────────────────────────────────────────────────────

export interface Conversation {
  sessionId: string;
  agentId: string;
  title: string;
  createdAt: string;
}
