"""
PalmPay - Database Setup Script
================================
Creates missing tables and policies in Supabase.
Run once: python setup_db.py
"""

import os
import requests
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://esjiqgazoweajanmwkwr.supabase.co")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

headers = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

# SQL statements to run via the pg_dump workaround
# We'll use the Supabase SQL endpoint (if available) or REST API

def check_table(table_name):
    """Check if a table exists by trying to query it."""
    try:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/{table_name}?select=id&limit=1",
            headers=headers
        )
        return r.status_code == 200
    except:
        return False


def run_sql_via_rpc(sql):
    """Try to run SQL through Supabase's built-in query endpoint."""
    # Try the pg_net approach
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/",
        headers=headers,
        json={"query": sql}
    )
    return r


if __name__ == "__main__":
    print("🔍 Checking tables...")
    
    tables = {
        "profiles": check_table("profiles"),
        "transactions": check_table("transactions"),
        "pending_payments": check_table("pending_payments"),
    }
    
    for name, exists in tables.items():
        status = "✅ exists" if exists else "❌ missing"
        print(f"  {name}: {status}")
    
    if all(tables.values()):
        print("\n✅ All tables exist! Database is ready.")
    else:
        missing = [name for name, exists in tables.items() if not exists]
        print(f"\n⚠️ Missing tables: {', '.join(missing)}")
        print("Please run the following SQL in your Supabase SQL Editor:")
        
        if "pending_payments" in missing:
            print("""
-- Run this in Supabase SQL Editor:
CREATE TABLE IF NOT EXISTS pending_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES profiles(id),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE pending_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants can insert pending payments" ON pending_payments FOR INSERT WITH CHECK (auth.uid() = merchant_id);
CREATE POLICY "Merchants can view own pending payments" ON pending_payments FOR SELECT USING (auth.uid() = merchant_id);
CREATE POLICY "Customers can view pending payments" ON pending_payments FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'customer'));
CREATE POLICY "Allow updating pending payments" ON pending_payments FOR UPDATE USING (true);
""")
    
    # Test signup trigger
    print("\n🔍 Testing auth trigger by checking function exists...")
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/rpc/handle_new_user",
        headers=headers
    )
    if r.status_code == 404:
        print("  ⚠️ Trigger function might not exist. Please run the trigger SQL.")
    else:
        print("  ℹ️ Function endpoint responded (this is expected to error, means it exists)")
