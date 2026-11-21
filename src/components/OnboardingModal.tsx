"use client";

import { useState, useEffect } from "react";
import { Sparkles, ArrowRight, ArrowLeft, Check, Plus, Trash2, ShieldCheck, Target, Wallet } from "lucide-react";

interface FixedCostItem {
  name: string;
  amount: number;
  due_day?: number;
}

export function OnboardingModal({ onComplete }: { onComplete?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form states
  const [monthlyIncome, setMonthlyIncome] = useState(90000);
  const [incomeType, setIncomeType] = useState("salaried");
  const [detectedIncome, setDetectedIncome] = useState(0);

  const [fixedCosts, setFixedCosts] = useState<FixedCostItem[]>([
    { name: "Rent & Maintenance", amount: 25000, due_day: 1 },
    { name: "Electricity & Utilities", amount: 3500, due_day: 10 },
    { name: "Internet & WiFi", amount: 1199, due_day: 5 },
  ]);

  const [emergencyFundTarget, setEmergencyFundTarget] = useState(180000);
  const [emergencyFundBalance, setEmergencyFundBalance] = useState(50000);
  const [goalName, setGoalName] = useState("Emergency Reserve");
  const [goalTarget, setGoalTarget] = useState(150000);
  const [goalDate, setGoalDate] = useState("2027-06-30");

  useEffect(() => {
    async function checkProfile() {
      try {
        const res = await fetch("/api/profile");
        if (res.ok) {
          const data = await res.json();
          if (!data.profile) {
            setIsOpen(true);
            if (data.detectedMonthlyIncome > 0) {
              setDetectedIncome(data.detectedMonthlyIncome);
              setMonthlyIncome(data.detectedMonthlyIncome);
              setEmergencyFundTarget(data.detectedMonthlyIncome * 3);
            }
          }
        }
      } catch {}
    }
    checkProfile();
  }, []);

  const addFixedCost = () => {
    setFixedCosts([...fixedCosts, { name: "", amount: 0, due_day: 1 }]);
  };

  const removeFixedCost = (index: number) => {
    setFixedCosts(fixedCosts.filter((_, i) => i !== index));
  };

  const updateFixedCost = (index: number, field: keyof FixedCostItem, value: any) => {
    const updated = [...fixedCosts];
    updated[index] = { ...updated[index], [field]: value };
    setFixedCosts(updated);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthly_income: monthlyIncome,
          income_type: incomeType,
          emergency_fund_target: emergencyFundTarget,
          emergency_fund_balance: emergencyFundBalance,
          dependents: 0,
          fixed_costs: fixedCosts.filter((f) => f.name && f.amount > 0),
        }),
      });

      // Also create starter goal if provided
      if (goalName && goalTarget > 0) {
        await fetch("/api/goals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: goalName,
            target_amount: goalTarget,
            current_amount: emergencyFundBalance,
            target_date: goalDate,
            priority: 1,
          }),
        });
      }

      setIsOpen(false);
      onComplete?.();
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1E293B] rounded-3xl border border-[#E5E7EB]/50 dark:border-[#4B5563] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-6 bg-[#FFFFFF] dark:bg-[#0F172A] border-b border-[#E5E7EB]/40 dark:border-[#4B5563] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0F172A] flex items-center justify-center text-white font-bold shadow-md shadow-[#0F172A]/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0F172A] dark:text-[#FFFFFF]">
                Build Your Living Money Model
              </h3>
              <p className="text-xs text-[#4B5563] dark:text-[#E5E7EB]">
                Step {step} of 3: {step === 1 ? "Income & Cashflow" : step === 2 ? "Fixed Commitments" : "Goals & Safety Net"}
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-[#0F172A] px-2.5 py-1 rounded-full bg-[#0F172A]/15">
            {step}/3
          </span>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex-1 space-y-5">
          {/* STEP 1: Income */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#FFFFFF] mb-1.5">
                  Monthly Take-Home Income (₹)
                </label>
                <input
                  type="number"
                  value={monthlyIncome}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setMonthlyIncome(val);
                    setEmergencyFundTarget(val * 3);
                  }}
                  className="w-full text-lg font-bold px-4 py-3 rounded-2xl border border-[#E5E7EB]/60 dark:border-[#4B5563] bg-[#FFFFFF] dark:bg-[#1E293B] text-[#0F172A] dark:text-[#FFFFFF] focus:outline-none focus:ring-2 focus:ring-[#0F172A]"
                />
                {detectedIncome > 0 && (
                  <p className="text-xs text-[#0F172A] mt-1.5 font-medium flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Detected ~₹{detectedIncome.toLocaleString("en-IN")}/mo from salary deposits.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#FFFFFF] mb-1.5">
                  Income Source Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["salaried", "freelance", "business"].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setIncomeType(type)}
                      className={`py-2.5 px-3 text-xs font-semibold rounded-xl capitalize border transition-all ${
                        incomeType === type
                          ? "bg-[#0F172A] text-white border-[#0F172A] shadow-sm"
                          : "bg-white dark:bg-[#1E293B] text-[#4B5563] dark:text-[#E5E7EB] border-[#E5E7EB]/40 dark:border-[#4B5563]"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Fixed Costs */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#FFFFFF]">
                  Monthly Fixed Costs (Rent, EMIs, Bills)
                </label>
                <button
                  type="button"
                  onClick={addFixedCost}
                  className="text-xs text-[#0F172A] font-semibold flex items-center gap-1 hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Row
                </button>
              </div>

              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {fixedCosts.map((fc, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={fc.name}
                      placeholder="Expense name"
                      onChange={(e) => updateFixedCost(idx, "name", e.target.value)}
                      className="flex-1 text-xs px-3 py-2 rounded-xl border border-[#E5E7EB]/50 dark:border-[#4B5563] bg-[#FFFFFF] dark:bg-[#1E293B] text-[#0F172A] dark:text-[#FFFFFF]"
                    />
                    <input
                      type="number"
                      value={fc.amount || ""}
                      placeholder="₹ Amount"
                      onChange={(e) => updateFixedCost(idx, "amount", Number(e.target.value))}
                      className="w-28 text-xs font-semibold px-3 py-2 rounded-xl border border-[#E5E7EB]/50 dark:border-[#4B5563] bg-[#FFFFFF] dark:bg-[#1E293B] text-[#0F172A] dark:text-[#FFFFFF]"
                    />
                    <button
                      type="button"
                      onClick={() => removeFixedCost(idx)}
                      className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-[#E5E7EB]/15 dark:bg-[#4B5563]/30 text-xs text-[#4B5563] dark:text-[#E5E7EB] flex justify-between font-semibold">
                <span>Total Fixed Commitments:</span>
                <span className="text-[#0F172A] dark:text-[#FFFFFF] font-bold">
                  ₹{fixedCosts.reduce((acc, f) => acc + (f.amount || 0), 0).toLocaleString("en-IN")}/mo
                </span>
              </div>
            </div>
          )}

          {/* STEP 3: Goals & Emergency Fund */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#FFFFFF] mb-1">
                  Emergency Fund Target (Default ~3-6 mo expenses)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-0.5">Target (₹)</span>
                    <input
                      type="number"
                      value={emergencyFundTarget}
                      onChange={(e) => setEmergencyFundTarget(Number(e.target.value))}
                      className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-[#E5E7EB]/50 dark:border-[#4B5563] bg-[#FFFFFF] dark:bg-[#1E293B] text-[#0F172A] dark:text-[#FFFFFF]"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-0.5">Current Saved (₹)</span>
                    <input
                      type="number"
                      value={emergencyFundBalance}
                      onChange={(e) => setEmergencyFundBalance(Number(e.target.value))}
                      className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-[#E5E7EB]/50 dark:border-[#4B5563] bg-[#FFFFFF] dark:bg-[#1E293B] text-[#0F172A] dark:text-[#FFFFFF]"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-[#E5E7EB]/30 dark:border-[#4B5563]">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#FFFFFF] mb-1.5">
                  Add Your Primary Savings Goal
                </label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={goalName}
                    placeholder="e.g. Vacation to Europe or Car Down Payment"
                    onChange={(e) => setGoalName(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-[#E5E7EB]/50 dark:border-[#4B5563] bg-[#FFFFFF] dark:bg-[#1E293B] text-[#0F172A] dark:text-[#FFFFFF]"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-0.5">Goal Amount (₹)</span>
                      <input
                        type="number"
                        value={goalTarget}
                        onChange={(e) => setGoalTarget(Number(e.target.value))}
                        className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-[#E5E7EB]/50 dark:border-[#4B5563] bg-[#FFFFFF] dark:bg-[#1E293B] text-[#0F172A] dark:text-[#FFFFFF]"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-0.5">Target Date</span>
                      <input
                        type="date"
                        value={goalDate}
                        onChange={(e) => setGoalDate(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-[#E5E7EB]/50 dark:border-[#4B5563] bg-[#FFFFFF] dark:bg-[#1E293B] text-[#0F172A] dark:text-[#FFFFFF]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#FFFFFF] dark:bg-[#0F172A] border-t border-[#E5E7EB]/40 dark:border-[#4B5563] flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl text-[#4B5563] dark:text-[#E5E7EB] hover:bg-[#E5E7EB]/20 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs text-slate-400 hover:text-slate-600 px-3 py-2"
            >
              Skip for now
            </button>
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-[#0F172A] hover:bg-[#020617] text-white shadow-sm transition-colors"
            >
              Next <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={handleSubmit}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-[#0F172A] hover:bg-[#020617] text-white shadow-md shadow-[#0F172A]/20 transition-all disabled:opacity-50"
            >
              {loading ? "Activating Model..." : "Launch My Model"}
              <Check className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
