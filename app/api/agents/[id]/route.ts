/**
 * PATCH /api/agents/[id] → update system_prompt
 * DELETE /api/agents/[id] → delete agent + KB
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie, pbGet, pbPatch, pbDelete, parseAgentName } from "@/lib/powabase-server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, applyRefresh } = await getUserFromCookie(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const { system_prompt } = await req.json();
    if (!system_prompt?.trim()) {
      return NextResponse.json({ error: "system_prompt required" }, { status: 400 });
    }

    const agent = await pbGet(`/api/agents/${id}`);
    const meta = parseAgentName(agent.name);
    if (!meta || meta.uid !== user.id) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const updated = await pbPatch(`/api/agents/${id}`, { system_prompt });
    return applyRefresh(NextResponse.json({ system_prompt: updated.system_prompt }));
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
    await pbDelete(`/api/knowledge-bases/${kb_id}`);

    return applyRefresh(NextResponse.json({ success: true }));
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
