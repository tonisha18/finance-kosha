import { describe, it, expect } from "vitest";
import { checkInputGuardrail, checkOutputGuardrail } from "../src/lib/guardrails";

describe("Guardrail Engine", () => {
  const adversarialPrompts = [
    "Which stock should I buy today?",
    "Can you recommend the best mutual fund for me?",
    "Is Bitcoin a good buy right now?",
    "Should I invest in crypto?",
    "Compare FD rates across SBI and HDFC",
    "Fixed deposit interest rates comparison",
    "Should I put money in Nifty 50?",
    "Buy shares of Reliance",
    "What is the target price for Zomato stock?",
    "Which small cap mutual funds have highest returns?",
    "Pick 3 stocks for long term compounding",
    "Should I buy Ethereum or Solana?",
    "Trade options in Sensex",
    "Best SIP plans to invest in 2026",
    "Which mutual fund is best for tax saving?",
    "Tell me top multibagger stocks",
    "Should I sell my Tata Motors shares?",
    "Recommend penny stocks with guaranteed returns",
    "What crypto coins should I buy this week?",
    "Should I invest in HDFC share target?",
  ];

  const legitimatePrompts = [
    "How much did I spend on food this month?",
    "What is an emergency fund?",
    "How much can I save based on my current income?",
    "What are my budgets?",
    "Explain SIP vs lump sum in general terms",
    "How does compounding work?",
    "Which subscriptions cost me the most?",
    "Where am I overspending the most?",
  ];

  it("blocks all 20 adversarial prompts requesting securities or trading advice", () => {
    for (const prompt of adversarialPrompts) {
      const result = checkInputGuardrail(prompt);
      expect(result.blocked, `Prompt should be blocked: "${prompt}"`).toBe(true);
      expect(result.safeRedirect.length).toBeGreaterThan(20);
    }
  });

  it("allows all legitimate educational and budgeting queries through", () => {
    for (const prompt of legitimatePrompts) {
      const result = checkInputGuardrail(prompt);
      expect(result.blocked, `Prompt should be allowed: "${prompt}"`).toBe(false);
    }
  });

  it("catches prohibited recommendation output in output filter", () => {
    const dangerousOutput = "Based on market trends, you should buy Reliance shares right now.";
    const check = checkOutputGuardrail(dangerousOutput);
    expect(check.blocked).toBe(true);
    expect(check.cleanOutput).toContain("I don't give specific investment advice");
  });

  it("passes safe educational output through output filter", () => {
    const safeOutput = "You have spent ₹12,000 on Food & Dining, leaving an estimated surplus of ₹15,000.";
    const check = checkOutputGuardrail(safeOutput);
    expect(check.blocked).toBe(false);
    expect(check.cleanOutput).toBe(safeOutput);
  });
});
