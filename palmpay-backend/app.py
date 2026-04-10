"""
PalmPay Flask Backend (Production Architecture)
==============================================
Main entry point for the API. Initializes Supabase and registers modular routes.
"""

import os
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
from supabase import create_client, Client

# Import modular routes
from routes.payment_routes import construct_payment_blueprint
from routes.scan_routes import construct_scan_blueprint

# Load environment variables
load_dotenv()

app = Flask(__name__)
# Enable CORS for the React frontend
CORS(app, origins=["http://localhost:5173", "http://127.0.0.1:5173"])

# ============================================================
# DATABASE INITIALIZATION
# ============================================================
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("WARNING: Supabase credentials not found. Ensure .env is configured.")

db: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ============================================================
# BLUEPRINT REGISTRATION
# ============================================================
# We pass the db client to the constructors so routes can use it directly
app.register_blueprint(construct_payment_blueprint(db))
app.register_blueprint(construct_scan_blueprint(db))

@app.route("/health", methods=["GET"])
def health():
    return {"status": "ok", "message": "PalmPay API is stable"}, 200

# ============================================================
# SERVER START
# ============================================================
if __name__ == "__main__":
    print("-----------------------------------------")
    print("PalmPay Production Backend: ONLINE")
    print("Local Endpoint: http://localhost:5000")
    print("-----------------------------------------")
    app.run(host="0.0.0.0", port=5000, debug=True)
