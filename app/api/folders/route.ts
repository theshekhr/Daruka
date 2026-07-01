import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("project_id");
  if (!projectId) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("project_folders")
    .select("*")
    .eq("project_id", projectId)
    .order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { project_id, name, parent_folder_id } = body as {
    project_id?: string;
    name?: string;
    parent_folder_id?: string | null;
  };
  if (!project_id || !name || !name.trim()) {
    return NextResponse.json({ error: "project_id and name are required" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("project_folders")
    .insert({ project_id, name: name.trim(), parent_folder_id: parent_folder_id || null })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}