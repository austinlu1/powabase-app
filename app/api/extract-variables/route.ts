import { NextRequest, NextResponse } from "next/server";
import { pbGet, pbPost, pbDelete } from "@/lib/powabase-server";
import { AgentVariable } from "@/lib/agentVariables";

export async function POST(req: NextRequest) {
  try {
    const { agentId, sessionId, variables }: {
      agentId: string;
      sessionId: string;
      variables: AgentVariable[];
    } = await req.json();

    if (!agentId || !sessionId || !variables?.length) {
      return NextResponse.json({ error: "agentId, sessionId, and variables required" }, { status: 400 });
    }

    // Fetch session runs to build a readable transcript
    const data = await pbGet(`/api/sessions/${sessionId}/runs`);
    const runs: {
      input_messages: { role: string; content: string }[];
      output_messages: { role: string; content: string }[];
    }[] = data.runs ?? [];

    if (!runs.length) return NextResponse.json({ data: {} });

    // Build plain transcript, stripping injected context blocks
    const sep = "\n\n---\n\n";
    const lines: string[] = [];
    for (const run of runs) {
      const userMsg = run.input_messages?.find((m) => m.role === "user");
      const assistantMsg = run.output_messages?.find((m) => m.role === "assistant");
      if (userMsg) {
        const raw = userMsg.content ?? "";
        const lastSep = raw.lastIndexOf(sep);
        const display = lastSep !== -1 ? raw.slice(lastSep + sep.length) : raw;
        lines.push(`User: ${display}`);
      }
      if (assistantMsg) lines.push(`Assistant: ${assistantMsg.content ?? ""}`);
    }
    const transcript = lines.join("\n");

    const variableList = variables.map((v) =>
      `- ${v.name} (${v.dataType}): ${v.description}` +
      (v.example ? `. Example: "${v.example}"` : "") +
      (v.defaultValue ? `. Default: "${v.defaultValue}"` : "")
    ).join("\n");

    const message = `You are a data extraction assistant. Extract the following variables from the conversation transcript below. Return ONLY a valid JSON object — no explanation, no markdown, no code fences, just the raw JSON.

Variables to extract:
${variableList}

Conversation:
${transcript}

Rules:
- Return a flat JSON object with variable names as keys.
- For "text" variables, return a string or null.
- For "number" variables, return a number or null.
- For "boolean" variables, return true, false, or null.
- If a value cannot be determined, use the variable's default value, or null if no default is set.`;

    const result = await pbPost(`/api/agents/${agentId}/run`, { message });

    // Delete the ephemeral extraction session before returning so it never appears in the sidebar.
    // Must be awaited — fire-and-forget gets killed by the serverless runtime before it completes.
    if (result.session_id) {
      try {
        await pbDelete(`/api/sessions/${result.session_id}`);
      } catch {
        // best-effort — don't let a cleanup failure break extraction
      }
    }

    // Handle various field names the API might use for the output
    const raw: string =
      (typeof result.output === "string" ? result.output : "") ||
      (typeof result.content === "string" ? result.content : "") ||
      (typeof result.response === "string" ? result.response : "") ||
      (typeof result.result === "string" ? result.result : "") ||
      "";

    // Strip markdown code fences if the model wrapped the JSON anyway
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    let extracted: Record<string, unknown> = {};
    try {
      extracted = JSON.parse(cleaned);
    } catch {
      // Best effort — return empty object rather than crashing
    }

    return NextResponse.json({ data: extracted });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
