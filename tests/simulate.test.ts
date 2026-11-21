import { describe, it, expect } from "vitest";
import { runFinancialSimulation, SimulationBaseline } from "../src/lib/simulate";

describe("Simulation Engine", () => {
  const mockBaseline: SimulationBaseline = {
    monthlyIncome: 100000,
    essentialSpend: 40000,
    discretionarySpend: 30000,
    fixedCosts: 10000,
    totalMonthlySpend: 80000,
    monthlySurplus: 20000,
    categorySpends: {
      "Food & Dining": 15000,
      Shopping: 15000,
      Groceries: 20000,
      Utilities: 5000,
      Transport: 15000,
    },
    emergencyFundBalance: 60000,
    emergencyFundTarget: 180000,
    goals: [
      {
        id: "goal_1",
        name: "Car Down Payment",
        targetAmount: 240000,
        currentAmount: 40000,
        targetDate: "2027-12-31",
      },
    ],
  };

  it("calculates baseline without adjustments accurately", () => {
    const res = runFinancialSimulation(mockBaseline, {});
    expect(res.baselineSurplus).toBe(20000);
    expect(res.scenarioSurplus).toBe(20000);
    expect(res.surplusDelta).toBe(0);
    expect(res.cumulative12MonthSeries.length).toBe(12);
  });

  it("simulates a 30% reduction in Food & Dining", () => {
    const res = runFinancialSimulation(mockBaseline, {
      categoryPctChanges: { "Food & Dining": -30 },
    });
    // Food & Dining cut from 15000 -> 10500 (savings = 4500)
    expect(res.surplusDelta).toBe(4500);
    expect(res.scenarioSurplus).toBe(24500);
  });

  it("simulates income increase and rent increase simultaneously", () => {
    const res = runFinancialSimulation(mockBaseline, {
      incomeChange: 15000,
      fixedCostChange: 5000,
    });
    // Net surplus change: +15000 - 5000 = +10000
    expect(res.surplusDelta).toBe(10000);
    expect(res.scenarioSurplus).toBe(30000);
  });

  it("factors in one-time expenses into the 12-month projection trajectory", () => {
    const res = runFinancialSimulation(mockBaseline, {
      oneTimeExpense: 20000,
    });
    // First month scenario should be 0 because 20k surplus - 20k one-time = 0
    expect(res.cumulative12MonthSeries[0].scenario).toBe(0);
    expect(res.cumulative12MonthSeries[1].scenario).toBe(20000);
  });

  it("computes goal months gained accurately when surplus increases", () => {
    const res = runFinancialSimulation(mockBaseline, {
      incomeChange: 20000, // surplus doubles from 20k to 40k
    });
    const goalProj = res.goalProjections[0];
    // Remaining is 200,000. Baseline = 10 months. Scenario = 5 months. Gained = 5.
    expect(goalProj.baselineMonthsLeft).toBe(10);
    expect(goalProj.scenarioMonthsLeft).toBe(5);
    expect(goalProj.monthsGainedOrLost).toBe(5);
  });

  it("accurately models multi-year lifetime goals like buying a car", () => {
    const lifetimeBaseline: SimulationBaseline = {
      ...mockBaseline,
      monthlyIncome: 120000,
      monthlySurplus: 40000,
      goals: [
        {
          id: "goal_car",
          name: "Buy a Car / Vehicle",
          targetAmount: 1500000,
          currentAmount: 300000,
          targetDate: "2029-06-30",
        },
      ],
    };

    // Baseline: remaining = 1,200,000. Surplus = 40,000. Needed = 30 months (2.5 years).
    const res = runFinancialSimulation(lifetimeBaseline, {}, 60);
    expect(res.goalProjections[0].remainingAmount).toBe(1200000);
    expect(res.goalProjections[0].baselineMonthsLeft).toBe(30);
    expect(res.goalProjections[0].status).toBe("on-track");
    expect(res.cumulativeSeries.length).toBe(60);
  });

  it("simulates dynamic lifetime goal override for car purchase", () => {
    const res = runFinancialSimulation(mockBaseline, {
      goalOverride: {
        name: "🚗 Buy a Car / Vehicle",
        targetAmount: 1200000,
        targetMonths: 36,
        downPayment: 200000,
        monthlyAllocation: 30000,
      },
    });

    expect(res.activeSimulatedGoal).toBeDefined();
    expect(res.activeSimulatedGoal?.targetAmount).toBe(1200000);
    // 1,200,000 - (40,000 existing + 200,000 downPayment) = 960,000 / 36 = 26,667
    expect(res.activeSimulatedGoal?.requiredMonthly).toBe(Math.ceil((1200000 - 240000) / 36));
    expect(res.activeSimulatedGoal?.isFeasible).toBe(true);
  });
});
