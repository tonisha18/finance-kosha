"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Mail, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  };

  const handleInstantDemo = async () => {
    setDemoLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/demo-login", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to initialize demo");

      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (signInError) throw signInError;

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to start instant demo");
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0D12] text-slate-100 p-4 font-sans">
      <div className="w-full max-w-md bg-[#101418] border border-[#1E2533] rounded-md p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-9 h-9 rounded bg-white text-black font-mono font-bold text-base flex items-center justify-center mx-auto mb-3">
            K
          </div>
          <h1 className="text-xl font-medium tracking-tight text-white">
            Welcome to Kosha
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            Institutional personal finance & ledger
          </p>
        </div>

        {/* Instant Demo Button */}
        <div className="space-y-4">
          <button
            type="button"
            onClick={handleInstantDemo}
            disabled={demoLoading || loading}
            className="w-full py-2.5 px-4 bg-white hover:bg-slate-200 text-black rounded text-xs font-mono font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{demoLoading ? "Initializing Demo Account..." : "Enter Kosha (Instant 1-Click Demo)"}</span>
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#1E2533]" />
            </div>
            <div className="relative flex justify-center text-[10px] font-mono uppercase tracking-wider text-slate-500 bg-[#101418] px-2">
              or enter account credentials
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 font-mono text-xs">
          <div>
            <label className="block text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-9 pr-3 py-2 bg-transparent border border-[#1E2533] focus:border-white rounded text-white text-xs focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">
              Password
            </label>
            <div className="relative">
              <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 bg-transparent border border-[#1E2533] focus:border-white rounded text-white text-xs focus:outline-none transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || demoLoading}
            className="w-full py-2.5 px-4 bg-white/[0.08] hover:bg-white text-white hover:text-black border border-[#1E2533] rounded text-xs font-medium transition-colors flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In to Kosha"}
            {!loading && <ArrowRight className="w-3.5 h-3.5" />}
          </button>
        </form>

        <div className="text-center text-xs font-mono text-slate-500">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-white hover:underline font-medium">
            Sign up
          </Link>
        </div>

        <div className="pt-4 border-t border-[#1E2533] flex items-center justify-center gap-2 text-[10px] font-mono text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Zero-retention ephemeral ledger privacy</span>
        </div>
      </div>
    </div>
  );
}
