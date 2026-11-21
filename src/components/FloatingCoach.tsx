"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, X, Send, ShieldAlert } from "lucide-react";
import { usePathname } from "next/navigation";

interface Message {
  role: "user" | "assistant";
  content: string;
  metrics?: any;
}

export function FloatingCoach() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello. I am the Kosha intelligence layer. Ask me about your cash-flow run rate, category spending, or recurring commitments.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (open) scrollToBottom();
  }, [messages, open]);

  if (pathname === "/login" || pathname === "/signup") {
    return null;
  }

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input;
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
          chat_history: newMessages.slice(-6).map((m) => ({
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
    <>
      {/* Floating Toggle Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open Kosha assistant"
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 border border-slate-700/50 dark:border-white shadow-md text-xs font-mono transition-opacity hover:opacity-90"
        >
          <Bot className="w-3.5 h-3.5" />
          <span className="font-semibold uppercase tracking-wider text-[11px]">Kosha AI</span>
        </button>
      )}

      {/* Floating Chat Panel */}
      {open && (
        <div className="fixed bottom-4 right-4 z-50 w-[92vw] sm:w-[390px] h-[520px] max-h-[85vh] flex flex-col rounded-md bg-white dark:bg-[#11131A] border border-slate-200 dark:border-[#1F2330] shadow-2xl overflow-hidden transition-all select-none">
          {/* Header */}
          <div className="h-11 px-3.5 bg-slate-50 dark:bg-[#090A0F] border-b border-slate-200 dark:border-[#1F2330] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-mono font-medium uppercase tracking-wider text-slate-900 dark:text-white">
                Kosha Intelligence
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Guardrail Subtext */}
          <div className="px-3 py-1.5 bg-slate-100/50 dark:bg-[#181B24] border-b border-slate-200 dark:border-[#1F2330] flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
            <ShieldAlert className="w-3 h-3 text-slate-400 shrink-0" />
            <span>Cash-flow guidance. Securities recommendations prohibited.</span>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-2.5 text-xs select-text">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded p-2.5 leading-relaxed text-xs ${
                    m.role === "user"
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-medium"
                      : "bg-slate-50 dark:bg-[#090A0F] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-[#1F2330]"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded p-2 bg-slate-50 dark:bg-[#090A0F] text-slate-400 border border-slate-200 dark:border-[#1F2330] flex items-center gap-2 text-[11px] font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-ping" />
                  <span>Calculating ledger ground-truth...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompt Chips */}
          <div className="px-3 py-1.5 border-t border-slate-200 dark:border-[#1F2330] flex gap-1.5 overflow-x-auto bg-slate-50/50 dark:bg-[#090A0F]/50">
            <button
              onClick={() => handleSend("What is my total spend this month?")}
              className="text-[10px] font-mono whitespace-nowrap px-2 py-0.5 rounded border border-slate-200 dark:border-[#1F2330] text-slate-600 dark:text-slate-300 hover:border-slate-400"
            >
              Month Spend
            </button>
            <button
              onClick={() => handleSend("Which subscriptions are active?")}
              className="text-[10px] font-mono whitespace-nowrap px-2 py-0.5 rounded border border-slate-200 dark:border-[#1F2330] text-slate-600 dark:text-slate-300 hover:border-slate-400"
            >
              Subscriptions
            </button>
            <button
              onClick={() => handleSend("Am I over budget in any category?")}
              className="text-[10px] font-mono whitespace-nowrap px-2 py-0.5 rounded border border-slate-200 dark:border-[#1F2330] text-slate-600 dark:text-slate-300 hover:border-slate-400"
            >
              Budget Drift
            </button>
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-2 border-t border-slate-200 dark:border-[#1F2330] flex items-center gap-1.5 bg-white dark:bg-[#11131A]"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Query cash-flow..."
              className="flex-1 text-xs font-mono px-2.5 py-1.5 rounded border border-slate-200 dark:border-[#1F2330] bg-slate-50 dark:bg-[#090A0F] text-slate-900 dark:text-white focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-2.5 py-1.5 rounded bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-mono disabled:opacity-40 hover:opacity-90"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
