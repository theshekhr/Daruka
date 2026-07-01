import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { verifyFirebaseToken } from "@/lib/firebase-admin";
import { supabaseAdmin, FILES_BUCKET } from "@/lib/supabase-admin";

async function getUid(request: Request): Promise<string> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Missing auth token");
  const token = authHeader.split("Bearer ")[1];
  const decoded = await verifyFirebaseToken(token);
  return decoded.uid;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = await getUid(request);
    const { id } = await params;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .eq("user_id", uid)
      .single();
    if (error || !data) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unauthorized" },
      { status: 401 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = await getUid(request);
    const { id } = await params;
    const body = await request.json();
    const supabase = createClient();
    const updates: { name?: string; description?: string | null } = {};
    if (typeof body.name === "string") updates.name = body.name;
    if (typeof body.description === "string" || body.description === null) {
      updates.description = body.description;
    }
    const { data, error } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", id)
      .eq("user_id", uid)
      .select()
      .single();
    if (error || !data) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unauthorized" },
      { status: 401 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = await getUid(request);
    const { id } = await params;
    const supabase = createClient();

    // Confirm ownership before deleting
    const { data: existing } = await supabase
      .from("projects")
      .select("id")
      .eq("id", id)
      .eq("user_id", uid)
      .single();
    if (!existing) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    // Clean up files in Supabase Storage first — this is billable, so it
    // must be removed explicitly. Deleting the project_files rows alone
    // does NOT delete the underlying bytes from the bucket.
    const { data: files } = await supabaseAdmin
      .from("project_files")
      .select("storage_path")
      .eq("project_id", id);

    if (files && files.length > 0) {
      const paths = files.map((f) => f.storage_path);
      const { error: storageError } = await supabaseAdmin.storage
        .from(FILES_BUCKET)
        .remove(paths);
      if (storageError) {
        // Don't block project deletion on a storage cleanup failure —
        // log it so it can be investigated / swept later, but proceed.
        console.error("Failed to remove project files from storage:", storageError.message);
      }
    }

    // Clean up related rows (no cascading FK since we dropped constraints earlier)
    await supabaseAdmin.from("project_files").delete().eq("project_id", id);
    await supabase.from("memory_blocks").delete().eq("project_id", id);
    await supabase.from("knowledge_graph").delete().eq("project_id", id);

    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unauthorized" },
      { status: 401 }
    );
  }
}