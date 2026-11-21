import { describe, it, expect } from "vitest";
import { parseNaturalLanguageScenario, parseAmount } from "../src/lib/scenario-parser";

describe("Amount Parser", () => {
  it("correctly parses Indian currency units and standard numbers", () => {
    expect(parseAmount("15 lakhs")).toBe(1500000);
    expect(parseAmount("15L")).toBe(1500000);
    expect(parseAmount("1.5 crore")).toBe(15000000);
    expect(parseAmount("2 cr")).toBe(20000000);
    expect(parseAmount("25k")).toBe(25000);
    expect(parseAmount("₹25,000")).toBe(25000);
    expect(parseAmount("1500000")).toBe(1500000);
  });
});

describe("Natural Language Scenario Parser", () => {
  const testPhrasings = [
    {
      input: "what if I cut dining out by 30%",
      expectedSuccess: true,
      check: (adj: any) => adj.categoryPctChanges?.["Food & Dining"] === -30,
    },
    {
      input: "reduce groceries by 15%",
      expectedSuccess: true,
      check: (adj: any) => adj.categoryPctChanges?.["Groceries"] === -15,
    },
    {
      input: "what if my rent goes up by 5000",
      expectedSuccess: true,
      check: (adj: any) => adj.fixedCostChange === 5000,
    },
    {
      input: "what if income increases by 10000",
      expectedSuccess: true,
      check: (adj: any) => adj.incomeChange === 10000,
    },
    {
      input: "salary hike of 25000",
      expectedSuccess: true,
      check: (adj: any) => adj.incomeChange === 25000,
    },
    {
      input: "income drops by 12000",
      expectedSuccess: true,
      check: (adj: any) => adj.incomeChange === -12000,
    },
    {
      input: "one-time expense of 20000",
      expectedSuccess: true,
      check: (adj: any) => adj.oneTimeExpense === 20000,
    },
    {
      input: "spend 50000 on laptop",
      expectedSuccess: true,
      check: (adj: any) => adj.oneTimeExpense === 50000,
    },
    {
      input: "slash shopping by 25%",
      expectedSuccess: true,
      check: (adj: any) => adj.categoryPctChanges?.["Shopping"] === -25,
    },
    {
      input: "trim utilities by 10%",
      expectedSuccess: true,
      check: (adj: any) => adj.categoryPctChanges?.["Utilities"] === -10,
    },
    {
      input: "what if entertainment increases by 20%",
      expectedSuccess: true,
      check: (adj: any) => adj.categoryPctChanges?.["Entertainment & Subscriptions"] === 20,
    },
    {
      input: "spend 4000 more on transport",
      expectedSuccess: true,
      check: (adj: any) => adj.categoryAmountChanges?.["Transport"] === 4000,
    },
    {
      input: "buy a car for 15 lakhs in 3 years",
      expectedSuccess: true,
      check: (adj: any) => adj.goalOverride?.targetAmount === 1500000 && adj.goalOverride?.targetMonths === 36,
    },
    {
      input: "buy a house for 50 lakhs",
      expectedSuccess: true,
      check: (adj: any) => adj.goalOverride?.targetAmount === 5000000,
    },
    {
      input: "save 25000 per month",
      expectedSuccess: true,
      check: (adj: any) => adj.monthlySavingsAllocation === 25000,
    },
  ];

  it("successfully parses all natural language phrasings correctly", () => {
    for (const testCase of testPhrasings) {
      const parsed = parseNaturalLanguageScenario(testCase.input);
      expect(parsed.success, `Failed on: "${testCase.input}"`).toBe(true);
      expect(testCase.check(parsed.adjustment), `Assertion failed for: "${testCase.input}"`).toBe(true);
    }
  });

  it("gracefully returns failure and helpful guidance for unparseable input", () => {
    const unparseable = parseNaturalLanguageScenario("tell me a random story");
    expect(unparseable.success).toBe(false);
    expect(unparseable.explanation).toContain("Could not parse");
  });
});
