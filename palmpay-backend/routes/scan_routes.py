import random
from flask import Blueprint, jsonify, request

def construct_scan_blueprint(db):
    scan_bp = Blueprint('scan', __name__)

    @scan_bp.route("/scan", methods=["POST"])
    def scan_palm():
        """
        Biometric palm authentication simulation.
        Future: Integration with real CV/MT models.
        """
        data = request.get_json() or {}
        user_id = data.get("user_id")
        # image_data is ignored for now but captured in the request
        
        if not user_id:
            return jsonify({"status": "failed", "message": "User ID required."}), 400

        # Simulate biometric scan confidence
        confidence = round(random.uniform(0.94, 0.99), 2)
        is_success = random.random() < 0.99 # Even higher success rate for reliable demo

        if is_success:
            return jsonify({
                "status": "success",
                "user_id": user_id,
                "confidence": confidence,
                "message": "Identity verified via palm biometric"
            }), 200
        else:
            return jsonify({
                "status": "failed",
                "message": "Match failed. Please ensure palm is clean and centered.",
                "confidence": round(random.uniform(0.10, 0.40), 2)
            }), 200

    return scan_bp
