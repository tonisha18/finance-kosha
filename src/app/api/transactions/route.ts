import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ALL_CATEGORIES, CategoryName } from "@/lib/categories";
import { createHash } from "crypto";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);
  const category = searchParams.get("category");

  let query = supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(limit);

  if (category && category !== "all") {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ transactions: data || [] });
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
  const { date, merchant, amount, type, category, raw_description } = body;

  if (!merchant || !merchant.trim()) {
    return NextResponse.json({ error: "Counterparty/Merchant name is required" }, { status: 400 });
  }

  const numAmount = Math.abs(Number(amount));
  if (isNaN(numAmount) || numAmount <= 0) {
    return NextResponse.json({ error: "Valid positive amount is required" }, { status: 400 });
  }

  const txnDate = date || new Date().toISOString().split("T")[0];
  const txnType: "debit" | "credit" = type === "credit" ? "credit" : "debit";
  const txnCategory: CategoryName = ALL_CATEGORIES.includes(category as CategoryName)
    ? (category as CategoryName)
    : txnType === "credit"
    ? "Income/Salary"
    : "Shopping";

  const description = (raw_description && raw_description.trim()) || merchant.trim();

  // Deduplication hash with random nonce to allow explicit duplicate manual logging if desired
  const hash = createHash("sha256")
    .update(`${user.id}_${txnDate}_${numAmount}_${merchant}_${txnType}_${Date.now()}`)
    .digest("hex");

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      date: txnDate,
      merchant: merchant.trim(),
      raw_description_redacted: description,
      amount: numAmount,
      type: txnType,
      category: txnCategory,
      category_source: "manual",
      confidence: 1.0,
      needs_review: false,
      dedupe_hash: hash,
      is_recurring: false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, transaction: data });
}
