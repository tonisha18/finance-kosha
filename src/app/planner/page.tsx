"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sidebar, MobileNav } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import {
  Target,
  Plus,
  Trash2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  TrendingUp,
  DollarSign,
  Layers,
  RotateCcw,
  Compass,
} from "lucide-react";
import {
  runFinancialSimulation,
  SimulationBaseline,
  SimulationAdjustment,
  SimulationResult,
  GoalProjection,
  GoalSimulationOverride,
} from "@/lib/simulate";
import { parseNaturalLanguageScenario } from "@/lib/scenario-parser";


interface GoalItem {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string;
  priority?: number;
  status?: string;
}

const LIFETIME_TEMPLATES = [
  { name: "🚗 Buy a Car / Vehicle", target: 1500000, monthsAhead: 36, desc: "Personal transport & asset" },
  { name: "🏠 Real Estate / Home Down-Payment", target: 3000000, monthsAhead: 60, desc: "Primary residence capital" },
  { name: "🛡️ Emergency Reserve (6 Months)", target: 360000, monthsAhead: 12, desc: "6 months essential runway" },
  { name: "🎓 Higher Education / Master's", target: 2000000, monthsAhead: 24, desc: "Professional development" },
  { name: "✈️ Sabbatical / Career Break", target: 600000, monthsAhead: 18, desc: "Unpaid leave & exploration" },
];

export default function PlannerPage() {
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [baseline, setBaseline] = useState<SimulationBaseline | null>(null);

  // Simulator state
  const [horizonMonths, setHorizonMonths] = useState<number>(36);
  const [nlInput, setNlInput] = useState("");
  const [nlFeedback, setNlFeedback] = useState<string | null>(null);

  // Interactive Lifetime Goal Modeler State
  const [simGoalName, setSimGoalName] = useState("🚗 Buy a Car / Vehicle");
  const [simGoalTarget, setSimGoalTarget] = useState(1500000);
  const [simGoalMonths, setSimGoalMonths] = useState(36);
  const [simGoalDownPayment, setSimGoalDownPayment] = useState(250000);
  const [simGoalMonthlyAlloc, setSimGoalMonthlyAlloc] = useState(35000);

  const [adjustments, setAdjustments] = useState<SimulationAdjustment>({
    categoryPctChanges: { "Food & Dining": 0, Shopping: 0 },
    fixedCostChange: 0,
    incomeChange: 0,
    oneTimeExpense: 0,
    monthlySavingsAllocation: 0,
    goalOverride: {
      name: "🚗 Buy a Car / Vehicle",
      targetAmount: 1500000,
      targetMonths: 36,
      downPayment: 250000,
      monthlyAllocation: 35000,
    },
  });
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);

  // New goal modal
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalTarget, setNewGoalTarget] = useState(1500000);
  const [newGoalDate, setNewGoalDate] = useState("2029-12-31");

  // Add funds to goal modal
  const [fundingGoal, setFundingGoal] = useState<GoalItem | null>(null);
  const [fundAmount, setFundAmount] = useState<number>(10000);
  const [fundingLoading, setFundingLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Saved scenarios
  const [savedScenarios, setSavedScenarios] = useState<any[]>([]);
  const [scenarioName, setScenarioName] = useState("");

  const defaultCategorySpends: Record<string, number> = {
    "Food & Dining": 11500,
    Groceries: 14200,
    "Rent & Housing": 32000,
    Utilities: 5800,
    Transport: 6200,
    Shopping: 7800,
    "Entertainment & Subscriptions": 2200,
    Healthcare: 3400,
  };

  const fallbackGoals = [
    {
      id: "goal_demo_car",
      name: "🚗 Buy a Car / Vehicle",
      targetAmount: 1500000,
      currentAmount: 250000,
      targetDate: "2029-06-30",
    },
    {
      id: "goal_demo_emergency",
      name: "🛡️ Emergency Reserve (6 Months)",
      targetAmount: 360000,
      currentAmount: 180000,
      targetDate: "2027-12-31",
    },
    {
      id: "goal_demo_home",
      name: "🏠 Real Estate / Home Down-Payment",
      targetAmount: 3000000,
      currentAmount: 450000,
      targetDate: "2031-12-31",
    },
  ];

  const buildInitialBaseline = (
    avgIncome = 110000,
    avgSpend = 83100,
    totalFixed = 32000,
    essTotal = 58200,
    discTotal = 24900,
    categorySpends = defaultCategorySpends,
    dbGoals: GoalItem[] = []
  ): SimulationBaseline => {
    const activeGoals =
      dbGoals.length > 0
        ? dbGoals.map((g) => ({
            id: g.id,
            name: g.name,
            targetAmount: Number(g.target_amount),
            currentAmount: Number(g.current_amount || 0),
            targetDate: g.target_date,
          }))
        : fallbackGoals;

    return {
      monthlyIncome: avgIncome,
      essentialSpend: essTotal,
      discretionarySpend: discTotal,
      fixedCosts: totalFixed,
      totalMonthlySpend: avgSpend,
      monthlySurplus: avgIncome - avgSpend,
      categorySpends,
      emergencyFundBalance: 180000,
      emergencyFundTarget: avgIncome * 3,
      goals: activeGoals,
    };
  };

  const fetchData = async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // Fallback for guest / demo state
        const base = buildInitialBaseline();
        setBaseline(base);
        setGoals(
          fallbackGoals.map((g) => ({
            id: g.id,
            name: g.name,
            target_amount: g.targetAmount,
            current_amount: g.currentAmount,
            target_date: g.targetDate,
          }))
        );
        const res = runFinancialSimulation(base, adjustments, horizonMonths);
        setSimulationResult(res);
        setLoading(false);
        return;
      }

      // 1. Fetch Profile & Fixed Costs
      const { data: prof } = await supabase
        .from("financial_profile")
        .select("*")
        .eq("user_id", user.id)
        .single();

      const { data: fixed } = await supabase
        .from("fixed_costs")
        .select("amount")
        .eq("user_id", user.id);

      const totalFixed = (fixed || []).reduce((acc, f) => acc + Number(f.amount), 0);
      setProfile(prof);

      // 2. Fetch Goals
      const { data: gList } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .order("priority", { ascending: true });

      const activeDbGoals = (gList || []) as GoalItem[];
      setGoals(
        activeDbGoals.length > 0
          ? activeDbGoals
          : fallbackGoals.map((g) => ({
              id: g.id,
              name: g.name,
              target_amount: g.targetAmount,
              current_amount: g.currentAmount,
              target_date: g.targetDate,
            }))
      );

      // 3. Compute 3-Month Average Baseline from transactions
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const { data: tx } = await supabase
        .from("transactions")
        .select("category, amount, type")
        .eq("user_id", user.id)
        .gte("date", threeMonthsAgo.toISOString().split("T")[0]);

      let incTotal = 0;
      const catTotals: Record<string, number> = {};
      let essTotal = 0;
      let discTotal = 0;

      if (tx && tx.length > 0) {
        for (const t of tx) {
          const amt = Number(t.amount);
          if (t.type === "credit") {
            incTotal += amt;
          } else if (t.type === "debit") {
            catTotals[t.category] = (catTotals[t.category] || 0) + amt;
            const isEss = ["Rent & Housing", "Utilities", "Groceries", "Healthcare", "Transport"].includes(
              t.category
            );
            if (isEss) essTotal += amt;
            else discTotal += amt;
          }
        }
      }

      const hasRealTx = Object.keys(catTotals).length > 0;
      const avgCategorySpends = { ...defaultCategorySpends };
      if (hasRealTx) {
        for (const [cat, sum] of Object.entries(catTotals)) {
          avgCategorySpends[cat] = Math.round(sum / 3);
        }
      }

      const avgIncome = incTotal > 0 ? Math.round(incTotal / 3) : Number(prof?.monthly_income || 110000);
      const avgSpend = hasRealTx
        ? Math.round((essTotal + discTotal) / 3) + totalFixed
        : Object.values(defaultCategorySpends).reduce((a, b) => a + b, 0);

      const base = buildInitialBaseline(
        avgIncome,
        avgSpend,
        totalFixed || 32000,
        hasRealTx ? Math.round(essTotal / 3) : 58200,
        hasRealTx ? Math.round(discTotal / 3) : 24900,
        avgCategorySpends,
        activeDbGoals
      );

      setBaseline(base);
      const res = runFinancialSimulation(base, adjustments, horizonMonths);
      setSimulationResult(res);

      // 4. Fetch Saved Scenarios
      const { data: scen } = await supabase
        .from("saved_scenarios")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setSavedScenarios(scen || []);
    } catch (err) {
      console.error("Error loading simulation baseline:", err);
      const base = buildInitialBaseline();
      setBaseline(base);
      setSimulationResult(runFinancialSimulation(base, adjustments, horizonMonths));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [horizonMonths]);

  // Recalculate simulation with adjustments
  const updateSimulationWithAdjustments = (adj: SimulationAdjustment) => {
    if (!baseline) return;
    setAdjustments(adj);
    const res = runFinancialSimulation(baseline, adj, horizonMonths);
    setSimulationResult(res);
  };

  const handleApplyNL = () => {
    if (!nlInput.trim() || !baseline) return;
    const parsed = parseNaturalLanguageScenario(nlInput);
    setNlFeedback(parsed.explanation);

    if (parsed.success) {
      const merged: SimulationAdjustment = {
        ...adjustments,
        ...parsed.adjustment,
        categoryPctChanges: {
          ...adjustments.categoryPctChanges,
          ...parsed.adjustment.categoryPctChanges,
        },
      };

      if (parsed.adjustment.goalOverride) {
        setSimGoalName(parsed.adjustment.goalOverride.name || simGoalName);
        setSimGoalTarget(parsed.adjustment.goalOverride.targetAmount || simGoalTarget);
        if (parsed.adjustment.goalOverride.targetMonths) {
          setSimGoalMonths(parsed.adjustment.goalOverride.targetMonths);
        }
        if (parsed.adjustment.goalOverride.downPayment) {
          setSimGoalDownPayment(parsed.adjustment.goalOverride.downPayment);
        }
        if (parsed.adjustment.goalOverride.monthlyAllocation) {
          setSimGoalMonthlyAlloc(parsed.adjustment.goalOverride.monthlyAllocation);
        }
      }

      updateSimulationWithAdjustments(merged);
    }
  };

  const handleUpdateLifetimeGoalSimulator = (
    name = simGoalName,
    target = simGoalTarget,
    months = simGoalMonths,
    downPayment = simGoalDownPayment,
    monthlyAlloc = simGoalMonthlyAlloc
  ) => {
    setSimGoalName(name);
    setSimGoalTarget(target);
    setSimGoalMonths(months);
    setSimGoalDownPayment(downPayment);
    setSimGoalMonthlyAlloc(monthlyAlloc);

    const goalOv: GoalSimulationOverride = {
      name,
      targetAmount: target,
      targetMonths: months,
      downPayment,
      monthlyAllocation: monthlyAlloc > 0 ? monthlyAlloc : undefined,
    };

    const updated = {
      ...adjustments,
      goalOverride: goalOv,
    };
    updateSimulationWithAdjustments(updated);
  };

  const handleCommitSimulatedGoalToActive = async () => {
    const d = new Date();
    d.setMonth(d.getMonth() + simGoalMonths);
    const dateStr = d.toISOString().split("T")[0];

    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: simGoalName,
        target_amount: simGoalTarget,
        current_amount: simGoalDownPayment,
        target_date: dateStr,
        priority: goals.length + 1,
      }),
    });

    if (res.ok) {
      setToastMessage(`Milestone goal "${simGoalName}" committed to active tracking.`);
      setTimeout(() => setToastMessage(null), 5000);
      await fetchData();
    } else {
      // In-memory update for guest mode
      const newGoal: GoalItem = {
        id: `goal_custom_${Date.now()}`,
        name: simGoalName,
        target_amount: simGoalTarget,
        current_amount: simGoalDownPayment,
        target_date: dateStr,
      };
      setGoals([newGoal, ...goals]);
      setToastMessage(`Milestone goal "${simGoalName}" added to local planner.`);
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  const handleResetAdjustments = () => {
    const clean: SimulationAdjustment = {
      categoryPctChanges: { "Food & Dining": 0, Shopping: 0 },
      fixedCostChange: 0,
      incomeChange: 0,
      oneTimeExpense: 0,
      monthlySavingsAllocation: 0,
    };
    setNlInput("");
    setNlFeedback(null);
    updateSimulationWithAdjustments(clean);
  };

  const handleSliderChange = (cat: string, val: number) => {
    if (!baseline) return;
    const updated = {
      ...adjustments,
      categoryPctChanges: {
        ...adjustments.categoryPctChanges,
        [cat]: val,
      },
    };
    updateSimulationWithAdjustments(updated);
  };

  const handleNumericAdjustment = (field: keyof SimulationAdjustment, val: number) => {
    if (!baseline) return;
    const updated = {
      ...adjustments,
      [field]: val,
    };
    updateSimulationWithAdjustments(updated);
  };

  const handleSaveScenario = async () => {
    if (!scenarioName.trim() || !simulationResult) return;
    const res = await fetch("/api/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: scenarioName,
        inputs: adjustments,
        result: simulationResult,
      }),
    });
    if (res.ok) {
      setScenarioName("");
      setToastMessage(`Scenario "${scenarioName}" saved.`);
      setTimeout(() => setToastMessage(null), 5000);
      fetchData();
    }
  };

  const handleCreateGoal = async () => {
    if (!newGoalName || !newGoalTarget || !newGoalDate) return;
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newGoalName,
        target_amount: newGoalTarget,
        current_amount: 0,
        target_date: newGoalDate,
        priority: goals.length + 1,
      }),
    });
    if (res.ok) {
      setShowGoalModal(false);
      setNewGoalName("");
      fetchData();
    }
  };

  const handleAddFundsSubmit = async () => {
    if (!fundingGoal || !fundAmount || fundAmount <= 0) return;
    setFundingLoading(true);

    const isDemo = fundingGoal.id.startsWith("goal_demo_");

    if (isDemo) {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fundingGoal.name,
          target_amount: fundingGoal.target_amount,
          current_amount: fundingGoal.current_amount + fundAmount,
          target_date: fundingGoal.target_date,
          priority: goals.length + 1,
        }),
      });
      if (res.ok) {
        setToastMessage(`Logged ₹${fundAmount.toLocaleString("en-IN")} towards ${fundingGoal.name}. Simulation updated!`);
        setTimeout(() => setToastMessage(null), 5000);
        setFundingGoal(null);
        await fetchData();
      }
    } else {
      const res = await fetch("/api/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: fundingGoal.id,
          add_amount: fundAmount,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const updatedAmt = data.goal?.current_amount || fundingGoal.current_amount + fundAmount;
        setToastMessage(
          `Logged ₹${fundAmount.toLocaleString("en-IN")} towards ${fundingGoal.name}. Current progress: ₹${updatedAmt.toLocaleString("en-IN")}`
        );
        setTimeout(() => setToastMessage(null), 5000);
        setFundingGoal(null);
        await fetchData();
      }
    }
    setFundingLoading(false);
  };

  const handleDeleteGoal = async (id: string) => {
    if (id.startsWith("goal_demo_")) {
      const remaining = goals.filter((g) => g.id !== id);
      setGoals(remaining);
      if (baseline) {
        const filtered = baseline.goals.filter((g) => g.id !== id);
        const updatedBase = { ...baseline, goals: filtered };
        setBaseline(updatedBase);
        setSimulationResult(runFinancialSimulation(updatedBase, adjustments, horizonMonths));
      }
      return;
    }
    await fetch(`/api/goals?id=${id}`, { method: "DELETE" });
    fetchData();
  };

  if (loading || !baseline) {
    return (
      <div className="flex min-h-screen bg-[#0A0D12] text-slate-100">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
          <Header />
          <main className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-6">
            <div className="py-12 border-b border-[#1E2533] animate-pulse text-xs font-mono text-slate-500">
              Calibrating lifetime scenario baseline & capital engine...
            </div>
          </main>
        </div>
        <MobileNav />
      </div>
    );
  }

  const efCoverMonths =
    baseline.essentialSpend > 0
      ? (baseline.emergencyFundBalance / baseline.essentialSpend).toFixed(1)
      : "3.5";

  // Active simulated goal calculation
  const simRemaining = Math.max(0, simGoalTarget - simGoalDownPayment);
  const simReqMonthly = Math.ceil(simRemaining / Math.max(1, simGoalMonths));
  const activeSurplus = simulationResult?.scenarioSurplus || 0;
  const isSimGoalFeasible = activeSurplus >= simReqMonthly || simGoalMonthlyAlloc >= simReqMonthly;

  const simTargetDate = new Date();
  simTargetDate.setMonth(simTargetDate.getMonth() + simGoalMonths);
  const simTargetDateStr = simTargetDate.toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });

  return (
    <div className="flex min-h-screen bg-[#0A0D12] text-slate-100 font-sans antialiased">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <Header />
        <main className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-10">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-[#1E2533] pb-6">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-medium tracking-tight text-white">
                  Capital Planning & Lifetime Simulator
                </h1>
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded">
                  Deterministic Engine
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Multi-year capital accumulation &bull; Lifetime milestones (Car, Home, Education) &bull; Trade-off simulation
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowGoalModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white text-black text-xs font-mono font-medium rounded hover:bg-slate-200 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Define Lifetime Goal</span>
              </button>
            </div>
          </div>

          {/* Feedback Toast */}
          {toastMessage && (
            <div className="py-2.5 px-4 border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs font-mono flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{toastMessage}</span>
              </div>
              <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white">
                &times;
              </button>
            </div>
          )}

          {/* UNBOXED HORIZONTAL BASELINE STRIP */}
          <section className="border-y border-[#1E2533] py-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#1E2533]">
              {/* Emergency Reserve */}
              <div className="px-4 py-2 sm:first:pl-0">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                    Reserve Liquidity
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 tabular-nums">
                    ₹{baseline.emergencyFundBalance.toLocaleString("en-IN")} / ₹
                    {baseline.emergencyFundTarget.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="text-xl md:text-2xl font-mono tabular-nums font-medium text-white mt-1">
                  {efCoverMonths} Months <span className="text-xs font-normal text-slate-500">burn coverage</span>
                </div>
                <div className="w-full h-0.5 bg-[#1E2533] mt-2">
                  <div
                    className="h-full bg-emerald-400"
                    style={{
                      width: `${Math.min(
                        100,
                        (baseline.emergencyFundBalance / Math.max(1, baseline.emergencyFundTarget)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Baseline Surplus */}
              <div className="px-4 py-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block">
                  Current Baseline Surplus
                </span>
                <div className="text-xl md:text-2xl font-mono tabular-nums font-medium text-white mt-1">
                  ₹{Math.max(0, baseline.monthlySurplus).toLocaleString("en-IN")}
                  <span className="text-xs font-normal text-slate-500">/mo status quo</span>
                </div>
                <span className="text-[10px] font-mono text-slate-500 mt-2 block tabular-nums">
                  In: ₹{baseline.monthlyIncome.toLocaleString("en-IN")} &bull; Out: ₹
                  {baseline.totalMonthlySpend.toLocaleString("en-IN")}
                </span>
              </div>

              {/* Simulated Surplus */}
              <div className="px-4 py-2 sm:last:pr-0">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                    Simulated Surplus Trajectory
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 font-medium tabular-nums">
                    {simulationResult && simulationResult.surplusDelta >= 0 ? "+" : ""}
                    ₹{(simulationResult?.surplusDelta || 0).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="text-xl md:text-2xl font-mono tabular-nums font-medium text-white mt-1">
                  ₹{(simulationResult?.scenarioSurplus || 0).toLocaleString("en-IN")}
                  <span className="text-xs font-normal text-slate-500">/mo simulated</span>
                </div>
                <span className="text-[10px] font-mono text-slate-500 mt-2 block">
                  {simulationResult && simulationResult.surplusDelta >= 0
                    ? "Accelerates milestone & lifetime targets"
                    : "Caution: Simulated deficit run-rate"}
                </span>
              </div>
            </div>
          </section>

          {/* INTERACTIVE LIFETIME MILESTONE SIMULATOR (CAR, HOME, EDUCATION) */}
          <section className="space-y-4 border border-[#1E2533] bg-[#0E1217] p-5 rounded">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1E2533] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-xs font-mono uppercase tracking-widest text-white">
                    Lifetime Milestone Simulator (Car, Home, Education)
                  </h2>
                </div>
                <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                  Test milestone feasibility, required monthly savings, and maturity dates with mathematical precision.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCommitSimulatedGoalToActive}
                  className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-mono font-medium rounded transition-colors"
                >
                  + Add to Active Goals
                </button>
              </div>
            </div>

            {/* Template Selector Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-xs">
              <span className="text-[10px] uppercase text-slate-500 tracking-wider">Select Milestone:</span>
              {LIFETIME_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.name}
                  type="button"
                  onClick={() =>
                    handleUpdateLifetimeGoalSimulator(
                      tpl.name,
                      tpl.target,
                      tpl.monthsAhead,
                      tpl.target >= 1000000 ? Math.round(tpl.target * 0.15) : 50000,
                      Math.ceil((tpl.target * 0.85) / tpl.monthsAhead)
                    )
                  }
                  className={`px-2.5 py-1 text-xs border rounded transition-colors ${
                    simGoalName === tpl.name
                      ? "border-white bg-white text-black font-medium"
                      : "border-[#1E2533] text-slate-400 hover:text-white bg-transparent"
                  }`}
                >
                  {tpl.name.split(" ")[0]} {tpl.name.split("/")[0].replace(/[^\w\s]/gi, "").trim()} (₹
                  {(tpl.target / 100000).toFixed(1)}L)
                </button>
              ))}
            </div>

            {/* Interactive Levers for the Milestone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 pt-4 border-t border-[#1E2533]">
              <div>
                <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                  Target Price / Goal (₹)
                </label>
                <input
                  type="number"
                  step="50000"
                  value={simGoalTarget}
                  onChange={(e) =>
                    handleUpdateLifetimeGoalSimulator(
                      simGoalName,
                      Math.max(10000, Number(e.target.value)),
                      simGoalMonths,
                      simGoalDownPayment,
                      simGoalMonthlyAlloc
                    )
                  }
                  className="w-full text-xs font-mono tabular-nums bg-transparent border-b border-[#1E2533] py-1 text-white focus:outline-none focus:border-white"
                />
                <span className="text-[10px] font-mono text-slate-500 mt-1 block">
                  ₹{(simGoalTarget / 100000).toFixed(2)} Lakhs
                </span>
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                  Target Horizon
                </label>
                <div className="flex items-center gap-1">
                  {[12, 24, 36, 48, 60].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() =>
                        handleUpdateLifetimeGoalSimulator(
                          simGoalName,
                          simGoalTarget,
                          m,
                          simGoalDownPayment,
                          simGoalMonthlyAlloc
                        )
                      }
                      className={`flex-1 py-1 text-[11px] font-mono border rounded transition-colors ${
                        simGoalMonths === m
                          ? "border-emerald-500 bg-emerald-500/20 text-emerald-400 font-medium"
                          : "border-[#1E2533] text-slate-400 hover:text-white"
                      }`}
                    >
                      {m / 12}y
                    </button>
                  ))}
                </div>
                <span className="text-[10px] font-mono text-slate-500 mt-1 block">
                  Maturity: {simTargetDateStr} ({simGoalMonths} mos)
                </span>
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                  Upfront Down Payment / Saved (₹)
                </label>
                <input
                  type="number"
                  step="25000"
                  value={simGoalDownPayment}
                  onChange={(e) =>
                    handleUpdateLifetimeGoalSimulator(
                      simGoalName,
                      simGoalTarget,
                      simGoalMonths,
                      Math.max(0, Number(e.target.value)),
                      simGoalMonthlyAlloc
                    )
                  }
                  className="w-full text-xs font-mono tabular-nums bg-transparent border-b border-[#1E2533] py-1 text-white focus:outline-none focus:border-white"
                />
                <input
                  type="range"
                  min="0"
                  max={Math.min(simGoalTarget, 1000000)}
                  step="25000"
                  value={simGoalDownPayment}
                  onChange={(e) =>
                    handleUpdateLifetimeGoalSimulator(
                      simGoalName,
                      simGoalTarget,
                      simGoalMonths,
                      Number(e.target.value),
                      simGoalMonthlyAlloc
                    )
                  }
                  className="w-full mt-2 accent-white h-1 bg-[#1E2533] rounded"
                />
                <span className="text-[10px] font-mono text-slate-500 mt-1 block">
                  Remaining: ₹{simRemaining.toLocaleString("en-IN")}
                </span>
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                  Dedicated Monthly Savings (₹)
                </label>
                <input
                  type="number"
                  step="5000"
                  value={simGoalMonthlyAlloc}
                  onChange={(e) =>
                    handleUpdateLifetimeGoalSimulator(
                      simGoalName,
                      simGoalTarget,
                      simGoalMonths,
                      simGoalDownPayment,
                      Math.max(0, Number(e.target.value))
                    )
                  }
                  className="w-full text-xs font-mono tabular-nums bg-transparent border-b border-[#1E2533] py-1 text-white focus:outline-none focus:border-white"
                />
                <input
                  type="range"
                  min="5000"
                  max="100000"
                  step="2500"
                  value={simGoalMonthlyAlloc}
                  onChange={(e) =>
                    handleUpdateLifetimeGoalSimulator(
                      simGoalName,
                      simGoalTarget,
                      simGoalMonths,
                      simGoalDownPayment,
                      Number(e.target.value)
                    )
                  }
                  className="w-full mt-2 accent-emerald-400 h-1 bg-[#1E2533] rounded"
                />
                <span className="text-[10px] font-mono text-slate-500 mt-1 block">
                  Required Run-Rate: ₹{simReqMonthly.toLocaleString("en-IN")}/mo
                </span>
              </div>
            </div>

            {/* Simulation Feasibility Verdict Banner */}
            <div
              className={`p-3 border font-mono text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                isSimGoalFeasible
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
              }`}
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold uppercase tracking-wider">
                    {isSimGoalFeasible ? "🟢 Milestone Achievable" : "🟡 Requires Adjustment"}
                  </span>
                  <span>&bull;</span>
                  <span>Target: {simGoalName}</span>
                </div>
                <p className="text-[11px] opacity-90">
                  {isSimGoalFeasible
                    ? `Your simulated surplus of ₹${activeSurplus.toLocaleString("en-IN")}/mo comfortably funds the ₹${simReqMonthly.toLocaleString("en-IN")}/mo needed to buy by ${simTargetDateStr}.`
                    : `To purchase by ${simTargetDateStr}, you need ₹${simReqMonthly.toLocaleString("en-IN")}/mo. Current surplus leaves a shortfall of ₹${Math.max(0, simReqMonthly - activeSurplus).toLocaleString("en-IN")}/mo.`}
                </p>
              </div>

              <div className="text-right shrink-0">
                <div className="text-[10px] uppercase text-slate-400">Total Capital Plan</div>
                <div className="text-sm font-semibold tabular-nums text-white">
                  ₹{simGoalTarget.toLocaleString("en-IN")}
                </div>
              </div>
            </div>
          </section>

          {/* ACTIVE CAPITAL ALLOCATION TARGETS (LIFETIME GOALS) */}
          <section className="space-y-4">
            <div className="flex items-baseline justify-between border-b border-[#1E2533] pb-3">
              <div>
                <h2 className="text-xs font-mono uppercase tracking-widest text-white flex items-center gap-2">
                  <span>Lifetime Capital Goals & Milestones</span>
                  <span className="text-slate-500 text-[10px] font-normal">
                    ({goals.length} Tracked Targets)
                  </span>
                </h2>
                <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                  Projections adapt dynamically as you simulate income raises or discretionary cuts below.
                </p>
              </div>

              <button
                onClick={() => setShowGoalModal(true)}
                className="text-xs font-mono text-slate-400 hover:text-white transition-colors"
              >
                + Add Goal &rarr;
              </button>
            </div>

            {goals.length === 0 ? (
              <div className="py-12 text-center text-slate-500 font-mono text-xs">
                No active capital goals. Click &apos;+ Define Lifetime Goal&apos; to model milestone targets.
              </div>
            ) : (
              <div className="divide-y divide-[#1E2533]">
                {goals.map((g) => {
                  const proj = simulationResult?.goalProjections.find((p) => p.id === g.id);
                  const currentAmt = Number(g.current_amount || 0);
                  const targetAmt = Number(g.target_amount);
                  const pct = Math.min(100, Math.round((currentAmt / Math.max(1, targetAmt)) * 100));
                  const remaining = Math.max(0, targetAmt - currentAmt);

                  const isAchieved = currentAmt >= targetAmt;

                  return (
                    <div
                      key={g.id}
                      className="py-5 space-y-4 hover:bg-white/[0.01] transition-colors"
                    >
                      {/* Top Row: Title, Target Date, Actions */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <h3 className="text-sm font-medium text-white">{g.name}</h3>
                            {isAchieved ? (
                              <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded">
                                Target Achieved
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono text-slate-400 border border-[#1E2533] px-2 py-0.5 rounded">
                                Maturity:{" "}
                                {new Date(g.target_date).toLocaleDateString("en-IN", {
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            )}
                            {proj && proj.monthsGainedOrLost > 0 && (
                              <span className="text-[10px] font-mono text-emerald-400">
                                +{proj.monthsGainedOrLost} mo sooner with scenario!
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-mono text-slate-500">
                            {remaining === 0
                              ? "100% completed. Milestone capital fully accumulated."
                              : `Remaining: ₹${remaining.toLocaleString("en-IN")} needed • Required Run-Rate: ₹${(
                                  proj?.monthlyContributionNeeded || 0
                                ).toLocaleString("en-IN")}/mo`}
                          </p>
                        </div>

                        {/* Right: Balances and Action Buttons */}
                        <div className="flex items-center gap-4 font-mono">
                          <div className="text-right">
                            <div className="text-sm text-white tabular-nums font-medium">
                              ₹{currentAmt.toLocaleString("en-IN")}
                              <span className="text-slate-500 font-normal text-xs">
                                {" "}
                                / ₹{targetAmt.toLocaleString("en-IN")}
                              </span>
                            </div>
                            <span className="text-[11px] text-emerald-400 tabular-nums">{pct}% funded</span>
                          </div>

                          {/* Quick Add Funds Button */}
                          <button
                            onClick={() => {
                              setFundingGoal(g);
                              setFundAmount(10000);
                            }}
                            className="px-3 py-1 bg-white/[0.08] hover:bg-white text-white hover:text-black border border-[#1E2533] text-xs font-mono font-medium rounded transition-colors flex items-center gap-1.5"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Funds</span>
                          </button>

                          {/* Simulate this goal directly in modeler */}
                          <button
                            onClick={() => {
                              const targetD = new Date(g.target_date);
                              const now = new Date();
                              const diffMonths = Math.max(
                                6,
                                (targetD.getFullYear() - now.getFullYear()) * 12 + (targetD.getMonth() - now.getMonth())
                              );
                              handleUpdateLifetimeGoalSimulator(
                                g.name,
                                Number(g.target_amount),
                                diffMonths,
                                Number(g.current_amount || 0),
                                Math.ceil((Number(g.target_amount) - Number(g.current_amount || 0)) / diffMonths)
                              );
                              window.scrollTo({ top: 300, behavior: "smooth" });
                            }}
                            className="text-xs text-slate-400 hover:text-emerald-400 p-1.5 transition-colors"
                            title="Simulate this Goal in Lifetime Modeler"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteGoal(g.id)}
                            className="text-slate-600 hover:text-rose-400 p-1.5 transition-colors"
                            title="Remove Target"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-1 bg-[#1E2533]">
                        <div
                          className="bg-emerald-400 h-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      {/* Lifetime Projection Insights Strip */}
                      {proj && remaining > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-xs font-mono border-t border-[#1E2533]/40">
                          <div>
                            <span className="text-[10px] uppercase text-slate-500 block">
                              Status Quo Baseline
                            </span>
                            <span className="text-slate-300">
                              {proj.baselineCompletionDate}{" "}
                              {proj.baselineMonthsLeft < 999 && (
                                <span className="text-slate-500">({proj.baselineMonthsLeft} mos)</span>
                              )}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] uppercase text-slate-500 block">
                              Simulated Trajectory
                            </span>
                            <span className="text-emerald-400 font-medium">
                              {proj.scenarioCompletionDate}{" "}
                              {proj.scenarioMonthsLeft < 999 && (
                                <span className="text-emerald-500/80">({proj.scenarioMonthsLeft} mos)</span>
                              )}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] uppercase text-slate-500 block">
                              Simulation Verdict
                            </span>
                            <span className="text-slate-400">{proj.timeSummary}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>



          {/* ADD FUNDS TO GOAL MODAL */}
          {fundingGoal && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#101418] border border-[#1E2533] p-6 max-w-md w-full space-y-4">
                <div className="flex items-center justify-between border-b border-[#1E2533] pb-3">
                  <div>
                    <h3 className="text-xs font-mono uppercase tracking-widest text-white">
                      RECORD CAPITAL CONTRIBUTION
                    </h3>
                    <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                      {fundingGoal.name}
                    </p>
                  </div>
                  <button onClick={() => setFundingGoal(null)} className="text-slate-400 hover:text-white">
                    &times;
                  </button>
                </div>

                <div className="space-y-4 font-mono text-xs">
                  <div className="p-3 bg-white/[0.02] border border-[#1E2533] text-slate-400 space-y-1">
                    <div className="flex justify-between">
                      <span>Current Progress:</span>
                      <span className="text-white font-medium">
                        ₹{(fundingGoal.current_amount || 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Target Goal:</span>
                      <span className="text-white font-medium">
                        ₹{fundingGoal.target_amount.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase text-slate-400 block mb-1">
                      Contribution Amount (₹)
                    </label>
                    <input
                      type="number"
                      step="1000"
                      value={fundAmount}
                      onChange={(e) => setFundAmount(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-transparent border-b border-[#1E2533] py-1 text-white text-base focus:outline-none focus:border-white tabular-nums"
                    />
                  </div>

                  {/* Quick Preset Amount Buttons */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {[5000, 10000, 25000, 50000, 100000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setFundAmount(amt)}
                        className={`px-2.5 py-1 text-[11px] border rounded transition-colors ${
                          fundAmount === amt
                            ? "border-white bg-white text-black font-medium"
                            : "border-[#1E2533] text-slate-400 hover:text-white"
                        }`}
                      >
                        +₹{(amt / 1000).toFixed(0)}k
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-[#1E2533] font-mono text-xs">
                  <button
                    onClick={() => setFundingGoal(null)}
                    disabled={fundingLoading}
                    className="text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddFundsSubmit}
                    disabled={fundingLoading || fundAmount <= 0}
                    className="px-4 py-1.5 bg-white text-black font-medium hover:bg-slate-200 transition-colors disabled:opacity-40"
                  >
                    {fundingLoading ? "Recording..." : "Record Contribution"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* DEFINE NEW GOAL MODAL WITH LIFETIME TEMPLATES */}
          {showGoalModal && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#101418] border border-[#1E2533] p-6 max-w-lg w-full space-y-4">
                <div className="flex items-center justify-between border-b border-[#1E2533] pb-3">
                  <div>
                    <h3 className="text-xs font-mono uppercase tracking-widest text-white">
                      DEFINE LIFETIME CAPITAL TARGET
                    </h3>
                    <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                      Model significant life milestones (Car, House, Emergency Reserve)
                    </p>
                  </div>
                  <button onClick={() => setShowGoalModal(false)} className="text-slate-400 hover:text-white">
                    &times;
                  </button>
                </div>

                {/* Quick Lifetime Templates */}
                <div className="space-y-1.5 font-mono text-xs">
                  <span className="text-[10px] uppercase text-slate-500 tracking-wider">
                    Quick Milestone Presets:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {LIFETIME_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.name}
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setMonth(d.getMonth() + tpl.monthsAhead);
                          const dateStr = d.toISOString().split("T")[0];
                          setNewGoalName(tpl.name);
                          setNewGoalTarget(tpl.target);
                          setNewGoalDate(dateStr);
                        }}
                        className="text-left p-2 border border-[#1E2533] hover:border-slate-500 bg-white/[0.01] hover:bg-white/[0.04] transition-colors rounded"
                      >
                        <div className="text-white font-medium">{tpl.name}</div>
                        <div className="text-[10px] text-emerald-400 tabular-nums">
                          ₹{(tpl.target / 100000).toFixed(1)} Lakhs &bull; {tpl.monthsAhead / 12} yrs
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 font-mono text-xs pt-2">
                  <div>
                    <label className="text-[10px] uppercase text-slate-400 block mb-1">
                      Milestone / Goal Name
                    </label>
                    <input
                      type="text"
                      value={newGoalName}
                      placeholder="e.g. 🚗 Buy a Car / Vehicle"
                      onChange={(e) => setNewGoalName(e.target.value)}
                      className="w-full bg-transparent border-b border-[#1E2533] py-1 text-white focus:outline-none focus:border-white"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase text-slate-400 block mb-1">
                      Required Capital (₹)
                    </label>
                    <input
                      type="number"
                      step="50000"
                      value={newGoalTarget}
                      onChange={(e) => setNewGoalTarget(Number(e.target.value))}
                      className="w-full bg-transparent border-b border-[#1E2533] py-1 text-white focus:outline-none focus:border-white tabular-nums"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      ₹{newGoalTarget.toLocaleString("en-IN")} (
                      {(newGoalTarget / 100000).toFixed(2)} Lakhs)
                    </span>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase text-slate-400 block mb-1">
                      Target Maturity Date
                    </label>
                    <input
                      type="date"
                      value={newGoalDate}
                      onChange={(e) => setNewGoalDate(e.target.value)}
                      className="w-full bg-transparent border-b border-[#1E2533] py-1 text-white focus:outline-none focus:border-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-[#1E2533] font-mono text-xs">
                  <button onClick={() => setShowGoalModal(false)} className="text-slate-400 hover:text-white">
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateGoal}
                    disabled={!newGoalName.trim() || newGoalTarget <= 0}
                    className="px-4 py-1.5 bg-white text-black font-medium hover:bg-slate-200 transition-colors disabled:opacity-40"
                  >
                    Commit Milestone
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
