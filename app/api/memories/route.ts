import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { resolveUid } from "@/lib/auth-resolver";
import { extractWithFallback, updateKnowledgeGraphWithFallback } from "@/lib/providers";
import { getUserProviderConfig } from "@/lib/get-user-key";
import { EMPTY_KNOWLEDGE } from "@/lib/providers/types";

async function assertOwnsProject(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  uid: string
) {
  const { data, error } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", uid)
    .single();
  if (error || !data) throw new Error("Project not found");
}

export async function GET(request: Request) {
  try {
    const uid = await resolveUid(request);
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("project_id");
    if (!projectId) return NextResponse.json({ error: "project_id required" }, { status: 400 });

    const supabase = createClient();
    await assertOwnsProject(supabase, projectId, uid);

    const { data, error } = await supabase
      .from("memory_blocks")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unauthorized" },
      { status: 401 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const uid = await resolveUid(request);
    const body = await request.json();

    const supabase = createClient();
    await assertOwnsProject(supabase, body.project_id, uid);

    if (!body.raw_conversation || !body.raw_conversation.trim()) {
      return NextResponse.json({ error: "raw_conversation is required" }, { status: 400 });
    }

    const config = await getUserProviderConfig(uid);
    const aiModel = body.ai_model || "Unknown";

    const { result, providerUsed, degraded } = await extractWithFallback(
      config,
      body.raw_conversation,
      aiModel
    );

    const { data: memory, error: memoryError } = await supabase
      .from("memory_blocks")
      .insert({
        project_id: body.project_id,
        ai_model: aiModel,
        raw_conversation: result.formatted_conversation,
        title: result.title,
        summary: result.summary,
        extracted_data: result.extracted,
      })
      .select()
      .single();

    if (memoryError) {
      return NextResponse.json({ error: memoryError.message }, { status: 500 });
    }

    const { data: existingGraph } = await supabase
      .from("knowledge_graph")
      .select("*")
      .eq("project_id", body.project_id)
      .maybeSingle();

    const existingData = existingGraph?.data || EMPTY_KNOWLEDGE;

    const { data: updatedData } = await updateKnowledgeGraphWithFallback(config, existingData, {
      title: result.title,
      summary: result.summary,
      extracted_data: result.extracted,
    });

    if (existingGraph) {
      await supabase
        .from("knowledge_graph")
        .update({ data: updatedData, updated_at: new Date().toISOString() })
        .eq("project_id", body.project_id);
    } else {
      await supabase
        .from("knowledge_graph")
        .insert({ project_id: body.project_id, data: updatedData });
    }

    return NextResponse.json({ ...memory, _meta: { providerUsed, degraded } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unauthorized" },
      { status: 401 }
    );
  }
}