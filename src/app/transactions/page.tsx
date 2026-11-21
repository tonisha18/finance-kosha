"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sidebar, MobileNav } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import {
  Search,
  Download,
  AlertTriangle,
  Receipt,
  BookOpen,
  Check,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { ALL_CATEGORIES, CategoryName } from "@/lib/categories";

interface Transaction {
  id: string;
  date: string;
  merchant: string;
  raw_description_redacted: string;
  amount: number;
  type: "debit" | "credit";
  category: CategoryName;
  needs_review: boolean;
  category_source: "rule" | "dict" | "llm" | "manual";
  is_recurring: boolean;
  source: string;
}

interface CategoryRule {
  id: string;
  merchant_keyword: string;
  category: CategoryName;
  hit_count: number;
  is_active: boolean;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"all" | "review" | "rules">("all");

  // Inline feedback toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    loadTransactionsAndRules();
  }, []);

  async function loadTransactionsAndRules() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Fetch transactions
    const { data: txs } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false });

    if (txs) setTransactions(txs as Transaction[]);

    // 2. Fetch category rules
    const { data: rls } = await supabase
      .from("category_rules")
      .select("*")
      .eq("user_id", user.id)
      .order("hit_count", { ascending: false });

    if (rls) setRules(rls as CategoryRule[]);

    setLoading(false);
  }

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (activeTab === "review" && !t.needs_review) return false;
      if (selectedCategory !== "all" && t.category !== selectedCategory) return false;
      if (selectedType !== "all" && t.type !== selectedType) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const m = (t.merchant || "").toLowerCase();
        const r = (t.raw_description_redacted || "").toLowerCase();
        if (!m.includes(q) && !r.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, activeTab, selectedCategory, selectedType, search]);

  const handleCategoryChange = async (txId: string, newCat: CategoryName) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const tx = transactions.find((t) => t.id === txId);
    if (!tx) return;

    setTransactions((prev) =>
      prev.map((t) =>
        t.id === txId
          ? { ...t, category: newCat, category_source: "manual", needs_review: false }
          : t
      )
    );

    await supabase
      .from("transactions")
      .update({
        category: newCat,
        category_source: "manual",
        needs_review: false,
      })
      .eq("id", txId);

    showToast(`Updated to ${newCat}. Learning pattern for future imports...`);

    try {
      await fetch("/api/learn-rule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant: tx.merchant,
          category: newCat,
        }),
      });

      const { data: updatedRules } = await supabase
        .from("category_rules")
        .select("*")
        .eq("user_id", user.id)
        .order("hit_count", { ascending: false });

      if (updatedRules) setRules(updatedRules as CategoryRule[]);
    } catch {
      // rule learned silently
    }
  };

  const toggleRule = async (id: string, current: boolean) => {
    const supabase = createClient();
    await supabase.from("category_rules").update({ is_active: !current }).eq("id", id);
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, is_active: !current } : r)));
  };

  const deleteRule = async (id: string) => {
    const supabase = createClient();
    await supabase.from("category_rules").delete().eq("id", id);
    setRules((prev) => prev.filter((r) => r.id !== id));
    showToast("Rule removed.");
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const exportFilteredCSV = () => {
    const headers = ["Date", "Merchant", "Raw Description", "Category", "Amount", "Type", "Source"];
    const rows = filteredTransactions.map((t) => [
      t.date,
      `"${t.merchant.replace(/"/g, '""')}"`,
      `"${(t.raw_description_redacted || "").replace(/"/g, '""')}"`,
      t.category,
      t.amount,
      t.type,
      t.category_source,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `kosha_ledger_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const inrFmt = (n: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(n);
  };

  return (
    <div className="flex min-h-screen bg-[#0A0D12] text-slate-100 font-sans antialiased">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <Header />

        <main className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8">
          {/* Editorial Header */}
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-[#1E2533] pb-6">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-medium tracking-tight text-white">
                  General Ledger
                </h1>
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 border border-[#1E2533] px-2 py-0.5 rounded">
                  {transactions.length} Postings
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Double-entry financial journal &bull; Real-time classification engine
              </p>
            </div>

            <button
              onClick={exportFilteredCSV}
              disabled={filteredTransactions.length === 0}
              className="flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-white transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV &rarr;</span>
            </button>
          </div>

          {/* Toast Notification */}
          {toastMsg && (
            <div className="py-2 border-b border-emerald-500/30 text-xs font-mono text-emerald-400 flex items-center gap-2">
              <Check className="w-3.5 h-3.5" />
              <span>{toastMsg}</span>
            </div>
          )}

          {/* Unboxed Navigation Tabs */}
          <div className="flex border-b border-[#1E2533] gap-6 text-xs font-mono">
            <button
              onClick={() => setActiveTab("all")}
              className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === "all"
                  ? "border-white text-white font-medium"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>All Postings ({transactions.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("review")}
              className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === "review"
                  ? "border-amber-400 text-amber-400 font-medium"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Needs Review ({transactions.filter((t) => t.needs_review).length})</span>
            </button>
            <button
              onClick={() => setActiveTab("rules")}
              className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === "rules"
                  ? "border-white text-white font-medium"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Learned Rules ({rules.length})</span>
            </button>
          </div>

          {/* TAB: Rules Management (Unboxed) */}
          {activeTab === "rules" && (
            <section className="space-y-4">
              <div className="border-b border-[#1E2533] pb-3">
                <h2 className="text-xs font-mono uppercase tracking-widest text-white">
                  Deterministic Classification Overrides
                </h2>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  Rules take absolute priority over built-in dictionary and LLM inferences.
                </p>
              </div>

              {rules.length === 0 ? (
                <div className="py-12 text-center text-xs font-mono text-slate-500">
                  No active category rules. Change any transaction category in the ledger to teach kosha.
                </div>
              ) : (
                <div className="divide-y divide-[#1E2533]/50">
                  {rules.map((rule) => (
                    <div key={rule.id} className="py-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-xs text-white">
                          &quot;{rule.merchant_keyword}&quot;
                        </span>
                        <span className="text-slate-600">&rarr;</span>
                        <span className="font-mono text-xs text-slate-300">
                          {rule.category}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500 tabular-nums">
                          ({rule.hit_count} hits)
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleRule(rule.id, rule.is_active)}
                          className="text-slate-400 hover:text-white"
                        >
                          {rule.is_active ? (
                            <ToggleRight className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <ToggleLeft className="w-5 h-5 text-slate-600" />
                          )}
                        </button>
                        <button
                          onClick={() => deleteRule(rule.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* TAB: General Ledger Table (Completely Unboxed) */}
          {activeTab !== "rules" && (
            <section className="space-y-4">
              {/* Unboxed Filter Controls */}
              <div className="flex flex-col sm:flex-row gap-4 border-b border-[#1E2533] pb-4">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-0 top-2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter people & businesses, notes..."
                    className="w-full pl-6 pr-3 py-1.5 bg-transparent text-xs font-mono text-white placeholder-slate-600 focus:outline-none"
                  />
                </div>

                <div className="flex gap-4 text-xs font-mono">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="bg-transparent text-slate-300 border-b border-[#1E2533] py-1 focus:outline-none focus:border-white"
                  >
                    <option value="all" className="bg-[#0A0D12]">All Categories</option>
                    {ALL_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat} className="bg-[#0A0D12]">
                        {cat}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="bg-transparent text-slate-300 border-b border-[#1E2533] py-1 focus:outline-none focus:border-white"
                  >
                    <option value="all" className="bg-[#0A0D12]">All Types</option>
                    <option value="debit" className="bg-[#0A0D12]">Debits Only</option>
                    <option value="credit" className="bg-[#0A0D12]">Credits Only</option>
                  </select>
                </div>
              </div>

              {/* Pure Open Editorial Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#1E2533] text-[10px] font-mono uppercase tracking-widest text-slate-500">
                      <th className="py-2.5 font-normal">Date</th>
                      <th className="py-2.5 font-normal">Person / Business & Notes</th>
                      <th className="py-2.5 font-normal">Classification</th>
                      <th className="py-2.5 font-normal text-right">Amount</th>
                      <th className="py-2.5 font-normal text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E2533]/50">
                    {filteredTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="py-3 font-mono text-slate-400 whitespace-nowrap text-[11px]">
                          {tx.date}
                        </td>
                        <td className="py-3 pr-4 max-w-sm">
                          <span className="font-medium text-white block">
                            {tx.merchant}
                          </span>
                          {tx.raw_description_redacted && tx.raw_description_redacted !== tx.merchant && (
                            <span className="font-mono text-[10px] text-slate-500 truncate block mt-0.5">
                              {tx.raw_description_redacted}
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          <select
                            value={tx.category}
                            onChange={(e) => handleCategoryChange(tx.id, e.target.value as CategoryName)}
                            className="bg-transparent text-[11px] font-mono text-slate-300 hover:text-white border-b border-transparent hover:border-[#1E2533] focus:outline-none cursor-pointer"
                          >
                            {ALL_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat} className="bg-[#0A0D12]">
                                {cat}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 text-right font-mono tabular-nums whitespace-nowrap text-[12px]">
                          <span className={tx.type === "credit" ? "text-emerald-400 font-medium" : "text-white"}>
                            {tx.type === "credit" ? "+" : "-"}
                            {inrFmt(tx.amount)}
                          </span>
                        </td>
                        <td className="py-3 text-right whitespace-nowrap">
                          {tx.needs_review ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              Review
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-slate-600">Reconciled</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredTransactions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center font-mono text-xs text-slate-500">
                          No transactions found matching the active filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
