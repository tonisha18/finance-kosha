import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient as createAdminSupabase } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { action, confirmation } = body;

  if (confirmation !== "DELETE") {
    return NextResponse.json(
      { error: "Must confirm by typing 'DELETE'" },
      { status: 400 }
    );
  }

  if (action === "clear_data") {
    // Delete user rows across all application tables
    await Promise.all([
      supabase.from("transactions").delete().eq("user_id", user.id),
      supabase.from("import_batches").delete().eq("user_id", user.id),
      supabase.from("category_rules").delete().eq("user_id", user.id),
      supabase.from("categorization_feedback").delete().eq("user_id", user.id),
      supabase.from("subscriptions").delete().eq("user_id", user.id),
      supabase.from("category_budgets").delete().eq("user_id", user.id),
      supabase.from("alerts").delete().eq("user_id", user.id),
      supabase.from("financial_profile").delete().eq("user_id", user.id),
      supabase.from("fixed_costs").delete().eq("user_id", user.id),
      supabase.from("profile_history").delete().eq("user_id", user.id),
      supabase.from("goals").delete().eq("user_id", user.id),
      supabase.from("saved_scenarios").delete().eq("user_id", user.id),
      supabase.from("monthly_reports").delete().eq("user_id", user.id),
      supabase.from("guardrail_events").delete().eq("user_id", user.id),
    ]);

    return NextResponse.json({ success: true, message: "All user data deleted" });
  }

  if (action === "delete_account") {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json({ error: "Service key missing" }, { status: 500 });
    }

    const adminClient = createAdminSupabase(url, serviceKey);
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(user.id);

    if (deleteAuthError) {
      return NextResponse.json({ error: deleteAuthError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Account permanently deleted" });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
