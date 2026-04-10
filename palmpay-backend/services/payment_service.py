"""
Payment Service
===============
Handles secure transaction logic: balance checks, wallet updates,
and transaction recording.
"""

from typing import Dict, Any, List
from supabase import Client
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PaymentService:
    def __init__(self, db: Client):
        self.db = db

    def process_transaction(self, customer_id: str) -> Dict[str, Any]:
        """
        Executes a complete payment cycle.
        1. Finds oldest pending payment.
        2. Validates customer balance.
        3. Atomically(?) updates balances and records transactions.
        """
        try:
            # 1. Fetch latest pending payment
            pending_res = self.db.table("pending_payments") \
                .select("*") \
                .eq("status", "pending") \
                .order("created_at", desc=False) \
                .limit(1) \
                .execute()

            if not pending_res.data or len(pending_res.data) == 0:
                logger.warning("Payment failed: No pending payment found.")
                return {"status": "failed", "message": "No pending payment request found on terminal."}

            payment = pending_res.data[0]
            payment_id = payment["id"]
            merchant_id = payment["merchant_id"]
            amount = float(payment["amount"])

            # 2. Fetch profiles
            customer = self.db.table("profiles").select("*").eq("id", customer_id).single().execute().data
            merchant = self.db.table("profiles").select("*").eq("id", merchant_id).single().execute().data

            if not customer:
                return {"status": "failed", "message": "Customer account not found."}
            if not merchant:
                return {"status": "failed", "message": "Merchant account not found."}

            cust_balance = float(customer["wallet_balance"])
            merc_balance = float(merchant["wallet_balance"])

            # 3. Validation
            if cust_balance < amount:
                logger.warning(f"Insufficient funds for user {customer_id}")
                return {
                    "status": "failed", 
                    "message": f"Insufficient balance. Required: ₹{amount:.2f}, Available: ₹{cust_balance:.2f}"
                }

            # 4. Execute Updates (Sequential - ideally should be a DB RPC/Function for true atomicity)
            # Update Customer
            self.db.table("profiles").update({"wallet_balance": cust_balance - amount}).eq("id", customer_id).execute()
            # Update Merchant
            self.db.table("profiles").update({"wallet_balance": merc_balance + amount}).eq("id", merchant_id).execute()

            # Record Transactions
            self.db.table("transactions").insert([
                {"user_id": customer_id, "merchant_id": merchant_id, "amount": amount, "type": "debit"},
                {"user_id": customer_id, "merchant_id": merchant_id, "amount": amount, "type": "credit"}
            ]).execute()

            # Mark Payment as Completed
            self.db.table("pending_payments").update({"status": "completed"}).eq("id", payment_id).execute()

            logger.info(f"Payment of ₹{amount} from {customer_id} to {merchant_id} successful.")
            return {
                "status": "success",
                "message": f"Payment of ₹{amount:.2f} processed successfully.",
                "data": {
                    "amount": amount,
                    "new_balance": cust_balance - amount
                }
            }

        except Exception as e:
            logger.error(f"Critical error in process_transaction: {str(e)}")
            return {"status": "failed", "message": f"Server error during payment: {str(e)}"}

    def add_funds(self, user_id: str, amount: float) -> Dict[str, Any]:
        """Securely increments user wallet balance."""
        try:
            profile = self.db.table("profiles").select("wallet_balance").eq("id", user_id).single().execute().data
            if not profile:
                return {"status": "failed", "message": "User not found."}
            
            new_balance = float(profile["wallet_balance"]) + amount
            self.db.table("profiles").update({"wallet_balance": new_balance}).eq("id", user_id).execute()
            
            # Record deposit transaction
            self.db.table("transactions").insert({
                "user_id": user_id,
                "amount": amount,
                "type": "credit",
                "merchant_id": user_id # self-deposit
            }).execute()

            return {"status": "success", "new_balance": new_balance}
        except Exception as e:
            logger.error(f"Error adding funds: {str(e)}")
            return {"status": "failed", "message": str(e)}

    def get_history(self, user_id: str) -> List[Dict[str, Any]]:
        """Fetch latest 20 transactions."""
        try:
            res = self.db.table("transactions") \
                .select("*") \
                .or_(f"user_id.eq.{user_id},merchant_id.eq.{user_id}") \
                .order("created_at", desc=True) \
                .limit(20) \
                .execute()
            return res.data or []
        except Exception as e:
            logger.error(f"Error fetching history: {str(e)}")
            return []

    def cancel_payment(self, payment_id: str, status: str = "expired") -> Dict[str, Any]:
        """Marks a pending payment as expired or cancelled."""
        try:
            self.db.table("pending_payments").update({"status": status}).eq("id", payment_id).execute()
            logger.info(f"Payment {payment_id} marked as {status}")
            return {"status": "success", "message": f"Payment {status}."}
        except Exception as e:
            logger.error(f"Error cancelling payment: {str(e)}")
            return {"status": "failed", "message": str(e)}

    def reset_terminal(self, admin_id: str) -> Dict[str, Any]:
        """Clears all pending payments. Restricted to Admin role."""
        try:
            # Verify Admin Role
            admin = self.db.table("profiles").select("role").eq("id", admin_id).single().execute().data
            if not admin or admin.get("role") != "admin":
                logger.warning(f"Unauthorized reset attempt by {admin_id}")
                return {"status": "failed", "message": "Unauthorized. Admin role required."}

            self.db.table("pending_payments").update({"status": "cancelled"}).eq("status", "pending").execute()
            logger.info(f"Terminal reset by admin {admin_id}")
            return {"status": "success", "message": "Terminal reset. All pending bills cleared."}
        except Exception as e:
            logger.error(f"Admin reset failure: {str(e)}")
            return {"status": "failed", "message": str(e)}
