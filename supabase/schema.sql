-- ============================================================
-- School Fee Management System - Database Schema
-- Run this in your Supabase SQL Editor (supabase.com/dashboard)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- Schools
CREATE TABLE IF NOT EXISTS public.schools (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  address     TEXT,
  phone       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  full_name   TEXT NOT NULL DEFAULT 'Unknown',
  role        TEXT NOT NULL DEFAULT 'staff'
                CHECK (role IN ('admin', 'school_owner', 'staff')),
  school_id   UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Students
CREATE TABLE IF NOT EXISTS public.students (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  class         TEXT NOT NULL,
  fee_amount    NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  parent_phone  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Monthly Fee Records
CREATE TABLE IF NOT EXISTS public.fee_records (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  month       INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year        INTEGER NOT NULL CHECK (year >= 2000),
  paid        BOOLEAN NOT NULL DEFAULT FALSE,
  paid_date   TIMESTAMPTZ,
  paid_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, month, year)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_profiles_school_id ON public.profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_students_school_id ON public.students(school_id);
CREATE INDEX IF NOT EXISTS idx_fee_records_student_id ON public.fee_records(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_records_school_month ON public.fee_records(school_id, month, year);
CREATE INDEX IF NOT EXISTS idx_fee_records_paid ON public.fee_records(paid);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_schools_updated
  BEFORE UPDATE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER on_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER on_students_updated
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER on_fee_records_updated
  BEFORE UPDATE ON public.fee_records
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_app_meta_data->>'role', 'staff')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.schools    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_records ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTIONS (SECURITY DEFINER - kept in public schema
-- but only reads from profiles which is protected)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- SCHOOLS POLICIES
-- ============================================================

-- Admin: full access
CREATE POLICY "admin_all_schools" ON public.schools
  FOR ALL
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- School owner & staff: read their own school
CREATE POLICY "school_user_read_own_school" ON public.schools
  FOR SELECT
  USING (
    get_my_role() IN ('school_owner', 'staff')
    AND id = get_my_school_id()
  );

-- ============================================================
-- PROFILES POLICIES
-- ============================================================

-- Any authenticated user can read their own profile
CREATE POLICY "read_own_profile" ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

-- Admin can read all profiles
CREATE POLICY "admin_read_all_profiles" ON public.profiles
  FOR SELECT
  USING (get_my_role() = 'admin');

-- Admin can update any profile
CREATE POLICY "admin_update_profiles" ON public.profiles
  FOR UPDATE
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- Users can update their own profile (non-role fields)
CREATE POLICY "user_update_own_profile" ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- System trigger can insert profiles
CREATE POLICY "system_insert_profiles" ON public.profiles
  FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- STUDENTS POLICIES
-- ============================================================

-- Admin: full access to all students
CREATE POLICY "admin_all_students" ON public.students
  FOR ALL
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- School owner & staff: full access to their school's students
CREATE POLICY "school_user_manage_students" ON public.students
  FOR ALL
  USING (
    get_my_role() IN ('school_owner', 'staff')
    AND school_id = get_my_school_id()
  )
  WITH CHECK (
    get_my_role() IN ('school_owner', 'staff')
    AND school_id = get_my_school_id()
  );

-- ============================================================
-- FEE RECORDS POLICIES
-- ============================================================

-- Admin: full access
CREATE POLICY "admin_all_fee_records" ON public.fee_records
  FOR ALL
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- School owner & staff: full access to their school's fee records
CREATE POLICY "school_user_manage_fees" ON public.fee_records
  FOR ALL
  USING (
    get_my_role() IN ('school_owner', 'staff')
    AND school_id = get_my_school_id()
  )
  WITH CHECK (
    get_my_role() IN ('school_owner', 'staff')
    AND school_id = get_my_school_id()
  );

-- ============================================================
-- FIRST ADMIN USER SETUP
-- ============================================================
-- After creating your first user through the app's signup page,
-- run this SQL to make them an admin (replace the email):
--
-- UPDATE public.profiles
-- SET role = 'admin', school_id = NULL
-- WHERE email = 'admin@yourdomain.com';
--
-- ============================================================

-- ============================================================
-- OPTIONAL: pg_cron monthly fee reset notification
-- (requires pg_cron extension to be enabled in Supabase)
-- The app handles monthly reset automatically via month/year
-- based records. No database cleanup is needed.
-- ============================================================
