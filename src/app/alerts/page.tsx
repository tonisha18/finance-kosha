"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Sidebar, MobileNav } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import {
  Bell,
  CheckCheck,
  Check,
  RefreshCw,
  ArrowRight,
} from "lucide-react";

interface AlertItem {
  id: string;
  alert_type: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "critical";
  dedup_key: string;
  is_read: boolean;
  created_at: string;
}

export default function AlertsPage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const fetchAlerts = async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    let query = supabase
      .from("alerts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (severityFilter !== "all") {
      query = query.eq("severity", severityFilter);
    }
    if (typeFilter !== "all") {
      query = query.eq("alert_type", typeFilter);
    }

    const { data } = await query;
    if (data) {
      setAlerts(data as AlertItem[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAlerts();

    const supabase = createClient();
    const channel = supabase
      .channel("alerts-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts" },
        () => {
          fetchAlerts();
        }
      )
      .subscribe();

    const interval = setInterval(fetchAlerts, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [severityFilter, typeFilter]);

  const handleRecheck = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/alerts/run", { method: "POST" });
      await fetchAlerts();
    } finally {
      setRefreshing(false);
    }
  };

  const markAsRead = async (id: string) => {
    const supabase = createClient();
    await supabase.from("alerts").update({ is_read: true }).eq("id", id);
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, is_read: true } : a)));
  };

  const markAllAsRead = async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("alerts").update({ is_read: true }).eq("user_id", user.id);
    setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
  };

  const getTargetUrl = (type: string) => {
    switch (type) {
      case "price_hike":
      case "new_subscription":
      case "upcoming_renewal":
      case "missing_charge":
        return "/subscriptions";
      case "budget_drift":
        return "/budgets";
      case "goal_risk":
        return "/planner";
      case "anomaly":
        return "/transactions";
      default:
        return "/alerts";
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase text-rose-400">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            Critical
          </span>
        );
      case "warning":
        return (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Warning
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            Info
          </span>
        );
    }
  };

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  return (
    <div className="flex min-h-screen bg-[#0A0D12] text-slate-100 font-sans antialiased">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <Header />
        <main className="p-6 md:p-10 max-w-6xl mx-auto w-full space-y-8">
          {/* Editorial Header */}
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-[#1E2533] pb-6">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-medium tracking-tight text-white">
                  Surveillance & Anomaly Log
                </h1>
                {unreadCount > 0 && (
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded text-amber-400 font-semibold tabular-nums border border-amber-500/30">
                    {unreadCount} UNRESOLVED
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Continuous audit: budget drift, contract price hikes, anomalous charges
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}

              <button
                onClick={handleRecheck}
                disabled={refreshing}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                <span>{refreshing ? "Scanning ledger..." : "Re-check Now &rarr;"}</span>
              </button>
            </div>
          </div>

          {/* Unboxed Filter Row */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1E2533] pb-4 text-xs font-mono">
            <div className="flex items-center gap-4">
              <span className="text-[10px] uppercase tracking-widest text-slate-500">Severity:</span>
              <div className="flex items-center gap-3">
                {["all", "critical", "warning", "info"].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(sev)}
                    className={`capitalize transition-colors ${
                      severityFilter === sev
                        ? "text-white font-medium underline"
                        : "text-slate-500 hover:text-white"
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-slate-500">Classification:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-transparent text-slate-300 border-b border-[#1E2533] py-1 focus:outline-none focus:border-white"
              >
                <option value="all" className="bg-[#0A0D12]">All Classifications</option>
                <option value="price_hike" className="bg-[#0A0D12]">Price Hikes</option>
                <option value="budget_drift" className="bg-[#0A0D12]">Budget Drift</option>
                <option value="new_subscription" className="bg-[#0A0D12]">New Subscriptions</option>
                <option value="upcoming_renewal" className="bg-[#0A0D12]">Upcoming Renewals</option>
                <option value="missing_charge" className="bg-[#0A0D12]">Missing Charges</option>
                <option value="anomaly" className="bg-[#0A0D12]">Anomalies</option>
                <option value="goal_risk" className="bg-[#0A0D12]">Goal Risk</option>
              </select>
            </div>
          </div>

          {/* UNBOXED ALERTS LOG */}
          {loading ? (
            <div className="py-12 border-b border-[#1E2533] text-center font-mono text-xs text-slate-500 animate-pulse">
              Loading anomaly journal...
            </div>
          ) : alerts.length === 0 ? (
            <div className="py-16 border-b border-[#1E2533] text-center space-y-2">
              <h3 className="text-sm font-medium text-white font-mono uppercase tracking-wider">
                All Audits Clear
              </h3>
              <p className="text-xs text-slate-500 font-mono max-w-sm mx-auto">
                Ledger telemetry is nominal. No budget deviations or pricing spikes detected.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#1E2533]/50">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`py-4 transition-colors flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 ${
                    !alert.is_read ? "opacity-100" : "opacity-70 hover:opacity-100"
                  }`}
                >
                  <div className="space-y-1.5 flex-1 min-w-0 pr-4">
                    <div className="flex flex-wrap items-center gap-3">
                      {getSeverityBadge(alert.severity)}
                      <h3 className="text-xs font-semibold text-white tracking-tight">
                        {alert.title}
                      </h3>
                      <span className="font-mono text-[10px] text-slate-500 tabular-nums">
                        {new Date(alert.created_at).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed max-w-3xl font-mono">
                      {alert.body}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 font-mono text-xs">
                    {!alert.is_read && (
                      <button
                        onClick={() => markAsRead(alert.id)}
                        className="text-slate-400 hover:text-white transition-colors"
                      >
                        Acknowledge
                      </button>
                    )}

                    <button
                      onClick={() => router.push(getTargetUrl(alert.alert_type))}
                      className="text-white hover:underline transition-colors flex items-center gap-1"
                    >
                      <span>Inspect</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
