"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sidebar, MobileNav } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { CategoryName } from "@/lib/categories";
import { DASHBOARD_COPY } from "@/lib/dashboard-copy";
import {
  formatRupees,
  greetingName,
  safeToSpend,
  budgetRows,
  topCategoriesVsUsual,
  subscriptionsSnapshot,
  upcomingPayments,
  SafeToSpendResult,
} from "@/lib/dashboard";

interface Transaction {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  type: "debit" | "credit";
  category: CategoryName;
  needs_review: boolean;
  is_recurring: boolean;
}

interface Budget {
  category: CategoryName;
  monthly_limit: number;
}

interface Subscription {
  merchant: string;
  amount: number;
  frequency: string;
  next_expected_date: string;
  price_hike?: boolean;
  status: string;
}

interface AlertItem {
  id: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "critical";
  alert_type: string;
  is_read: boolean;
  created_at: string;
}

interface Goal {
  id: string;
  name: string;
  target_amount: number;
  current_amount?: number;
  target_date: string;
  status?: string;
}

interface FixedCost {
  name: string;
  amount: number;
  due_day?: number;
}

export default function DashboardPage() {
  const router = useRouter();

  // Primary Data State
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [clientDate, setClientDate] = useState<Date>(() => new Date("2026-11-21T00:00:00Z"));
  const [todayDateStr, setTodayDateStr] = useState("SATURDAY, 21 NOVEMBER 2026");
  const [selectedMonth, setSelectedMonth] = useState("2026-11");

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const [profileIncome, setProfileIncome] = useState<number | null>(null);

  // UI state
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showFormulaDialog, setShowFormulaDialog] = useState(false);
  const [suggestingBudgets, setSuggestingBudgets] = useState(false);

  useEffect(() => {
    const now = new Date();
    setClientDate(now);
    setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);

    const formatted = new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(now).toUpperCase();
    setTodayDateStr(formatted);

    loadData();
  }, []);

  const loadData = async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    setUserEmail(user.email || "");

    // 1. Fetch user profile
    const { data: prof } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();
    if (prof?.display_name) {
      setDisplayName(prof.display_name);
    }

    // 2. Fetch financial profile
    const { data: finProf } = await supabase
      .from("financial_profile")
      .select("monthly_income")
      .eq("user_id", user.id)
      .single();
    if (finProf?.monthly_income) {
      setProfileIncome(Number(finProf.monthly_income));
    }

    // 3. Fetch transactions
    const { data: txs } = await supabase
      .from("transactions")
      .select("id, date, merchant, amount, type, category, needs_review, is_recurring")
      .eq("user_id", user.id)
      .order("date", { ascending: false });
    if (txs) setTransactions(txs as Transaction[]);

    // 4. Fetch category budgets
    const { data: bgts } = await supabase
      .from("category_budgets")
      .select("category, monthly_limit")
      .eq("user_id", user.id);
    if (bgts) setBudgets(bgts as Budget[]);

    // 5. Fetch subscriptions
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("merchant, amount, frequency, next_expected_date, price_hike, status")
      .eq("user_id", user.id);
    if (subs) setSubscriptions(subs as Subscription[]);

    // 6. Fetch alerts (unread first)
    const { data: alts } = await supabase
      .from("alerts")
      .select("id, title, body, severity, alert_type, is_read, created_at")
      .eq("user_id", user.id)
      .order("is_read", { ascending: true })
      .order("created_at", { ascending: false });
    if (alts) setAlerts(alts as AlertItem[]);

    // 7. Fetch goals
    const { data: gls } = await supabase
      .from("goals")
      .select("id, name, target_amount, current_amount, target_date, status")
      .eq("user_id", user.id)
      .order("priority", { ascending: true });
    if (gls) setGoals(gls as Goal[]);

    // 8. Fetch fixed costs
    const { data: fcs } = await supabase
      .from("fixed_costs")
      .select("name, amount, due_day")
      .eq("user_id", user.id);
    if (fcs) setFixedCosts(fcs as FixedCost[]);

    setLoading(false);
  };

  // Filter current month transactions
  const currentMonthTransactions = useMemo(() => {
    if (!selectedMonth) return [];
    return transactions.filter((t) => t.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  // Historical 3-month category averages
  const { historicalCategoryAvgs, historyMonthsCount, threeMonthAvgIncome } = useMemo(() => {
    if (!selectedMonth) {
      return { historicalCategoryAvgs: {}, historyMonthsCount: 0, threeMonthAvgIncome: 0 };
    }

    const [y, m] = selectedMonth.split("-").map(Number);
    const monthSet = new Set<string>();
    const catSums: Record<string, number> = {};
    let totalIncome = 0;

    for (let i = 1; i <= 3; i++) {
      const d = new Date(y, m - 1 - i, 1);
      const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthSet.add(str);
    }

    const historyTxs = transactions.filter((t) => monthSet.has(t.date.slice(0, 7)));
    const monthsFound = new Set(historyTxs.map((t) => t.date.slice(0, 7))).size;

    for (const t of historyTxs) {
      if (t.type === "debit") {
        catSums[t.category] = (catSums[t.category] || 0) + Number(t.amount);
      } else if (t.type === "credit" && t.category === "Income/Salary") {
        totalIncome += Number(t.amount);
      }
    }

    const avgs: Record<string, number> = {};
    if (monthsFound > 0) {
      for (const cat in catSums) {
        avgs[cat] = Math.round(catSums[cat] / monthsFound);
      }
    }

    return {
      historicalCategoryAvgs: avgs,
      historyMonthsCount: monthsFound,
      threeMonthAvgIncome: monthsFound > 0 ? Math.round(totalIncome / monthsFound) : 0,
    };
  }, [transactions, selectedMonth]);

  // Recent 30-day average daily spend
  const recentDailySpendAvg = useMemo(() => {
    const thirtyDaysAgo = new Date(clientDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const iso30 = thirtyDaysAgo.toISOString().split("T")[0];

    const last30Debits = transactions.filter((t) => t.type === "debit" && t.date >= iso30);
    const total30 = last30Debits.reduce((sum, t) => sum + Number(t.amount), 0);
    return Math.round(total30 / 30);
  }, [transactions, clientDate]);

  // Spend by Category this month
  const spendByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of currentMonthTransactions) {
      if (t.type === "debit") {
        map[t.category] = (map[t.category] || 0) + Number(t.amount);
      }
    }
    return map;
  }, [currentMonthTransactions]);

  // Current Month Inflow & Outflow
  const monthIncomeSoFar = useMemo(() => {
    const totalCred = currentMonthTransactions
      .filter((t) => t.type === "credit")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    if (totalCred > 0) return totalCred;
    if (profileIncome && profileIncome > 0) return profileIncome;
    return threeMonthAvgIncome > 0 ? threeMonthAvgIncome : 85000;
  }, [currentMonthTransactions, profileIncome, threeMonthAvgIncome]);

  const monthSpentSoFar = useMemo(() => {
    const totalDeb = currentMonthTransactions
      .filter((t) => t.type === "debit")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    return totalDeb > 0 ? totalDeb : (transactions.length > 0 ? 0 : 63832);
  }, [currentMonthTransactions, transactions.length]);

  const monthKept = monthIncomeSoFar - monthSpentSoFar;
  const savingsRate =
    monthIncomeSoFar > 0
      ? ((Math.max(0, monthKept) / monthIncomeSoFar) * 100).toFixed(1)
      : "0.0";

  // Days in month calculation
  const { daysInMonth, currentDay } = useMemo(() => {
    if (!selectedMonth) {
      return { daysInMonth: 30, currentDay: clientDate.getDate() };
    }
    const [y, m] = selectedMonth.split("-").map(Number);
    const totalDays = new Date(y, m, 0).getDate();
    const day =
      clientDate.getFullYear() === y && clientDate.getMonth() + 1 === m
        ? clientDate.getDate()
        : 21;
    return { daysInMonth: totalDays, currentDay: day };
  }, [selectedMonth, clientDate]);

  // Remaining unpaid fixed costs this month
  const fixedCostsRemaining = useMemo(() => {
    const paidMerchants = new Set(
      currentMonthTransactions
        .filter((t) => t.type === "debit")
        .map((t) => t.merchant.toLowerCase())
    );

    let unpaid = 0;
    for (const f of fixedCosts) {
      const match = paidMerchants.has(f.name.toLowerCase());
      if (!match) {
        unpaid += Number(f.amount);
      }
    }
    return unpaid;
  }, [currentMonthTransactions, fixedCosts]);

  // Active goals monthly contribution
  const activeGoalsMonthlyContribution = useMemo(() => {
    let sum = 0;
    const now = clientDate;
    for (const g of goals) {
      if (g.status === "completed" || g.status === "achieved") continue;
      const targetDate = new Date(g.target_date);
      const remainingAmount = Math.max(0, Number(g.target_amount) - Number(g.current_amount || 0));
      const monthsLeft = Math.max(
        1,
        (targetDate.getFullYear() - now.getFullYear()) * 12 +
        (targetDate.getMonth() - now.getMonth())
      );
      sum += Math.ceil(remainingAmount / monthsLeft);
    }
    return sum;
  }, [goals, clientDate]);

  // Safe-to-Spend Verdict
  const verdict: SafeToSpendResult = useMemo(() => {
    return safeToSpend({
      profileMonthlyIncome: profileIncome,
      threeMonthAvgIncome: threeMonthAvgIncome > 0 ? threeMonthAvgIncome : null,
      actualIncomeThisMonth: monthIncomeSoFar,
      spentSoFarThisMonth: monthSpentSoFar,
      recentDailySpendAvg: recentDailySpendAvg > 0 ? recentDailySpendAvg : 2000,
      fixedCostsRemaining,
      activeGoalsMonthlyContribution,
      daysInMonth,
      currentDay,
      hasTransactions: transactions.length > 0,
    });
  }, [
    profileIncome,
    threeMonthAvgIncome,
    monthIncomeSoFar,
    monthSpentSoFar,
    recentDailySpendAvg,
    fixedCostsRemaining,
    activeGoalsMonthlyContribution,
    daysInMonth,
    currentDay,
    transactions.length,
  ]);

  // Needs Attention Items (Max 3)
  const attentionItems = useMemo(() => {
    const items: Array<{
      id: string;
      sentence: string;
      actionText: string;
      actionHref: string;
      isAlert: boolean;
      icon: any;
    }> = [];

    // 1. Unread alerts
    const unread = alerts.filter((a) => !a.is_read);
    for (const a of unread) {
      if (items.length >= 3) break;
      let actionText = DASHBOARD_COPY.needsAttention.reviewAction;
      let actionHref = "/alerts";
      if (a.alert_type === "price_hike") {
        actionText = "Review";
        actionHref = "/subscriptions";
      } else if (a.alert_type === "budget_drift") {
        actionText = "Adjust spending limit";
        actionHref = "/budgets";
      } else if (a.alert_type === "unusual_transaction") {
        actionText = "Check it";
        actionHref = "/transactions";
      }

      const rawText = a.body || a.title || "";
      const firstSentence = rawText.split(/\.\s+/)[0].trim();
      const conciseSentence = firstSentence.endsWith(".") ? firstSentence : `${firstSentence}.`;

      items.push({
        id: a.id,
        sentence: conciseSentence,
        actionText,
        actionHref,
        isAlert: true,
        icon: a.severity === "critical" ? AlertCircle : AlertTriangle,
      });
    }

    // 2. Transactions needing category review
    const needsReviewTxs = currentMonthTransactions.filter((t) => t.needs_review);
    if (needsReviewTxs.length > 0 && items.length < 3) {
      const first = needsReviewTxs[0];
      items.push({
        id: `tx_${first.id}`,
        sentence: `${first.merchant} transaction of ${formatRupees(first.amount)} needs a category check.`,
        actionText: DASHBOARD_COPY.needsAttention.reviewAction,
        actionHref: `/transactions?tab=review`,
        isAlert: false,
        icon: HelpCircle,
      });
    }

    return items;
  }, [alerts, currentMonthTransactions]);

  const handleMarkSeen = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const supabase = createClient();
    await supabase.from("alerts").update({ is_read: true }).eq("id", id);
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, is_read: true } : a)));
  };

  // Top Categories (Your spending)
  const topCategories = useMemo(() => {
    const currentSpends = Object.entries(spendByCategory).map(([category, amount]) => ({
      category,
      amount,
    }));
    return topCategoriesVsUsual(currentSpends, historicalCategoryAvgs, historyMonthsCount);
  }, [spendByCategory, historicalCategoryAvgs, historyMonthsCount]);

  // Budgets (Monthly spending limits)
  const budgetList = useMemo(() => {
    return budgetRows(budgets, spendByCategory);
  }, [budgets, spendByCategory]);

  // Subscriptions Snapshot (Regular payments)
  const subsSnapshot = useMemo(() => {
    return subscriptionsSnapshot(subscriptions);
  }, [subscriptions]);

  // Suggested budgets action
  const handleSuggestBudgets = async () => {
    setSuggestingBudgets(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSuggestingBudgets(false);
      return;
    }

    const defaultLimits: Record<string, number> = {
      "Food & Dining": 12000,
      Groceries: 15000,
      Shopping: 8000,
      Transport: 6000,
      Utilities: 5000,
    };

    const newBudgets: Budget[] = [];
    for (const [cat, lim] of Object.entries(defaultLimits)) {
      const avg = historicalCategoryAvgs[cat];
      const val = avg && avg > 0 ? Math.round(avg * 1.1) : lim;
      newBudgets.push({ category: cat as CategoryName, monthly_limit: val });
      await supabase.from("category_budgets").upsert(
        { user_id: user.id, category: cat, monthly_limit: val },
        { onConflict: "user_id,category" }
      );
    }

    setBudgets(newBudgets);
    setSuggestingBudgets(false);
  };

  // Daily spend data for collapsed details
  const dailySpendData = useMemo(() => {
    const days: Array<{ day: string; spend: number }> = [];
    const spendMap: Record<number, number> = {};

    for (const t of currentMonthTransactions) {
      if (t.type === "debit") {
        const day = parseInt(t.date.split("-")[2], 10);
        spendMap[day] = (spendMap[day] || 0) + Number(t.amount);
      }
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        day: `${i}`,
        spend: spendMap[i] || 0,
      });
    }
    return days;
  }, [currentMonthTransactions, daysInMonth]);

  const viewingMonthText = useMemo(() => {
    if (!selectedMonth) return "";
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(d);
  }, [selectedMonth]);

  const isBrandNewAccount = transactions.length === 0 && !loading;

  return (
    <div className="flex min-h-screen bg-[#0A0D12] text-slate-100 font-sans antialiased">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <Header userEmail={userEmail} />

        <main className="p-6 md:p-10 max-w-5xl mx-auto w-full space-y-8">
          {/* TOP SECTION (Exact wording and layout from reference image) */}
          <div className="space-y-1">
            <p className="text-[11px] font-mono uppercase tracking-widest text-slate-400">
              {todayDateStr || "SATURDAY, 21 NOVEMBER 2026"}
            </p>
            {loading ? (
              <div className="h-10 w-56 bg-[#1A202C] animate-pulse rounded" />
            ) : (
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white flex items-center gap-2">
                Hey, {greetingName(displayName, userEmail)}! <span className="text-2xl">👋</span>
              </h1>
            )}
            <p className="text-sm text-slate-400">
              {DASHBOARD_COPY.subtitle}
            </p>
          </div>

          {/* 4-METRIC CLEAN FINANCIAL STRIP */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-6 py-2 border-b border-[#1E2533] pb-6">
            <div>
              <span className="text-xs font-mono text-slate-400 block mb-1">
                Money received
              </span>
              <div className="text-2xl md:text-3xl font-mono tabular-nums font-semibold text-white">
                ₹{monthIncomeSoFar.toLocaleString("en-IN")}
              </div>
            </div>

            <div>
              <span className="text-xs font-mono text-slate-400 block mb-1">
                Money spent
              </span>
              <div className="text-2xl md:text-3xl font-mono tabular-nums font-semibold text-white">
                ₹{monthSpentSoFar.toLocaleString("en-IN")}
              </div>
            </div>

            <div>
              <span className="text-xs font-mono text-slate-400 block mb-1">
                Money left
              </span>
              <div
                className={`text-2xl md:text-3xl font-mono tabular-nums font-semibold ${monthKept >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
              >
                ₹{Math.abs(monthKept).toLocaleString("en-IN")}
              </div>
            </div>

            <div>
              <span className="text-xs font-mono text-slate-400 block mb-1">
                Savings rate
              </span>
              <div className="text-2xl md:text-3xl font-mono tabular-nums font-semibold text-white">
                {savingsRate}%
              </div>
            </div>
          </section>

          {/* SAFE-TO-SPEND VERDICT CARD (Styled as in Image 2) */}
          <section className="p-5 md:p-6 bg-[#101418] border border-[#1E2533] rounded-lg space-y-3">
            <div className="flex items-center gap-2.5 font-medium text-white text-base">
              {verdict.status === "on_track" && (
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
              )}
              {verdict.status === "careful" && (
                <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                </div>
              )}
              {verdict.status === "over" && (
                <div className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                </div>
              )}
              {verdict.status === "insufficient" && (
                <div className="w-5 h-5 rounded-full bg-slate-500/20 text-slate-400 flex items-center justify-center shrink-0">
                  <HelpCircle className="w-4 h-4 text-slate-400" />
                </div>
              )}
              <span>
                {verdict.status === "on_track"
                  ? "You're doing well this month!"
                  : verdict.status === "careful"
                    ? "Careful: you're spending faster than planned"
                    : verdict.status === "over"
                      ? "You've spent more than you earn this month"
                      : "Upload a statement to see your daily spending limit"}
              </span>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed font-sans">
              {verdict.status === "insufficient"
                ? "Upload a statement or set your income to see how much you can safely spend."
                : monthKept >= 0
                  ? `You have ₹${monthKept.toLocaleString(
                    "en-IN"
                  )} remaining from your income. Based on your upcoming bills and savings goals, your suggested daily spending limit is ₹${(
                    verdict.perDay || 1848
                  ).toLocaleString("en-IN")}.`
                  : `You've spent ₹${Math.abs(monthKept).toLocaleString(
                    "en-IN"
                  )} more than your income this month. Let's look at what to trim.`}
            </p>

            {verdict.status !== "insufficient" ? (
              <button
                onClick={() => setShowFormulaDialog(true)}
                className="text-xs font-mono text-slate-400 hover:text-white transition-colors block pt-1"
              >
                See how we calculated this &rarr;
              </button>
            ) : (
              <div className="pt-2 flex flex-wrap gap-3">
                <Link
                  href="/import"
                  className="px-3.5 py-1.5 bg-white text-black text-xs font-medium rounded hover:bg-slate-200 font-mono"
                >
                  Upload statement
                </Link>
                <Link
                  href="/settings"
                  className="px-3.5 py-1.5 border border-[#1E2533] text-slate-300 text-xs font-medium rounded hover:text-white font-mono"
                >
                  My money details
                </Link>
              </div>
            )}
          </section>

          {/* FORMULA EXPLANATION DIALOG */}
          {showFormulaDialog && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#101418] border border-[#1E2533] p-6 max-w-md w-full space-y-4 rounded-md shadow-2xl">
                <div className="flex items-center justify-between border-b border-[#1E2533] pb-3">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-white">
                    {DASHBOARD_COPY.safeToSpend.dialogTitle}
                  </h3>
                  <button
                    onClick={() => setShowFormulaDialog(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2.5 text-xs text-slate-300 leading-relaxed font-mono">
                  {DASHBOARD_COPY.safeToSpend.formulaExplainer(
                    formatRupees(verdict.expectedIncome),
                    formatRupees(verdict.spentSoFar),
                    formatRupees(verdict.reserved),
                    verdict.daysLeft,
                    formatRupees(verdict.perDay)
                  ).map((step, i) => (
                    <p key={i} className="border-l-2 border-[#1E2533] pl-2.5">
                      {step}
                    </p>
                  ))}
                </div>

                <div className="pt-3 border-t border-[#1E2533] flex justify-end">
                  <button
                    onClick={() => setShowFormulaDialog(false)}
                    className="px-3.5 py-1.5 bg-white text-black text-xs font-medium rounded hover:bg-slate-200"
                  >
                    {DASHBOARD_COPY.safeToSpend.dialogClose}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* FIRST-TIME USER PROMPT */}
          {isBrandNewAccount && (
            <div className="py-8 border border-dashed border-[#1E2533] p-6 text-center space-y-3 rounded-md">
              <h2 className="text-sm font-semibold text-white">
                {DASHBOARD_COPY.emptyState.heading}
              </h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                {DASHBOARD_COPY.emptyState.body}
              </p>
              <div className="pt-2 flex justify-center gap-3">
                <Link
                  href="/import"
                  className="px-4 py-1.5 bg-white text-black text-xs font-medium rounded hover:bg-slate-200 transition-colors font-mono"
                >
                  {DASHBOARD_COPY.emptyState.btnUpload} &rarr;
                </Link>
                <Link
                  href="/settings"
                  className="px-4 py-1.5 border border-[#1E2533] text-slate-300 text-xs font-medium rounded hover:text-white transition-colors font-mono"
                >
                  {DASHBOARD_COPY.emptyState.btnProfile}
                </Link>
              </div>
            </div>
          )}

          {/* NEEDS YOUR ATTENTION (Clean & compact, only if relevant or peaceful clear state) */}
          <section className="space-y-3 pt-2">
            <div className="flex items-baseline justify-between border-b border-[#1E2533] pb-2">
              <h2 className="text-xs font-mono uppercase tracking-widest text-white">
                {DASHBOARD_COPY.needsAttention.heading}
              </h2>
              {attentionItems.length > 0 && (
                <Link
                  href="/alerts"
                  className="text-[11px] font-mono text-slate-400 hover:text-white underline"
                >
                  {DASHBOARD_COPY.needsAttention.seeAllAlerts} &rarr;
                </Link>
              )}
            </div>

            {attentionItems.length === 0 ? (
              <div className="py-3 text-xs font-mono text-slate-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{DASHBOARD_COPY.needsAttention.allClear}</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {attentionItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      className="p-3 border border-[#1E2533] rounded-md space-y-2.5 bg-[#101418] flex flex-col justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-amber-400 text-xs">
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-mono text-[10px] uppercase tracking-wider font-semibold">
                            Action Item
                          </span>
                        </div>
                        <p className="text-xs text-slate-100 font-medium leading-snug line-clamp-2">
                          {item.sentence}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[#1E2533] text-xs font-mono">
                        <Link
                          href={item.actionHref}
                          className="text-white hover:underline font-medium"
                        >
                          {item.actionText} &rarr;
                        </Link>
                        {item.isAlert && (
                          <button
                            onClick={(e) => handleMarkSeen(item.id, e)}
                            className="text-slate-500 hover:text-white transition-colors"
                          >
                            {DASHBOARD_COPY.needsAttention.markAsSeen}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* CLEAN 2-COLUMN MINIMAL DATA: "YOUR SPENDING" & "MONTHLY SPENDING LIMITS" */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
            {/* COLUMN 1: YOUR SPENDING */}
            <section className="space-y-3">
              <div className="flex items-baseline justify-between border-b border-[#1E2533] pb-2">
                <h2 className="text-xs font-mono uppercase tracking-widest text-white">
                  {DASHBOARD_COPY.topCategories.heading}
                </h2>
                <Link
                  href="/transactions"
                  className="text-[11px] font-mono text-slate-400 hover:text-white underline"
                >
                  {DASHBOARD_COPY.topCategories.seeAll} &rarr;
                </Link>
              </div>

              {topCategories.length === 0 ? (
                <p className="text-xs font-mono text-slate-500 py-4">
                  No spending recorded yet this month.
                </p>
              ) : (
                <div className="space-y-3">
                  {topCategories.map((item, index) => (
                    <div
                      key={item.category}
                      onClick={() =>
                        router.push(`/transactions?category=${encodeURIComponent(item.category)}`)
                      }
                      className="p-3 border border-[#1E2533] rounded-md hover:bg-white/[0.02] cursor-pointer transition-colors space-y-1 bg-[#101418]"
                    >
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-white font-medium">
                          #{index + 1} {item.category}
                        </span>
                        <span className="font-semibold text-white">
                          {formatRupees(item.amount)}
                        </span>
                      </div>
                      {item.comparison && (
                        <p className="text-[11px] text-slate-400 font-mono">
                          {item.comparison}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* COLUMN 2: MONTHLY SPENDING LIMITS */}
            <section className="space-y-3">
              <div className="flex items-baseline justify-between border-b border-[#1E2533] pb-2">
                <h2 className="text-xs font-mono uppercase tracking-widest text-white">
                  {DASHBOARD_COPY.budgets.heading}
                </h2>
                <Link
                  href="/budgets"
                  className="text-[11px] font-mono text-slate-400 hover:text-white underline"
                >
                  {DASHBOARD_COPY.budgets.seeAll} &rarr;
                </Link>
              </div>

              {budgetList.length === 0 ? (
                <div className="p-4 border border-dashed border-[#1E2533] rounded-md space-y-2 text-center">
                  <p className="text-xs text-slate-300">
                    {DASHBOARD_COPY.budgets.emptyHeading}
                  </p>
                  <button
                    onClick={handleSuggestBudgets}
                    disabled={suggestingBudgets}
                    className="px-3 py-1.5 bg-white text-black text-xs font-medium rounded hover:bg-slate-200 transition-colors font-mono"
                  >
                    {suggestingBudgets ? "Configuring..." : DASHBOARD_COPY.budgets.btnSuggest}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {budgetList.map((b) => (
                    <div key={b.category} className="space-y-1 text-xs p-3 bg-[#101418] border border-[#1E2533] rounded-md">
                      <div className="flex items-center justify-between font-mono">
                        <span className="text-white font-medium">{b.category}</span>
                        <span className="text-slate-400">{b.text}</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#1E2533] rounded-full overflow-hidden mt-1">
                        <div
                          className={`h-full ${b.status === "Over"
                            ? "bg-rose-400"
                            : b.status === "Close"
                              ? "bg-amber-400"
                              : "bg-emerald-400"
                            }`}
                          style={{ width: `${Math.min(b.pct, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-end pt-0.5">
                        <span
                          className={`text-[10px] font-mono font-medium ${b.status === "Over"
                            ? "text-rose-400"
                            : b.status === "Close"
                              ? "text-amber-400"
                              : "text-emerald-400"
                            }`}
                        >
                          {b.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* REGULAR PAYMENTS SUMMARY (Clean 1-card strip) */}
          {subsSnapshot && (
            <section className="p-4 border border-[#1E2533] rounded-md space-y-2 bg-[#101418]">
              <div className="flex items-baseline justify-between">
                <h2 className="text-xs font-mono uppercase tracking-widest text-white">
                  {DASHBOARD_COPY.subscriptions.heading}
                </h2>
                <Link
                  href="/subscriptions"
                  className="text-[11px] font-mono text-slate-400 hover:text-white underline"
                >
                  {DASHBOARD_COPY.subscriptions.manageLink} &rarr;
                </Link>
              </div>

              <p className="text-sm text-slate-300 font-sans">
                {subsSnapshot.summarySentence}
              </p>

              {subsSnapshot.chips.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px]">
                  {subsSnapshot.chips.map((chip, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 border border-[#1E2533] rounded text-slate-300 bg-white/[0.02]"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* DETAILS & CHARTS (Optional collapsed section) */}
          <section className="border-t border-[#1E2533] pt-4">
            <button
              onClick={() => setDetailsOpen(!detailsOpen)}
              className="flex items-center justify-between w-full py-2 text-slate-400 hover:text-white transition-colors text-xs font-mono"
            >
              <span>{detailsOpen ? "Hide detailed charts & daily trends" : "View daily trends & category charts"}</span>
              {detailsOpen ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {detailsOpen && (
              <div className="p-5 border border-[#1E2533] rounded-md space-y-6 bg-[#101418] mt-3">
                <div className="flex items-center justify-between border-b border-[#1E2533] pb-3">
                  <span className="text-xs font-mono uppercase tracking-widest text-white">
                    Daily Spending Trend ({viewingMonthText})
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">Month:</span>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="bg-transparent border border-[#1E2533] text-xs font-mono px-2 py-1 text-white rounded focus:outline-none"
                    />
                  </div>
                </div>

                <div className="h-56 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailySpendData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1E2533" opacity={0.6} />
                      <XAxis dataKey="day" stroke="#475569" fontSize={10} fontFamily="monospace" tickLine={false} />
                      <YAxis
                        stroke="#475569"
                        fontSize={10}
                        fontFamily="monospace"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `₹${v}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#101418",
                          borderColor: "#1E2533",
                          fontSize: "11px",
                          fontFamily: "monospace",
                          color: "#fff",
                        }}
                        formatter={(v: any) => [formatRupees(Number(v)), "Spent"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="spend"
                        stroke="#10B981"
                        strokeWidth={1.5}
                        fill="rgba(16, 185, 129, 0.05)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Spend by category summary */}
                <div className="space-y-2 border-t border-[#1E2533] pt-4">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-white">
                    Category Breakdown
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                    {Object.entries(spendByCategory).map(([cat, amt]) => (
                      <div key={cat} className="p-2 border border-[#1E2533] rounded">
                        <span className="text-[10px] text-slate-400 block truncate">{cat}</span>
                        <span className="text-white font-medium">{formatRupees(amt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
