import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { seedDemoDataForUser } from "@/lib/seed-demo";

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

    const { action } = await request.json();

    if (action === "clear") {
      // Clear demo data
      await supabase.from("transactions").delete().eq("user_id", user.id).eq("is_demo", true);
      await supabase.from("subscriptions").delete().eq("user_id", user.id).eq("is_demo", true);
      await supabase.from("alerts").delete().eq("user_id", user.id).eq("is_demo", true);
      await supabase.from("goals").delete().eq("user_id", user.id).eq("is_demo", true);
      return NextResponse.json({ success: true, message: "Demo data cleared" });
    }

    // Action === "load"
    const result = await seedDemoDataForUser(supabase, user.id);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to seed demo data" }, { status: 500 });
  }
}
