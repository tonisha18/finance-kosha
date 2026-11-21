import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: goals, error } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", user.id)
    .order("priority", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ goals: goals || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, target_amount, current_amount, target_date, priority } = body;

  if (!name || !target_amount || !target_date) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("goals")
    .insert({
      user_id: user.id,
      name,
      target_amount: Number(target_amount),
      current_amount: Number(current_amount) || 0,
      target_date,
      priority: Number(priority) || 1,
      status: "active",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ goal: data });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, name, target_amount, current_amount, target_date, priority, status } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing goal id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("goals")
    .update({
      name,
      target_amount: Number(target_amount),
      current_amount: Number(current_amount),
      target_date,
      priority: Number(priority),
      status,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ goal: data });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, add_amount, current_amount, status } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing goal id" }, { status: 400 });
  }

  // Fetch the existing goal
  const { data: existingGoal, error: fetchErr } = await supabase
    .from("goals")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchErr || !existingGoal) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  let newAmount = Number(existingGoal.current_amount) || 0;
  if (typeof add_amount === "number" && !isNaN(add_amount)) {
    newAmount += add_amount;
  } else if (typeof current_amount === "number" && !isNaN(current_amount)) {
    newAmount = current_amount;
  }

  const updatePayload: Record<string, any> = {
    current_amount: Math.max(0, Math.round(newAmount)),
  };

  if (status) {
    updatePayload.status = status;
  } else if (newAmount >= Number(existingGoal.target_amount)) {
    updatePayload.status = "achieved";
  }

  const { data, error } = await supabase
    .from("goals")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ goal: data, added: add_amount || 0 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing goal id" }, { status: 400 });
  }

  const { error } = await supabase.from("goals").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
