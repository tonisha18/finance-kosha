import { describe, it, expect } from "vitest";
import { detectRecurringSubscriptions, TransactionForRecurring } from "../src/lib/recurring";

describe("Recurring and Subscription Detector", () => {
  it("detects monthly recurring subscriptions and price hikes", () => {
    const txs: TransactionForRecurring[] = [
      { id: "1", date: "2026-08-15", merchant: "Netflix", amount: 649, type: "debit" },
      { id: "2", date: "2026-09-15", merchant: "Netflix", amount: 649, type: "debit" },
      { id: "3", date: "2026-10-15", merchant: "Netflix", amount: 799, type: "debit" }, // Price hike!
    ];

    const result = detectRecurringSubscriptions(txs);
    expect(result.subscriptions.length).toBe(1);
    const sub = result.subscriptions[0];
    expect(sub.merchant).toBe("Netflix");
    expect(sub.frequency).toBe("monthly");
    expect(sub.amount).toBe(799);
    expect(sub.previous_amount).toBe(649);
    expect(sub.price_hike).toBe(true);
    expect(result.hikes.length).toBe(1);
    expect(result.hikes[0].newAmount).toBe(799);
  });

  it("detects weekly subscriptions", () => {
    const txs: TransactionForRecurring[] = [
      { id: "1", date: "2026-10-01", merchant: "Country Delight", amount: 350, type: "debit" },
      { id: "2", date: "2026-10-08", merchant: "Country Delight", amount: 350, type: "debit" },
      { id: "3", date: "2026-10-15", merchant: "Country Delight", amount: 350, type: "debit" },
    ];

    const result = detectRecurringSubscriptions(txs);
    expect(result.subscriptions.length).toBe(1);
    expect(result.subscriptions[0].frequency).toBe("weekly");
  });

  it("ignores one-off transactions", () => {
    const txs: TransactionForRecurring[] = [
      { id: "1", date: "2026-10-01", merchant: "Zomato", amount: 450, type: "debit" },
      { id: "2", date: "2026-10-02", merchant: "Swiggy", amount: 320, type: "debit" },
    ];

    const result = detectRecurringSubscriptions(txs);
    expect(result.subscriptions.length).toBe(0);
  });
});
