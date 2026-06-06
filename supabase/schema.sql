-- ============================================================
-- School Fee Management System - Database Schema v2
-- Run this in your Supabase SQL Editor (supabase.com/dashboard)
-- ============================================================

-- ============================================================
-- MIGRATION: If you already have an existing database, run
-- ONLY the ALTER TABLE statements below first, then continue
-- with the CREATE TABLE for payment_transactions.
-- ============================================================
--
-- ALTER TABLE public.schools
--   ADD COLUMN IF NOT EXISTS fee_reset_type TEXT NOT NULL DEFAULT 'monthly'
--     CHECK (fee_reset_type IN ('monthly', 'term')),
--   ADD COLUMN IF NOT EXISTS class_fees JSONB NOT NULL DEFAULT '{}';
--
-- ALTER TABLE public.students
--   ADD COLUMN IF NOT EXISTS exam_fee_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
--
-- ALTER TABLE public.fee_records
--   ADD COLUMN IF NOT EXISTS fee_type TEXT NOT NULL DEFAULT 'school_fee'
--     CHECK (fee_type IN ('school_fee', 'exam_fee')),
--   ADD COLUMN IF NOT EXISTS due_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
--   ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
--   ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'unpaid'
--     CHECK (status IN ('unpaid', 'partial', 'paid')),
--   ADD COLUMN IF NOT EXISTS due_date DATE;
--
-- -- Migrate existing paid/unpaid data
-- UPDATE public.fee_records fr
--   SET status = CASE WHEN fr.paid THEN 'paid' ELSE 'unpaid' END,
--       paid_amount = CASE WHEN fr.paid THEN s.fee_amount ELSE 0 END,
--       due_amount = s.fee_amount
--   FROM public.students s WHERE s.id = fr.student_id;
--
-- -- Drop old unique constraint, add new one
-- ALTER TABLE public.fee_records
--   DROP CONSTRAINT IF EXISTS fee_records_student_id_month_year_key;
-- ALTER TABLE public.fee_records
--   ADD CONSTRAINT IF NOT EXISTS fee_records_student_month_year_type_key
--   UNIQUE (student_id, month, year, fee_type);
--
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.schools (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  address         TEXT,
  phone           TEXT,
  fee_reset_type  TEXT NOT NULL DEFAULT 'monthly'
                    CHECK (fee_reset_type IN ('monthly', 'term')),
  class_fees      JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  full_name   TEXT NOT NULL DEFAULT 'Unknown',
  role        TEXT NOT NULL DEFAULT 'staff'
                CHECK (role IN ('admin', 'school_owner', 'staff', 'demo')),
  school_id   UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.students (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  class           TEXT NOT NULL,
  fee_amount      NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  exam_fee_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (exam_fee_amount >= 0),
  parent_phone    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fee Records — one per student per period per fee type
CREATE TABLE IF NOT EXISTS public.fee_records (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  month       INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year        INTEGER NOT NULL CHECK (year >= 2000),
  fee_type    TEXT NOT NULL DEFAULT 'school_fee'
                CHECK (fee_type IN ('school_fee', 'exam_fee')),
  due_amount  NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (due_amount >= 0),
  paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status      TEXT NOT NULL DEFAULT 'unpaid'
                CHECK (status IN ('unpaid', 'partial', 'paid')),
  due_date    DATE,
  paid_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, month, year, fee_type)
);

-- Payment Transactions — individual payment events
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_record_id   UUID NOT NULL REFERENCES public.fee_records(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id       UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  amount          NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_method  TEXT NOT NULL CHECK (payment_method IN ('cash', 'online')),
  paid_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_profiles_school_id           ON public.profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_students_school_id           ON public.students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_class               ON public.students(school_id, class);
CREATE INDEX IF NOT EXISTS idx_fee_records_student          ON public.fee_records(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_records_school_period    ON public.fee_records(school_id, month, year);
CREATE INDEX IF NOT EXISTS idx_fee_records_status           ON public.fee_records(status);
CREATE INDEX IF NOT EXISTS idx_fee_records_type             ON public.fee_records(fee_type);
CREATE INDEX IF NOT EXISTS idx_transactions_fee_record      ON public.payment_transactions(fee_record_id);
CREATE INDEX IF NOT EXISTS idx_transactions_student         ON public.payment_transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_transactions_school          ON public.payment_transactions(school_id);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE OR REPLACE TRIGGER on_schools_updated
  BEFORE UPDATE ON public.schools FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE OR REPLACE TRIGGER on_profiles_updated
  BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE OR REPLACE TRIGGER on_students_updated
  BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE OR REPLACE TRIGGER on_fee_records_updated
  BEFORE UPDATE ON public.fee_records FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE OR REPLACE TRIGGER on_transactions_updated
  BEFORE UPDATE ON public.payment_transactions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_app_meta_data->>'role', 'staff')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.schools             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_records         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Schools
DROP POLICY IF EXISTS "admin_all_schools"           ON public.schools;
DROP POLICY IF EXISTS "school_user_read_own_school"  ON public.schools;
CREATE POLICY "admin_all_schools" ON public.schools FOR ALL
  USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');
CREATE POLICY "school_user_read_own_school" ON public.schools FOR SELECT
  USING (get_my_role() IN ('school_owner', 'staff') AND id = get_my_school_id());

-- Profiles
DROP POLICY IF EXISTS "read_own_profile"      ON public.profiles;
DROP POLICY IF EXISTS "admin_read_all"        ON public.profiles;
DROP POLICY IF EXISTS "admin_update_profiles" ON public.profiles;
DROP POLICY IF EXISTS "user_update_own"       ON public.profiles;
DROP POLICY IF EXISTS "system_insert"         ON public.profiles;
DROP POLICY IF EXISTS "admin_delete_profiles" ON public.profiles;
CREATE POLICY "read_own_profile"      ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "admin_read_all"        ON public.profiles FOR SELECT USING (get_my_role() = 'admin');
CREATE POLICY "admin_update_profiles" ON public.profiles FOR UPDATE
  USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');
CREATE POLICY "user_update_own"       ON public.profiles FOR UPDATE
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "system_insert"         ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "admin_delete_profiles" ON public.profiles FOR DELETE
  USING (get_my_role() = 'admin' AND id <> auth.uid());

-- Students
DROP POLICY IF EXISTS "admin_all_students"     ON public.students;
DROP POLICY IF EXISTS "school_manage_students" ON public.students;
CREATE POLICY "admin_all_students" ON public.students FOR ALL
  USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');
CREATE POLICY "school_manage_students" ON public.students FOR ALL
  USING (get_my_role() IN ('school_owner','staff') AND school_id = get_my_school_id())
  WITH CHECK (get_my_role() IN ('school_owner','staff') AND school_id = get_my_school_id());

-- Fee records
DROP POLICY IF EXISTS "admin_all_fee_records" ON public.fee_records;
DROP POLICY IF EXISTS "school_manage_fees"    ON public.fee_records;
CREATE POLICY "admin_all_fee_records" ON public.fee_records FOR ALL
  USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');
CREATE POLICY "school_manage_fees" ON public.fee_records FOR ALL
  USING (get_my_role() IN ('school_owner','staff') AND school_id = get_my_school_id())
  WITH CHECK (get_my_role() IN ('school_owner','staff') AND school_id = get_my_school_id());

-- Payment transactions
DROP POLICY IF EXISTS "admin_all_transactions"    ON public.payment_transactions;
DROP POLICY IF EXISTS "school_manage_transactions" ON public.payment_transactions;
CREATE POLICY "admin_all_transactions" ON public.payment_transactions FOR ALL
  USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');
CREATE POLICY "school_manage_transactions" ON public.payment_transactions FOR ALL
  USING (get_my_role() IN ('school_owner','staff') AND school_id = get_my_school_id())
  WITH CHECK (get_my_role() IN ('school_owner','staff') AND school_id = get_my_school_id());

-- ============================================================
-- FIRST ADMIN SETUP
-- After your first signup, run:
-- UPDATE public.profiles SET role = 'admin', school_id = NULL
-- WHERE email = 'your-email@example.com';
-- ============================================================
