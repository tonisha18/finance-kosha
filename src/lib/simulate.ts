import { CategoryName } from "./categories";

export interface SimulationBaseline {
  monthlyIncome: number;
  essentialSpend: number;
  discretionarySpend: number;
  fixedCosts: number;
  totalMonthlySpend: number;
  monthlySurplus: number;
  categorySpends: Record<string, number>;
  emergencyFundBalance: number;
  emergencyFundTarget: number;
  goals: Array<{
    id: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
    targetDate: string; // YYYY-MM-DD
  }>;
}

export interface GoalSimulationOverride {
  goalId?: string;
  name?: string;
  targetAmount?: number;
  downPayment?: number;
  monthlyAllocation?: number; // User explicitly allocating ₹X/mo to this goal
  targetMonths?: number;
}

export interface SimulationAdjustment {
  categoryPctChanges?: Record<string, number>; // e.g. { "Food & Dining": -30 }
  categoryAmountChanges?: Record<string, number>; // e.g. { "Utilities": 500 }
  fixedCostChange?: number; // e.g. 5000 (rent increase)
  incomeChange?: number; // e.g. 10000 (raise)
  oneTimeExpense?: number; // e.g. 25000
  monthlySavingsAllocation?: number; // Dedicated capital allocation / savings rate
  goalOverride?: GoalSimulationOverride; // Active simulated lifetime goal
}

export interface GoalProjection {
  id: string;
  name: string;
  baselineMonthsLeft: number;
  baselineCompletionDate: string;
  scenarioMonthsLeft: number;
  scenarioCompletionDate: string;
  monthsGainedOrLost: number; // positive = gained (finished earlier)
  status: "on-track" | "at-risk" | "off-track";
  targetAmount: number;
  currentAmount: number;
  remainingAmount: number;
  targetDate: string;
  monthlyContributionNeeded: number;
  percentFunded: number;
  timeSummary: string;
}

export interface SimulationResult {
  baselineSurplus: number;
  scenarioSurplus: number;
  surplusDelta: number;
  newMonthlyIncome: number;
  newMonthlySpend: number;
  emergencyFundMonthsToTarget: {
    baseline: number;
    scenario: number;
  };
  goalProjections: GoalProjection[];
  cumulative12MonthSeries: Array<{
    month: number;
    label: string;
    baseline: number;
    scenario: number;
  }>;
  cumulativeSeries: Array<{
    month: number;
    label: string;
    baseline: number;
    scenario: number;
  }>;
  activeSimulatedGoal?: {
    name: string;
    targetAmount: number;
    requiredMonthly: number;
    availableSurplus: number;
    isFeasible: boolean;
    completionMonths: number;
    completionDate: string;
    verdict: string;
  };
}

const formatLocalDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/**
 * Pure deterministic simulation engine.
 * No floating point issues, strictly grounded in integer math/rounding.
 */
export function runFinancialSimulation(
  baseline: SimulationBaseline,
  adjustments: SimulationAdjustment,
  horizonMonths: number = 36
): SimulationResult {
  const newIncome = baseline.monthlyIncome + (adjustments.incomeChange || 0);

  // Calculate new spend per category
  let newDiscretionarySpend = 0;
  let newEssentialSpend = 0;

  for (const [cat, origSpend] of Object.entries(baseline.categorySpends)) {
    let spend = origSpend;

    // Apply pct change
    if (adjustments.categoryPctChanges && adjustments.categoryPctChanges[cat] !== undefined) {
      const pct = adjustments.categoryPctChanges[cat];
      spend = spend * (1 + pct / 100);
    }

    // Apply absolute amount change
    if (adjustments.categoryAmountChanges && adjustments.categoryAmountChanges[cat] !== undefined) {
      spend += adjustments.categoryAmountChanges[cat];
    }

    spend = Math.max(0, spend);

    // Essential vs discretionary check
    const isEssential = ["Rent & Housing", "Utilities", "Groceries", "Healthcare", "Transport"].includes(cat);
    if (isEssential) {
      newEssentialSpend += spend;
    } else {
      newDiscretionarySpend += spend;
    }
  }

  const newFixedCosts = Math.max(0, baseline.fixedCosts + (adjustments.fixedCostChange || 0));
  const newTotalMonthlySpend = Math.round(newEssentialSpend + newDiscretionarySpend + newFixedCosts);
  const scenarioSurplus = Math.round(newIncome - newTotalMonthlySpend);
  const surplusDelta = scenarioSurplus - baseline.monthlySurplus;

  // Emergency Fund timeline
  const efTarget = baseline.emergencyFundTarget;
  const efCurrent = baseline.emergencyFundBalance;
  const efNeeded = Math.max(0, efTarget - efCurrent);

  const baselineEFMonths =
    baseline.monthlySurplus > 0 ? Math.ceil(efNeeded / baseline.monthlySurplus) : 999;
  const scenarioEFMonths =
    scenarioSurplus > 0 ? Math.ceil(efNeeded / scenarioSurplus) : 999;

  // Build effective goals list incorporating any GoalSimulationOverride
  const now = new Date();
  const rawGoals = [...baseline.goals];

  if (adjustments.goalOverride) {
    const ov = adjustments.goalOverride;
    const matchIdx = rawGoals.findIndex((g) => {
      if (ov.goalId && g.id === ov.goalId) return true;
      if (ov.name && g.name.toLowerCase().includes("car") && ov.name.toLowerCase().includes("car")) return true;
      if (ov.name && g.name.toLowerCase().includes("home") && ov.name.toLowerCase().includes("home")) return true;
      return false;
    });

    const targetDateStr = ov.targetMonths
      ? formatLocalDate(new Date(now.getFullYear(), now.getMonth() + ov.targetMonths, now.getDate()))
      : "2029-12-31";

    if (matchIdx >= 0) {
      rawGoals[matchIdx] = {
        ...rawGoals[matchIdx],
        name: ov.name || rawGoals[matchIdx].name,
        targetAmount: ov.targetAmount || rawGoals[matchIdx].targetAmount,
        currentAmount: rawGoals[matchIdx].currentAmount + (ov.downPayment || 0),
        targetDate: ov.targetMonths ? targetDateStr : rawGoals[matchIdx].targetDate,
      };
    } else {
      rawGoals.unshift({
        id: ov.goalId || "goal_simulated_custom",
        name: ov.name || "🚗 Buy a Car / Vehicle",
        targetAmount: ov.targetAmount || 1500000,
        currentAmount: ov.downPayment || 0,
        targetDate: targetDateStr,
      });
    }
  }

  // Goal projections (Lifetime & Milestone capital allocation)
  let activeSimulatedGoal: SimulationResult["activeSimulatedGoal"] | undefined;

  const goalProjections: GoalProjection[] = rawGoals.map((g) => {
    const isOverrideGoal = adjustments.goalOverride && (
      (adjustments.goalOverride.goalId && g.id === adjustments.goalOverride.goalId) ||
      (adjustments.goalOverride.name && g.name === adjustments.goalOverride.name)
    );

    const remaining = Math.max(0, g.targetAmount - g.currentAmount);
    const percentFunded = Math.min(100, Math.round(((g.currentAmount || 0) / Math.max(1, g.targetAmount)) * 100));

    const targetD = new Date(g.targetDate);
    const monthsToTargetDate = isOverrideGoal && adjustments.goalOverride?.targetMonths
      ? adjustments.goalOverride.targetMonths
      : Math.max(
          1,
          (targetD.getFullYear() - now.getFullYear()) * 12 + (targetD.getMonth() - now.getMonth())
        );

    const monthlyContributionNeeded = Math.ceil(remaining / Math.max(1, monthsToTargetDate));

    if (remaining === 0) {
      return {
        id: g.id,
        name: g.name,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount,
        remainingAmount: 0,
        targetDate: g.targetDate,
        monthlyContributionNeeded: 0,
        percentFunded: 100,
        baselineMonthsLeft: 0,
        baselineCompletionDate: "Target Achieved!",
        scenarioMonthsLeft: 0,
        scenarioCompletionDate: "Target Achieved!",
        monthsGainedOrLost: 0,
        status: "on-track",
        timeSummary: "Target fully funded and achieved!",
      };
    }

    const baselineMonthsNeeded =
      baseline.monthlySurplus > 0 ? Math.ceil(remaining / baseline.monthlySurplus) : 999;

    // Use explicit allocation or full surplus
    const effectiveSavingsRate = isOverrideGoal && adjustments.goalOverride?.monthlyAllocation
      ? adjustments.goalOverride.monthlyAllocation
      : adjustments.monthlySavingsAllocation && adjustments.monthlySavingsAllocation > 0
      ? adjustments.monthlySavingsAllocation
      : scenarioSurplus;

    const scenarioMonthsNeeded =
      effectiveSavingsRate > 0 ? Math.ceil(remaining / effectiveSavingsRate) : 999;

    const baseFinish = new Date(now.getFullYear(), now.getMonth() + baselineMonthsNeeded, 1);
    const scenFinish = new Date(now.getFullYear(), now.getMonth() + scenarioMonthsNeeded, 1);

    const gained = baselineMonthsNeeded - scenarioMonthsNeeded;

    let status: "on-track" | "at-risk" | "off-track" = "on-track";
    if (scenarioMonthsNeeded >= 999) {
      status = "off-track";
    } else if (scenarioMonthsNeeded > monthsToTargetDate) {
      status = scenarioMonthsNeeded > monthsToTargetDate + 6 ? "off-track" : "at-risk";
    }

    const baseFinishStr =
      baselineMonthsNeeded >= 999
        ? "No progress (Deficit)"
        : baseFinish.toLocaleDateString("en-IN", { month: "short", year: "numeric" });

    const scenFinishStr =
      scenarioMonthsNeeded >= 999
        ? "No progress (Deficit)"
        : scenFinish.toLocaleDateString("en-IN", { month: "short", year: "numeric" });

    let timeSummary = "";
    if (scenarioMonthsNeeded >= 999) {
      timeSummary = "Current run-rate has no surplus to fund this target.";
    } else {
      const yrs = Math.floor(scenarioMonthsNeeded / 12);
      const mos = scenarioMonthsNeeded % 12;
      const durationText =
        yrs > 0
          ? mos > 0
            ? `${yrs} yr${yrs > 1 ? "s" : ""} ${mos} mo${mos > 1 ? "s" : ""}`
            : `${yrs} yr${yrs > 1 ? "s" : ""}`
          : `${mos} mo${mos > 1 ? "s" : ""}`;

      if (status === "on-track") {
        timeSummary = `Reaches target in ${durationText} (${scenFinishStr}). Feasible with simulated surplus.`;
      } else {
        timeSummary = `Reaches target in ${durationText} (${scenFinishStr}). Needs ₹${Math.max(0, monthlyContributionNeeded - scenarioSurplus).toLocaleString("en-IN")}/mo extra to meet target date.`;
      }

      if (baselineMonthsNeeded < 999) {
        if (gained > 0) {
          timeSummary += ` • ${gained} mo${gained > 1 ? "s" : ""} sooner than status quo`;
        } else if (gained < 0) {
          timeSummary += ` • ${Math.abs(gained)} mo${Math.abs(gained) > 1 ? "s" : ""} delayed`;
        }
      }
    }

    if (isOverrideGoal) {
      const isFeasible = scenarioSurplus >= monthlyContributionNeeded || (adjustments.goalOverride?.monthlyAllocation || 0) >= monthlyContributionNeeded;
      activeSimulatedGoal = {
        name: g.name,
        targetAmount: g.targetAmount,
        requiredMonthly: monthlyContributionNeeded,
        availableSurplus: scenarioSurplus,
        isFeasible,
        completionMonths: scenarioMonthsNeeded,
        completionDate: scenFinishStr,
        verdict: isFeasible
          ? `Feasible & On Track: Your simulated surplus of ₹${scenarioSurplus.toLocaleString("en-IN")}/mo covers the ₹${monthlyContributionNeeded.toLocaleString("en-IN")}/mo needed to buy by ${scenFinishStr}.`
          : `Requires Adjustment: You need ₹${monthlyContributionNeeded.toLocaleString("en-IN")}/mo to reach this goal by ${scenFinishStr}, leaving a shortfall of ₹${Math.max(0, monthlyContributionNeeded - scenarioSurplus).toLocaleString("en-IN")}/mo.`,
      };
    }

    return {
      id: g.id,
      name: g.name,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      remainingAmount: remaining,
      targetDate: g.targetDate,
      monthlyContributionNeeded,
      percentFunded,
      baselineMonthsLeft: baselineMonthsNeeded,
      baselineCompletionDate: baseFinishStr,
      scenarioMonthsLeft: scenarioMonthsNeeded,
      scenarioCompletionDate: scenFinishStr,
      monthsGainedOrLost: gained,
      status,
      timeSummary,
    };
  });

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Exact 12-Month Series for backward-compatibility & testing
  const cumulative12MonthSeries: Array<{
    month: number;
    label: string;
    baseline: number;
    scenario: number;
    goalTarget?: number;
  }> = [];

  const goalTargetVal = adjustments.goalOverride?.targetAmount;
  const initialCapital = (adjustments.goalOverride?.downPayment || 0) - (adjustments.oneTimeExpense || 0);

  // Effective scenario savings rate per month
  const scenarioMonthlyFlow =
    adjustments.goalOverride?.monthlyAllocation !== undefined && adjustments.goalOverride.monthlyAllocation > 0
      ? adjustments.goalOverride.monthlyAllocation
      : adjustments.monthlySavingsAllocation !== undefined && adjustments.monthlySavingsAllocation > 0
      ? adjustments.monthlySavingsAllocation
      : scenarioSurplus;

  let baseCum12 = 0;
  let scenCum12 = initialCapital;

  for (let m = 1; m <= 12; m++) {
    baseCum12 += Math.max(0, baseline.monthlySurplus);
    scenCum12 += Math.max(0, scenarioMonthlyFlow);

    const futureDate = new Date(now.getFullYear(), now.getMonth() + m, 1);
    const label = `${monthNames[futureDate.getMonth()]} '${String(futureDate.getFullYear()).slice(2)}`;

    const pt: {
      month: number;
      label: string;
      baseline: number;
      scenario: number;
      goalTarget?: number;
    } = {
      month: m,
      label,
      baseline: Math.round(baseCum12),
      scenario: Math.round(scenCum12),
    };

    if (goalTargetVal) {
      pt.goalTarget = goalTargetVal;
    }

    cumulative12MonthSeries.push(pt);
  }

  // Horizon-aware Cumulative Series for lifetime multi-year goal modeling (1Y, 3Y, 5Y, 10Y)
  const maxHorizon = Math.max(12, Math.min(120, horizonMonths));
  const cumulativeSeries: Array<{
    month: number;
    label: string;
    baseline: number;
    scenario: number;
    goalTarget?: number;
  }> = [];

  let baseCum = 0;
  let scenCum = initialCapital;

  for (let m = 1; m <= maxHorizon; m++) {
    baseCum += Math.max(0, baseline.monthlySurplus);
    scenCum += Math.max(0, scenarioMonthlyFlow);

    const futureDate = new Date(now.getFullYear(), now.getMonth() + m, 1);
    const label = `${monthNames[futureDate.getMonth()]} '${String(futureDate.getFullYear()).slice(2)}`;

    const pt: {
      month: number;
      label: string;
      baseline: number;
      scenario: number;
      goalTarget?: number;
    } = {
      month: m,
      label,
      baseline: Math.round(baseCum),
      scenario: Math.round(scenCum),
    };

    if (goalTargetVal) {
      pt.goalTarget = goalTargetVal;
    }

    cumulativeSeries.push(pt);
  }

  return {
    baselineSurplus: Math.round(baseline.monthlySurplus),
    scenarioSurplus,
    surplusDelta,
    newMonthlyIncome: Math.round(newIncome),
    newMonthlySpend: newTotalMonthlySpend,
    emergencyFundMonthsToTarget: {
      baseline: baselineEFMonths,
      scenario: scenarioEFMonths,
    },
    goalProjections,
    cumulative12MonthSeries,
    cumulativeSeries,
    activeSimulatedGoal,
  };
}
