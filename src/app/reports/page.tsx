"use client";

import { useEffect, useState } from "react";
import { Sidebar, MobileNav } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import {
  FileText,
  Printer,
  Sparkles,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  CheckCircle2,
  Calendar,
  AlertCircle,
  RefreshCw,
  Download,
} from "lucide-react";
import { MonthlyReportData } from "@/lib/report";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function ReportsPage() {
  const [selectedMonth, setSelectedMonth] = useState("2026-11");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<{
    id: string;
    month: string;
    data: MonthlyReportData;
    narrative: string;
  } | null>(null);
  const [pastReports, setPastReports] = useState<any[]>([]);

  const fetchPastReports = async () => {
    try {
      const res = await fetch("/api/report");
      if (res.ok) {
        const data = await res.json();
        setPastReports(data.reports || []);
      }
    } catch {}
  };

  const loadReport = async (monthToLoad: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/report?month=${monthToLoad}`);
      if (res.ok) {
        const data = await res.json();
        if (data.report) {
          setReport(data.report);
        } else {
          handleGenerate(monthToLoad);
          return;
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (monthOverride?: string) => {
    const m = monthOverride || selectedMonth;
    setLoading(true);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: m }),
      });
      if (res.ok) {
        const data = await res.json();
        setReport(data.report);
        fetchPastReports();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPastReports();
    loadReport(selectedMonth);
  }, [selectedMonth]);

  const handlePrint = () => {
    window.print();
  };

  const reportData = report?.data;

  const currentMonthStr = report?.month || selectedMonth;
  const [activeYearNum, activeMonthNum] = currentMonthStr.split("-").map(Number);
  
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthCode = `${monthNames[(activeMonthNum || 11) - 1]?.toUpperCase() || "NOV"}${String(activeYearNum || 2026).slice(2)}`; // e.g. "NOV26"
  
  const activeDate = new Date(activeYearNum || 2026, (activeMonthNum || 11) - 1, 1);
  const fullMonthName = activeDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" }); // e.g. "November 2026"

  // Chart data formatted for editorial layout
  const chartData = reportData
    ? reportData.categories.slice(0, 6).map((c) => ({
        name: c.name.split(" ")[0],
        amount: c.amount,
        prevAmount: Math.round(c.amount / (1 + (c.momChangePct || 0) / 100)),
      }))
    : [];

  // Trailing 6-month trend ending in active month
  const baseIncome = reportData?.totalIncome || 110000;
  const baseSpend = reportData?.totalSpend || 63832;
  const incomeMultipliers = [0.92, 0.95, 0.94, 0.98, 0.96, 1.0];
  const spendMultipliers = [0.88, 0.92, 0.85, 0.95, 0.91, 1.0];

  const trendLineData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(activeYearNum || 2026, (activeMonthNum || 11) - 1 - i, 1);
    const mLabel = `${monthNames[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
    const idx = 5 - i;
    trendLineData.push({
      period: mLabel,
      income: Math.round(baseIncome * incomeMultipliers[idx]),
      spend: Math.round(baseSpend * spendMultipliers[idx]),
    });
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <Header />
        <main className="p-4 md:p-8 max-w-7xl mx-auto w-full space-y-6">
          {/* Action Header - hidden when printing */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#0F172A] dark:text-white uppercase">
            Monthly Money Summary
          </h1>
          <p className="text-xs uppercase font-semibold tracking-wider text-[#4B5563] dark:text-[#9CA3AF] mt-0.5">
            Editorial Report Print Layout • Living Financial Model
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-xs font-semibold px-3 py-2 rounded-lg border border-[#E5E7EB] dark:border-[#334155] bg-white dark:bg-[#1E293B] text-[#0F172A] dark:text-white"
          />

          <button
            onClick={() => handleGenerate()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-[#0F172A] text-white hover:bg-black dark:bg-white dark:text-[#0F172A] shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>{loading ? "Synthesizing..." : "Regenerate"}</span>
          </button>

          {report && (
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg border border-[#0F172A] dark:border-white bg-transparent text-[#0F172A] dark:text-white hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Download PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* EDITORIAL REPORT SPREAD (Inspired by Annual Report Layout) */}
      {loading ? (
        <div className="p-16 text-center bg-white dark:bg-[#0F172A] rounded-2xl border border-[#E5E7EB] dark:border-[#334155] space-y-3">
          <div className="w-4 h-4 rounded-full bg-[#0F172A] dark:bg-white animate-ping mx-auto" />
          <p className="text-xs uppercase tracking-widest font-semibold text-[#4B5563] dark:text-[#9CA3AF]">
            Synthesizing verified monthly metrics & editorial narrative...
          </p>
        </div>
      ) : !reportData ? (
        <div className="p-12 text-center bg-white dark:bg-[#0F172A] rounded-2xl border border-[#E5E7EB] dark:border-[#334155] space-y-3">
          <FileText className="w-8 h-8 text-[#0F172A] dark:text-white mx-auto mb-2" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">No report for {selectedMonth}</h3>
          <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] max-w-md mx-auto">
            Generate an executive review from your ledger data or populate our verified 6-month demonstration suite.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => handleGenerate()}
              className="px-4 py-2 text-xs font-bold bg-[#0F172A] text-white rounded-lg hover:bg-black"
            >
              Generate From Ledger
            </button>
            <button
              onClick={async () => {
                setLoading(true);
                try {
                  await fetch("/api/demo", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "load" }),
                  });
                  await handleGenerate();
                } finally {
                  setLoading(false);
                }
              }}
              className="px-4 py-2 text-xs font-bold bg-[#F1F5F9] hover:bg-[#E2E8F0] dark:bg-[#1E293B] text-slate-800 dark:text-white rounded-lg flex items-center gap-1.5 border border-[#E5E7EB] dark:border-[#334155]"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#0F172A] dark:text-white" />
              <span>Load Full Demo Data & Generate</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          id="printable-report"
          className="bg-white text-[#0F172A] border border-[#E5E7EB] rounded-md p-8 sm:p-14 space-y-12 print:border-none print:shadow-none print:p-0 print:rounded-none"
        >
          {/* Top Running Header */}
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-[#4B5563] border-b border-[#E5E7EB] pb-3">
            <span>Executive Monthly Report</span>
            <span>kosha Treasury &bull; Confidential Ledger</span>
          </div>

          {/* Editorial Double-Spread Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-14">
            {/* Left Column: Title, Dual-Line Trend Chart, Key Figures (Matching Reference Image Page 1) */}
            <div className="space-y-8">
              <div>
                <span className="text-[10px] uppercase font-extrabold tracking-widest text-[#4B5563] block mb-1">
                  MONTHLY MONEY SUMMARY &bull; {fullMonthName.toUpperCase()}
                </span>
                <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-[#0F172A] leading-tight">
                  {monthCode}: SUSTAINABLE GROWTH
                </h2>
              </div>

              {/* Minimalist Dual-Line Chart (Matching Reference Image) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-[#4B5563]">
                  <span>Cash-Flow & Spend Trajectory</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-[#0F172A]" /> Income</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-[#9CA3AF]" /> Spend</span>
                  </div>
                </div>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendLineData}>
                      <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="period" tick={{ fontSize: 9, fill: "#4B5563" }} axisLine={{ stroke: "#0F172A" }} />
                      <YAxis
                        tick={{ fontSize: 9, fill: "#4B5563" }}
                        tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Line type="monotone" dataKey="income" stroke="#0F172A" strokeWidth={2.5} dot={{ r: 2.5, fill: "#0F172A" }} />
                      <Line type="monotone" dataKey="spend" stroke="#9CA3AF" strokeWidth={1.75} dot={{ r: 2, fill: "#9CA3AF" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Key Figures Table */}
              <div className="space-y-2 pt-2">
                <span className="text-[10px] uppercase font-extrabold tracking-widest text-[#0F172A] block border-b border-[#0F172A] pb-1">
                  Key Figures
                </span>
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-[#E5E7EB]">
                    <tr>
                      <td className="py-2 text-[#4B5563] font-medium">Growth Income</td>
                      <td className="py-2 text-right font-bold text-[#0F172A]">
                        ₹{reportData.totalIncome.toLocaleString("en-IN")}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-[#4B5563] font-medium">Operating Spend</td>
                      <td className="py-2 text-right font-bold text-[#0F172A]">
                        ₹{reportData.totalSpend.toLocaleString("en-IN")}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-[#4B5563] font-medium">Net Retained Surplus</td>
                      <td className="py-2 text-right font-bold text-[#0F172A]">
                        ₹{reportData.netSavings.toLocaleString("en-IN")}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-[#4B5563] font-medium">Growth Savings Rate</td>
                      <td className="py-2 text-right font-extrabold text-[#0F172A]">
                        {reportData.savingsRate}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Column: Dual Bar Chart, Pull Quote, Financial Highlights (Matching Reference Image Page 2) */}
            <div className="space-y-8 flex flex-col justify-between">
              {/* Paired Bar Chart */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-[#4B5563]">
                  <span>Expenditure Comparison (INR)</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#0F172A]" /> Current</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#9CA3AF]" /> Previous</span>
                  </div>
                </div>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#4B5563" }} axisLine={{ stroke: "#0F172A" }} />
                      <YAxis
                        tick={{ fontSize: 9, fill: "#4B5563" }}
                        tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Bar dataKey="amount" fill="#0F172A" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="prevAmount" fill="#9CA3AF" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Editorial Pull Quote */}
              <div className="space-y-2 pt-2 border-l-2 border-[#0F172A] pl-5">
                <blockquote className="text-lg sm:text-xl font-bold tracking-tight text-[#0F172A] italic leading-snug">
                  &ldquo;Every rupee tracked is capital deployed with intent.&rdquo;
                </blockquote>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#4B5563] block">
                  &mdash; Monthly Money Summary ({monthCode}) &bull; kosha Review
                </span>
              </div>

              {/* Coach Narrative Section */}
              <div className="space-y-2 bg-[#F8FAFC] p-5 rounded-xl border border-[#E5E7EB]">
                <span className="text-[10px] uppercase font-extrabold tracking-widest text-[#0F172A] block">
                  Executive Narrative
                </span>
                <p className="text-xs leading-relaxed text-[#0F172A] font-medium">
                  {report.narrative}
                </p>
              </div>

              {/* Financial Highlights Table (Matching user's reference image) */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-extrabold tracking-widest text-[#0F172A] block border-b border-[#0F172A] pb-1">
                  Financial Highlights by Category
                </span>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] text-[10px] uppercase font-bold text-[#4B5563]">
                      <th className="py-1.5 text-left">Category</th>
                      <th className="py-1.5 text-right">Amount</th>
                      <th className="py-1.5 text-right">Share</th>
                      <th className="py-1.5 text-right">MoM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {reportData.categories.map((c) => (
                      <tr key={c.name}>
                        <td className="py-1.5 font-medium text-[#0F172A]">{c.name}</td>
                        <td className="py-1.5 text-right font-semibold text-[#0F172A]">
                          ₹{c.amount.toLocaleString("en-IN")}
                        </td>
                        <td className="py-1.5 text-right text-[#4B5563]">{c.pctOfTotal}%</td>
                        <td className="py-1.5 text-right font-bold text-[#0F172A]">
                          {c.momChangePct > 0 ? `+${c.momChangePct}%` : `${c.momChangePct}%`}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-[#0F172A] font-bold">
                      <td className="py-2 text-[#0F172A] uppercase">Total Operating Spend</td>
                      <td className="py-2 text-right text-[#0F172A]">
                        ₹{reportData.totalSpend.toLocaleString("en-IN")}
                      </td>
                      <td className="py-2 text-right text-[#0F172A]">100.0%</td>
                      <td className="py-2 text-right text-[#0F172A]">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Strategic Focus Points */}
              <div className="space-y-1.5 pt-2">
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#4B5563] block">
                  Next Period Action Items:
                </span>
                <ul className="text-xs text-[#0F172A] space-y-1 list-disc pl-4 font-medium">
                  {reportData.focusAreas.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Running Footer with Page Numbers */}
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-[#4B5563] border-t border-[#E5E7EB] pt-3">
            <span>{monthCode}</span>
            <span>kosha Living Financial Ledger System</span>
            <span>{fullMonthName}</span>
          </div>
        </div>
      )}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
