"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, Bell, Check, Search, Command } from "lucide-react";

interface HeaderAlert {
  id: string;
  alert_type: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "critical";
  is_read: boolean;
  created_at: string;
}

export function Header({ userEmail }: { userEmail?: string }) {
  const router = useRouter();
  const [alerts, setAlerts] = useState<HeaderAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchAlerts = async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("alerts")
      .select("id, alert_type, title, body, severity, is_read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (data) {
      setAlerts(data as HeaderAlert[]);
      setUnreadCount(data.filter((a) => !a.is_read).length);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      clearInterval(interval);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const markAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const supabase = createClient();
    await supabase.from("alerts").update({ is_read: true }).eq("id", id);
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, is_read: true } : a)));
    setUnreadCount((c) => Math.max(0, c - 1));
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

  return (
    <header className="h-14 border-b border-[#1E2533] bg-[#0A0D12] flex items-center justify-between px-6 sticky top-0 z-20">
      {/* Global Command / Search Hint */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-slate-500 font-mono text-xs">
          <Search className="w-3.5 h-3.5 text-slate-500" />
          <span className="hidden sm:inline">Search transactions, people & businesses...</span>
          <span className="text-[10px] border border-[#1E2533] px-1 py-0.2 rounded text-slate-500">⌘K</span>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4">
        {/* User Identity */}
        {userEmail && (
          <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="truncate max-w-[200px]">{userEmail}</span>
          </div>
        )}

        {/* Notifications Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setBellOpen(!bellOpen)}
            className="p-1.5 text-slate-400 hover:text-white transition-colors relative"
            title="Surveillance Log"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-amber-400 rounded-full" />
            )}
          </button>

          {bellOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-[#101418] border border-[#1E2533] shadow-2xl z-50 overflow-hidden font-mono text-xs">
              <div className="p-3 border-b border-[#1E2533] flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-white">
                  Audits ({unreadCount} new)
                </span>
                <Link
                  href="/alerts"
                  onClick={() => setBellOpen(false)}
                  className="text-[10px] text-slate-400 hover:text-white underline"
                >
                  View All &rarr;
                </Link>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-[#1E2533]/50">
                {alerts.length === 0 ? (
                  <p className="p-6 text-center text-slate-500 text-[11px]">
                    No alerts in surveillance pipeline
                  </p>
                ) : (
                  alerts.map((alert) => (
                    <div
                      key={alert.id}
                      onClick={() => {
                        router.push(getTargetUrl(alert.alert_type));
                        setBellOpen(false);
                      }}
                      className={`p-3 hover:bg-white/[0.02] cursor-pointer transition-colors ${!alert.is_read ? "bg-white/[0.03]" : ""
                        }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <p className="font-medium text-white text-[11px] leading-snug">
                            {alert.title}
                          </p>
                          <p className="text-[10px] text-slate-400 line-clamp-2">
                            {alert.body}
                          </p>
                        </div>
                        {!alert.is_read && (
                          <button
                            onClick={(e) => markAsRead(alert.id, e)}
                            className="text-slate-500 hover:text-white shrink-0 p-1"
                            title="Acknowledge"
                          >
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sign Out */}
        <button
          onClick={handleLogout}
          className="p-1.5 text-slate-400 hover:text-white transition-colors"
          title="Disconnect Session"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
