import { describe, it, expect } from "vitest";
import {
  formatRupees,
  greetingName,
  safeToSpend,
  monthSummary,
  budgetRows,
  topCategoriesVsUsual,
  subscriptionsSnapshot,
  upcomingPayments,
  goalStatusSentence,
} from "@/lib/dashboard";

describe("Dashboard pure calculation functions", () => {
  describe("formatRupees", () => {
    it("formats Indian rupees with grouping and whole numbers", () => {
      expect(formatRupees(124500)).toBe("Rs 1,24,500");
      expect(formatRupees(640)).toBe("Rs 640");
      expect(formatRupees(0)).toBe("Rs 0");
      expect(formatRupees(-5000)).toBe("Rs 5,000");
    });
  });

  describe("greetingName", () => {
    it("uses first word of display_name", () => {
      expect(greetingName("Aditya Sharma", "aditya@example.com")).toBe("Aditya");
      expect(greetingName("Pooja", "pooja@example.com")).toBe("Pooja");
    });

    it("falls back to email username capitalized when display_name is empty", () => {
      expect(greetingName("", "john.doe@example.com")).toBe("John.doe");
      expect(greetingName(null, "rahul@gmail.com")).toBe("Rahul");
    });

    it("falls back to 'there' when both are missing or empty", () => {
      expect(greetingName(null, null)).toBe("there");
      expect(greetingName("", "")).toBe("there");
    });
  });

  describe("safeToSpend", () => {
    it("returns on_track when per_day is healthy", () => {
      const result = safeToSpend({
        profileMonthlyIncome: 100000,
        threeMonthAvgIncome: null,
        actualIncomeThisMonth: 100000,
        spentSoFarThisMonth: 30000,
        recentDailySpendAvg: 1000,
        fixedCostsRemaining: 20000,
        activeGoalsMonthlyContribution: 5000,
        daysInMonth: 30,
        currentDay: 20, // 11 days left
        hasTransactions: true,
      });

      // safe total = 100000 - 30000 - 25000 = 45000
      // daysLeft = 30 - 20 + 1 = 11
      // perDay = 45000 / 11 = ~4091
      expect(result.status).toBe("on_track");
      expect(result.daysLeft).toBe(11);
      expect(result.perDay).toBeGreaterThan(1000);
      expect(result.headline).toContain("You're on track this month");
      expect(result.headline).toContain("Rs 4,091 a day");
    });

    it("returns careful when per_day is below 70% of usual pace", () => {
      const result = safeToSpend({
        profileMonthlyIncome: 60000,
        actualIncomeThisMonth: 60000,
        spentSoFarThisMonth: 45000,
        recentDailySpendAvg: 2000, // 70% is 1400
        fixedCostsRemaining: 10000,
        activeGoalsMonthlyContribution: 0,
        daysInMonth: 30,
        currentDay: 15, // 16 days left
        hasTransactions: true,
      });

      // safe total = 60000 - 45000 - 10000 = 5000
      // perDay = 5000 / 16 = 313 (less than 1400)
      expect(result.status).toBe("careful");
      expect(result.headline).toContain("Careful: you're spending faster than planned");
      expect(result.headline).toContain("Rs 313 a day");
    });

    it("returns over when total spent and reserved exceeds income", () => {
      const result = safeToSpend({
        profileMonthlyIncome: 50000,
        actualIncomeThisMonth: 50000,
        spentSoFarThisMonth: 45000,
        recentDailySpendAvg: 1500,
        fixedCostsRemaining: 10000, // 45k + 10k = 55k > 50k
        activeGoalsMonthlyContribution: 0,
        daysInMonth: 30,
        currentDay: 25,
        hasTransactions: true,
      });

      expect(result.status).toBe("over");
      expect(result.safeToSpendTotal).toBe(0);
      expect(result.perDay).toBe(0);
      expect(result.headline).toBe("You've spent more than you earn this month. Let's look at what to trim.");
    });

    it("handles last day of the month correctly", () => {
      const result = safeToSpend({
        profileMonthlyIncome: 60000,
        actualIncomeThisMonth: 60000,
        spentSoFarThisMonth: 50000,
        recentDailySpendAvg: 1000,
        fixedCostsRemaining: 5000,
        activeGoalsMonthlyContribution: 0,
        daysInMonth: 30,
        currentDay: 30, // 1 day left
        hasTransactions: true,
      });

      expect(result.daysLeft).toBe(1);
      expect(result.perDay).toBe(5000); // 60k - 50k - 5k = 5k / 1
    });

    it("returns insufficient when user has no income info and no transactions", () => {
      const result = safeToSpend({
        profileMonthlyIncome: null,
        threeMonthAvgIncome: null,
        actualIncomeThisMonth: 0,
        spentSoFarThisMonth: 0,
        recentDailySpendAvg: 0,
        fixedCostsRemaining: 0,
        activeGoalsMonthlyContribution: 0,
        daysInMonth: 30,
        currentDay: 1,
        hasTransactions: false,
      });

      expect(result.status).toBe("insufficient");
      expect(result.headline).toBe("Upload a statement or set your income to see how much you can safely spend.");
    });
  });

  describe("monthSummary", () => {
    it("returns positive kept sentence and delta vs last month", () => {
      const res = monthSummary(85000, 71000, 12000);
      expect(res.kept).toBe(14000);
      expect(res.isOverspent).toBe(false);
      expect(res.sentence).toBe("You earned Rs 85,000, spent Rs 71,000, and kept Rs 14,000.");
      expect(res.comparisonSentence).toBe("That's Rs 2,000 more kept than last month.");
    });

    it("returns overspent sentence when spent exceeds earned", () => {
      const res = monthSummary(50000, 53000, 5000);
      expect(res.kept).toBe(-3000);
      expect(res.isOverspent).toBe(true);
      expect(res.sentence).toBe("You earned Rs 50,000, spent Rs 53,000, and overspent by Rs 3,000.");
      expect(res.comparisonSentence).toBe("That's Rs 8,000 less kept than last month.");
    });
  });

  describe("budgetRows", () => {
    it("orders by most used and calculates remaining rupee amounts", () => {
      const budgets = [
        { category: "Food & Dining", monthly_limit: 10000 },
        { category: "Shopping", monthly_limit: 5000 },
      ];
      const spend = {
        "Food & Dining": 8500, // 85%
        Shopping: 5500, // 110%
      };

      const rows = budgetRows(budgets, spend);
      expect(rows).toHaveLength(2);
      expect(rows[0].category).toBe("Shopping"); // 110% is higher usage
      expect(rows[0].status).toBe("Over");
      expect(rows[0].text).toBe("Rs 500 over");

      expect(rows[1].category).toBe("Food & Dining");
      expect(rows[1].status).toBe("Close");
      expect(rows[1].text).toBe("Rs 1,500 left of Rs 10,000");
    });
  });

  describe("topCategoriesVsUsual", () => {
    it("computes comparisons when 2 or more months of history exist", () => {
      const currentSpends = [
        { category: "Food & Dining", amount: 12000 },
        { category: "Groceries", amount: 8000 },
        { category: "Shopping", amount: 7000 },
        { category: "Utilities", amount: 3000 },
      ];
      const historyAvgs = {
        "Food & Dining": 9000, // +3000
        Groceries: 8050, // about same
        Shopping: 8500, // -1500
      };

      const top = topCategoriesVsUsual(currentSpends, historyAvgs, 3);
      expect(top).toHaveLength(3);
      expect(top[0].category).toBe("Food & Dining");
      expect(top[0].comparison).toBe("Rs 3,000 more than usual");

      expect(top[1].category).toBe("Groceries");
      expect(top[1].comparison).toBe("about the same as usual");

      expect(top[2].category).toBe("Shopping");
      expect(top[2].comparison).toBe("Rs 1,500 less than usual");
    });

    it("hides comparisons when history is insufficient", () => {
      const currentSpends = [{ category: "Food & Dining", amount: 5000 }];
      const top = topCategoriesVsUsual(currentSpends, {}, 1);
      expect(top[0].comparison).toBeNull();
    });
  });

  describe("subscriptionsSnapshot", () => {
    it("returns null for empty subscriptions list", () => {
      expect(subscriptionsSnapshot([])).toBeNull();
    });

    it("formats summary and chips for active subscriptions", () => {
      const subs = [
        { merchant: "Netflix", amount: 649, frequency: "monthly", status: "active", price_hike: true },
        { merchant: "Spotify", amount: 119, frequency: "monthly", status: "active", next_expected_date: "2026-12-15" },
        { merchant: "Gym", amount: 2000, frequency: "monthly", status: "unused" },
      ];

      const res = subscriptionsSnapshot(subs);
      expect(res).not.toBeNull();
      expect(res?.count).toBe(2); // 2 active
      expect(res?.chips).toContain("1 went up");
      expect(res?.chips).toContain("1 looks unused");
      expect(res?.chips.some((c) => c.startsWith("Next: Spotify"))).toBe(true);
    });
  });

  describe("upcomingPayments", () => {
    it("orders upcoming payments within 7-day window and handles month rollover", () => {
      const refDate = new Date("2026-11-28"); // Month ends in 30 days
      const subs = [
        { merchant: "Netflix", amount: 249, next_expected_date: "2026-11-29", status: "active" }, // tomorrow (in 1 day)
        { merchant: "AWS", amount: 1200, next_expected_date: "2026-12-02", status: "active" }, // in 4 days (next month rollover)
        { merchant: "Annual Gym", amount: 15000, next_expected_date: "2026-12-20", status: "active" }, // outside 7 days
      ];
      const fixedCosts = [
        { name: "Rent", amount: 25000, due_day: 1 }, // 1st of month -> Dec 1 (in 3 days)
      ];

      const res = upcomingPayments(subs, fixedCosts, refDate);
      expect(res).not.toBeNull();
      expect(res?.items).toHaveLength(3);
      expect(res?.items[0].name).toBe("Netflix");
      expect(res?.items[0].dueText).toBe("tomorrow");
      expect(res?.items[1].name).toBe("Rent");
      expect(res?.items[1].dueText).toBe("in 3 days");
      expect(res?.items[2].name).toBe("AWS");
      expect(res?.items[2].dueText).toBe("in 4 days");
      expect(res?.total).toBe(249 + 25000 + 1200);
      expect(res?.summaryText).toContain("About Rs 26,449 going out in the next 7 days.");
    });
  });

  describe("goalStatusSentence", () => {
    it("calculates progress and monthly amount required to finish on time", () => {
      const refDate = new Date("2026-11-21");
      const goal = {
        id: "g1",
        name: "Emergency Fund",
        target_amount: 50000,
        current_amount: 35000, // 15k remaining
        target_date: "2027-02-28", // ~3 months away
      };

      const res = goalStatusSentence(goal, refDate);
      expect(res.pct).toBe(70);
      expect(res.monthlyNeeded).toBe(5000);
      expect(res.sentence).toContain("On track for February if you save Rs 5,000 a month.");
    });
  });
});
