import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { scanAndGenerateAlerts } from "@/lib/alerts";

export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}

async function handleCron(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized: Invalid CRON_SECRET" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const supabase = createClient(url, serviceKey);

  // Get distinct active users from profiles
  const { data: profiles, error } = await supabase.from("profiles").select("id");
  if (error || !profiles) {
    return NextResponse.json({ error: error?.message || "Failed to fetch users" }, { status: 500 });
  }

  const results: Array<{ userId: string; alertsGenerated: number }> = [];

  for (const p of profiles) {
    try {
      const generated = await scanAndGenerateAlerts(p.id, supabase as any);
      results.push({ userId: p.id, alertsGenerated: generated.length });
    } catch (err) {
      console.error(`Cron alert error for user ${p.id}:`, err);
    }
  }

  return NextResponse.json({
    success: true,
    usersProcessed: profiles.length,
    results,
  });
}
