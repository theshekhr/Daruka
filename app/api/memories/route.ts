import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { resolveUid } from "@/lib/auth-resolver";
import { extractKnowledgeFromConversation, updateKnowledgeGraph } from "@/lib/gemini";
import { getUserGeminiKey, NoApiKeyError } from "@/lib/get-user-key";

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

    let apiKey: string;
    try {
      apiKey = await getUserGeminiKey(uid);
    } catch (err) {
      if (err instanceof NoApiKeyError) {
        return NextResponse.json({ error: err.message, code: "NO_API_KEY" }, { status: 402 });
      }
      throw err;
    }

    const { title, summary, extracted } = await extractKnowledgeFromConversation(
      apiKey,
      body.raw_conversation
    );

    const { data: memory, error: memoryError } = await supabase
      .from("memory_blocks")
      .insert({
        project_id: body.project_id,
        ai_model: body.ai_model || "Unknown",
        raw_conversation: body.raw_conversation,
        title,
        summary,
        extracted_data: extracted,
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

    const existingData = existingGraph?.data || {
      purpose: [],
      tech_stack: [],
      decisions: [],
      completed: [],
      pending: [],
      blockers: [],
      ideas: [],
      architecture: [],
    };

    const updatedData = await updateKnowledgeGraph(apiKey, existingData, {
      title,
      summary,
      extracted_data: extracted,
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

    return NextResponse.json(memory);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unauthorized" },
      { status: 401 }
    );
  }
}