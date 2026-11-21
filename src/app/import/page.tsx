"use client";

import { useState, useEffect } from "react";
import { Sidebar, MobileNav } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import Link from "next/link";
import {
  UploadCloud,
  FileText,
  MessageSquare,
  Lock,
  ArrowRight,
  RefreshCw,
  Plus,
  CheckCircle2,
  DollarSign,
} from "lucide-react";
import { ALL_CATEGORIES, CategoryName } from "@/lib/categories";

interface PreviewRow {
  date: string;
  merchant: string;
  raw_description?: string;
  category: CategoryName;
  amount: number;
  type: "debit" | "credit";
  needs_review: boolean;
  confidence?: number;
  status: "inserted" | "needs_review" | "duplicate";
}

interface IngestSummary {
  transactions_found: number;
  inserted: number;
  duplicates_skipped: number;
  rows_dropped: number;
  needs_review: number;
  subscriptions_detected: number;
  preview_rows?: PreviewRow[];
}

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState<"file" | "sms" | "manual">("file");
  const [file, setFile] = useState<File | null>(null);
  const [pdfPassword, setPdfPassword] = useState("");
  const [smsText, setSmsText] = useState("");
  const [stage, setStage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<IngestSummary | null>(null);
  const [auditFilter, setAuditFilter] = useState<"all" | "inserted" | "needs_review">("all");

  // Manual Quick Add state
  const [manualDate, setManualDate] = useState("2026-11-21");
  const [manualMerchant, setManualMerchant] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualType, setManualType] = useState<"debit" | "credit">("debit");
  const [manualCategory, setManualCategory] = useState<CategoryName>("Food & Dining");
  const [manualDescription, setManualDescription] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [manualSuccessMsg, setManualSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    // Set default date safely on mount
    setManualDate(new Date().toISOString().split("T")[0]);
  }, []);

  const STAGES = [
    "Uploading securely...",
    "Redacting PII in volatile RAM...",
    "Categorizing transactions...",
    "Writing to ledger...",
  ];

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const loadSampleCSV = () => {
    const sampleData = `Txn Date,Description,Debit,Credit,Balance
2026-11-01,SALARY CREDITED BY ACME CORP,,125000.00,125000.00
2026-11-02,RENT PAYMENT TO LANDLORD,32000.00,,93000.00
2026-11-04,SWIGGY BANGALORE,540.00,,92460.00
2026-11-05,BLINKIT GROCERIES,1240.00,,91220.00
2026-11-08,NETFLIX INDIA SUBSCRIPTION,649.00,,90571.00
2026-11-10,UBER TRIP BANGALORE,380.00,,90191.00
2026-11-12,ZOMATO DINING,1120.00,,89071.00
2026-11-14,BESCOM ELECTRICITY BILL,2450.00,,86621.00
2026-11-16,AMAZON INDIA SHOPPING,3499.00,,83122.00
2026-11-18,SPOTIFY SUBSCRIPTION,119.00,,83003.00
2026-11-20,APOLLO PHARMACY,890.00,,82113.00`;
    const blob = new Blob([sampleData], { type: "text/csv" });
    const sampleFile = new File([blob], "sample_bank_statement.csv", { type: "text/csv" });
    setFile(sampleFile);
    setError(null);
  };

  const handleUpload = async () => {
    if (activeTab === "file" && !file) return;
    if (activeTab === "sms" && !smsText.trim()) return;

    setLoading(true);
    setError(null);
    setSummary(null);

    let currentStage = 0;
    setStage(STAGES[0]);
    const timer = setInterval(() => {
      currentStage++;
      if (currentStage < STAGES.length) {
        setStage(STAGES[currentStage]);
      }
    }, 700);

    try {
      const formData = new FormData();
      if (activeTab === "file" && file) {
        formData.append("file", file);
        if (pdfPassword) formData.append("pdf_password", pdfPassword);
      } else {
        formData.append("sms", smsText);
      }

      const res = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      clearInterval(timer);

      if (!res.ok) {
        setError(data.error || "Ingestion pipeline returned an error.");
      } else {
        setSummary(data);
      }
    } catch {
      clearInterval(timer);
      setError("Network or server failure during statement ingestion.");
    } finally {
      setLoading(false);
      setStage(null);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualMerchant.trim() || !manualAmount || Number(manualAmount) <= 0) {
      setError("Please specify a valid counterparty/merchant and positive amount.");
      return;
    }

    setManualLoading(true);
    setError(null);
    setManualSuccessMsg(null);

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: manualDate || new Date().toISOString().split("T")[0],
          merchant: manualMerchant.trim(),
          amount: Number(manualAmount),
          type: manualType,
          category: manualCategory,
          raw_description: manualDescription.trim() || manualMerchant.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to log transaction.");
      } else {
        const newTx: PreviewRow = {
          date: manualDate || new Date().toISOString().split("T")[0],
          merchant: manualMerchant.trim(),
          raw_description: manualDescription.trim() || manualMerchant.trim(),
          category: manualCategory,
          amount: Number(manualAmount),
          type: manualType,
          needs_review: false,
          confidence: 1.0,
          status: "inserted",
        };

        setSummary((prev) => {
          if (!prev) {
            return {
              transactions_found: 1,
              inserted: 1,
              duplicates_skipped: 0,
              rows_dropped: 0,
              needs_review: 0,
              subscriptions_detected: 0,
              preview_rows: [newTx],
            };
          }
          return {
            ...prev,
            transactions_found: prev.transactions_found + 1,
            inserted: prev.inserted + 1,
            preview_rows: [newTx, ...(prev.preview_rows || [])],
          };
        });

        setManualSuccessMsg(
          `Recorded ₹${Number(manualAmount).toLocaleString("en-IN")} ${
            manualType === "credit" ? "income credit from" : "debit to"
          } ${manualMerchant.trim()} in ${manualCategory}.`
        );

        setManualMerchant("");
        setManualAmount("");
        setManualDescription("");
      }
    } catch {
      setError("Network error logging manual transaction to ledger.");
    } finally {
      setManualLoading(false);
    }
  };

  const inrFmt = (n: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(n);
  };

  const filteredPreview = (summary?.preview_rows || []).filter((r) => {
    if (auditFilter === "inserted") return !r.needs_review;
    if (auditFilter === "needs_review") return r.needs_review;
    return true;
  });

  return (
    <div className="flex min-h-screen bg-[#0A0D12] text-slate-100 font-sans antialiased">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <Header />

        <main className="p-6 md:p-10 max-w-6xl mx-auto w-full space-y-10">
          {/* Page Heading: Open, unboxed typography */}
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-[#1E2533] pb-6">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-medium tracking-tight text-white">
                  Ingestion & Ledger Entry
                </h1>
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 border border-[#1E2533] px-2 py-0.5 rounded">
                  ETL & Quick Add
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Import statements &bull; Ingest bank SMS &bull; Add manual transactions directly to ledger
              </p>
            </div>

            <Link
              href="/transactions"
              className="text-xs font-mono text-slate-400 hover:text-white transition-colors"
            >
              View General Ledger &rarr;
            </Link>
          </div>

          {/* Feedback Notices */}
          {error && (
            <div className="py-3 px-4 border border-rose-500/30 bg-rose-500/10 text-xs text-rose-400 flex items-center gap-2 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {manualSuccessMsg && (
            <div className="py-2.5 px-4 border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs font-mono flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{manualSuccessMsg}</span>
              </div>
              <button onClick={() => setManualSuccessMsg(null)} className="text-slate-400 hover:text-white">
                &times;
              </button>
            </div>
          )}

          {/* UNBOXED HORIZONTAL SUMMARY STRIP */}
          {summary && (
            <section className="space-y-8">
              <div className="border-y border-[#1E2533] py-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-[#1E2533]">
                  {/* Found */}
                  <div className="px-4 py-2 sm:first:pl-0">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block">
                      Found
                    </span>
                    <span className="text-xl font-mono tabular-nums font-medium text-white mt-1 block">
                      {summary.transactions_found}
                    </span>
                  </div>

                  {/* Inserted */}
                  <div className="px-4 py-2">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 block">
                      Inserted
                    </span>
                    <span className="text-xl font-mono tabular-nums font-medium text-emerald-400 mt-1 block">
                      {summary.inserted}
                    </span>
                  </div>

                  {/* Duplicates */}
                  <div className="px-4 py-2">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block">
                      Duplicates
                    </span>
                    <span className="text-xl font-mono tabular-nums font-medium text-slate-400 mt-1 block">
                      {summary.duplicates_skipped}
                    </span>
                  </div>

                  {/* Dropped */}
                  <div className="px-4 py-2">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block">
                      Dropped
                    </span>
                    <span className="text-xl font-mono tabular-nums font-medium text-slate-400 mt-1 block">
                      {summary.rows_dropped}
                    </span>
                  </div>

                  {/* Needs Review */}
                  <div className="px-4 py-2">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 block">
                      Needs Review
                    </span>
                    <span className="text-xl font-mono tabular-nums font-medium text-amber-400 mt-1 block">
                      {summary.needs_review}
                    </span>
                  </div>

                  {/* Subscriptions */}
                  <div className="px-4 py-2 sm:last:pr-0">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block">
                      Recurring Detected
                    </span>
                    <span className="text-xl font-mono tabular-nums font-medium text-white mt-1 block">
                      {summary.subscriptions_detected}
                    </span>
                  </div>
                </div>
              </div>

              {/* UNBOXED INTERACTIVE AUDIT PREVIEW TABLE */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-[#1E2533] pb-3">
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-mono uppercase tracking-widest text-white">
                      Reconciled Ledger Preview
                    </span>
                    <div className="flex items-center gap-1 font-mono text-xs">
                      <button
                        onClick={() => setAuditFilter("all")}
                        className={`px-2 py-0.5 transition-colors ${
                          auditFilter === "all" ? "text-white font-medium underline" : "text-slate-500 hover:text-white"
                        }`}
                      >
                        All ({summary.preview_rows?.length || 0})
                      </button>
                      <button
                        onClick={() => setAuditFilter("inserted")}
                        className={`px-2 py-0.5 transition-colors ${
                          auditFilter === "inserted" ? "text-white font-medium underline" : "text-slate-500 hover:text-white"
                        }`}
                      >
                        Clean ({summary.preview_rows?.filter((r) => !r.needs_review).length || 0})
                      </button>
                      <button
                        onClick={() => setAuditFilter("needs_review")}
                        className={`px-2 py-0.5 transition-colors ${
                          auditFilter === "needs_review" ? "text-amber-400 font-medium underline" : "text-slate-500 hover:text-white"
                        }`}
                      >
                        Flagged ({summary.preview_rows?.filter((r) => r.needs_review).length || 0})
                      </button>
                    </div>
                  </div>

                  <Link
                    href="/dashboard"
                    className="px-3 py-1 text-xs font-medium bg-white text-black rounded hover:bg-slate-200 transition-colors font-mono"
                  >
                    Confirm & View Dashboard &rarr;
                  </Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#1E2533] text-[10px] font-mono uppercase tracking-widest text-slate-500">
                        <th className="py-2.5 font-normal">Date</th>
                        <th className="py-2.5 font-normal">Merchant / Narration</th>
                        <th className="py-2.5 font-normal">Classification</th>
                        <th className="py-2.5 font-normal text-right">Amount</th>
                        <th className="py-2.5 font-normal text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1E2533]/50">
                      {filteredPreview.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center font-mono text-slate-500">
                            No records match this filter.
                          </td>
                        </tr>
                      ) : (
                        filteredPreview.map((row, i) => (
                          <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-3 font-mono text-slate-400 whitespace-nowrap text-[11px]">
                              {row.date}
                            </td>
                            <td className="py-3 pr-4">
                              <span className="font-medium text-white block">
                                {row.merchant}
                              </span>
                              {row.raw_description && row.raw_description !== row.merchant && (
                                <span className="font-mono text-[10px] text-slate-500 truncate block max-w-sm">
                                  {row.raw_description}
                                </span>
                              )}
                            </td>
                            <td className="py-3">
                              <span className="text-[10px] font-mono text-slate-400">
                                {row.category}
                              </span>
                            </td>
                            <td className="py-3 text-right font-mono tabular-nums whitespace-nowrap text-[12px]">
                              <span className={row.type === "credit" ? "text-emerald-400 font-medium" : "text-white"}>
                                {row.type === "credit" ? "+" : "-"}
                                {inrFmt(row.amount)}
                              </span>
                            </td>
                            <td className="py-3 text-right whitespace-nowrap">
                              {row.needs_review ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-400">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                  Needs Review
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono text-emerald-400">
                                  Reconciled
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* INGESTION & ENTRY INTERFACE: 3 Tabs (Document, SMS, Manual Quick Add) */}
          <section className="space-y-6">
            {/* Mode Selector */}
            <div className="flex border-b border-[#1E2533] gap-6 text-xs font-mono overflow-x-auto">
              <button
                onClick={() => {
                  setActiveTab("file");
                  setError(null);
                }}
                className={`pb-3 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                  activeTab === "file"
                    ? "border-white text-white font-medium"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Statement Document (.csv, .xlsx, .pdf)</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("sms");
                  setError(null);
                }}
                className={`pb-3 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                  activeTab === "sms"
                    ? "border-white text-white font-medium"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Bank SMS Raw Feed</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("manual");
                  setError(null);
                }}
                className={`pb-3 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                  activeTab === "manual"
                    ? "border-emerald-400 text-emerald-400 font-medium"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Manual Quick Add</span>
              </button>
            </div>

            <div className="space-y-5">
              {/* TAB 1: FILE UPLOAD */}
              {activeTab === "file" && (
                <div className="space-y-4">
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleFileDrop}
                    onClick={() => document.getElementById("fileInput")?.click()}
                    className="py-12 border border-dashed border-[#1E2533] rounded text-center hover:border-slate-500 transition-colors cursor-pointer"
                  >
                    <input
                      id="fileInput"
                      type="file"
                      accept=".pdf,.xlsx,.csv"
                      onChange={(e) => e.target.files && setFile(e.target.files[0])}
                      className="hidden"
                    />
                    <UploadCloud className="w-6 h-6 mx-auto text-slate-500 mb-2" />
                    {file ? (
                      <div>
                        <span className="font-mono text-xs text-white block font-medium">
                          {file.name}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500 mt-1 block">
                          {(file.size / 1024).toFixed(1)} KB &bull; Document selected
                        </span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-xs text-slate-300 block">
                          Click to select statement or drag & drop file here
                        </span>
                        <span className="font-mono text-[10px] text-slate-500 mt-1 block">
                          PDF &bull; Excel (.xlsx) &bull; CSV &bull; Up to 10 MB
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="font-mono text-[11px] text-slate-500">Need immediate verification?</span>
                    <button
                      type="button"
                      onClick={loadSampleCSV}
                      className="font-mono text-[11px] text-slate-300 hover:text-white underline"
                    >
                      Load Sample Statement (11 records)
                    </button>
                  </div>

                  {file?.name.toLowerCase().endsWith(".pdf") && (
                    <div className="py-2 border-b border-[#1E2533] space-y-1">
                      <label className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                        <Lock className="w-3 h-3" />
                        <span>PDF Decryption Password</span>
                      </label>
                      <input
                        type="password"
                        value={pdfPassword}
                        onChange={(e) => setPdfPassword(e.target.value)}
                        placeholder="Leave empty if file is unencrypted"
                        className="w-full text-xs font-mono bg-transparent py-1.5 text-white focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Progress Indicator */}
                  {loading && (
                    <div className="py-2 border-b border-[#1E2533] flex items-center gap-2 text-xs font-mono text-slate-300">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                      <span>{stage || "Executing parser..."}</span>
                    </div>
                  )}

                  {/* Execute Button */}
                  <div className="pt-2">
                    <button
                      onClick={handleUpload}
                      disabled={loading || !file}
                      className="py-2 px-5 bg-white text-black hover:bg-slate-200 text-xs font-medium rounded transition-colors disabled:opacity-30 flex items-center gap-2 font-mono"
                    >
                      {loading ? "Processing..." : "Run Ingestion Pipeline"}
                      {!loading && <ArrowRight className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: SMS PASTE */}
              {activeTab === "sms" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-mono uppercase tracking-widest text-slate-500">
                      Paste Raw Bank Transaction Alerts
                    </label>
                    <textarea
                      rows={6}
                      value={smsText}
                      onChange={(e) => setSmsText(e.target.value)}
                      placeholder={`Example:\nDear Customer, INR 450.00 debited from A/c XX1234 on 12-10-2026 to Swiggy.\n\nUPI payment of Rs 1,299.00 to Netflix successful on 2026-10-15.`}
                      className="w-full p-3 border border-[#1E2533] bg-transparent text-xs font-mono text-white focus:outline-none focus:border-slate-500 rounded"
                    />
                  </div>

                  {/* Progress Indicator */}
                  {loading && (
                    <div className="py-2 border-b border-[#1E2533] flex items-center gap-2 text-xs font-mono text-slate-300">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                      <span>{stage || "Executing parser..."}</span>
                    </div>
                  )}

                  {/* Execute Button */}
                  <div className="pt-2">
                    <button
                      onClick={handleUpload}
                      disabled={loading || !smsText.trim()}
                      className="py-2 px-5 bg-white text-black hover:bg-slate-200 text-xs font-medium rounded transition-colors disabled:opacity-30 flex items-center gap-2 font-mono"
                    >
                      {loading ? "Processing..." : "Run SMS Ingestion Pipeline"}
                      {!loading && <ArrowRight className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: MANUAL QUICK ADD */}
              {activeTab === "manual" && (
                <form onSubmit={handleManualSubmit} className="space-y-5">
                  <div className="border border-[#1E2533] p-5 space-y-4 bg-white/[0.01]">
                    <div className="flex items-center justify-between border-b border-[#1E2533] pb-3">
                      <div>
                        <h3 className="text-xs font-mono uppercase tracking-widest text-white">
                          MANUAL TRANSACTION LOG
                        </h3>
                        <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                          Directly write a single transaction into your verified ledger.
                        </p>
                      </div>

                      {/* Debit / Credit Switcher */}
                      <div className="flex items-center border border-[#1E2533] rounded overflow-hidden font-mono text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setManualType("debit");
                            if (manualCategory === "Income/Salary") setManualCategory("Food & Dining");
                          }}
                          className={`px-3 py-1 transition-colors ${
                            manualType === "debit"
                              ? "bg-rose-500/20 text-rose-300 font-medium"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          Debit (Expense)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setManualType("credit");
                            setManualCategory("Income/Salary");
                          }}
                          className={`px-3 py-1 transition-colors ${
                            manualType === "credit"
                              ? "bg-emerald-500/20 text-emerald-300 font-medium"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          Credit (Income)
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 font-mono text-xs">
                      {/* Date */}
                      <div>
                        <label className="text-[10px] uppercase text-slate-400 block mb-1">
                          Date
                        </label>
                        <input
                          type="date"
                          value={manualDate}
                          onChange={(e) => setManualDate(e.target.value)}
                          required
                          className="w-full bg-transparent border-b border-[#1E2533] py-1.5 text-white focus:outline-none focus:border-white"
                        />
                      </div>

                      {/* Counterparty / Merchant */}
                      <div>
                        <label className="text-[10px] uppercase text-slate-400 block mb-1">
                          Counterparty / Merchant
                        </label>
                        <input
                          type="text"
                          value={manualMerchant}
                          onChange={(e) => setManualMerchant(e.target.value)}
                          placeholder="e.g. Swiggy, Amazon, Client Acme"
                          required
                          className="w-full bg-transparent border-b border-[#1E2533] py-1.5 text-white focus:outline-none focus:border-white"
                        />
                      </div>

                      {/* Amount */}
                      <div>
                        <label className="text-[10px] uppercase text-slate-400 block mb-1">
                          Amount (₹)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={manualAmount}
                          onChange={(e) => setManualAmount(e.target.value)}
                          placeholder="e.g. 1450"
                          required
                          className="w-full bg-transparent border-b border-[#1E2533] py-1.5 text-white focus:outline-none focus:border-white tabular-nums text-sm font-medium"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 font-mono text-xs pt-1">
                      {/* Category */}
                      <div>
                        <label className="text-[10px] uppercase text-slate-400 block mb-1">
                          Category
                        </label>
                        <select
                          value={manualCategory}
                          onChange={(e) => setManualCategory(e.target.value as CategoryName)}
                          className="w-full bg-[#101418] border border-[#1E2533] p-1.5 text-white focus:outline-none focus:border-slate-500 rounded text-xs"
                        >
                          {ALL_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat} className="bg-[#101418] text-white">
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Notes / Description */}
                      <div>
                        <label className="text-[10px] uppercase text-slate-400 block mb-1">
                          Narration / Description (Optional)
                        </label>
                        <input
                          type="text"
                          value={manualDescription}
                          onChange={(e) => setManualDescription(e.target.value)}
                          placeholder="e.g. Team dinner, Grocery run, Monthly bonus"
                          className="w-full bg-transparent border-b border-[#1E2533] py-1.5 text-white focus:outline-none focus:border-white text-xs"
                        />
                      </div>
                    </div>

                    {/* Quick Category Chips */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 text-[11px] font-mono">
                      <span className="text-[10px] uppercase text-slate-500">Quick Select:</span>
                      {(["Food & Dining", "Groceries", "Shopping", "Transport", "Utilities", "Rent & Housing", "Income/Salary"] as CategoryName[]).map(
                        (cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => {
                              setManualCategory(cat);
                              if (cat === "Income/Salary") setManualType("credit");
                              else setManualType("debit");
                            }}
                            className={`px-2 py-0.5 border rounded transition-colors ${
                              manualCategory === cat
                                ? "border-white bg-white text-black font-medium"
                                : "border-[#1E2533] text-slate-400 hover:text-white"
                            }`}
                          >
                            {cat}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div>
                    <button
                      type="submit"
                      disabled={manualLoading || !manualMerchant.trim() || !manualAmount}
                      className="py-2 px-5 bg-white text-black hover:bg-slate-200 text-xs font-medium rounded transition-colors disabled:opacity-30 flex items-center gap-2 font-mono"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{manualLoading ? "Logging..." : "Log Transaction to Ledger"}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </section>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
