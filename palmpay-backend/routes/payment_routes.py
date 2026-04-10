from flask import Blueprint, jsonify, request
from services.payment_service import PaymentService

def construct_payment_blueprint(db):
    payment_bp = Blueprint('payment', __name__)
    payment_service = PaymentService(db)

    @payment_bp.route("/process-payment", methods=["POST"])
    def process_payment():
        data = request.get_json() or {}
        customer_id = data.get("customer_id")
        if not customer_id:
            return jsonify({"status": "failed", "message": "Customer ID missing."}), 400
        
        result = payment_service.process_transaction(customer_id)
        return jsonify(result), 200 if result["status"] == "success" else 400

    @payment_bp.route("/add-funds", methods=["POST"])
    def add_funds():
        data = request.get_json() or {}
        user_id = data.get("user_id")
        amount = data.get("amount", 100)
        
        if not user_id:
            return jsonify({"status": "failed", "message": "User ID missing."}), 400
            
        result = payment_service.add_funds(user_id, float(amount))
        return jsonify(result), 200 if result["status"] == "success" else 400

    @payment_bp.route("/get-pending-payment", methods=["GET"])
    def get_pending():
        try:
            result = db.table("pending_payments") \
                .select("*") \
                .eq("status", "pending") \
                .order("created_at", desc=False) \
                .limit(1) \
                .execute()

            if result.data and len(result.data) > 0:
                return jsonify({"status": "found", "payment": result.data[0]}), 200
            return jsonify({"status": "none"}), 200
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500

    @payment_bp.route("/latest-transaction/<user_id>", methods=["GET"])
    def get_latest_transaction(user_id):
        try:
            result = db.table("transactions") \
                .select("*") \
                .eq("user_id", user_id) \
                .order("created_at", desc=True) \
                .limit(1) \
                .execute()

            if result.data and len(result.data) > 0:
                return jsonify({"status": "success", "transaction": result.data[0]}), 200
            return jsonify({"status": "none"}), 200
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500

    @payment_bp.route("/cancel-payment", methods=["POST"])
    def cancel_payment():
        data = request.get_json() or {}
        payment_id = data.get("payment_id")
        status = data.get("status", "expired")
        
        if not payment_id:
            return jsonify({"status": "failed", "message": "Payment ID missing."}), 400
            
        result = payment_service.cancel_payment(payment_id, status)
        return jsonify(result), 200 if result["status"] == "success" else 400

    @payment_bp.route("/admin/reset-payments", methods=["POST"])
    def admin_reset():
        data = request.get_json() or {}
        admin_id = data.get("admin_id")
        
        if not admin_id:
            return jsonify({"status": "failed", "message": "Admin ID missing."}), 400
            
        result = payment_service.reset_terminal(admin_id)
        return jsonify(result), 200 if result["status"] == "success" else 400

    return payment_bp
