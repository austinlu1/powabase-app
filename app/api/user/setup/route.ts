/**
 * GET /api/user/setup
 *
 * Called once on app load. Ensures the authenticated user has:
 *   - A dedicated Powabase agent
 *   - A dedicated Knowledge Base linked to that agent
 *   - A knowledge_search builtin tool on the agent
 *   - A row in user_agents linking them together
 *
 * On first login  → creates agent + KB → inserts into user_agents → returns ids
 * On return visit → looks up existing row in user_agents → returns ids
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie, pbPost, pbRestGet, pbRestPost } from "@/lib/powabase-server";

const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful AI assistant. When the user provides documents, use your knowledge_search tool to find relevant information before answering. Be concise, accurate, and friendly.";

interface UserAgentRow {
  agent_id: string;
  kb_id: string;
}

export async function GET(req: NextRequest) {
  const user = await getUserFromCookie(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // 1. Check if this user already has an agent set up
    const rows = await pbRestGet<UserAgentRow>("user_agents", {
      user_id: `eq.${user.id}`,
      select: "agent_id,kb_id",
      limit: "1",
    });

    if (rows.length > 0) {
      return NextResponse.json({ agentId: rows[0].agent_id, kbId: rows[0].kb_id, user });
    }

    // 2. First login — create a dedicated agent for this user
    const agent = await pbPost("/api/agents", {
      name: `chat-${user.id}`,
      system_prompt: DEFAULT_SYSTEM_PROMPT,
      model: "gpt-4o-mini",
    });

    // 3. Create a dedicated Knowledge Base for this user
    const kb = await pbPost("/api/knowledge-bases", {
      name: `kb-${user.id}`,
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

    // 4. Attach the KB to the agent
    await pbPost(`/api/agents/${agent.id}/knowledge-bases`, {
      knowledge_base_id: kb.id,
    });

    // 5. Explicitly add the knowledge_search builtin tool to the agent
    await pbPost(`/api/agents/${agent.id}/tools`, {
      tool_name: "knowledge_search",
    });

    // 6. Store the mapping in our user_agents table
    await pbRestPost("user_agents", {
      user_id: user.id,
      agent_id: agent.id,
      kb_id: kb.id,
    });

    return NextResponse.json({ agentId: agent.id, kbId: kb.id, user });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
