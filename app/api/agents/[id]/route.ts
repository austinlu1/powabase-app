/**
 * PATCH /api/agents/[id] → update system_prompt
 * DELETE /api/agents/[id] → delete agent + KB
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie, pbGet, pbPatch, pbDelete, parseAgentName, buildAgentName } from "@/lib/powabase-server";
import { getKnowledgeInstruction } from "@/lib/agentPrefs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, applyRefresh } = await getUserFromCookie(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const { system_prompt, display_name, knowledge_mode } = await req.json();

    const agent = await pbGet(`/api/agents/${id}`);
    const meta = parseAgentName(agent.name);
    if (!meta || meta.uid !== user.id) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const patch: Record<string, string> = {};
    if (system_prompt !== undefined) patch.system_prompt = system_prompt + getKnowledgeInstruction(knowledge_mode);
    if (display_name?.trim()) {
      patch.name = buildAgentName(user.id, meta.kid, display_name.trim());
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const updated = await pbPatch(`/api/agents/${id}`, patch);
    const updatedMeta = parseAgentName(updated.name);
    return applyRefresh(NextResponse.json({
      system_prompt: updated.system_prompt,
      name: updatedMeta?.displayName ?? updated.name,
    }));
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, applyRefresh } = await getUserFromCookie(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;

    // Fetch agent and verify ownership via name format
    const agent = await pbGet(`/api/agents/${id}`);
    const meta = parseAgentName(agent.name);

    if (!meta || meta.uid !== user.id) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    const kb_id = meta.kid;

    await pbDelete(`/api/agents/${id}`);

    // KB deletion is best-effort — agent is already gone so don't let this block success
    try {
      await pbDelete(`/api/knowledge-bases/${kb_id}`);
    } catch (e) {
      console.error(`Failed to delete KB ${kb_id}:`, e);
    }

    return applyRefresh(NextResponse.json({ success: true }));
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
