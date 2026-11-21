-- Migration 001_core.sql: Core schema with RLS for MoneyModel Part 1

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

-- ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorization_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_budgets ENABLE ROW LEVEL SECURITY;

-- POLICIES
-- Profiles
CREATE POLICY "Users can manage own profile" ON public.profiles
  FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Import Batches
CREATE POLICY "Users can manage own import batches" ON public.import_batches
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Transactions
CREATE POLICY "Users can manage own transactions" ON public.transactions
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Category Rules
CREATE POLICY "Users can manage own rules" ON public.category_rules
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Categorization Feedback
CREATE POLICY "Users can manage own feedback" ON public.categorization_feedback
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Subscriptions
CREATE POLICY "Users can manage own subscriptions" ON public.subscriptions
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Category Budgets
CREATE POLICY "Users can manage own budgets" ON public.category_budgets
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Automatic profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
