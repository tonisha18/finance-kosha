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

  const { data: profile } = await supabase
    .from("financial_profile")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const { data: fixedCosts } = await supabase
    .from("fixed_costs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const { data: goals } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", user.id)
    .order("priority", { ascending: true });

  // Calculate detected income from transactions (salary credits)
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const { data: credits } = await supabase
    .from("transactions")
    .select("amount, date")
    .eq("user_id", user.id)
    .eq("type", "credit")
    .gte("date", threeMonthsAgo.toISOString().split("T")[0]);

  let detectedMonthlyIncome = 0;
  if (credits && credits.length > 0) {
    const totalCredits = credits.reduce((sum, c) => sum + Number(c.amount), 0);
    detectedMonthlyIncome = Math.round(totalCredits / 3);
  }

  return NextResponse.json({
    profile: profile || null,
    fixedCosts: fixedCosts || [],
    goals: goals || [],
    detectedMonthlyIncome,
  });
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
  const {
    monthly_income,
    income_type,
    emergency_fund_target,
    emergency_fund_balance,
    dependents,
    fixed_costs = [],
  } = body;

  const profilePayload = {
    user_id: user.id,
    monthly_income: Number(monthly_income) || 0,
    income_type: income_type || "salaried",
    emergency_fund_target: Number(emergency_fund_target) || 0,
    emergency_fund_balance: Number(emergency_fund_balance) || 0,
    dependents: Number(dependents) || 0,
    updated_at: new Date().toISOString(),
  };

  const { error: profileError } = await supabase
    .from("financial_profile")
    .upsert(profilePayload, { onConflict: "user_id" });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // Update fixed costs if provided
  if (Array.isArray(fixed_costs)) {
    // Delete existing fixed costs and re-insert
    await supabase.from("fixed_costs").delete().eq("user_id", user.id);
    if (fixed_costs.length > 0) {
      const fixedToInsert = fixed_costs.map((fc: any) => ({
        user_id: user.id,
        name: fc.name,
        amount: Number(fc.amount) || 0,
        due_day: fc.due_day ? Number(fc.due_day) : null,
      }));
      await supabase.from("fixed_costs").insert(fixedToInsert);
    }
  }

  // Write a snapshot to profile_history
  await supabase.from("profile_history").insert({
    user_id: user.id,
    snapshot: {
      profile: profilePayload,
      fixed_costs,
      timestamp: new Date().toISOString(),
    },
  });

  return NextResponse.json({ success: true, profile: profilePayload });
}
