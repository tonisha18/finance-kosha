"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Sidebar, MobileNav } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import {
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [monthlyIncome, setMonthlyIncome] = useState(90000);
  const [emergencyTarget, setEmergencyTarget] = useState(250000);
  const [emergencyBalance, setEmergencyBalance] = useState(100000);
  const [dependents, setDependents] = useState(0);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [demoStatus, setDemoStatus] = useState<string | null>(null);

  // Danger modal state
  const [dangerAction, setDangerAction] = useState<"clear_data" | "delete_account" | null>(null);
  const [confirmInput, setConfirmInput] = useState("");
  const [dangerLoading, setDangerLoading] = useState(false);
  const [dangerError, setDangerError] = useState<string | null>(null);

  const demoModeEnabled = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email || "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();

      if (profile?.display_name) {
        setDisplayName(profile.display_name);
      }

      const { data: finProf } = await supabase
        .from("financial_profile")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (finProf) {
        setMonthlyIncome(Number(finProf.monthly_income || 90000));
        setEmergencyTarget(Number(finProf.emergency_fund_target || 250000));
        setEmergencyBalance(Number(finProf.emergency_fund_balance || 0));
        setDependents(Number(finProf.dependents || 0));
      }
    }

    loadProfile();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("profiles").upsert({ id: user.id, display_name: displayName });

    await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        monthly_income: monthlyIncome,
        emergency_fund_target: emergencyTarget,
        emergency_fund_balance: emergencyBalance,
        dependents,
      }),
    });

    setLoading(false);
    setMessage("Parameters synchronized with ledger model.");
    setTimeout(() => setMessage(null), 4000);
  };

  const handleDemoAction = async (action: "load" | "clear") => {
    setDemoStatus(action === "load" ? "Seeding 6 months demo data & alerts..." : "Clearing demo data...");

    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (res.ok) {
        setDemoStatus(data.message);
        setTimeout(() => setDemoStatus(null), 4000);
      } else {
        setDemoStatus(data.error || "Failed");
      }
    } catch {
      setDemoStatus("Error executing sandbox operation");
    }
  };

  const handleExecuteDanger = async () => {
    if (confirmInput !== "DELETE" || !dangerAction) return;
    setDangerLoading(true);
    setDangerError(null);

    try {
      const res = await fetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: dangerAction,
          confirmation: "DELETE",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setDangerAction(null);
        if (dangerAction === "delete_account") {
          const supabase = createClient();
          await supabase.auth.signOut();
          router.push("/signup");
        } else {
          setMessage("All personal ledger records purged.");
          setTimeout(() => setMessage(null), 4000);
        }
      } else {
        setDangerError(data.error || "Purge operation failed");
      }
    } catch {
      setDangerError("Server error executing request");
    } finally {
      setDangerLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0A0D12] text-slate-100 font-sans antialiased">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <Header />
        <main className="p-6 md:p-10 max-w-4xl mx-auto w-full space-y-12">
          {/* Header */}
          <div className="border-b border-[#1E2533] pb-6">
            <h1 className="text-2xl md:text-3xl font-medium tracking-tight text-white">
              Parameters & Governance
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Baseline assumptions &bull; Session identity &bull; Ledger lifecycle
            </p>
          </div>

          {message && (
            <div className="py-2 border-b border-emerald-500/30 text-emerald-400 flex items-center gap-2 text-xs font-mono">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{message}</span>
            </div>
          )}

          {/* Living Financial Parameters (Unboxed) */}
          <section className="space-y-6 border-b border-[#1E2533] pb-10">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xs font-mono uppercase tracking-widest text-white">
                My Money Details
              </h2>
              <span className="font-mono text-[10px] text-slate-500 uppercase">
                Snapshot Versioning Active
              </span>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-6 font-mono text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div>
                  <label className="block text-[10px] uppercase text-slate-500 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-transparent border-b border-[#1E2533] py-1.5 text-white focus:outline-none focus:border-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-slate-500 mb-1">
                    Authentication Principal
                  </label>
                  <input
                    type="email"
                    disabled
                    value={email}
                    className="w-full bg-transparent border-b border-[#1E2533] py-1.5 text-slate-600 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-slate-500 mb-1">
                    Net Monthly Cash Inflow (₹)
                  </label>
                  <input
                    type="number"
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(Number(e.target.value))}
                    className="w-full bg-transparent border-b border-[#1E2533] py-1.5 text-white focus:outline-none focus:border-white tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-slate-500 mb-1">
                    Reserve Liquidity Balance (₹)
                  </label>
                  <input
                    type="number"
                    value={emergencyBalance}
                    onChange={(e) => setEmergencyBalance(Number(e.target.value))}
                    className="w-full bg-transparent border-b border-[#1E2533] py-1.5 text-white focus:outline-none focus:border-white tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-slate-500 mb-1">
                    Target Reserve Capital (₹)
                  </label>
                  <input
                    type="number"
                    value={emergencyTarget}
                    onChange={(e) => setEmergencyTarget(Number(e.target.value))}
                    className="w-full bg-transparent border-b border-[#1E2533] py-1.5 text-white focus:outline-none focus:border-white tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-slate-500 mb-1">
                    Financial Dependents
                  </label>
                  <input
                    type="number"
                    value={dependents}
                    onChange={(e) => setDependents(Number(e.target.value))}
                    className="w-full bg-transparent border-b border-[#1E2533] py-1.5 text-white focus:outline-none focus:border-white tabular-nums"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-white text-black text-xs font-medium rounded hover:bg-slate-200 transition-colors"
                >
                  {loading ? "Persisting..." : "Save Parameters"}
                </button>
              </div>
            </form>
          </section>

          {/* Demo Sandbox Controls (Unboxed) */}
          {demoModeEnabled && (
            <section className="space-y-4 border-b border-[#1E2533] pb-10">
              <div className="flex items-baseline justify-between">
                <h2 className="text-xs font-mono uppercase tracking-widest text-white">
                  Simulation Suite
                </h2>
                <span className="font-mono text-[10px] text-amber-400">
                  SANDBOX
                </span>
              </div>

              <p className="text-xs text-slate-400 font-mono leading-relaxed">
                Seed simulated multi-month financial streams (UPI, recurring SaaS, price variance, and budget drift) for stress testing.
              </p>

              {demoStatus && (
                <p className="text-xs font-mono text-slate-300 py-1 border-b border-[#1E2533]">
                  {demoStatus}
                </p>
              )}

              <div className="flex items-center gap-4 text-xs font-mono pt-2">
                <button
                  onClick={() => handleDemoAction("load")}
                  className="text-white hover:underline font-medium"
                >
                  Seed 6-Month Dataset &rarr;
                </button>
                <button
                  onClick={() => handleDemoAction("clear")}
                  className="text-slate-500 hover:text-white"
                >
                  Purge Simulation Data
                </button>
              </div>
            </section>
          )}

          {/* Data & Privacy Controls (Unboxed) */}
          <section className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xs font-mono uppercase tracking-widest text-rose-400">
                Data Purge & Governance
              </h2>
              <span className="font-mono text-[10px] text-rose-500">
                IRREVERSIBLE
              </span>
            </div>

            <p className="text-xs text-slate-500 font-mono leading-relaxed">
              Permanently wipe all financial ledger transactions, extracted subscriptions, budget histories, or your cryptographic identity.
            </p>

            <div className="flex items-center gap-6 pt-2 font-mono text-xs">
              <button
                onClick={() => {
                  setDangerAction("clear_data");
                  setConfirmInput("");
                }}
                className="text-rose-400 hover:underline"
              >
                Purge All Financial Data &rarr;
              </button>

              <button
                onClick={() => {
                  setDangerAction("delete_account");
                  setConfirmInput("");
                }}
                className="text-slate-500 hover:text-rose-400"
              >
                Delete Account
              </button>
            </div>
          </section>

          {/* Confirmation Danger Modal */}
          {dangerAction && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#101418] border border-rose-500/40 p-6 max-w-md w-full space-y-4">
                <div className="flex items-center justify-between border-b border-[#1E2533] pb-3">
                  <div className="flex items-center gap-2 text-rose-400 font-mono text-xs uppercase tracking-widest">
                    <AlertTriangle className="w-4 h-4" />
                    <span>
                      {dangerAction === "clear_data" ? "CONFIRM DATA PURGE" : "CONFIRM ACCOUNT DELETION"}
                    </span>
                  </div>
                  <button onClick={() => setDangerAction(null)} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-slate-400 font-mono leading-relaxed">
                  {dangerAction === "clear_data"
                    ? "Cascade deletion across transactions, subscriptions, budgets, scenarios, and reports. Ledger recovery is impossible."
                    : "Terminates your identity and removes all linked data across all clusters. This cannot be undone."}
                </p>

                <div>
                  <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                    Type <span className="text-rose-400 font-bold">DELETE</span> to confirm:
                  </label>
                  <input
                    type="text"
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    placeholder="DELETE"
                    className="w-full text-xs font-mono bg-transparent border-b border-rose-500/50 py-1.5 text-rose-400 focus:outline-none"
                  />
                </div>

                {dangerError && <p className="text-xs text-rose-400 font-mono">{dangerError}</p>}

                <div className="flex justify-end gap-3 pt-3 border-t border-[#1E2533] font-mono text-xs">
                  <button
                    onClick={() => setDangerAction(null)}
                    className="text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={confirmInput !== "DELETE" || dangerLoading}
                    onClick={handleExecuteDanger}
                    className="text-rose-400 hover:underline disabled:opacity-30"
                  >
                    {dangerLoading ? "Purging..." : "Execute Purge"}
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
