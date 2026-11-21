import { createClient } from "@supabase/supabase-js";
import { scanAndGenerateAlerts } from "./alerts";

export interface PostImportContext {
  hikes?: Array<{ merchant: string; oldAmount: number; newAmount: number; pctChange: number }>;
  newSubscriptions?: Array<{ merchant: string; amount: number }>;
  overdue?: Array<{ merchant: string; expectedDate: string }>;
}

/**
 * Extension hook executed immediately after import finishes.
 * Automatically scans for budget drift, price hikes, and new subscription alerts.
 */
export async function runPostImportJobs(
  userId: string,
  context?: PostImportContext
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;

  const supabase = createClient(url, serviceKey);
  try {
    await scanAndGenerateAlerts(userId, supabase as any, context);
  } catch (err) {
    console.error("runPostImportJobs failed:", err);
  }
}
