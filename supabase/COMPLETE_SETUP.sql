-- ====================================================================
-- MONEYMODEL COACH: COMPLETE DATABASE MIGRATION SCRIPT
-- Safe, Idempotent: Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/suojdayxnhyrbpcaytee/sql/new
-- ====================================================================

-- 1. Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Import Batches
CREATE TABLE IF NOT EXISTS public.import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('pdf', 'xlsx', 'csv', 'sms')),
  file_name TEXT,
  rows_found INT NOT NULL DEFAULT 0,
  rows_inserted INT NOT NULL DEFAULT 0,
  rows_duplicate INT NOT NULL DEFAULT 0,
  rows_dropped INT NOT NULL DEFAULT 0,
  needs_review INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  merchant TEXT NOT NULL,
  raw_description_redacted TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  type TEXT NOT NULL CHECK (type IN ('debit', 'credit')),
  category TEXT NOT NULL,
  category_source TEXT NOT NULL CHECK (category_source IN ('rule', 'dictionary', 'llm', 'user')),
  confidence NUMERIC(3,2) DEFAULT 1.00,
  needs_review BOOLEAN DEFAULT false,
  is_recurring BOOLEAN DEFAULT false,
  is_demo BOOLEAN DEFAULT false,
  dedupe_hash TEXT NOT NULL,
  import_batch_id UUID REFERENCES public.import_batches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_dedupe UNIQUE (user_id, dedupe_hash)
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_cat ON public.transactions (user_id, category);

-- 4. Category Rules
CREATE TABLE IF NOT EXISTS public.category_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_keyword TEXT NOT NULL,
  category TEXT NOT NULL,
  hit_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_keyword UNIQUE (user_id, merchant_keyword)
);

CREATE INDEX IF NOT EXISTS idx_category_rules_user ON public.category_rules (user_id);

-- 5. Categorization Feedback
CREATE TABLE IF NOT EXISTS public.categorization_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
  old_category TEXT,
  new_category TEXT NOT NULL,
  rule_created BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_user ON public.categorization_feedback (user_id, created_at DESC);

-- 6. Subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  previous_amount NUMERIC(12,2),
  frequency TEXT CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')) DEFAULT 'monthly',
  last_billed_date DATE,
  next_expected_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'unused')),
  is_demo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_merchant UNIQUE (user_id, merchant)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions (user_id);

-- 7. Category Budgets
CREATE TABLE IF NOT EXISTS public.category_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  monthly_limit NUMERIC(12,2) NOT NULL CHECK (monthly_limit > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_category UNIQUE (user_id, category)
);

CREATE INDEX IF NOT EXISTS idx_budgets_user ON public.category_budgets (user_id);

-- 8. Alerts
CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('price_hike','budget_drift','upcoming_renewal','new_subscription','goal_risk','anomaly','missing_charge')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
  dedup_key TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  is_demo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_dedup_key UNIQUE (user_id, dedup_key)
);

CREATE INDEX IF NOT EXISTS idx_alerts_user_created ON public.alerts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_user_unread ON public.alerts (user_id, is_read);

-- 9. Financial Profile
CREATE TABLE IF NOT EXISTS public.financial_profile (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_income NUMERIC(12,2),
  income_type TEXT,
  emergency_fund_target NUMERIC(12,2),
  emergency_fund_balance NUMERIC(12,2) DEFAULT 0,
  dependents INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Fixed Costs
CREATE TABLE IF NOT EXISTS public.fixed_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  due_day INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fixed_costs_user ON public.fixed_costs (user_id);

-- 11. Profile History
CREATE TABLE IF NOT EXISTS public.profile_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_history_user ON public.profile_history (user_id, changed_at DESC);

-- 12. Goals
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount NUMERIC(12,2) NOT NULL,
  current_amount NUMERIC(12,2) DEFAULT 0,
  target_date DATE NOT NULL,
  priority INT DEFAULT 1,
  status TEXT DEFAULT 'active',
  is_demo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goals_user ON public.goals (user_id, priority ASC);

-- 13. Saved Scenarios
CREATE TABLE IF NOT EXISTS public.saved_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  inputs JSONB NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_scenarios_user ON public.saved_scenarios (user_id, created_at DESC);

-- 14. Monthly Reports
CREATE TABLE IF NOT EXISTS public.monthly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  data JSONB NOT NULL,
  narrative TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_report_month UNIQUE (user_id, month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_reports_user ON public.monthly_reports (user_id, month DESC);

-- 15. Guardrail Events
CREATE TABLE IF NOT EXISTS public.guardrail_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_excerpt TEXT NOT NULL,
  classification TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guardrail_events_user ON public.guardrail_events (user_id, created_at DESC);

-- ====================================================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorization_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardrail_events ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- RLS POLICIES (DROP IF EXISTS first to avoid duplicate errors)
-- ====================================================================

DO $$
BEGIN
  -- Profiles
  DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
  CREATE POLICY "Users can manage own profile" ON public.profiles FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());

  -- Import Batches
  DROP POLICY IF EXISTS "Users can manage own import batches" ON public.import_batches;
  CREATE POLICY "Users can manage own import batches" ON public.import_batches FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

  -- Transactions
  DROP POLICY IF EXISTS "Users can manage own transactions" ON public.transactions;
  CREATE POLICY "Users can manage own transactions" ON public.transactions FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

  -- Category Rules
  DROP POLICY IF EXISTS "Users can manage own rules" ON public.category_rules;
  CREATE POLICY "Users can manage own rules" ON public.category_rules FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

  -- Feedback
  DROP POLICY IF EXISTS "Users can manage own feedback" ON public.categorization_feedback;
  CREATE POLICY "Users can manage own feedback" ON public.categorization_feedback FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

  -- Subscriptions
  DROP POLICY IF EXISTS "Users can manage own subscriptions" ON public.subscriptions;
  CREATE POLICY "Users can manage own subscriptions" ON public.subscriptions FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

  -- Budgets
  DROP POLICY IF EXISTS "Users can manage own budgets" ON public.category_budgets;
  CREATE POLICY "Users can manage own budgets" ON public.category_budgets FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

  -- Alerts
  DROP POLICY IF EXISTS "Users can manage own alerts" ON public.alerts;
  CREATE POLICY "Users can manage own alerts" ON public.alerts FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

  -- Financial Profile
  DROP POLICY IF EXISTS "Users can manage own profile" ON public.financial_profile;
  CREATE POLICY "Users can manage own profile" ON public.financial_profile FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

  -- Fixed Costs
  DROP POLICY IF EXISTS "Users can manage own fixed costs" ON public.fixed_costs;
  CREATE POLICY "Users can manage own fixed costs" ON public.fixed_costs FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

  -- Profile History
  DROP POLICY IF EXISTS "Users can manage own profile history" ON public.profile_history;
  CREATE POLICY "Users can manage own profile history" ON public.profile_history FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

  -- Goals
  DROP POLICY IF EXISTS "Users can manage own goals" ON public.goals;
  CREATE POLICY "Users can manage own goals" ON public.goals FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

  -- Scenarios
  DROP POLICY IF EXISTS "Users can manage own scenarios" ON public.saved_scenarios;
  CREATE POLICY "Users can manage own scenarios" ON public.saved_scenarios FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

  -- Monthly Reports
  DROP POLICY IF EXISTS "Users can manage own reports" ON public.monthly_reports;
  CREATE POLICY "Users can manage own reports" ON public.monthly_reports FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

  -- Guardrail Events
  DROP POLICY IF EXISTS "Users can manage own guardrail events" ON public.guardrail_events;
  CREATE POLICY "Users can manage own guardrail events" ON public.guardrail_events FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
END $$;

-- Automatic profile trigger on user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Reload PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
