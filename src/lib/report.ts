import { generateText } from "./llm";

export interface MonthlyReportData {
  month: string; // YYYY-MM
  totalIncome: number;
  totalSpend: number;
  netSavings: number;
  savingsRate: number; // percentage
  categories: Array<{
    name: string;
    amount: number;
    pctOfTotal: number;
    momChangePct: number; // month-over-month %
  }>;
  topMerchants: Array<{
    merchant: string;
    amount: number;
  }>;
  subscriptionSummary: {
    totalMonthlyCost: number;
    activeCount: number;
    hikesCount: number;
  };
  budgetAdherence: Array<{
    category: string;
    spent: number;
    limit: number;
    pctUsed: number;
    status: "within" | "near_limit" | "exceeded";
  }>;
  goalSummary: Array<{
    name: string;
    current: number;
    target: number;
    pct: number;
  }>;
  focusAreas: string[];
}

/**
 * Deterministic report generation fallback when LLM is unavailable.
 */
export function generateTemplateNarrative(data: MonthlyReportData): string {
  const savingsWord = data.netSavings >= 0 ? "saved" : "overspent by";
  const absSavings = Math.abs(data.netSavings).toLocaleString("en-IN");
  const topCat = data.categories[0]?.name || "Discretionary";

  return `In ${data.month}, you earned ₹${data.totalIncome.toLocaleString(
    "en-IN"
  )} and spent ₹${data.totalSpend.toLocaleString(
    "en-IN"
  )}, achieving a savings rate of ${data.savingsRate}%. You ${savingsWord} ₹${absSavings}. Your largest expenditure was in ${topCat} (₹${(
    data.categories[0]?.amount || 0
  ).toLocaleString(
    "en-IN"
  )}). Key focus for next month: ${data.focusAreas.slice(0, 2).join("; ")}. Keep maintaining steady cash-flow habits!`;
}

/**
 * Computes deterministic report data from raw transactions, budgets, subscriptions, and goals.
 */
export function computeReportData(
  month: string, // YYYY-MM
  currentTx: Array<{ category: string; amount: number; merchant: string; type: string }>,
  previousTx: Array<{ category: string; amount: number; merchant: string; type: string }>,
  budgets: Array<{ category: string; monthly_limit: number }>,
  subscriptions: Array<{ merchant: string; amount: number; status: string }>,
  goals: Array<{ name: string; target_amount: number; current_amount: number }>
): MonthlyReportData {
  let totalIncome = 0;
  let totalSpend = 0;
  const currentCatMap: Record<string, number> = {};
  const currentMerchMap: Record<string, number> = {};

  for (const t of currentTx) {
    const amt = Number(t.amount);
    if (t.type === "credit") {
      totalIncome += amt;
    } else if (t.type === "debit") {
      totalSpend += amt;
      currentCatMap[t.category] = (currentCatMap[t.category] || 0) + amt;
      currentMerchMap[t.merchant] = (currentMerchMap[t.merchant] || 0) + amt;
    }
  }

  // Previous month category spends for MoM comparison
  const prevCatMap: Record<string, number> = {};
  for (const t of previousTx) {
    if (t.type === "debit") {
      prevCatMap[t.category] = (prevCatMap[t.category] || 0) + Number(t.amount);
    }
  }

  const netSavings = totalIncome - totalSpend;
  const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

  // Categories array with MoM change
  const categories = Object.entries(currentCatMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => {
      const prev = prevCatMap[name] || 0;
      let momChangePct = 0;
      if (prev > 0) {
        momChangePct = Math.round(((amount - prev) / prev) * 100);
      }
      return {
        name,
        amount: Math.round(amount),
        pctOfTotal: totalSpend > 0 ? Math.round((amount / totalSpend) * 100) : 0,
        momChangePct,
      };
    });

  // Top 5 merchants
  const topMerchants = Object.entries(currentMerchMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([merchant, amount]) => ({ merchant, amount: Math.round(amount) }));

  // Budget adherence
  const budgetAdherence = budgets.map((b) => {
    const spent = currentCatMap[b.category] || 0;
    const limit = Number(b.monthly_limit);
    const pctUsed = limit > 0 ? Math.round((spent / limit) * 100) : 0;
    let status: "within" | "near_limit" | "exceeded" = "within";
    if (pctUsed >= 100) status = "exceeded";
    else if (pctUsed >= 80) status = "near_limit";

    return {
      category: b.category,
      spent: Math.round(spent),
      limit: Math.round(limit),
      pctUsed,
      status,
    };
  });

  // Subscriptions summary
  const activeSubs = subscriptions.filter((s) => s.status === "active");
  const totalSubCost = activeSubs.reduce((acc, s) => acc + Number(s.amount), 0);

  // Goals summary
  const goalSummary = goals.map((g) => ({
    name: g.name,
    current: Math.round(Number(g.current_amount || 0)),
    target: Math.round(Number(g.target_amount)),
    pct: Math.min(100, Math.round(((g.current_amount || 0) / Math.max(1, g.target_amount)) * 100)),
  }));

  // Focus areas (2-3 deterministic takeaways)
  const focusAreas: string[] = [];
  const exceededBudgets = budgetAdherence.filter((b) => b.status === "exceeded");
  if (exceededBudgets.length > 0) {
    focusAreas.push(
      `Budget exceeded in ${exceededBudgets.map((b) => b.category).join(", ")} by ₹${exceededBudgets
        .reduce((sum, b) => sum + (b.spent - b.limit), 0)
        .toLocaleString("en-IN")}`
    );
  }

  const fastestGrowing = categories.find((c) => c.momChangePct > 20 && c.amount > 3000);
  if (fastestGrowing) {
    focusAreas.push(
      `Spend in ${fastestGrowing.name} grew by +${fastestGrowing.momChangePct}% compared to last month`
    );
  }

  if (savingsRate < 20 && totalIncome > 0) {
    focusAreas.push(`Savings rate is at ${savingsRate}%; targeting 20-30% will accelerate your emergency fund`);
  } else if (focusAreas.length === 0) {
    focusAreas.push("All category budgets remained within safe thresholds this month");
  }

  return {
    month,
    totalIncome: Math.round(totalIncome),
    totalSpend: Math.round(totalSpend),
    netSavings: Math.round(netSavings),
    savingsRate,
    categories,
    topMerchants,
    subscriptionSummary: {
      totalMonthlyCost: Math.round(totalSubCost),
      activeCount: activeSubs.length,
      hikesCount: 0,
    },
    budgetAdherence,
    goalSummary,
    focusAreas,
  };
}

/**
 * Calls LLM to synthesize concise supportive 150-word narrative from precomputed report data.
 */
export async function synthesizeReportNarrative(data: MonthlyReportData): Promise<string> {
  const prompt = `Write a supportive, personalized 150-word monthly financial review narrative for the user based strictly on this verified report data:
${JSON.stringify(data, null, 2)}

Rules:
- Cite exact INR figures from the data.
- Tone: warm, encouraging, peer-like coach. Never shame or scold.
- Highlight positive accomplishments, call out primary focus area, and give one constructive next step.
- Maximum 150 words.`;

  try {
    return await generateText(
      prompt,
      "You are kosha's financial review copywriter. Produce warm, constructive monthly financial narratives."
    );
  } catch (err) {
    console.warn("LLM report narrative generation failed, using template:", err);
    return generateTemplateNarrative(data);
  }
}
