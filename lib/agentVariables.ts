export type DataType = "text" | "number" | "boolean";

export interface AgentVariable {
  id: string;
  name: string;
  description: string;
  dataType: DataType;
  example: string;
  defaultValue: string;
}

export type CollectedData = Record<string, string | number | boolean | null>;

export function getAgentVariables(agentId: string): AgentVariable[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`agent_variables_${agentId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveAgentVariables(agentId: string, variables: AgentVariable[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`agent_variables_${agentId}`, JSON.stringify(variables));
}

export function getSessionCollectedData(sessionId: string): CollectedData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`session_variables_${sessionId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveSessionCollectedData(sessionId: string, data: CollectedData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`session_variables_${sessionId}`, JSON.stringify(data));
}

export function deleteSessionCollectedData(sessionId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`session_variables_${sessionId}`);
}
