/**
 * GET /api/user/setup
 * Called on every app load. Ensures the user has at least one agent,
 * and that every agent's KB still exists — recreating any that were deleted.
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie, pbGet, pbPost, pbPatch, listAgentsWithDescription, parseAgentName, buildAgentName } from "@/lib/powabase-server";

const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful AI assistant. When the user provides documents, use your knowledge_search tool to find relevant information before answering. Be concise, accurate, and friendly.";

async function createKb(userIdPrefix: string) {
  return pbPost("/api/knowledge-bases", {
    name: `kb-${userIdPrefix}-${Date.now()}`,
    indexing_config: {
      strategy: "chunk_embed",
      chunk_size: 2000,
      overlap: 50,
      embedding_model: "text-embedding-3-small",
    },
    retrieval_config: { method: "hybrid", top_k: 10, vector_weight: 0.6 },
  });
}

export async function GET(req: NextRequest) {
  const { user, applyRefresh } = await getUserFromCookie(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const allAgents = await listAgentsWithDescription();
    const userAgents = allAgents.filter((a) => parseAgentName(a.name)?.uid === user.id);

    if (userAgents.length === 0) {
      // First login — create default KB + agent
      const kb = await createKb(user.id.slice(0, 8));
      const agent = await pbPost("/api/agents", {
        name: buildAgentName(user.id, kb.id, "My Agent"),
        system_prompt: DEFAULT_SYSTEM_PROMPT,
        model: "gpt-4o-mini",
      });
      await pbPost(`/api/agents/${agent.id}/knowledge-bases`, { knowledge_base_id: kb.id });
        return applyRefresh(NextResponse.json({ agentId: agent.id, kbId: kb.id, user }));
    }

    // Verify every agent's KB still exists — repair any that were deleted
    for (const agent of userAgents) {
      const meta = parseAgentName(agent.name)!;
      let kbExists = true;
      try {
        await pbGet(`/api/knowledge-bases/${meta.kid}`);
      } catch {
        kbExists = false;
      }

      if (!kbExists) {
        const kb = await createKb(user.id.slice(0, 8));
        await pbPatch(`/api/agents/${agent.id}`, {
          name: buildAgentName(user.id, kb.id, meta.displayName),
        });
        await pbPost(`/api/agents/${agent.id}/knowledge-bases`, { knowledge_base_id: kb.id });
      }
    }

    const primary = userAgents[0];
    const primaryMeta = parseAgentName(primary.name)!;
    return applyRefresh(NextResponse.json({ agentId: primary.id, kbId: primaryMeta.kid, user }));
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
