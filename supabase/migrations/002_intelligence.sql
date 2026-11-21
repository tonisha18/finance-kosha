-- Migration 002_intelligence.sql: Intelligence & Planning layer for MoneyModel Part 2

-- 1. Alerts
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

-- 2. Financial Profile
CREATE TABLE IF NOT EXISTS public.financial_profile (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_income NUMERIC(12,2),
  income_type TEXT,
  emergency_fund_target NUMERIC(12,2),
  emergency_fund_balance NUMERIC(12,2) DEFAULT 0,
  dependents INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Fixed Costs
CREATE TABLE IF NOT EXISTS public.fixed_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  due_day INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fixed_costs_user ON public.fixed_costs (user_id);

-- 4. Profile History
CREATE TABLE IF NOT EXISTS public.profile_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_history_user ON public.profile_history (user_id, changed_at DESC);

-- 5. Goals
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

-- 6. Saved Scenarios
CREATE TABLE IF NOT EXISTS public.saved_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  inputs JSONB NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_scenarios_user ON public.saved_scenarios (user_id, created_at DESC);

-- 7. Monthly Reports
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

-- 8. Guardrail Events
CREATE TABLE IF NOT EXISTS public.guardrail_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_excerpt TEXT NOT NULL,
  classification TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guardrail_events_user ON public.guardrail_events (user_id, created_at DESC);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardrail_events ENABLE ROW LEVEL SECURITY;

-- Alerts policies
CREATE POLICY "Users can manage own alerts" ON public.alerts
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Financial Profile policies
CREATE POLICY "Users can manage own profile" ON public.financial_profile
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Fixed Costs policies
CREATE POLICY "Users can manage own fixed costs" ON public.fixed_costs
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Profile History policies
CREATE POLICY "Users can manage own profile history" ON public.profile_history
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Goals policies
CREATE POLICY "Users can manage own goals" ON public.goals
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Saved Scenarios policies
CREATE POLICY "Users can manage own scenarios" ON public.saved_scenarios
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Monthly Reports policies
CREATE POLICY "Users can manage own reports" ON public.monthly_reports
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Guardrail Events policies
CREATE POLICY "Users can manage own guardrail events" ON public.guardrail_events
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
