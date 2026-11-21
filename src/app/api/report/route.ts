import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeReportData, synthesizeReportNarrative } from "@/lib/report";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");

  if (month) {
    const { data: report } = await supabase
      .from("monthly_reports")
      .select("*")
      .eq("user_id", user.id)
      .eq("month", `${month}-01`)
      .single();

    return NextResponse.json({ report: report || null });
  }

  // List all past reports
  const { data: reports } = await supabase
    .from("monthly_reports")
    .select("id, month, created_at")
    .eq("user_id", user.id)
    .order("month", { ascending: false });

  return NextResponse.json({ reports: reports || [] });
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
  const targetMonth = body.month || new Date().toISOString().slice(0, 7); // e.g. "2026-11"
  const startDate = `${targetMonth}-01`;

  // Calculate next month start date
  const [y, m] = targetMonth.split("-").map(Number);
  const nextMonthDate = new Date(y, m, 1);
  const endDate = nextMonthDate.toISOString().slice(0, 10);

  // Calculate previous month start and end dates
  const prevMonthDate = new Date(y, m - 2, 1);
  const prevStart = prevMonthDate.toISOString().slice(0, 10);

  // 1. Fetch current month transactions
  const { data: currentTx } = await supabase
    .from("transactions")
    .select("category, amount, merchant, type")
    .eq("user_id", user.id)
    .gte("date", startDate)
    .lt("date", endDate);

  // 2. Fetch previous month transactions
  const { data: previousTx } = await supabase
    .from("transactions")
    .select("category, amount, merchant, type")
    .eq("user_id", user.id)
    .gte("date", prevStart)
    .lt("date", startDate);

  // 3. Fetch budgets
  const { data: budgets } = await supabase
    .from("category_budgets")
    .select("category, monthly_limit")
    .eq("user_id", user.id);

  // 4. Fetch subscriptions
  const { data: subscriptions } = await supabase
    .from("subscriptions")
    .select("merchant, amount, status")
    .eq("user_id", user.id);

  // 5. Fetch goals
  const { data: goals } = await supabase
    .from("goals")
    .select("name, target_amount, current_amount")
    .eq("user_id", user.id);

  // 6. Compute verified ground truth data
  const reportData = computeReportData(
    targetMonth,
    (currentTx || []) as any,
    (previousTx || []) as any,
    (budgets || []) as any,
    (subscriptions || []) as any,
    (goals || []) as any
  );

  // 7. Synthesize short supportive narrative
  const narrative = await synthesizeReportNarrative(reportData);

  // 8. Upsert into monthly_reports
  const { data: savedReport, error: saveError } = await supabase
    .from("monthly_reports")
    .upsert(
      {
        user_id: user.id,
        month: startDate,
        data: reportData,
        narrative,
      },
      { onConflict: "user_id,month" }
    )
    .select()
    .single();

  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 });
  }

  return NextResponse.json({ report: savedReport });
}
