/**
 * dashboard.ts
 * Pure calculation functions for the plain-language dashboard.
 * Zero jargon: no drift, runway, surplus, coverage, or savings rate.
 */

export interface SafeToSpendParams {
  profileMonthlyIncome?: number | null;
  threeMonthAvgIncome?: number | null;
  actualIncomeThisMonth: number;
  spentSoFarThisMonth: number;
  recentDailySpendAvg: number;
  fixedCostsRemaining: number;
  activeGoalsMonthlyContribution: number;
  daysInMonth: number;
  currentDay: number; // 1-based, e.g. 21
  hasTransactions: boolean;
}

export interface SafeToSpendResult {
  status: "on_track" | "careful" | "over" | "insufficient";
  headline: string;
  expectedIncome: number;
  spentSoFar: number;
  reserved: number;
  safeToSpendTotal: number;
  perDay: number;
  daysLeft: number;
}

export interface MonthSummaryResult {
  earned: number;
  spent: number;
  kept: number;
  isOverspent: boolean;
  sentence: string;
  comparisonSentence: string | null;
  spendRatio: number; // 0 to 1 for visual bar
}

export interface BudgetRowResult {
  category: string;
  monthly_limit: number;
  spent: number;
  left: number;
  pct: number;
  text: string;
  status: "On track" | "Close" | "Over";
}

export interface TopCategoryResult {
  category: string;
  amount: number;
  comparison: string | null;
}

export interface SubscriptionSnapshotResult {
  count: number;
  monthlyTotal: number;
  summarySentence: string;
  chips: string[];
}

export interface UpcomingPaymentItem {
  name: string;
  amount: number;
  daysAway: number;
  dueText: string;
  dateStr: string;
}

export interface UpcomingPaymentsResult {
  items: UpcomingPaymentItem[];
  total: number;
  summaryText: string;
}

export interface GoalStatusResult {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  pct: number;
  monthlyNeeded: number;
  sentence: string;
}

/**
 * Formats a number in Indian currency grouping as "Rs X,XX,XXX".
 * Displayed amounts are rounded to whole rupees.
 */
export function formatRupees(amount: number): string {
  const rounded = Math.round(Math.abs(amount));
  return `Rs ${rounded.toLocaleString("en-IN")}`;
}

/**
 * Extracts a friendly first name for greeting.
 * - profiles.display_name, else email before @ with first letter capitalized, else "there".
 * - Multi-word names only use the first word.
 */
export function greetingName(displayName?: string | null, email?: string | null): string {
  if (displayName && displayName.trim()) {
    const clean = displayName.trim().split(/\s+/)[0];
    if (clean) return clean;
  }

  if (email && email.trim()) {
    const username = email.trim().split("@")[0];
    if (username) {
      const clean = username.split(/\s+/)[0];
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    }
  }

  return "there";
}

/**
 * Pure calculation for Safe-to-Spend verdict card.
 */
export function safeToSpend(params: SafeToSpendParams): SafeToSpendResult {
  const {
    profileMonthlyIncome,
    threeMonthAvgIncome,
    actualIncomeThisMonth,
    spentSoFarThisMonth,
    recentDailySpendAvg,
    fixedCostsRemaining,
    activeGoalsMonthlyContribution,
    daysInMonth,
    currentDay,
    hasTransactions,
  } = params;

  const daysLeft = Math.max(1, daysInMonth - currentDay + 1);

  // Expected income priority
  let expectedIncome = 0;
  if (profileMonthlyIncome && profileMonthlyIncome > 0) {
    expectedIncome = profileMonthlyIncome;
  } else if (threeMonthAvgIncome && threeMonthAvgIncome > 0) {
    expectedIncome = threeMonthAvgIncome;
  } else if (actualIncomeThisMonth > 0) {
    expectedIncome = actualIncomeThisMonth;
  }

  // Insufficient data check
  if (expectedIncome <= 0 && !hasTransactions) {
    return {
      status: "insufficient",
      headline: "Upload a statement or set your income to see how much you can safely spend.",
      expectedIncome: 0,
      spentSoFar: 0,
      reserved: 0,
      safeToSpendTotal: 0,
      perDay: 0,
      daysLeft,
    };
  }

  const reserved = Math.max(0, fixedCostsRemaining) + Math.max(0, activeGoalsMonthlyContribution);
  const netAvailable = expectedIncome - spentSoFarThisMonth - reserved;
  const safeToSpendTotal = Math.max(0, netAvailable);
  const perDay = Math.round(safeToSpendTotal / daysLeft);

  // Status determinations
  if (netAvailable <= 0) {
    return {
      status: "over",
      headline: "You've spent more than you earn this month. Let's look at what to trim.",
      expectedIncome,
      spentSoFar: spentSoFarThisMonth,
      reserved,
      safeToSpendTotal: 0,
      perDay: 0,
      daysLeft,
    };
  }

  // If daily spend average is known and perDay is less than 70% of usual pace
  const thresholdRate = recentDailySpendAvg > 0 ? recentDailySpendAvg : (expectedIncome / daysInMonth);
  if (thresholdRate > 0 && perDay < 0.7 * thresholdRate) {
    return {
      status: "careful",
      headline: `Careful: you're spending faster than planned. Try to keep to ${formatRupees(perDay)} a day for the next ${daysLeft} days.`,
      expectedIncome,
      spentSoFar: spentSoFarThisMonth,
      reserved,
      safeToSpendTotal,
      perDay,
      daysLeft,
    };
  }

  return {
    status: "on_track",
    headline: `You're on track this month. You can safely spend ${formatRupees(perDay)} a day for the next ${daysLeft} days.`,
    expectedIncome,
    spentSoFar: spentSoFarThisMonth,
    reserved,
    safeToSpendTotal,
    perDay,
    daysLeft,
  };
}

/**
 * Plain language month summary in one sentence.
 */
export function monthSummary(
  earned: number,
  spent: number,
  lastMonthKept?: number | null
): MonthSummaryResult {
  const kept = earned - spent;
  const isOverspent = kept < 0;

  const sentence = isOverspent
    ? `You earned ${formatRupees(earned)}, spent ${formatRupees(spent)}, and overspent by ${formatRupees(Math.abs(kept))}.`
    : `You earned ${formatRupees(earned)}, spent ${formatRupees(spent)}, and kept ${formatRupees(kept)}.`;

  let comparisonSentence: string | null = null;
  if (lastMonthKept !== undefined && lastMonthKept !== null) {
    const diff = kept - lastMonthKept;
    if (diff > 0) {
      comparisonSentence = `That's ${formatRupees(diff)} more kept than last month.`;
    } else if (diff < 0) {
      comparisonSentence = `That's ${formatRupees(Math.abs(diff))} less kept than last month.`;
    } else {
      comparisonSentence = `That's the same amount kept as last month.`;
    }
  }

  const spendRatio = earned > 0 ? Math.min(1, Math.max(0, spent / earned)) : (spent > 0 ? 1 : 0);

  return {
    earned,
    spent,
    kept,
    isOverspent,
    sentence,
    comparisonSentence,
    spendRatio,
  };
}

/**
 * Budget progress rows (up to 5 categories, ordered by highest usage).
 */
export function budgetRows(
  budgets: { category: string; monthly_limit: number }[],
  spendByCategory: Record<string, number>
): BudgetRowResult[] {
  if (!budgets || budgets.length === 0) return [];

  const rows: BudgetRowResult[] = budgets.map((b) => {
    const spent = spendByCategory[b.category] || 0;
    const limit = b.monthly_limit;
    const left = limit - spent;
    const pct = limit > 0 ? Math.round((spent / limit) * 100) : 100;

    const text =
      left >= 0
        ? `${formatRupees(left)} left of ${formatRupees(limit)}`
        : `${formatRupees(Math.abs(left))} over`;

    let status: "On track" | "Close" | "Over" = "On track";
    if (pct >= 100) status = "Over";
    else if (pct >= 80) status = "Close";

    return {
      category: b.category,
      monthly_limit: limit,
      spent,
      left,
      pct,
      text,
      status,
    };
  });

  // Sort by highest percent used, then take top 5
  rows.sort((a, b) => b.pct - a.pct || b.spent - a.spent);
  return rows.slice(0, 5);
}

/**
 * Top 3 spending categories compared to user's usual history.
 */
export function topCategoriesVsUsual(
  currentMonthSpends: { category: string; amount: number }[],
  historicalCategoryAvgs: Record<string, number>,
  historyMonthsCount: number
): TopCategoryResult[] {
  if (!currentMonthSpends || currentMonthSpends.length === 0) return [];

  const sorted = [...currentMonthSpends]
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  const hasHistory = historyMonthsCount >= 2;

  return sorted.map((item) => {
    let comparison: string | null = null;
    if (hasHistory) {
      const usual = historicalCategoryAvgs[item.category] || 0;
      const diff = item.amount - usual;
      if (diff > 500) {
        comparison = `${formatRupees(diff)} more than usual`;
      } else if (diff < -500) {
        comparison = `${formatRupees(Math.abs(diff))} less than usual`;
      } else {
        comparison = "about the same as usual";
      }
    }

    return {
      category: item.category,
      amount: item.amount,
      comparison,
    };
  });
}

/**
 * Subscriptions Snapshot
 */
export function subscriptionsSnapshot(
  subscriptions: {
    merchant: string;
    amount: number;
    frequency: string;
    status: string;
    price_hike?: boolean;
    next_expected_date?: string;
  }[]
): SubscriptionSnapshotResult | null {
  const active = (subscriptions || []).filter((s) => s.status === "active");
  if (active.length === 0) return null;

  const monthlyTotal = Math.round(
    active.reduce((sum, s) => {
      const amt = Number(s.amount);
      if (s.frequency === "yearly") return sum + amt / 12;
      if (s.frequency === "quarterly") return sum + amt / 3;
      if (s.frequency === "weekly") return sum + amt * 4.33;
      return sum + amt;
    }, 0)
  );

  const summarySentence = `You pay ${formatRupees(monthlyTotal)} a month on ${active.length} subscription${active.length === 1 ? "" : "s"}.`;

  const chips: string[] = [];
  const hikes = subscriptions.filter((s) => s.price_hike).length;
  if (hikes > 0) chips.push(`${hikes} went up`);

  const unused = subscriptions.filter((s) => s.status === "unused").length;
  if (unused > 0) chips.push(`${unused} looks unused`);

  // Next renewal
  const withNextDate = active
    .filter((s) => s.next_expected_date)
    .sort((a, b) => (a.next_expected_date! > b.next_expected_date! ? 1 : -1));

  if (withNextDate.length > 0) {
    const nextSub = withNextDate[0];
    const d = new Date(nextSub.next_expected_date!);
    if (!isNaN(d.getTime())) {
      const dateFmt = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      chips.push(`Next: ${nextSub.merchant} on ${dateFmt}`);
    }
  }

  return {
    count: active.length,
    monthlyTotal,
    summarySentence,
    chips,
  };
}

/**
 * Upcoming payments for next 7 days.
 */
export function upcomingPayments(
  subscriptions: { merchant: string; amount: number; next_expected_date?: string; status: string }[],
  fixedCosts: { name: string; amount: number; due_day?: number }[],
  referenceDate: Date
): UpcomingPaymentsResult | null {
  const items: UpcomingPaymentItem[] = [];
  const startMs = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate()).getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  // 1. Subscriptions
  for (const s of subscriptions || []) {
    if (s.status !== "active" || !s.next_expected_date) continue;
    const targetDate = new Date(s.next_expected_date);
    if (isNaN(targetDate.getTime())) continue;

    const diffDays = Math.round((targetDate.getTime() - startMs) / (24 * 60 * 60 * 1000));
    if (diffDays >= 0 && diffDays <= 7) {
      const dueText =
        diffDays === 0 ? "today" : diffDays === 1 ? "tomorrow" : `in ${diffDays} days`;
      items.push({
        name: s.merchant,
        amount: Number(s.amount),
        daysAway: diffDays,
        dueText,
        dateStr: targetDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      });
    }
  }

  // 2. Fixed Costs with due_day
  const currentMonth = referenceDate.getMonth();
  const currentYear = referenceDate.getFullYear();
  for (const f of fixedCosts || []) {
    if (!f.due_day) continue;
    // Test for this month's due_day or next month's due_day
    let target = new Date(currentYear, currentMonth, f.due_day);
    if (target.getTime() < startMs) {
      target = new Date(currentYear, currentMonth + 1, f.due_day);
    }

    const diffDays = Math.round((target.getTime() - startMs) / (24 * 60 * 60 * 1000));
    if (diffDays >= 0 && diffDays <= 7) {
      const dueText =
        diffDays === 0 ? "today" : diffDays === 1 ? "tomorrow" : `in ${diffDays} days`;
      items.push({
        name: f.name,
        amount: Number(f.amount),
        daysAway: diffDays,
        dueText,
        dateStr: target.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      });
    }
  }

  if (items.length === 0) return null;

  items.sort((a, b) => a.daysAway - b.daysAway || b.amount - a.amount);
  const topItems = items.slice(0, 4);
  const total = topItems.reduce((sum, item) => sum + item.amount, 0);

  return {
    items: topItems,
    total,
    summaryText: `About ${formatRupees(total)} going out in the next 7 days.`,
  };
}

/**
 * Goal status sentence (up to 2 goals).
 */
export function goalStatusSentence(
  goal: {
    id: string;
    name: string;
    target_amount: number;
    current_amount?: number;
    target_date: string;
  },
  referenceDate: Date
): GoalStatusResult {
  const current = Number(goal.current_amount || 0);
  const target = Number(goal.target_amount);
  const remaining = Math.max(0, target - current);
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 100;

  const targetDate = new Date(goal.target_date);
  let monthsLeft = 1;
  let targetMonthName = "the target date";

  if (!isNaN(targetDate.getTime())) {
    targetMonthName = targetDate.toLocaleDateString("en-IN", { month: "long" });
    const diffMonths =
      (targetDate.getFullYear() - referenceDate.getFullYear()) * 12 +
      (targetDate.getMonth() - referenceDate.getMonth());
    monthsLeft = Math.max(1, diffMonths);
  }

  const monthlyNeeded = Math.round(remaining / monthsLeft);

  // Status sentence logic
  let sentence = "";
  if (pct >= 90) {
    sentence = `Almost there: just ${formatRupees(remaining)} left to complete this goal!`;
  } else if (monthlyNeeded <= 5000) {
    sentence = `On track for ${targetMonthName} if you save ${formatRupees(monthlyNeeded)} a month.`;
  } else {
    sentence = `A bit behind: you'd need ${formatRupees(monthlyNeeded)} a month to finish on time.`;
  }

  return {
    id: goal.id,
    name: goal.name,
    target_amount: target,
    current_amount: current,
    pct,
    monthlyNeeded,
    sentence,
  };
}
