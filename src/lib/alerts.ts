import { createClient } from "@supabase/supabase-js";
import { generateJson } from "./llm";
import { z } from "zod";
import { PostImportContext } from "./post-import";

export type AlertType =
  | "price_hike"
  | "budget_drift"
  | "upcoming_renewal"
  | "new_subscription"
  | "goal_risk"
  | "anomaly"
  | "missing_charge";

export type AlertSeverity = "info" | "warning" | "critical";

export interface AlertDraft {
  alert_type: AlertType;
  title: string;
  body: string;
  severity: AlertSeverity;
  dedup_key: string;
}

const LLMAlertBatchSchema = z.object({
  alerts: z.array(
    z.object({
      dedup_key: z.string(),
      title: z.string(),
      body: z.string(),
    })
  ),
});

/**
 * Deterministic template fallback when LLM is unavailable or fails schema validation.
 */
export function getTemplateAlert(
  type: AlertType,
  payload: Record<string, any>
): { title: string; body: string; severity: AlertSeverity } {
  switch (type) {
    case "price_hike":
      return {
        title: `Subscription Price Hike: ${payload.merchant}`,
        body: `${payload.merchant} increased from ₹${payload.oldAmount?.toLocaleString("en-IN")} to ₹${payload.newAmount?.toLocaleString("en-IN")} (+${payload.pctChange}%). Check your subscription settings to review this renewal.`,
        severity: "warning",
      };
    case "new_subscription":
      return {
        title: `New Recurring Charge Detected: ${payload.merchant}`,
        body: `We noticed a new regular charge of ₹${payload.amount?.toLocaleString("en-IN")} for ${payload.merchant}. Added to your active subscriptions tracker.`,
        severity: "info",
      };
    case "budget_drift":
      if (payload.driftType === "100") {
        return {
          title: `Budget Limit Reached: ${payload.category}`,
          body: `You have spent ₹${payload.spent?.toLocaleString("en-IN")} of your ₹${payload.limit?.toLocaleString("en-IN")} budget for ${payload.category}. Consider holding off discretionary purchases until next month.`,
          severity: "critical",
        };
      }
      if (payload.driftType === "proj") {
        return {
          title: `Projected Budget Overage: ${payload.category}`,
          body: `At your current pace, month-end spend on ${payload.category} is projected to reach ₹${payload.projected?.toLocaleString("en-IN")} (limit: ₹${payload.limit?.toLocaleString("en-IN")}). Reducing daily spend can bring this back on track.`,
          severity: "warning",
        };
      }
      return {
        title: `80% of Budget Used: ${payload.category}`,
        body: `You've utilized ₹${payload.spent?.toLocaleString("en-IN")} (80%) of your ₹${payload.limit?.toLocaleString("en-IN")} monthly budget for ${payload.category}. Keep an eye on remaining expenses.`,
        severity: "warning",
      };
    case "upcoming_renewal":
      return {
        title: `Upcoming Renewal: ${payload.merchant}`,
        body: `Your subscription to ${payload.merchant} (₹${payload.amount?.toLocaleString("en-IN")}) is due to renew in ${payload.daysLeft} days. Ensure sufficient balance is maintained.`,
        severity: "info",
      };
    case "missing_charge":
      return {
        title: `Expected Charge Overdue: ${payload.merchant}`,
        body: `We haven't seen your recurring charge for ${payload.merchant} (expected around ${payload.expectedDate}). Verify if this service was paused or cancelled.`,
        severity: "info",
      };
    case "anomaly":
      return {
        title: `Unusual Expense Detected in ${payload.category}`,
        body: `A debit of ₹${payload.amount?.toLocaleString("en-IN")} at ${payload.merchant} is over 3x your typical spend in ${payload.category}. Review this transaction in your ledger.`,
        severity: "warning",
      };
    case "goal_risk":
      return {
        title: `Savings Goal at Risk: ${payload.goalName}`,
        body: `Your ${payload.goalName} goal requires ₹${payload.requiredMonthly?.toLocaleString("en-IN")}/mo, which exceeds your current monthly surplus of ₹${payload.surplus?.toLocaleString("en-IN")}. Adjust your target date or trim discretionary expenses.`,
        severity: "critical",
      };
  }
}

/**
 * Severity ranking for alert sorting.
 */
const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  critical: 1,
  warning: 2,
  info: 3,
};

/**
 * Main alert scanner engine.
 */
export async function scanAndGenerateAlerts(
  userId: string,
  supabaseClient: any,
  context?: PostImportContext
): Promise<AlertDraft[]> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const monthStr = `${year}-${month}`;
  const daysInMonth = new Date(year, now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();

  const candidateAlerts: AlertDraft[] = [];

  // 1. Price hikes and new subscriptions from context or DB
  if (context?.hikes) {
    for (const h of context.hikes) {
      const dedup_key = `hike_${h.merchant.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${year}_${month}`;
      const template = getTemplateAlert("price_hike", h);
      candidateAlerts.push({
        alert_type: "price_hike",
        title: template.title,
        body: template.body,
        severity: template.severity,
        dedup_key,
      });
    }
  }

  if (context?.newSubscriptions) {
    for (const s of context.newSubscriptions) {
      const dedup_key = `newsub_${s.merchant.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
      const template = getTemplateAlert("new_subscription", s);
      candidateAlerts.push({
        alert_type: "new_subscription",
        title: template.title,
        body: template.body,
        severity: template.severity,
        dedup_key,
      });
    }
  }

  // 2. Budget drift (80%, 100%, and projection)
  const { data: budgets }: any = await supabaseClient
    .from("category_budgets")
    .select("category, monthly_limit")
    .eq("user_id", userId);

  const startOfMonth = `${monthStr}-01`;
  const { data: currentMonthTx }: any = await supabaseClient
    .from("transactions")
    .select("id, category, amount, merchant, date, type")
    .eq("user_id", userId)
    .gte("date", startOfMonth)
    .eq("type", "debit");

  if (budgets && currentMonthTx) {
    const spendByCat = new Map<string, number>();
    for (const t of currentMonthTx) {
      spendByCat.set(t.category, (spendByCat.get(t.category) || 0) + Number(t.amount));
    }

    for (const b of budgets) {
      const spent = spendByCat.get(b.category) || 0;
      const limit = Number(b.monthly_limit);
      if (limit <= 0) continue;

      const catKey = b.category.toLowerCase().replace(/[^a-z0-9]/g, "_");

      // 100% critical
      if (spent >= limit) {
        const dedup_key = `budget100_${catKey}_${year}_${month}`;
        const template = getTemplateAlert("budget_drift", { category: b.category, spent, limit, driftType: "100" });
        candidateAlerts.push({
          alert_type: "budget_drift",
          title: template.title,
          body: template.body,
          severity: "critical",
          dedup_key,
        });
      } else if (spent >= 0.8 * limit) {
        // 80% warning
        const dedup_key = `budget80_${catKey}_${year}_${month}`;
        const template = getTemplateAlert("budget_drift", { category: b.category, spent, limit, driftType: "80" });
        candidateAlerts.push({
          alert_type: "budget_drift",
          title: template.title,
          body: template.body,
          severity: "warning",
          dedup_key,
        });
      }

      // Projection
      if (currentDay > 3) {
        const projected = (spent / currentDay) * daysInMonth;
        if (projected > limit && spent < limit) {
          const dedup_key = `proj_${catKey}_${year}_${month}`;
          const template = getTemplateAlert("budget_drift", { category: b.category, projected, limit, driftType: "proj" });
          candidateAlerts.push({
            alert_type: "budget_drift",
            title: template.title,
            body: template.body,
            severity: "warning",
            dedup_key,
          });
        }
      }
    }
  }

  // 3. Subscriptions renewals (within 3 days) and missing charges (>5 days overdue)
  const { data: activeSubs }: any = await supabaseClient
    .from("subscriptions")
    .select("merchant, amount, next_expected_date, status")
    .eq("user_id", userId)
    .eq("status", "active");

  if (activeSubs) {
    for (const sub of activeSubs) {
      if (!sub.next_expected_date) continue;
      const nextDate = new Date(sub.next_expected_date);
      const diffDays = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const merchKey = sub.merchant.toLowerCase().replace(/[^a-z0-9]/g, "_");

      if (diffDays >= 0 && diffDays <= 3) {
        const dedup_key = `renew_${merchKey}_${sub.next_expected_date}`;
        const template = getTemplateAlert("upcoming_renewal", {
          merchant: sub.merchant,
          amount: sub.amount,
          daysLeft: diffDays,
        });
        candidateAlerts.push({
          alert_type: "upcoming_renewal",
          title: template.title,
          body: template.body,
          severity: "info",
          dedup_key,
        });
      } else if (diffDays < -5) {
        const dedup_key = `missing_${merchKey}_${year}_${month}`;
        const template = getTemplateAlert("missing_charge", {
          merchant: sub.merchant,
          expectedDate: sub.next_expected_date,
        });
        candidateAlerts.push({
          alert_type: "missing_charge",
          title: template.title,
          body: template.body,
          severity: "info",
          dedup_key,
        });
      }
    }
  }

  // 4. Anomalies (single debit > 3x 3-month category average and > Rs 2,000)
  if (currentMonthTx) {
    // 3-month category average calculation
    const threeMonthsAgo = new Date(year, now.getMonth() - 3, 1).toISOString().split("T")[0];
    const { data: pastTx }: any = await supabaseClient
      .from("transactions")
      .select("category, amount")
      .eq("user_id", userId)
      .gte("date", threeMonthsAgo)
      .lt("date", startOfMonth)
      .eq("type", "debit");

    const pastCatTotals = new Map<string, number>();
    const pastCatCounts = new Map<string, number>();
    if (pastTx) {
      for (const p of pastTx) {
        pastCatTotals.set(p.category, (pastCatTotals.get(p.category) || 0) + Number(p.amount));
        pastCatCounts.set(p.category, (pastCatCounts.get(p.category) || 0) + 1);
      }
    }

    for (const tx of currentMonthTx) {
      const amt = Number(tx.amount);
      if (amt >= 2000) {
        const total = pastCatTotals.get(tx.category) || 0;
        const count = pastCatCounts.get(tx.category) || 0;
        const avg = count > 0 ? total / count : 500;
        if (amt >= 3 * avg) {
          const dedup_key = `anom_${tx.id}`;
          const template = getTemplateAlert("anomaly", {
            amount: amt,
            merchant: tx.merchant,
            category: tx.category,
          });
          candidateAlerts.push({
            alert_type: "anomaly",
            title: template.title,
            body: template.body,
            severity: "warning",
            dedup_key,
          });
        }
      }
    }
  }

  // 5. Goal Risk
  const { data: goals }: any = await supabaseClient
    .from("goals")
    .select("id, name, target_amount, current_amount, target_date, status")
    .eq("user_id", userId)
    .eq("status", "active");

  if (goals && goals.length > 0) {
    // calculate average surplus from last 3 months
    const threeMonthsAgo = new Date(year, now.getMonth() - 3, 1).toISOString().split("T")[0];
    const { data: pastIncome }: any = await supabaseClient
      .from("transactions")
      .select("amount")
      .eq("user_id", userId)
      .gte("date", threeMonthsAgo)
      .eq("type", "credit");
    const { data: pastSpend }: any = await supabaseClient
      .from("transactions")
      .select("amount")
      .eq("user_id", userId)
      .gte("date", threeMonthsAgo)
      .eq("type", "debit");

    const totalInc = (pastIncome || []).reduce((acc: number, r: any) => acc + Number(r.amount), 0);
    const totalSp = (pastSpend || []).reduce((acc: number, r: any) => acc + Number(r.amount), 0);
    const avgMonthlySurplus = Math.max(0, (totalInc - totalSp) / 3);

    for (const g of goals) {
      const targetDate = new Date(g.target_date);
      const monthsLeft = Math.max(
        1,
        (targetDate.getFullYear() - year) * 12 + (targetDate.getMonth() - now.getMonth())
      );
      const remaining = Number(g.target_amount) - Number(g.current_amount);
      const requiredMonthly = remaining / monthsLeft;

      if (requiredMonthly > avgMonthlySurplus && avgMonthlySurplus > 0) {
        const dedup_key = `goal_${g.id}_${year}_${month}`;
        const template = getTemplateAlert("goal_risk", {
          goalName: g.name,
          requiredMonthly: Math.round(requiredMonthly),
          surplus: Math.round(avgMonthlySurplus),
        });
        candidateAlerts.push({
          alert_type: "goal_risk",
          title: template.title,
          body: template.body,
          severity: "critical",
          dedup_key,
        });
      }
    }
  }

  // Filter out alerts that already exist in DB for this user
  if (candidateAlerts.length === 0) return [];

  const dedupKeys = candidateAlerts.map((a) => a.dedup_key);
  const { data: existing }: any = await supabaseClient
    .from("alerts")
    .select("dedup_key")
    .eq("user_id", userId)
    .in("dedup_key", dedupKeys);

  const existingSet = new Set((existing || []).map((e: any) => e.dedup_key));
  const newAlerts = candidateAlerts.filter((a) => !existingSet.has(a.dedup_key));

  if (newAlerts.length === 0) return [];

  // Sort by severity (critical first, then warning, then info) and cap at 5
  newAlerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const cappedAlerts = newAlerts.slice(0, 5);

  // Optional: Enhance copy using LLM if available
  if (process.env.GEMINI_API_KEY) {
    try {
      const prompt = `You are a warm, supportive personal finance coach. Write a concise, supportive title and 2-sentence body for each alert.
Guidelines:
- Never shame or judge.
- Cite exact rupee figures from the payload.
- End with one practical next step.
Return valid JSON matching the schema.

ALERTS PAYLOAD:
${JSON.stringify(
  cappedAlerts.map((a) => ({
    dedup_key: a.dedup_key,
    type: a.alert_type,
    severity: a.severity,
    defaultTitle: a.title,
    defaultBody: a.body,
  })),
  null,
  2
)}`;

      const llmResult = await generateJson(
        LLMAlertBatchSchema,
        prompt,
        "You are an encouraging financial alert copywriter. Produce warm, constructive alert copy."
      );

      const copyMap = new Map(llmResult.alerts.map((c) => [c.dedup_key, c]));
      for (const alert of cappedAlerts) {
        const enhanced = copyMap.get(alert.dedup_key);
        if (enhanced?.title && enhanced?.body) {
          alert.title = enhanced.title;
          alert.body = enhanced.body;
        }
      }
    } catch (err) {
      // Fallback silently to deterministic templates already set
      console.warn("LLM alert enhancement failed, using deterministic templates:", err);
    }
  }

  // Insert into DB
  const toInsert = cappedAlerts.map((a) => ({
    user_id: userId,
    alert_type: a.alert_type,
    title: a.title,
    body: a.body,
    severity: a.severity,
    dedup_key: a.dedup_key,
    is_read: false,
  }));

  await (supabaseClient.from("alerts") as any).upsert(toInsert, { onConflict: "user_id,dedup_key" });

  return cappedAlerts;
}
