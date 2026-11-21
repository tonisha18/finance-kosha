import { computeDedupeHash } from "./dedupe";
import { detectRecurringSubscriptions } from "./recurring";

export async function seedDemoDataForUser(supabase: any, userId: string) {
  const now = new Date();
  const demoTransactions: any[] = [];

  const fmt = (y: number, m: number, d: number) => {
    const mm = String(m + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  };

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // 1. Budgets
  const defaultBudgets = [
    { category: "Food & Dining", monthly_limit: 12000 },
    { category: "Groceries", monthly_limit: 15000 },
    { category: "Rent & Housing", monthly_limit: 35000 },
    { category: "Utilities", monthly_limit: 6000 },
    { category: "Transport", monthly_limit: 8000 },
    { category: "Shopping", monthly_limit: 10000 },
    { category: "Entertainment & Subscriptions", monthly_limit: 3000 },
    { category: "Healthcare", monthly_limit: 5000 },
  ];

  for (const b of defaultBudgets) {
    await supabase.from("category_budgets").upsert(
      {
        user_id: userId,
        category: b.category,
        monthly_limit: b.monthly_limit,
      },
      { onConflict: "user_id,category" }
    );
  }

  // 2. Loop through past 5 months + current month (6 months total)
  for (let i = 5; i >= 0; i--) {
    const dt = new Date(currentYear, currentMonth - i, 1);
    const y = dt.getFullYear();
    const m = dt.getMonth();

    // Salary credit
    demoTransactions.push({
      date: fmt(y, m, 1),
      merchant: "Acme Technologies (Salary)",
      raw_description_redacted: "NEFT/Acme Corp Payroll Oct",
      amount: 110000.0,
      type: "credit",
      category: "Income/Salary",
      category_source: "dictionary",
      confidence: 1.0,
      needs_review: false,
      is_demo: true,
    });

    // Rent
    demoTransactions.push({
      date: fmt(y, m, 3),
      merchant: "House Rent",
      raw_description_redacted: "UPI/Rent to Landlord",
      amount: 32000.0,
      type: "debit",
      category: "Rent & Housing",
      category_source: "dictionary",
      confidence: 1.0,
      needs_review: false,
      is_demo: true,
    });

    // Netflix with price hike (649 -> 799)
    const netflixAmt = i <= 1 ? 799.0 : 649.0;
    demoTransactions.push({
      date: fmt(y, m, 15),
      merchant: "Netflix",
      raw_description_redacted: "Netflix India Monthly Plan",
      amount: netflixAmt,
      type: "debit",
      category: "Entertainment & Subscriptions",
      category_source: "dictionary",
      confidence: 1.0,
      needs_review: false,
      is_recurring: true,
      is_demo: true,
    });

    // Spotify
    demoTransactions.push({
      date: fmt(y, m, 20),
      merchant: "Spotify",
      raw_description_redacted: "Spotify Premium Recurring",
      amount: 119.0,
      type: "debit",
      category: "Entertainment & Subscriptions",
      category_source: "dictionary",
      confidence: 1.0,
      needs_review: false,
      is_recurring: true,
      is_demo: true,
    });

    // Airtel Broadband
    demoTransactions.push({
      date: fmt(y, m, 10),
      merchant: "Airtel Broadband",
      raw_description_redacted: "Airtel Fibernet Auto-Debit",
      amount: 1179.0,
      type: "debit",
      category: "Utilities",
      category_source: "dictionary",
      confidence: 1.0,
      needs_review: false,
      is_recurring: true,
      is_demo: true,
    });

    // Groceries
    demoTransactions.push({
      date: fmt(y, m, 5),
      merchant: "Blinkit",
      raw_description_redacted: "Blinkit Instant Groceries",
      amount: 1850.0,
      type: "debit",
      category: "Groceries",
      category_source: "dictionary",
      confidence: 1.0,
      needs_review: false,
      is_demo: true,
    });
    demoTransactions.push({
      date: fmt(y, m, 14),
      merchant: "Zepto",
      raw_description_redacted: "Zepto Order",
      amount: 1420.0,
      type: "debit",
      category: "Groceries",
      category_source: "dictionary",
      confidence: 1.0,
      needs_review: false,
      is_demo: true,
    });
    demoTransactions.push({
      date: fmt(y, m, 22),
      merchant: "DMart",
      raw_description_redacted: "DMart Supermarket Bangalore",
      amount: 4200.0,
      type: "debit",
      category: "Groceries",
      category_source: "dictionary",
      confidence: 1.0,
      needs_review: false,
      is_demo: true,
    });

    // Food Delivery
    demoTransactions.push({
      date: fmt(y, m, 8),
      merchant: "Swiggy",
      raw_description_redacted: "Swiggy Food Delivery",
      amount: 540.0,
      type: "debit",
      category: "Food & Dining",
      category_source: "dictionary",
      confidence: 1.0,
      needs_review: false,
      is_demo: true,
    });
    demoTransactions.push({
      date: fmt(y, m, 18),
      merchant: "Zomato",
      raw_description_redacted: "Zomato Restaurant Order",
      amount: 720.0,
      type: "debit",
      category: "Food & Dining",
      category_source: "dictionary",
      confidence: 1.0,
      needs_review: false,
      is_demo: true,
    });
    demoTransactions.push({
      date: fmt(y, m, 27),
      merchant: "Swiggy Instamart",
      raw_description_redacted: "Swiggy Instamart Late Night",
      amount: 410.0,
      type: "debit",
      category: "Food & Dining",
      category_source: "dictionary",
      confidence: 1.0,
      needs_review: false,
      is_demo: true,
    });

    // Transport
    demoTransactions.push({
      date: fmt(y, m, 12),
      merchant: "Uber",
      raw_description_redacted: "Uber Trip Koramangala",
      amount: 380.0,
      type: "debit",
      category: "Transport",
      category_source: "dictionary",
      confidence: 1.0,
      needs_review: false,
      is_demo: true,
    });
    demoTransactions.push({
      date: fmt(y, m, 24),
      merchant: "Ola Cabs",
      raw_description_redacted: "Ola Ride Bangalore",
      amount: 290.0,
      type: "debit",
      category: "Transport",
      category_source: "dictionary",
      confidence: 1.0,
      needs_review: false,
      is_demo: true,
    });

    // Shopping
    demoTransactions.push({
      date: fmt(y, m, 16),
      merchant: "Amazon",
      raw_description_redacted: "Amazon India Marketplace",
      amount: 2499.0,
      type: "debit",
      category: "Shopping",
      category_source: "dictionary",
      confidence: 1.0,
      needs_review: false,
      is_demo: true,
    });

    // Utilities / Electricity
    demoTransactions.push({
      date: fmt(y, m, 9),
      merchant: "BESCOM Electricity",
      raw_description_redacted: "BESCOM Online Bill Pay",
      amount: 1450.0,
      type: "debit",
      category: "Utilities",
      category_source: "dictionary",
      confidence: 1.0,
      needs_review: false,
      is_demo: true,
    });

    // Healthcare
    demoTransactions.push({
      date: fmt(y, m, 21),
      merchant: "Apollo Pharmacy",
      raw_description_redacted: "Apollo Pharmacy Indiranagar",
      amount: 850.0,
      type: "debit",
      category: "Healthcare",
      category_source: "dictionary",
      confidence: 1.0,
      needs_review: false,
      is_demo: true,
    });
  }

  // Compute dedupe hashes and insert in chunks
  const rowsToInsert = demoTransactions.map((t, idx) => ({
    id: `demo_tx_${userId.slice(0, 8)}_${idx}`,
    user_id: userId,
    ...t,
    dedupe_hash: computeDedupeHash(
      userId,
      t.date,
      t.amount,
      t.merchant,
      t.type
    ),
  }));

  const chunkSize = 50;
  for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
    const chunk = rowsToInsert.slice(i, i + chunkSize);
    await supabase.from("transactions").upsert(chunk, { onConflict: "user_id,dedupe_hash" });
  }

  // 3. Subscriptions detection & upsert
  const { subscriptions: activeSubs } = detectRecurringSubscriptions(
    rowsToInsert.map((r) => ({
      id: r.id,
      merchant: r.merchant,
      amount: r.amount,
      date: r.date,
      type: r.type as "debit" | "credit",
    }))
  );

  for (const s of activeSubs) {
    await supabase.from("subscriptions").upsert(
      {
        user_id: userId,
        merchant: s.merchant,
        amount: s.amount,
        previous_amount: s.previous_amount,
        frequency: s.frequency,
        last_billed_date: s.last_billed_date,
        next_expected_date: s.next_expected_date,
        status: "active",
        is_demo: true,
      },
      { onConflict: "user_id,merchant" }
    );
  }

  // 4. Financial Profile & Fixed Costs
  await supabase.from("financial_profile").upsert(
    {
      user_id: userId,
      monthly_income: 110000,
      payday_date: 1,
      emergency_fund_target: 330000,
      emergencyFundBalance: 180000,
      risk_profile: "moderate",
    },
    { onConflict: "user_id" }
  );

  const fixedCosts = [
    { name: "House Rent", amount: 32000, due_day: 3 },
    { name: "Airtel Broadband", amount: 1179, due_day: 10 },
  ];

  for (const f of fixedCosts) {
    await supabase.from("fixed_costs").upsert(
      {
        user_id: userId,
        name: f.name,
        amount: f.amount,
        due_day: f.due_day,
      },
      { onConflict: "user_id,name" }
    );
  }

  // 5. Goals
  const sampleGoals = [
    {
      name: "Emergency Fund (6 Months)",
      target_amount: 330000,
      current_amount: 180000,
      target_date: "2027-06-30",
      priority: 1,
      category: "emergency",
      is_demo: true,
    },
    {
      name: "Europe Vacation Fund",
      target_amount: 250000,
      current_amount: 75000,
      target_date: "2027-10-31",
      priority: 2,
      category: "travel",
      is_demo: true,
    },
    {
      name: "New Electric Vehicle Down-Payment",
      target_amount: 400000,
      current_amount: 120000,
      target_date: "2028-03-31",
      priority: 3,
      category: "vehicle",
      is_demo: true,
    },
  ];

  for (const g of sampleGoals) {
    await supabase.from("goals").upsert(
      {
        user_id: userId,
        ...g,
      },
      { onConflict: "user_id,name" }
    );
  }

  // 6. Proactive Alerts
  const sampleAlerts = [
    {
      user_id: userId,
      dedup_key: `price_hike_netflix_${userId}`,
      alert_type: "subscription_price_hike",
      severity: "warning",
      title: "Subscription Price Hike Detected: Netflix",
      body: "Netflix auto-debit increased from ₹649 to ₹799 (+23.1% / +₹150/mo). Check your subscription settings.",
      metadata: { merchant: "Netflix", previous: 649, current: 799, hike_pct: 23 },
      is_read: false,
      is_demo: true,
    },
    {
      user_id: userId,
      dedup_key: `budget_pacing_dining_${userId}`,
      alert_type: "budget_pacing",
      severity: "warning",
      title: "Budget Run-Rate Alert: Food & Dining",
      body: "Food & Dining spend is pacing at 88% of monthly limit with 10 days remaining in the billing cycle.",
      metadata: { category: "Food & Dining", limit: 12000, current: 10560 },
      is_read: false,
      is_demo: true,
    },
  ];

  for (const a of sampleAlerts) {
    await supabase.from("alerts").upsert(a, { onConflict: "dedup_key" });
  }

  return { success: true, count: rowsToInsert.length };
}
