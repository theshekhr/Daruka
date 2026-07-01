import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { resolveUid } from "@/lib/auth-resolver";
import { syncCodeFilesFromMemory } from "@/lib/file-sync";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = await resolveUid(request);
    const { id } = await params;
    const supabase = createClient();

    const { data: memory, error } = await supabase
      .from("memory_blocks")
      .select("id, project_id, raw_conversation")
      .eq("id", id)
      .single();
    if (error || !memory) {
      return NextResponse.json({ error: "Memory not found" }, { status: 404 });
    }

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", memory.project_id)
      .eq("user_id", uid)
      .single();
    if (!project) {
      return NextResponse.json({ error: "Memory not found" }, { status: 404 });
    }

    const result = await syncCodeFilesFromMemory(
      memory.project_id,
      memory.id,
      memory.raw_conversation,
      uid
    );

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unauthorized" },
      { status: 401 }
    );
  }
}