import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { resolveUid } from "@/lib/auth-resolver";

export async function GET(request: Request) {
  try {
    const uid = await resolveUid(request);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", uid)
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

    const { data, error } = await supabase
      .from("projects")
      .insert({ name: body.name, description: body.description, user_id: uid })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unauthorized" },
      { status: 401 }
    );
  }
}