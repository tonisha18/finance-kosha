"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { AlertTriangle, AlertCircle, Info, RefreshCw, X, ArrowRight } from "lucide-react";

interface StripAlert {
  id: string;
  alert_type: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "critical";
  is_read: boolean;
}

export function AlertsStrip() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<StripAlert[]>([]);
  const [rechecking, setRechecking] = useState(false);

  const fetchAlerts = async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Trigger check if last run > 6 hours ago
    const lastRunKey = `last_alert_run_${user.id}`;
    const lastRun = localStorage.getItem(lastRunKey);
    const now = Date.now();
    if (!lastRun || now - Number(lastRun) > 6 * 60 * 60 * 1000) {
      localStorage.setItem(lastRunKey, String(now));
      fetch("/api/alerts/run", { method: "POST" }).catch(() => {});
    }

    const { data } = await supabase
      .from("alerts")
      .select("id, alert_type, title, body, severity, is_read")
      .eq("user_id", user.id)
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(3);

    if (data) {
      setAlerts(data as StripAlert[]);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRecheck = async () => {
    setRechecking(true);
    try {
      await fetch("/api/alerts/run", { method: "POST" });
      await fetchAlerts();
    } finally {
      setRechecking(false);
    }
  };

  const dismissAlert = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const supabase = createClient();
    await supabase.from("alerts").update({ is_read: true }).eq("id", id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
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

  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 space-y-2.5">
      {alerts.map((alert) => {
        const isCrit = alert.severity === "critical";
        const isWarn = alert.severity === "warning";

        return (
          <div
            key={alert.id}
            onClick={() => router.push(getTargetUrl(alert.alert_type))}
            className={`cursor-pointer rounded-xl p-4 transition-all flex items-start justify-between gap-4 border shadow-sm ${
              isCrit
                ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900 text-[#0F172A] dark:text-white"
                : isWarn
                ? "bg-[#F8FAFC] dark:bg-[#1E293B] border-[#E5E7EB] dark:border-[#334155] text-[#0F172A] dark:text-white"
                : "bg-white dark:bg-[#1E293B] border-[#E5E7EB] dark:border-[#334155] text-[#0F172A] dark:text-white"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {isCrit ? (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                ) : isWarn ? (
                  <AlertTriangle className="w-4 h-4 text-[#0F172A] dark:text-white shrink-0" />
                ) : (
                  <Info className="w-4 h-4 text-[#4B5563] dark:text-[#9CA3AF] shrink-0" />
                )}
              </div>
              <div>
                <h4 className="text-xs font-bold tracking-tight uppercase">{alert.title}</h4>
                <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] mt-0.5 max-w-3xl leading-relaxed">
                  {alert.body}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={(e) => dismissAlert(alert.id, e)}
                title="Dismiss"
                className="p-1 rounded-lg text-[#9CA3AF] hover:text-[#0F172A] dark:hover:text-white hover:bg-black/5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
