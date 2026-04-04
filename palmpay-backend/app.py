"""
PalmPay Flask Backend
=====================
Handles palm scan simulation and secure payment processing.
Uses Supabase service role key for direct DB operations.
"""

import os
import random
import uuid
from datetime import datetime

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from supabase import create_client, Client

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173", "http://127.0.0.1:5173"])

# Initialize Supabase client with SERVICE ROLE key (bypasses RLS)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Lazy-init: allows server to start even if credentials aren't set yet
_supabase_client = None

def get_supabase() -> Client:
    """Get or create the Supabase client. Fails gracefully if creds missing."""
    global _supabase_client
    if _supabase_client is None:
        url = os.getenv("SUPABASE_URL", "")
        key = os.getenv("SUPABASE_SERVICE_KEY", "")
        if not url or not key or "your_" in url or "your_" in key:
            raise RuntimeError(
                "Supabase credentials not configured. "
                "Please fill in SUPABASE_URL and SUPABASE_SERVICE_KEY in palmpay-backend/.env"
            )
        _supabase_client = create_client(url, key)
    return _supabase_client


# ============================================================
# ROUTE: Health Check
# ============================================================
@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok", "service": "PalmPay Backend"}), 200


# ============================================================
# ROUTE: Palm Scan Simulation
# ============================================================
@app.route("/scan", methods=["POST"])
def scan_palm():
    """
    Simulates biometric palm authentication.
    Accepts: { "user_id": "uuid-string" }
    Returns success (95% probability) or failure.
    """
    data = request.get_json() or {}
    user_id = data.get("user_id", str(uuid.uuid4()))

    # Simulate biometric scan with 95% success rate
    confidence = round(random.uniform(0.85, 0.99), 2)
    is_success = random.random() < 0.95

    if is_success:
        return jsonify({
            "status": "success",
            "user_id": user_id,
            "confidence": confidence,
            "message": "Palm authentication successful"
        }), 200
    else:
        return jsonify({
            "status": "failed",
            "message": "Palm authentication failed. Please try again.",
            "confidence": round(random.uniform(0.10, 0.40), 2)
        }), 200


# ============================================================
# ROUTE: Process Payment (SECURE - runs on backend only)
# ============================================================
@app.route("/process-payment", methods=["POST"])
def process_payment():
    """
    Securely processes a payment on the backend.
    
    Input: { "customer_id": "uuid-string" }
    
    Logic:
    1. Fetch latest pending payment
    2. Check customer balance
    3. If sufficient: deduct, credit merchant, record transaction, mark completed
    4. If insufficient: return error
    """
    data = request.get_json() or {}
    customer_id = data.get("customer_id")

    if not customer_id:
        return jsonify({
            "status": "failed",
            "message": "Customer ID is required"
        }), 400

    try:
        db = get_supabase()

        # Step 1: Fetch the latest pending payment
        pending_result = db.table("pending_payments") \
            .select("*") \
            .eq("status", "pending") \
            .order("created_at", desc=False) \
            .limit(1) \
            .execute()

        if not pending_result.data or len(pending_result.data) == 0:
            return jsonify({
                "status": "failed",
                "message": "No pending payment found"
            }), 404

        payment = pending_result.data[0]
        payment_id = payment["id"]
        merchant_id = payment["merchant_id"]
        amount = float(payment["amount"])

        # Step 2: Fetch customer profile and check balance
        customer_result = db.table("profiles") \
            .select("*") \
            .eq("id", customer_id) \
            .single() \
            .execute()

        if not customer_result.data:
            return jsonify({
                "status": "failed",
                "message": "Customer not found"
            }), 404

        customer = customer_result.data
        customer_balance = float(customer["wallet_balance"])

        if customer_balance < amount:
            return jsonify({
                "status": "failed",
                "message": f"Insufficient balance. Current: ₹{customer_balance:.2f}, Required: ₹{amount:.2f}"
            }), 400

        # Step 3: Fetch merchant profile
        merchant_result = db.table("profiles") \
            .select("*") \
            .eq("id", merchant_id) \
            .single() \
            .execute()

        if not merchant_result.data:
            return jsonify({
                "status": "failed",
                "message": "Merchant not found"
            }), 404

        merchant = merchant_result.data
        merchant_balance = float(merchant["wallet_balance"])

        # Step 4: Deduct from customer wallet
        new_customer_balance = customer_balance - amount
        db.table("profiles") \
            .update({"wallet_balance": new_customer_balance}) \
            .eq("id", customer_id) \
            .execute()

        # Step 5: Credit to merchant wallet
        new_merchant_balance = merchant_balance + amount
        db.table("profiles") \
            .update({"wallet_balance": new_merchant_balance}) \
            .eq("id", merchant_id) \
            .execute()

        # Step 6: Record debit transaction (customer side)
        db.table("transactions").insert({
            "user_id": customer_id,
            "merchant_id": merchant_id,
            "amount": amount,
            "type": "debit"
        }).execute()

        # Step 7: Record credit transaction (merchant side)
        db.table("transactions").insert({
            "user_id": customer_id,
            "merchant_id": merchant_id,
            "amount": amount,
            "type": "credit"
        }).execute()

        # Step 8: Mark pending payment as completed
        db.table("pending_payments") \
            .update({"status": "completed"}) \
            .eq("id", payment_id) \
            .execute()

        return jsonify({
            "status": "success",
            "message": f"Payment of ₹{amount:.2f} processed successfully",
            "transaction": {
                "amount": amount,
                "merchant_id": merchant_id,
                "customer_id": customer_id,
                "new_balance": new_customer_balance
            }
        }), 200

    except Exception as e:
        print(f"Payment processing error: {str(e)}")
        return jsonify({
            "status": "failed",
            "message": f"Payment processing failed: {str(e)}"
        }), 500


# ============================================================
# Run the Flask server
# ============================================================
if __name__ == "__main__":
    print("🖐️  PalmPay Backend running on http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
