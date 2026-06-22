import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { resolveUid } from "@/lib/auth-resolver";
import { generateSwitchContextWithFallback } from "@/lib/providers";
import { getUserProviderConfig } from "@/lib/get-user-key";

export async function POST(request: Request) {
  try {
    const uid = await resolveUid(request);
    const body = await request.json();

    const supabase = createClient();

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", body.project_id)
      .eq("user_id", uid)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { data: memories, error: memoriesError } = await supabase
      .from("memory_blocks")
      .select("*")
      .eq("project_id", body.project_id)
      .order("created_at", { ascending: true });

    if (memoriesError) {
      return NextResponse.json({ error: memoriesError.message }, { status: 500 });
    }

    const config = await getUserProviderConfig(uid);
    const { context, providerUsed, degraded } = await generateSwitchContextWithFallback(
      config,
      project.name,
      project.description || "",
      memories || []
    );

    return NextResponse.json({ context, providerUsed, degraded });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unauthorized" },
      { status: 401 }
    );
  }
}