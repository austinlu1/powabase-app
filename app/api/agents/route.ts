/**
 * GET  /api/agents  → list the authenticated user's agents
 * POST /api/agents  → create a new agent + KB for the authenticated user
 *
 * Ownership is tracked by storing "{userId}:{kbId}" in the Powabase agent's
 * description field — no external table writes needed.
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie, pbGet, pbPost, listAgentsWithDescription, parseAgentName, buildAgentName } from "@/lib/powabase-server";

const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful AI assistant. When the user provides documents, use your knowledge_search tool to find relevant information before answering. Be concise, accurate, and friendly.";

export async function GET(req: NextRequest) {
  const { user, applyRefresh } = await getUserFromCookie(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const allAgents = await listAgentsWithDescription();

    const agents = allAgents
      .map((agent) => {
        const meta = parseAgentName(agent.name);
        if (!meta || meta.uid !== user.id) return null;
        return {
          id: agent.id,
          kb_id: meta.kid,
          name: meta.displayName,
          system_prompt: agent.system_prompt,
          model: agent.model,
          created_at: agent.created_at,
        };
      })
      .filter(Boolean);

    return applyRefresh(NextResponse.json({ agents }));
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user, applyRefresh } = await getUserFromCookie(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { name, system_prompt } = await req.json();
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

    // 1. Create a dedicated KB for this agent
    const kb = await pbPost("/api/knowledge-bases", {
      name: `kb-${user.id.slice(0, 8)}-${Date.now()}`,
      indexing_config: {
        strategy: "chunk_embed",
        chunk_size: 2000,
        overlap: 50,
        embedding_model: "text-embedding-3-small",
      },
      retrieval_config: {
        method: "hybrid",
        top_k: 10,
        vector_weight: 0.6,
      },
    });

    // 2. Create agent — name encodes "{userId}__{kbId}__{displayName}" for ownership tracking
    const agent = await pbPost("/api/agents", {
      name: buildAgentName(user.id, kb.id, name),
      system_prompt: system_prompt || DEFAULT_SYSTEM_PROMPT,
      model: "gpt-4o-mini",
    });

    // 3. Link KB to agent (auto-creates knowledge_search tool)
    await pbPost(`/api/agents/${agent.id}/knowledge-bases`, {
      knowledge_base_id: kb.id,
    });

    return applyRefresh(NextResponse.json({
      id: agent.id,
      kb_id: kb.id,
      name,
      system_prompt: agent.system_prompt,
      model: agent.model,
      created_at: agent.created_at,
    }, { status: 201 }));
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
