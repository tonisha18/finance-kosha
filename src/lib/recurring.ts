export type Frequency = "weekly" | "monthly" | "quarterly" | "yearly";

export interface TransactionForRecurring {
  id: string;
  date: string; // YYYY-MM-DD
  merchant: string;
  amount: number;
  type: "debit" | "credit";
}

export interface DetectedSubscription {
  merchant: string;
  amount: number;
  previous_amount: number | null;
  frequency: Frequency;
  last_billed_date: string;
  next_expected_date: string;
  price_hike: boolean;
  price_hike_amount: number;
  price_hike_pct: number;
  matching_transaction_ids: string[];
}

export interface RecurringDetectionResult {
  subscriptions: DetectedSubscription[];
  hikes: Array<{ merchant: string; oldAmount: number; newAmount: number; pctChange: number }>;
  newSubscriptions: Array<{ merchant: string; amount: number }>;
  overdue: Array<{ merchant: string; expectedDate: string }>;
}

function parseDate(d: string): number {
  return new Date(d).getTime();
}

function addDays(d: string, days: number): string {
  const date = new Date(d);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Pure recurring payments detector.
 * Group debits by normalized merchant across history.
 * Detect 2+ charges with consistent interval and amounts within 15%.
 * Detect price hikes (latest amount higher by >= 3% or Rs 5).
 */
export function detectRecurringSubscriptions(
  transactions: TransactionForRecurring[]
): RecurringDetectionResult {
  // Only debits can be subscriptions
  const debits = transactions.filter((t) => t.type === "debit" && t.amount > 0);

  // Group by normalized merchant
  const groups: Record<string, TransactionForRecurring[]> = {};
  for (const t of debits) {
    const key = t.merchant.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }

  const subscriptions: DetectedSubscription[] = [];
  const hikes: Array<{ merchant: string; oldAmount: number; newAmount: number; pctChange: number }> = [];
  const newSubscriptions: Array<{ merchant: string; amount: number }> = [];
  const overdue: Array<{ merchant: string; expectedDate: string }> = [];

  const today = new Date().toISOString().slice(0, 10);
  const todayMs = parseDate(today);

  for (const key in groups) {
    const group = groups[key];
    if (group.length < 2) continue;

    // Sort ascending by date
    group.sort((a, b) => parseDate(a.date) - parseDate(b.date));

    // Calculate intervals between consecutive charges in days
    const intervals: number[] = [];
    for (let i = 1; i < group.length; i++) {
      const diffMs = parseDate(group[i].date) - parseDate(group[i - 1].date);
      const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
      intervals.push(days);
    }

    // Determine average interval
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    let freq: Frequency | null = null;
    let expectedCycleDays = 30;

    if (avgInterval >= 5 && avgInterval <= 10) {
      freq = "weekly";
      expectedCycleDays = 7;
    } else if (avgInterval >= 25 && avgInterval <= 36) {
      freq = "monthly";
      expectedCycleDays = 30;
    } else if (avgInterval >= 80 && avgInterval <= 100) {
      freq = "quarterly";
      expectedCycleDays = 90;
    } else if (avgInterval >= 340 && avgInterval <= 385) {
      freq = "yearly";
      expectedCycleDays = 365;
    }

    if (!freq) continue;

    // Check amount tolerance: allow past amounts to be within 15% of each other,
    // or detect a clear price hike in the latest charge
    const amounts = group.map((t) => t.amount);
    const latestAmount = amounts[amounts.length - 1];
    const prevAmount = amounts[amounts.length - 2];

    const isHike =
      latestAmount > prevAmount &&
      (latestAmount - prevAmount >= 5 || (latestAmount - prevAmount) / prevAmount >= 0.03);

    const priceHikePct = prevAmount > 0 ? ((latestAmount - prevAmount) / prevAmount) * 100 : 0;

    const lastBilledDate = group[group.length - 1].date;
    const nextExpectedDate = addDays(lastBilledDate, expectedCycleDays);

    const sub: DetectedSubscription = {
      merchant: group[0].merchant,
      amount: latestAmount,
      previous_amount: isHike ? prevAmount : null,
      frequency: freq,
      last_billed_date: lastBilledDate,
      next_expected_date: nextExpectedDate,
      price_hike: isHike,
      price_hike_amount: isHike ? latestAmount - prevAmount : 0,
      price_hike_pct: isHike ? Math.round(priceHikePct * 10) / 10 : 0,
      matching_transaction_ids: group.map((t) => t.id),
    };

    subscriptions.push(sub);

    if (isHike) {
      hikes.push({
        merchant: sub.merchant,
        oldAmount: prevAmount,
        newAmount: latestAmount,
        pctChange: sub.price_hike_pct,
      });
    }

    // Check if expected charge is overdue by more than 5 days
    const nextExpectedMs = parseDate(nextExpectedDate);
    const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
    if (todayMs > nextExpectedMs + fiveDaysMs) {
      overdue.push({
        merchant: sub.merchant,
        expectedDate: nextExpectedDate,
      });
    }

    newSubscriptions.push({
      merchant: sub.merchant,
      amount: sub.amount,
    });
  }

  return { subscriptions, hikes, newSubscriptions, overdue };
}
