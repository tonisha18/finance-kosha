import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const LearnRuleSchema = z.object({
  transaction_id: z.string().uuid(),
  merchant_keyword: z.string().min(1),
  new_category: z.string().min(1),
  scope: z.enum(["all", "this_only"]),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = LearnRuleSchema.parse(body);

    // 1. Fetch the target transaction to verify ownership and record old category
    const { data: tx, error: txError } = await supabase
      .from("transactions")
      .select("id, user_id, category, merchant")
      .eq("id", validated.transaction_id)
      .eq("user_id", user.id)
      .single();

    if (txError || !tx) {
      return NextResponse.json({ error: "Transaction not found or not owned by user" }, { status: 404 });
    }

    const oldCategory = tx.category;

    // 2. Update clicked transaction
    await supabase
      .from("transactions")
      .update({
        category: validated.new_category,
        category_source: "user",
        needs_review: false,
      })
      .eq("id", tx.id)
      .eq("user_id", user.id);

    // 3. Log feedback
    await supabase.from("categorization_feedback").insert({
      user_id: user.id,
      transaction_id: tx.id,
      old_category: oldCategory,
      new_category: validated.new_category,
      rule_created: validated.scope === "all",
    });

    let rowsUpdated = 1;

    // 4. If scope is "all", save rule and retroactively update matching transactions
    if (validated.scope === "all") {
      const keyword = validated.merchant_keyword.trim();

      // Upsert into category_rules
      await supabase.from("category_rules").upsert(
        {
          user_id: user.id,
          merchant_keyword: keyword,
          category: validated.new_category,
          is_active: true,
        },
        { onConflict: "user_id,merchant_keyword" }
      );

      // Find other transactions that match the keyword (case-insensitive substring) where category_source != 'user'
      const { data: matchingTxs } = await supabase
        .from("transactions")
        .select("id, merchant")
        .eq("user_id", user.id)
        .neq("category_source", "user")
        .ilike("merchant", `%${keyword}%`);

      if (matchingTxs && matchingTxs.length > 0) {
        const idsToUpdate = matchingTxs.map((t) => t.id);
        const { count } = await supabase
          .from("transactions")
          .update({
            category: validated.new_category,
            category_source: "rule",
            needs_review: false,
          })
          .in("id", idsToUpdate)
          .eq("user_id", user.id);

        rowsUpdated += count || idsToUpdate.length;
      }
    }

    return NextResponse.json({
      success: true,
      rows_updated: rowsUpdated,
      scope: validated.scope,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to process rule";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
