"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sidebar, MobileNav } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { ALL_CATEGORIES, CategoryName } from "@/lib/categories";
import {
  Sparkles,
  Trash2,
} from "lucide-react";

interface Budget {
  id?: string;
  category: CategoryName;
  monthly_limit: number;
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [spendStats, setSpendStats] = useState<Record<string, { spent: number; projected: number }>>({});
  const [suggestedBudgets, setSuggestedBudgets] = useState<Budget[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form for adding/editing a budget
  const [selectedCat, setSelectedCat] = useState<CategoryName>("Food & Dining");
  const [limitInput, setLimitInput] = useState<string>("10000");

  useEffect(() => {
    loadBudgetsAndSpend();
  }, []);

  async function loadBudgetsAndSpend() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Fetch budgets
    const { data: bData } = await supabase
      .from("category_budgets")
      .select("*")
      .eq("user_id", user.id);

    if (bData) setBudgets(bData as Budget[]);

    // 2. Fetch current month transactions to compute spent & projected run rate
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const daysElapsed = Math.max(1, now.getDate());
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const { data: txs } = await supabase
      .from("transactions")
      .select("category, amount, type, date")
      .eq("user_id", user.id)
      .gte("date", `${currentMonthStr}-01`);

    const statsMap: Record<string, { spent: number; projected: number }> = {};
    if (txs) {
      for (const t of txs) {
        if (t.type === "debit") {
          if (!statsMap[t.category]) statsMap[t.category] = { spent: 0, projected: 0 };
          statsMap[t.category].spent += Number(t.amount);
        }
      }
      for (const cat in statsMap) {
        const spent = statsMap[cat].spent;
        statsMap[cat].projected = Math.round((spent / daysElapsed) * daysInMonth);
      }
    }
    setSpendStats(statsMap);
    setLoading(false);
  }

  // Suggest budgets from last 3 months average + 10%
  const handleSuggestBudgets = async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const { data: txs } = await supabase
      .from("transactions")
      .select("category, amount, type")
      .eq("user_id", user.id)
      .gte("date", threeMonthsAgo.toISOString().slice(0, 10));

    const threeMonthTotals: Record<string, number> = {};
    if (txs) {
      for (const t of txs) {
        if (t.type === "debit") {
          threeMonthTotals[t.category] = (threeMonthTotals[t.category] || 0) + Number(t.amount);
        }
      }
    }

    const proposed: Budget[] = [];
    for (const cat of ALL_CATEGORIES) {
      if (cat === "Income/Salary" || cat === "Transfers") continue;
      const total = threeMonthTotals[cat] || 0;
      const avg = total / 3;
      const rounded = Math.max(1000, Math.round((avg * 1.1) / 500) * 500);
      proposed.push({
        category: cat,
        monthly_limit: rounded,
      });
    }

    setSuggestedBudgets(proposed);
  };

  const handleApplyAllSuggestions = async () => {
    if (!suggestedBudgets) return;
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    for (const b of suggestedBudgets) {
      await supabase.from("category_budgets").upsert(
        {
          user_id: user.id,
          category: b.category,
          monthly_limit: b.monthly_limit,
        },
        { onConflict: "user_id,category" }
      );
    }

    await loadBudgetsAndSpend();
    setSuggestedBudgets(null);
    setSaving(false);
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(limitInput);
    if (isNaN(val) || val <= 0) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("category_budgets").upsert(
      {
        user_id: user.id,
        category: selectedCat,
        monthly_limit: val,
      },
      { onConflict: "user_id,category" }
    );

    await loadBudgetsAndSpend();
  };

  const handleDeleteBudget = async (category: string) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("category_budgets")
      .delete()
      .eq("user_id", user.id)
      .eq("category", category);

    setBudgets((prev) => prev.filter((b) => b.category !== category));
  };

  const inrFmt = (n: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n);
  };

  return (
    <div className="flex min-h-screen bg-[#0A0D12] text-slate-100 font-sans antialiased">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <Header />

        <main className="p-6 md:p-10 max-w-6xl mx-auto w-full space-y-8">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-[#1E2533] pb-6">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-medium tracking-tight text-white">
                  Monthly Spending Limits
                </h1>
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 border border-[#1E2533] px-2 py-0.5 rounded">
                  {budgets.length} Configured
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Monthly limits &bull; 80% cautionary pacing &bull; alerts when spending increased
              </p>
            </div>

            <button
              onClick={handleSuggestBudgets}
              className="flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-white transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Calibrate from 90-Day Trend &rarr;</span>
            </button>
          </div>

          {/* AI Proposed Budgets Section (Unboxed) */}
          {suggestedBudgets && (
            <section className="space-y-4 border-b border-[#1E2533] pb-6">
              <div className="flex items-baseline justify-between">
                <div>
                  <h2 className="text-xs font-mono uppercase tracking-widest text-white">
                    Suggested Budget Allocations (Baseline + 10%)
                  </h2>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    Calculated from historical trailing burn rate.
                  </p>
                </div>
                <div className="flex gap-4 text-xs font-mono">
                  <button
                    onClick={handleApplyAllSuggestions}
                    disabled={saving}
                    className="text-white hover:underline font-medium"
                  >
                    {saving ? "Applying..." : "Accept All"}
                  </button>
                  <button
                    onClick={() => setSuggestedBudgets(null)}
                    className="text-slate-500 hover:text-white"
                  >
                    Dismiss
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 pt-2">
                {suggestedBudgets.map((sb) => (
                  <div key={sb.category} className="space-y-1">
                    <span className="text-[10px] font-mono text-slate-500 truncate block">
                      {sb.category.split(" ")[0]}
                    </span>
                    <span className="text-sm font-mono tabular-nums text-white block">
                      {inrFmt(sb.monthly_limit)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Add / Edit Budget Inline Bar (Unboxed) */}
          <form
            onSubmit={handleSaveBudget}
            className="flex flex-col sm:flex-row gap-4 items-baseline justify-between border-b border-[#1E2533] pb-4"
          >
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto flex-1 font-mono text-xs">
              <select
                value={selectedCat}
                onChange={(e) => setSelectedCat(e.target.value as CategoryName)}
                className="bg-transparent text-white border-b border-[#1E2533] py-1 focus:outline-none focus:border-white"
              >
                {ALL_CATEGORIES.filter((c) => c !== "Income/Salary" && c !== "Transfers").map((cat) => (
                  <option key={cat} value={cat} className="bg-[#0A0D12]">
                    {cat}
                  </option>
                ))}
              </select>

              <input
                type="number"
                min="500"
                step="500"
                value={limitInput}
                onChange={(e) => setLimitInput(e.target.value)}
                placeholder="Monthly Limit (INR)"
                className="bg-transparent text-white border-b border-[#1E2533] py-1 px-1 focus:outline-none focus:border-white w-full sm:w-48 tabular-nums"
              />
            </div>

            <button
              type="submit"
              className="px-3 py-1 bg-white text-black text-xs font-mono font-medium rounded hover:bg-slate-200 transition-colors"
            >
              Set Limit
            </button>
          </form>

          {/* DENSE INSTITUTIONAL BUDGET TABLE (Unboxed) */}
          <section className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#1E2533] text-[10px] font-mono uppercase tracking-widest text-slate-500">
                    <th className="py-2.5 font-normal">Category</th>
                    <th className="py-2.5 font-normal text-right">Monthly Limit</th>
                    <th className="py-2.5 font-normal text-right">Actual Spend</th>
                    <th className="py-2.5 font-normal w-48">Pacing Trajectory</th>
                    <th className="py-2.5 font-normal text-right">Projected End</th>
                    <th className="py-2.5 font-normal text-right">Drift Risk</th>
                    <th className="py-2.5 font-normal text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2533]/50">
                  {budgets.map((b) => {
                    const stats = spendStats[b.category] || { spent: 0, projected: 0 };
                    const pct = Math.round((stats.spent / b.monthly_limit) * 100);
                    const isExceeded = pct >= 100;
                    const isWarning = pct >= 80 && pct < 100;

                    return (
                      <tr key={b.category} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 font-medium text-white">
                          {b.category}
                        </td>
                        <td className="py-3 text-right font-mono tabular-nums text-slate-400">
                          {inrFmt(b.monthly_limit)}
                        </td>
                        <td className="py-3 text-right font-mono tabular-nums text-white font-medium">
                          {inrFmt(stats.spent)}
                        </td>
                        <td className="py-3">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-mono text-slate-500">
                              <span>{pct}%</span>
                              <span>{inrFmt(Math.max(0, b.monthly_limit - stats.spent))} left</span>
                            </div>
                            <div className="w-full h-1 bg-[#1E2533] overflow-hidden">
                              <div
                                className={`h-full ${
                                  isExceeded
                                    ? "bg-rose-400"
                                    : isWarning
                                    ? "bg-amber-400"
                                    : "bg-emerald-400"
                                }`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 text-right font-mono tabular-nums text-slate-400">
                          {inrFmt(stats.projected)}
                        </td>
                        <td className="py-3 text-right whitespace-nowrap">
                          {isExceeded ? (
                            <span className="text-[10px] font-mono text-rose-400">
                              EXCEEDED
                            </span>
                          ) : isWarning ? (
                            <span className="text-[10px] font-mono text-amber-400">
                              80% DRIFT
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-emerald-400">
                              NOMINAL
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleDeleteBudget(b.category)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {budgets.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center font-mono text-xs text-slate-500">
                        No monthly budgets configured. Use the form above to initialize limits.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
