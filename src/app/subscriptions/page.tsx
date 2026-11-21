"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sidebar, MobileNav } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import {
  AlertTriangle,
  Plus,
  Trash2,
  Calendar,
  X,
  CreditCard,
} from "lucide-react";
import { ALL_CATEGORIES, CategoryName } from "@/lib/categories";

interface Subscription {
  id: string;
  merchant: string;
  amount: number;
  frequency: "weekly" | "monthly" | "quarterly" | "yearly";
  category: CategoryName;
  status: "active" | "cancelled" | "unused";
  first_seen_date: string;
  last_charge_date: string;
  next_expected_date: string;
  price_hike: boolean;
  previous_amount?: number;
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<"all" | "active" | "hikes" | "unused" | "cancelled">("all");

  // Add Subscription Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMerchant, setNewMerchant] = useState("");
  const [newAmount, setNewAmount] = useState<number>(500);
  const [newFrequency, setNewFrequency] = useState<"monthly" | "yearly" | "quarterly">("monthly");
  const [newCategory, setNewCategory] = useState<CategoryName>("Entertainment & Subscriptions");
  const [newNextDate, setNewNextDate] = useState("");

  useEffect(() => {
    setNewNextDate(new Date().toISOString().slice(0, 10));
    loadSubscriptions();
  }, []);

  async function loadSubscriptions() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .order("next_expected_date", { ascending: true });

    if (data) {
      setSubscriptions(data as Subscription[]);
    }
    setLoading(false);
  }

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMerchant.trim() || !newAmount) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase.from("subscriptions").insert({
      user_id: user.id,
      merchant: newMerchant,
      amount: newAmount,
      frequency: newFrequency,
      category: newCategory,
      status: "active",
      first_seen_date: today,
      last_charge_date: today,
      next_expected_date: newNextDate,
      price_hike: false,
    }).select().single();

    if (!error && data) {
      setSubscriptions((prev) => [...prev, data as Subscription]);
      setShowAddModal(false);
      setNewMerchant("");
      setNewAmount(500);
    }
  };

  const updateStatus = async (id: string, status: "active" | "cancelled" | "unused") => {
    const supabase = createClient();
    await supabase.from("subscriptions").update({ status }).eq("id", id);
    setSubscriptions((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  };

  const deleteSubscription = async (id: string) => {
    const supabase = createClient();
    await supabase.from("subscriptions").delete().eq("id", id);
    setSubscriptions((prev) => prev.filter((s) => s.id !== id));
  };

  // Metrics
  const activeSubs = useMemo(() => subscriptions.filter((s) => s.status === "active"), [subscriptions]);
  const hikeSubs = useMemo(() => subscriptions.filter((s) => s.price_hike), [subscriptions]);

  const totalMonthlyCommitment = useMemo(() => {
    return Math.round(
      activeSubs.reduce((sum, s) => {
        const amt = Number(s.amount);
        if (s.frequency === "yearly") return sum + amt / 12;
        if (s.frequency === "quarterly") return sum + amt / 3;
        if (s.frequency === "weekly") return sum + amt * 4.33;
        return sum + amt;
      }, 0)
    );
  }, [activeSubs]);

  const totalYearlyCommitment = totalMonthlyCommitment * 12;

  const unusedSavings = useMemo(() => {
    return subscriptions
      .filter((s) => s.status === "unused")
      .reduce((sum, s) => sum + Number(s.amount) * 12, 0);
  }, [subscriptions]);

  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((s) => {
      if (filterTab === "active") return s.status === "active";
      if (filterTab === "hikes") return s.price_hike;
      if (filterTab === "unused") return s.status === "unused";
      if (filterTab === "cancelled") return s.status === "cancelled";
      return true;
    });
  }, [subscriptions, filterTab]);

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

        <main className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-[#1E2533] pb-6">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-medium tracking-tight text-white">
                  Recurring Commitments & Contracts
                </h1>
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 border border-[#1E2533] px-2 py-0.5 rounded">
                  {activeSubs.length} Active
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Cadence surveillance &bull; Inflation watchdog &bull; Renewal pipeline
              </p>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register Contract &rarr;</span>
            </button>
          </div>

          {/* Price Hike Warning Banner (Unboxed) */}
          {hikeSubs.length > 0 && (
            <div className="py-2.5 border-y border-amber-500/30 flex items-center justify-between gap-4 text-xs font-mono">
              <div className="flex items-center gap-2 text-slate-300">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong className="text-amber-400 uppercase font-semibold">
                    {hikeSubs.length} Contract Price Hike{hikeSubs.length > 1 ? "s" : ""} Detected:
                  </strong>
                  {hikeSubs.map((h) => {
                    const diff = Number(h.amount) - Number(h.previous_amount);
                    return ` ${h.merchant} (+${inrFmt(diff)}/mo);`;
                  })}
                </span>
              </div>
              <button
                onClick={() => setFilterTab("hikes")}
                className="text-amber-400 hover:underline shrink-0"
              >
                Inspect hikes &rarr;
              </button>
            </div>
          )}

          {/* UNBOXED HORIZONTAL METRIC STRIP */}
          <section className="border-y border-[#1E2533] py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#1E2533]">
              <div className="px-4 py-2 sm:first:pl-0">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block">
                  Monthly Commitment
                </span>
                <span className="text-xl md:text-2xl font-mono tabular-nums font-medium text-white mt-1 block">
                  {inrFmt(totalMonthlyCommitment)}
                </span>
                <span className="text-[10px] font-mono text-slate-500 mt-1.5 block">
                  Across {activeSubs.length} services
                </span>
              </div>

              <div className="px-4 py-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block">
                  Annualized Burn
                </span>
                <span className="text-xl md:text-2xl font-mono tabular-nums font-medium text-white mt-1 block">
                  {inrFmt(totalYearlyCommitment)}
                </span>
                <span className="text-[10px] font-mono text-slate-500 mt-1.5 block">Projected 12-mo run-rate</span>
              </div>

              <div className="px-4 py-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 block">
                  Recoverable Capital
                </span>
                <span className="text-xl md:text-2xl font-mono tabular-nums font-medium text-emerald-400 mt-1 block">
                  {inrFmt(unusedSavings)}/yr
                </span>
                <span className="text-[10px] font-mono text-slate-500 mt-1.5 block">
                  {subscriptions.filter((s) => s.status === "unused").length} marked unused
                </span>
              </div>

              <div className="px-4 py-2 sm:last:pr-0">
                <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 block">
                  Inflation Watchdog
                </span>
                <span className="text-xl md:text-2xl font-mono tabular-nums font-medium text-white mt-1 block">
                  {hikeSubs.length} Hikes
                </span>
                <span className="text-[10px] font-mono text-slate-500 mt-1.5 block">Price variance triggered</span>
              </div>
            </div>
          </section>

          {/* Filter Tabs (Unboxed) */}
          <div className="flex border-b border-[#1E2533] gap-6 text-xs font-mono">
            <button
              onClick={() => setFilterTab("all")}
              className={`pb-3 border-b-2 transition-colors ${filterTab === "all"
                ? "border-white text-white font-medium"
                : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
            >
              All ({subscriptions.length})
            </button>
            <button
              onClick={() => setFilterTab("active")}
              className={`pb-3 border-b-2 transition-colors ${filterTab === "active"
                ? "border-white text-white font-medium"
                : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
            >
              Active ({activeSubs.length})
            </button>
            <button
              onClick={() => setFilterTab("hikes")}
              className={`pb-3 border-b-2 transition-colors ${filterTab === "hikes"
                ? "border-amber-400 text-amber-400 font-medium"
                : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
            >
              Price Hikes ({hikeSubs.length})
            </button>
            <button
              onClick={() => setFilterTab("unused")}
              className={`pb-3 border-b-2 transition-colors ${filterTab === "unused"
                ? "border-white text-white font-medium"
                : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
            >
              Unused ({subscriptions.filter((s) => s.status === "unused").length})
            </button>
            <button
              onClick={() => setFilterTab("cancelled")}
              className={`pb-3 border-b-2 transition-colors ${filterTab === "cancelled"
                ? "border-white text-white font-medium"
                : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
            >
              Cancelled ({subscriptions.filter((s) => s.status === "cancelled").length})
            </button>
          </div>

          {/* DENSE INSTITUTIONAL SUBSCRIPTIONS TABLE (Unboxed) */}
          <section className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#1E2533] text-[10px] font-mono uppercase tracking-widest text-slate-500">
                    <th className="py-2.5 font-normal">Person / Business</th>
                    <th className="py-2.5 font-normal text-right">Debit Rate</th>
                    <th className="py-2.5 font-normal">Cadence</th>
                    <th className="py-2.5 font-normal">Next Renewal</th>
                    <th className="py-2.5 font-normal">Status</th>
                    <th className="py-2.5 font-normal text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2533]/50">
                  {filteredSubscriptions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 font-medium text-white">
                        <div className="flex items-center gap-2">
                          <span>{sub.merchant}</span>
                          {sub.price_hike && (
                            <span className="text-[10px] font-mono text-amber-400">
                              (+{inrFmt(Number(sub.amount) - Number(sub.previous_amount))})
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 block mt-0.5">
                          {sub.category}
                        </span>
                      </td>
                      <td className="py-3 text-right font-mono tabular-nums text-white text-[12px]">
                        {inrFmt(sub.amount)}
                      </td>
                      <td className="py-3 font-mono text-slate-400 capitalize text-[11px]">
                        {sub.frequency}
                      </td>
                      <td className="py-3 font-mono text-slate-400 text-[11px]">
                        {sub.next_expected_date || "—"}
                      </td>
                      <td className="py-3">
                        <select
                          value={sub.status}
                          onChange={(e) => updateStatus(sub.id, e.target.value as any)}
                          className="bg-transparent text-[11px] font-mono text-slate-300 hover:text-white border-b border-transparent hover:border-[#1E2533] focus:outline-none cursor-pointer capitalize"
                        >
                          <option value="active" className="bg-[#0A0D12]">Active</option>
                          <option value="unused" className="bg-[#0A0D12]">Unused</option>
                          <option value="cancelled" className="bg-[#0A0D12]">Cancelled</option>
                        </select>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => deleteSubscription(sub.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredSubscriptions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center font-mono text-xs text-slate-500">
                        No recurring contracts recorded under this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Add Subscription Modal */}
          {showAddModal && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#101418] border border-[#1E2533] p-6 max-w-md w-full space-y-4">
                <div className="flex items-center justify-between border-b border-[#1E2533] pb-3">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-white">
                    REGISTER RECURRING CONTRACT
                  </h3>
                  <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                    &times;
                  </button>
                </div>

                <form onSubmit={handleCreateSubscription} className="space-y-4 font-mono text-xs">
                  <div>
                    <label className="text-[10px] uppercase text-slate-400 block mb-1">
                      Person or Business
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. AWS Cloud, Bloomberg, Netflix"
                      value={newMerchant}
                      onChange={(e) => setNewMerchant(e.target.value)}
                      className="w-full bg-transparent border-b border-[#1E2533] py-1 text-white focus:outline-none focus:border-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase text-slate-400 block mb-1">
                        Amount (₹)
                      </label>
                      <input
                        type="number"
                        required
                        value={newAmount}
                        onChange={(e) => setNewAmount(Number(e.target.value))}
                        className="w-full bg-transparent border-b border-[#1E2533] py-1 text-white focus:outline-none focus:border-white tabular-nums"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase text-slate-400 block mb-1">
                        Cadence
                      </label>
                      <select
                        value={newFrequency}
                        onChange={(e) => setNewFrequency(e.target.value as any)}
                        className="w-full bg-transparent border-b border-[#1E2533] py-1 text-white focus:outline-none focus:border-white"
                      >
                        <option value="monthly" className="bg-[#0A0D12]">Monthly</option>
                        <option value="quarterly" className="bg-[#0A0D12]">Quarterly</option>
                        <option value="yearly" className="bg-[#0A0D12]">Yearly</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase text-slate-400 block mb-1">
                      Next Renewal Date
                    </label>
                    <input
                      type="date"
                      required
                      value={newNextDate}
                      onChange={(e) => setNewNextDate(e.target.value)}
                      className="w-full bg-transparent border-b border-[#1E2533] py-1 text-white focus:outline-none focus:border-white"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t border-[#1E2533]">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-white text-black font-medium hover:bg-slate-200 transition-colors"
                    >
                      Save Contract
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
