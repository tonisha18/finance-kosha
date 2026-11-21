import { describe, it, expect } from "vitest";
import { getTemplateAlert } from "../src/lib/alerts";

describe("Alert Templates & Dedup Logic", () => {
  it("formats price hike alerts with rupee figures and percentage", () => {
    const alert = getTemplateAlert("price_hike", {
      merchant: "Netflix",
      oldAmount: 649,
      newAmount: 799,
      pctChange: 23,
    });
    expect(alert.title).toContain("Netflix");
    expect(alert.body).toContain("₹649");
    expect(alert.body).toContain("₹799");
    expect(alert.body).toContain("+23%");
    expect(alert.severity).toBe("warning");
  });

  it("formats 100% budget limit reached as critical severity", () => {
    const alert = getTemplateAlert("budget_drift", {
      category: "Food & Dining",
      spent: 12500,
      limit: 12000,
      driftType: "100",
    });
    expect(alert.title).toContain("Budget Limit Reached");
    expect(alert.severity).toBe("critical");
  });

  it("formats upcoming renewal within 3 days as info severity", () => {
    const alert = getTemplateAlert("upcoming_renewal", {
      merchant: "Amazon Prime",
      amount: 1499,
      daysLeft: 2,
    });
    expect(alert.title).toContain("Upcoming Renewal");
    expect(alert.body).toContain("Amazon Prime");
    expect(alert.body).toContain("2 days");
    expect(alert.severity).toBe("info");
  });

  it("formats goal risk alert as critical severity", () => {
    const alert = getTemplateAlert("goal_risk", {
      goalName: "Vacation",
      requiredMonthly: 25000,
      surplus: 15000,
    });
    expect(alert.title).toContain("Savings Goal at Risk");
    expect(alert.severity).toBe("critical");
    expect(alert.body).toContain("₹25,000");
  });
});
