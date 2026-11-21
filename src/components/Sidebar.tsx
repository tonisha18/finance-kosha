"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UploadCloud,
  Receipt,
  Repeat,
  PiggyBank,
  Bell,
  Bot,
  Compass,
  FileText,
  Settings,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Import", href: "/import", icon: UploadCloud },
  { name: "Transactions", href: "/transactions", icon: Receipt },
  { name: "Subscriptions", href: "/subscriptions", icon: Repeat },
  { name: "Budgets", href: "/budgets", icon: PiggyBank },
  { name: "Alerts", href: "/alerts", icon: Bell, badge: true },
  { name: "Coach", href: "/coach", icon: Bot },
  { name: "Planner", href: "/planner", icon: Compass },
  { name: "Reports", href: "/reports", icon: FileText },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    async function fetchUnread() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { count } = await supabase
        .from("alerts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      setUnreadCount(count || 0);
    }
    fetchUnread();

    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [pathname]);

  return (
    <aside className="hidden md:flex flex-col w-56 border-r border-[#1E2533] bg-[#0A0D12] h-screen sticky top-0 select-none z-30">
      {/* Brand Header */}
      <div className="h-14 px-5 border-b border-[#1E2533] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded bg-white flex items-center justify-center text-black font-mono font-bold text-xs tracking-tight">
            K
          </div>
          <span className="font-semibold text-sm tracking-tight text-white">
            Kosha
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-2 pb-2 text-[10px] font-mono uppercase tracking-widest text-slate-500">
          Navigation
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded text-xs font-mono transition-colors ${isActive
                ? "text-white font-medium bg-white/[0.05]"
                : "text-slate-400 hover:text-white hover:bg-white/[0.02]"
                }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className="w-3.5 h-3.5 opacity-80" />
                <span>{item.name}</span>
              </div>
              {item.badge && unreadCount > 0 && (
                <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded text-amber-400 border border-amber-500/30">
                  {unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Institutional Status Footer */}
      <div className="p-4 border-t border-[#1E2533]">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>LEDGER SECURE</span>
          </div>
          <span className="uppercase">RAM-ONLY</span>
        </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0A0D12] border-t border-[#1E2533] flex justify-around p-1">
      {NAV_ITEMS.slice(0, 5).map((item) => {
        const Icon = item.icon;
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center py-1.5 px-3 text-[10px] font-mono ${isActive
              ? "text-white font-semibold"
              : "text-slate-400"
              }`}
          >
            <Icon className="w-4 h-4 mb-0.5" />
            {item.name}
          </Link>
        );
      })}
    </div>
  );
}
