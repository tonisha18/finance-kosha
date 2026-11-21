"use client";

import { useState, useRef, useEffect } from "react";
import { Sidebar, MobileNav } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { Send } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  metrics?: {
    spent?: number;
    income?: number;
    surplus?: number;
    subscriptionCost?: number;
    intent?: string;
  };
}

export default function CoachPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Welcome to Kosha intelligence. I evaluate your verified transactions, regular payments, and spending limits to provide cash-flow analysis. What query would you like to run?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (queryText?: string) => {
    const text = queryText || input;
    if (!text.trim() || loading) return;

    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          chat_history: newMessages.slice(-8).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessages([
          ...newMessages,
          { role: "assistant", content: data.reply, metrics: data.metrics },
        ]);
      } else {
        setMessages([
          ...newMessages,
          {
            role: "assistant",
            content: data.error || "Unable to reach the financial engine. Please retry.",
          },
        ]);
      }
    } catch {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "Connection error. Please retry." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0A0D12] text-slate-100 font-sans antialiased">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <Header />
        <main className="p-6 md:p-10 max-w-4xl mx-auto w-full space-y-6 flex-1 flex flex-col">
          {/* Unboxed Header */}
          <div className="flex items-baseline justify-between border-b border-[#1E2533] pb-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-medium tracking-tight text-white">
                  Financial Intelligence
                </h1>
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded">
                  Grounded
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Deterministic LLM evaluator &bull; Precomputed double-entry ledger inputs
              </p>
            </div>

            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
              Guardrails Enforced
            </span>
          </div>

          {/* Unboxed Messages Stream */}
          <div className="flex-1 overflow-y-auto space-y-6 py-4">
            {messages.map((m, idx) => (
              <div key={idx} className="space-y-1.5 font-mono text-xs">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 block">
                  {m.role === "user" ? "[USER QUERY]" : "[KOSHA MODEL ANALYSIS]"}
                </span>
                <p className={`leading-relaxed whitespace-pre-wrap ${m.role === "user" ? "text-white font-medium" : "text-slate-300"}`}>
                  {m.content}
                </p>

                {m.metrics && m.metrics.spent !== undefined && (
                  <div className="pt-2 border-t border-[#1E2533] grid grid-cols-2 gap-4 text-[11px] text-slate-400">
                    <div>
                      <span className="text-[10px] uppercase text-slate-500 block">Spent This Month</span>
                      <span className="text-white tabular-nums">
                        ₹{m.metrics.spent.toLocaleString("en-IN")}
                      </span>
                    </div>
                    {m.metrics.income !== undefined && (
                      <div>
                        <span className="text-[10px] uppercase text-slate-500 block">Income</span>
                        <span className="text-emerald-400 tabular-nums">
                          ₹{m.metrics.income.toLocaleString("en-IN")}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="text-[11px] font-mono text-slate-500 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span>Aggregating ledger run-rate metrics...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Query Suggestions */}
          <div className="flex gap-4 border-t border-[#1E2533] pt-3 text-xs font-mono overflow-x-auto">
            <span className="text-[10px] uppercase text-slate-500 tracking-wider">Prompts:</span>
            <button
              onClick={() => handleSend("What is my total spend this month?")}
              className="text-slate-400 hover:text-white underline whitespace-nowrap"
            >
              Month spend &rarr;
            </button>
            <button
              onClick={() => handleSend("Which subscriptions cost the most?")}
              className="text-slate-400 hover:text-white underline whitespace-nowrap"
            >
              Top contracts &rarr;
            </button>
            <button
              onClick={() => handleSend("What categories am I spending the most on?")}
              className="text-slate-400 hover:text-white underline whitespace-nowrap"
            >
              Category outflows &rarr;
            </button>
          </div>

          {/* Unboxed Prompt Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-4 border-b border-[#1E2533] pb-2 font-mono text-xs"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Query cashflow, run-rate, or specific category tradeoffs..."
              className="flex-1 bg-transparent text-white placeholder-slate-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="text-white hover:text-slate-300 disabled:opacity-30 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
