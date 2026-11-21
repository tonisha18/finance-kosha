import { describe, it, expect } from "vitest";
import { computeReportData, generateTemplateNarrative } from "../src/lib/report";

describe("Report Computation Engine", () => {
  const mockCurrentTx = [
    { category: "Income/Salary", amount: 100000, merchant: "Employer", type: "credit" },
    { category: "Food & Dining", amount: 12000, merchant: "Swiggy", type: "debit" },
    { category: "Groceries", amount: 14000, merchant: "Blinkit", type: "debit" },
    { category: "Rent & Housing", amount: 30000, merchant: "Rent", type: "debit" },
  ];

  const mockPrevTx = [
    { category: "Food & Dining", amount: 9000, merchant: "Swiggy", type: "debit" },
    { category: "Groceries", amount: 14000, merchant: "Blinkit", type: "debit" },
    { category: "Rent & Housing", amount: 30000, merchant: "Rent", type: "debit" },
  ];

  const mockBudgets = [
    { category: "Food & Dining", monthly_limit: 10000 },
    { category: "Groceries", monthly_limit: 15000 },
  ];

  const mockSubs = [
    { merchant: "Netflix", amount: 799, status: "active" },
    { merchant: "Spotify", amount: 119, status: "active" },
  ];

  const mockGoals = [
    { name: "Emergency Reserve", target_amount: 100000, current_amount: 40000 },
  ];

  it("computes net savings and savings rate accurately", () => {
    const data = computeReportData(
      "2026-11",
      mockCurrentTx,
      mockPrevTx,
      mockBudgets,
      mockSubs,
      mockGoals
    );

    expect(data.totalIncome).toBe(100000);
    expect(data.totalSpend).toBe(56000);
    expect(data.netSavings).toBe(44000);
    expect(data.savingsRate).toBe(44);
  });

  it("calculates month-over-month category growth correctly", () => {
    const data = computeReportData(
      "2026-11",
      mockCurrentTx,
      mockPrevTx,
      mockBudgets,
      mockSubs,
      mockGoals
    );

    const foodCat = data.categories.find((c) => c.name === "Food & Dining");
    // Food grew from 9000 to 12000 = +33%
    expect(foodCat?.momChangePct).toBe(33);
  });

  it("flags exceeded category budget in focus areas", () => {
    const data = computeReportData(
      "2026-11",
      mockCurrentTx,
      mockPrevTx,
      mockBudgets,
      mockSubs,
      mockGoals
    );

    const foodAdherence = data.budgetAdherence.find((b) => b.category === "Food & Dining");
    expect(foodAdherence?.status).toBe("exceeded");
    expect(data.focusAreas.some((f) => f.includes("Food & Dining"))).toBe(true);
  });

  it("produces clean template narrative fallback", () => {
    const data = computeReportData(
      "2026-11",
      mockCurrentTx,
      mockPrevTx,
      mockBudgets,
      mockSubs,
      mockGoals
    );

    const narrative = generateTemplateNarrative(data);
    expect(narrative).toContain("₹1,00,000");
    expect(narrative).toContain("₹56,000");
    expect(narrative).toContain("44%");
  });
});
