import { createClient } from "@/lib/supabase/server";
import { scanAndGenerateAlerts } from "@/lib/alerts";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const alerts = await scanAndGenerateAlerts(user.id, supabase as any);
    return NextResponse.json({ success: true, count: alerts.length, alerts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to scan alerts" }, { status: 500 });
  }
}
