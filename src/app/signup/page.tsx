"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Mail, User, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: name,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
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
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-[#0F172A] p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#1E293B] rounded-2xl shadow-xl border border-[#E5E7EB] dark:border-[#334155] p-8">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-[#0F172A] dark:bg-white rounded-2xl flex items-center justify-center text-white dark:text-[#0F172A] text-xl font-bold mx-auto mb-4 shadow-md">
            M
          </div>
          <h1 className="text-2xl font-bold text-[#0F172A] dark:text-white tracking-tight">
            Create your account
          </h1>
          <p className="text-sm text-[#4B5563] dark:text-[#9CA3AF] mt-1">
            Build your personal finance model with privacy first
          </p>
        </div>

        {/* Instant Demo Button */}
        <div className="mb-6">
          <button
            type="button"
            onClick={handleInstantDemo}
            disabled={demoLoading || loading}
            className="w-full py-2.5 px-4 bg-[#F1F5F9] dark:bg-[#334155] hover:bg-[#E2E8F0] dark:hover:bg-[#475569] text-[#0F172A] dark:text-white border border-[#E5E7EB] dark:border-[#475569] rounded-xl text-xs font-bold tracking-wide uppercase transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-[#0F172A] dark:text-white" />
            <span>{demoLoading ? "Initializing Demo Account..." : "Instant Demo Access (1-Click)"}</span>
          </button>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E5E7EB] dark:border-[#334155]" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider text-[#9CA3AF] bg-white dark:bg-[#1E293B] px-2">
              or create personal account
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 rounded-xl text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#0F172A] dark:text-white mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Rohit Sharma"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#475569] bg-white dark:bg-[#0F172A] text-[#0F172A] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0F172A] dark:focus:ring-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F172A] dark:text-white mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#475569] bg-white dark:bg-[#0F172A] text-[#0F172A] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0F172A] dark:focus:ring-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F172A] dark:text-white mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#475569] bg-white dark:bg-[#0F172A] text-[#0F172A] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0F172A] dark:focus:ring-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || demoLoading}
            className="w-full py-2.5 px-4 bg-[#0F172A] hover:bg-black dark:bg-white dark:text-[#0F172A] disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 mt-6 shadow-sm"
          >
            {loading ? "Creating account..." : "Sign Up"}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-[#4B5563] dark:text-[#9CA3AF]">
          Already have an account?{" "}
          <Link href="/login" className="text-[#0F172A] dark:text-white font-bold hover:underline">
            Sign in
          </Link>
        </div>

        <div className="mt-8 pt-6 border-t border-[#E5E7EB] dark:border-[#334155] flex items-center justify-center gap-2 text-[11px] text-[#4B5563] dark:text-[#9CA3AF]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#0F172A] dark:text-white" />
          <span>Zero-retention ephemeral statement security</span>
        </div>
      </div>
    </div>
  );
}
