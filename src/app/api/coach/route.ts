import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkInputGuardrail, checkOutputGuardrail } from "@/lib/guardrails";
import { generateJson, generateText } from "@/lib/llm";
import { redactPII } from "@/lib/redact";
import { z } from "zod";

// Rate limiting map: userId -> timestamps array
const rateLimitMap = new Map<string, number[]>();

const CoachRequestSchema = z.object({
  message: z.string().min(1).max(1000),
  chat_history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .optional(),
});

const IntentSchema = z.object({
  intent: z.enum([
    "spending_summary",
    "budget_status",
    "subscription_audit",
    "merchant_lookup",
    "goal_status",
    "cashflow_advice",
    "what_if",
    "general_education",
    "out_of_scope",
  ]),
  category: z.string().optional(),
  merchant: z.string().optional(),
  timeframe: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. In-memory rate limiting (max 30 requests per minute)
  const now = Date.now();
  const userTimestamps = (rateLimitMap.get(user.id) || []).filter((t) => now - t < 60000);
  if (userTimestamps.length >= 30) {
    return NextResponse.json(
      { error: "Too many messages. Please wait a moment before sending another." },
      { status: 429 }
    );
  }
  userTimestamps.push(now);
  rateLimitMap.set(user.id, userTimestamps);

  // 2. Validate request
  const body = await request.json();
  const parsed = CoachRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const { message, chat_history = [] } = parsed.data;

  // 3. Guardrail Pre-Check (Deterministic)
  const guardrailCheck = checkInputGuardrail(message);
  if (guardrailCheck.blocked) {
    const excerpt = redactPII(message).substring(0, 100);
    // Log to guardrail_events
    await supabase.from("guardrail_events").insert({
      user_id: user.id,
      message_excerpt: excerpt,
      classification: guardrailCheck.classification,
      action: "blocked_pre_check",
    });

    return NextResponse.json({
      reply: guardrailCheck.safeRedirect,
      metrics: null,
      guardrail_triggered: true,
    });
  }

  // 4. Intent Extraction
  let extractedIntent: z.infer<typeof IntentSchema> = {
    intent: "spending_summary",
  };

  try {
    const intentPrompt = `Classify the user intent from their query: "${message}".
Return valid JSON matching the schema.`;
    extractedIntent = await generateJson(
      IntentSchema,
      intentPrompt,
      "You are an intent extraction classifier for a personal finance assistant."
    );
  } catch {
    // Fallback intent detection via keywords
    const lower = message.toLowerCase();
    if (lower.includes("budget") || lower.includes("limit")) {
      extractedIntent.intent = "budget_status";
    } else if (lower.includes("subscription") || lower.includes("recurring") || lower.includes("netflix")) {
      extractedIntent.intent = "subscription_audit";
    } else if (lower.includes("goal") || lower.includes("save for")) {
      extractedIntent.intent = "goal_status";
    } else if (lower.includes("what if") || lower.includes("cut")) {
      extractedIntent.intent = "what_if";
    } else {
      extractedIntent.intent = "spending_summary";
    }
  }

  // 5. Fetch Ground Truth Data (Parameterized DB queries, all math in TypeScript)
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  const startOfMonth = `${year}-${month}-01`;

  // Fetch current month transactions
  const { data: currentTx } = await supabase
    .from("transactions")
    .select("category, amount, merchant, type")
    .eq("user_id", user.id)
    .gte("date", startOfMonth);

  // Fetch budgets
  const { data: budgets } = await supabase
    .from("category_budgets")
    .select("category, monthly_limit")
    .eq("user_id", user.id);

  // Fetch subscriptions
  const { data: subscriptions } = await supabase
    .from("subscriptions")
    .select("merchant, amount, frequency, status")
    .eq("user_id", user.id)
    .eq("status", "active");

  // Fetch goals
  const { data: goals } = await supabase
    .from("goals")
    .select("name, target_amount, current_amount, target_date, status")
    .eq("user_id", user.id);

  // Fetch profile
  const { data: profile } = await supabase
    .from("financial_profile")
    .select("monthly_income, emergency_fund_target, emergency_fund_balance")
    .eq("user_id", user.id)
    .single();

  // Compute ground truth summaries deterministically
  let totalSpentThisMonth = 0;
  let totalIncomeThisMonth = 0;
  const categoryTotals: Record<string, number> = {};
  const merchantTotals: Record<string, number> = {};

  if (currentTx) {
    for (const t of currentTx) {
      const amt = Number(t.amount);
      if (t.type === "debit") {
        totalSpentThisMonth += amt;
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + amt;
        merchantTotals[t.merchant] = (merchantTotals[t.merchant] || 0) + amt;
      } else if (t.type === "credit") {
        totalIncomeThisMonth += amt;
      }
    }
  }

  const topMerchants = Object.entries(merchantTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, total]) => ({ merchant: name, total: Math.round(total) }));

  const monthlySubscriptionTotal = (subscriptions || []).reduce(
    (acc, s) => acc + Number(s.amount),
    0
  );

  const budgetSummary = (budgets || []).map((b) => {
    const spent = categoryTotals[b.category] || 0;
    const limit = Number(b.monthly_limit);
    return {
      category: b.category,
      spent: Math.round(spent),
      limit: Math.round(limit),
      pctUsed: limit > 0 ? Math.round((spent / limit) * 100) : 0,
    };
  });

  const groundTruthContext = {
    currentMonth: `${year}-${month}`,
    totalSpentThisMonth: Math.round(totalSpentThisMonth),
    totalIncomeThisMonth: Math.round(totalIncomeThisMonth),
    monthlySurplus: Math.round(totalIncomeThisMonth - totalSpentThisMonth),
    topCategories: Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => ({ category: cat, spent: Math.round(amt) })),
    topMerchants,
    budgetStatus: budgetSummary,
    activeSubscriptions: (subscriptions || []).map((s) => ({
      merchant: s.merchant,
      amount: Math.round(Number(s.amount)),
      frequency: s.frequency,
    })),
    monthlySubscriptionTotal: Math.round(monthlySubscriptionTotal),
    savingsGoals: (goals || []).map((g) => ({
      name: g.name,
      target: Math.round(Number(g.target_amount)),
      current: Math.round(Number(g.current_amount)),
      status: g.status,
    })),
    emergencyFund: profile
      ? {
          current: Math.round(Number(profile.emergency_fund_balance || 0)),
          target: Math.round(Number(profile.emergency_fund_target || 0)),
        }
      : null,
  };

  // 6. Synthesize Response
  const prompt = `User question: "${message}"

GROUND TRUTH DATA (VERIFIED PRECOMPUTED NUMBERS):
${JSON.stringify(groundTruthContext, null, 2)}

RECENT CHAT HISTORY:
${chat_history
  .slice(-6)
  .map((m) => `${m.role}: ${m.content}`)
  .join("\n")}

Respond to the user as their supportive personal finance coach.
Rules:
- State exact figures in INR (₹) strictly from the verified ground truth data.
- NEVER perform your own arithmetic on unlisted items; if data is not available, state that clearly.
- Provide practical cash-flow, budgeting, and habit suggestions.
- Do NOT recommend any specific stocks, mutual funds, or crypto. Keep it focused on spending, budgeting, and savings.
- Keep response under 150 words. Be warm and encouraging.`;

  let replyText = "";
  try {
    replyText = await generateText(
      prompt,
      "You are MoneyModel's AI personal finance coach. Supportive, concise, and mathematically grounded in user's verified ledger."
    );
  } catch (err) {
    replyText = `Based on your records for this month, you have spent ₹${totalSpentThisMonth.toLocaleString(
      "en-IN"
    )} against ₹${totalIncomeThisMonth.toLocaleString(
      "en-IN"
    )} income, leaving an estimated surplus of ₹${Math.max(
      0,
      totalIncomeThisMonth - totalSpentThisMonth
    ).toLocaleString("en-IN")}. How can I assist you with your budgets or subscriptions?`;
  }

  // 7. Output Guardrail Filter
  const outputCheck = checkOutputGuardrail(replyText);
  if (outputCheck.blocked) {
    const excerpt = replyText.substring(0, 100);
    await supabase.from("guardrail_events").insert({
      user_id: user.id,
      message_excerpt: excerpt,
      classification: "output_filter_violation",
      action: "blocked_post_check",
    });
    replyText = outputCheck.cleanOutput;
  }

  return NextResponse.json({
    reply: replyText,
    metrics: {
      spent: totalSpentThisMonth,
      income: totalIncomeThisMonth,
      surplus: totalIncomeThisMonth - totalSpentThisMonth,
      subscriptionCost: monthlySubscriptionTotal,
      intent: extractedIntent.intent,
    },
  });
}
