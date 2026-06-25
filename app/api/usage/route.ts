/**
 * GET /api/usage
 * Returns per-agent usage: session count, run count, estimated tokens.
 * Estimation: ~4 chars per token (rough heuristic).
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie, pbGet, listAgentsWithDescription, parseAgentName } from "@/lib/powabase-server";

const CHARS_PER_TOKEN = 4;

export async function GET(req: NextRequest) {
  try {
    const { user, applyRefresh } = await getUserFromCookie(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get all agents belonging to this user
    const allAgents = await listAgentsWithDescription();
    const userAgents = allAgents.filter(a => parseAgentName(a.name)?.uid === user.id);

    const agentStats = await Promise.all(
      userAgents.map(async (agent) => {
        const parsed = parseAgentName(agent.name)!;
        try {
          const sessionsData = await pbGet(`/api/agents/${agent.id}/sessions`);
          const sessions: { session_id: string; created_at: string }[] = sessionsData.sessions ?? [];

          let totalRuns = 0;
          let totalChars = 0;

          await Promise.all(
            sessions.map(async (session) => {
              try {
                const runsData = await pbGet(`/api/sessions/${session.session_id}/runs`);
                const runs: {
                  input_messages: { role: string; content: string }[];
                  output_messages: { role: string; content: string }[];
                }[] = runsData.runs ?? [];
                totalRuns += runs.length;
                for (const run of runs) {
                  const userMsg = run.input_messages?.find((m) => m.role === "user");
                  const assistantMsg = run.output_messages?.find((m) => m.role === "assistant");
                  totalChars += (userMsg?.content?.length ?? 0) + (assistantMsg?.content?.length ?? 0);
                }
              } catch {
                // skip failed session
              }
            })
          );

          return {
            agentId: agent.id,
            name: parsed.displayName,
            sessionCount: sessions.length,
            runCount: totalRuns,
            estimatedTokens: Math.round(totalChars / CHARS_PER_TOKEN),
          };
        } catch {
          return {
            agentId: agent.id,
            name: parsed.displayName,
            sessionCount: 0,
            runCount: 0,
            estimatedTokens: 0,
          };
        }
      })
    );

    const totalSessions = agentStats.reduce((s, a) => s + a.sessionCount, 0);
    const totalRuns = agentStats.reduce((s, a) => s + a.runCount, 0);
    const totalTokens = agentStats.reduce((s, a) => s + a.estimatedTokens, 0);

    return applyRefresh(
      NextResponse.json({ agents: agentStats, totals: { totalSessions, totalRuns, totalTokens } })
    );
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
