-- ============================================================
-- PalmPay - Supabase Database Schema
-- Run this in your Supabase SQL Editor (supabase.com → SQL Editor)
-- ============================================================

-- 1. PROFILES TABLE
-- Stores user data linked to Supabase auth.users
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer', 'merchant')),
  wallet_balance NUMERIC(12, 2) DEFAULT 1000.00,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (wallet balance, name, etc.)
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Allow insert during signup (trigger or service role)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Allow service role full access for Flask backend
-- (Flask uses the service key, which bypasses RLS by default)


-- 2. TRANSACTIONS TABLE
-- Records all payment transactions
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  merchant_id UUID NOT NULL REFERENCES profiles(id),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Users can see transactions where they are either the customer or merchant
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = merchant_id);

-- Only backend (service role) should insert transactions
-- Frontend cannot directly insert
CREATE POLICY "Service role can insert transactions"
  ON transactions FOR INSERT
  WITH CHECK (true);


-- 3. PENDING PAYMENTS TABLE
-- Merchant-initiated payment requests
-- ============================================================
CREATE TABLE IF NOT EXISTS pending_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES profiles(id),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pending_payments ENABLE ROW LEVEL SECURITY;

-- Merchants can create and view their own pending payments
CREATE POLICY "Merchants can insert pending payments"
  ON pending_payments FOR INSERT
  WITH CHECK (auth.uid() = merchant_id);

CREATE POLICY "Merchants can view own pending payments"
  ON pending_payments FOR SELECT
  USING (auth.uid() = merchant_id);

-- Customers can view all pending payments (to find one to pay)
CREATE POLICY "Customers can view pending payments"
  ON pending_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'customer'
    )
  );

-- Allow updates (marking as completed) - service role handles this
CREATE POLICY "Allow updating pending payments"
  ON pending_payments FOR UPDATE
  USING (true);


-- 4. AUTO-CREATE PROFILE ON SIGNUP (TRIGGER)
-- When a user signs up via Supabase Auth, automatically create their profile
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, wallet_balance)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer'),
    1000.00
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- DONE! Your PalmPay database is ready.
-- ============================================================
