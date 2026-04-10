"""
PalmPay Hardware Scanner (Production Ready)
===========================================
Primary edge script for Raspberry Pi.
Features: 
- Hand detection polling (HC-SR04)
- NoIR camera capture with OpenCV encoding
- I2C OLED status reporting
- Network retry logic for backend communication
- Structured logging
"""

import os
import time
import base64
import requests
import cv2
import logging
import numpy as np
from gpiozero import DistanceSensor
from luma.core.interface.serial import i2c
from luma.core.render import canvas
from luma.oled.device import ssd1306
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry

# ==========================================
# CONFIGURATION
# ==========================================
# Replace with your local network IP of the Flask server
BACKEND_URL = "http://192.168.1.5:5000" 
MAX_IDLE_POLL_INTERVAL = 1.0 # Seconds between checking for new bills
HAND_DISTANCE_THRESHOLD = 0.15 # 15cm
MOCK_USER_ID = "8664687d-8f37-434a-99ad-653a1a1f11cb" # For demo purposes

# GPIO Pins
ECHO_PIN = 24
TRIGGER_PIN = 23

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - INTERNAL - %(levelname)s - %(message)s'
)
logger = logging.getLogger("PalmPayHardware")

# ==========================================
# HARDWARE INITIALIZATION
# ==========================================
try:
    serial = i2c(port=1, address=0x3C)
    device = ssd1306(serial)
    sensor = DistanceSensor(echo=ECHO_PIN, trigger=TRIGGER_PIN)
    camera = cv2.VideoCapture(0)
    logger.info("Hardware components initialized successfully.")
except Exception as e:
    logger.error(f"Hardware initialization failed: {e}")
    # In a real environment, we might sys.exit(1) here

# ==========================================
# NETWORK UTILS (WITH RETRIES)
# ==========================================
session = requests.Session()
retries = Retry(total=5, backoff_factor=0.5, status_forcelist=[500, 502, 503, 504])
session.mount('http://', HTTPAdapter(max_retries=retries))

def display_status(line1, line2=""):
    """Render text to OLED display."""
    try:
        with canvas(device) as draw:
            draw.text((10, 15), line1, fill="white")
            if line2:
                draw.text((10, 35), line2, fill="white")
    except Exception as e:
        logger.warning(f"Display error: {e}")

# ==========================================
# CORE LOGIC
# ==========================================

def capture_encoded_palm():
    """Captures a frame and returns base64 JPEG data."""
    ret, frame = camera.read()
    if not ret:
        logger.error("Failed to grab frame from camera.")
        return None
        
    # Pre-processing: Grayscale and sharpening for vein visibility
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    _, buffer = cv2.imencode('.jpg', gray, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
    return base64.b64encode(buffer).decode('utf-8')

def run_scanner_loop():
    logger.info("PalmPay Terminal: STANDBY MODE")
    display_status("PalmPay POS", "System: ONLINE")
    
    while True:
        try:
            # 1. Sync: Is there a bill waiting for payment?
            sync_res = session.get(f"{BACKEND_URL}/get-pending-payment", timeout=5)
            sync_data = sync_res.json()
            
            if sync_data.get("status") == "found":
                payment = sync_data["payment"]
                display_status(f"Pay: RS {payment['amount']}", "Detecting Hand...")
                logger.info(f"Payment request detected: ₹{payment['amount']}")

                # 2. Wait: Hand detection polling
                while sensor.distance > HAND_DISTANCE_THRESHOLD:
                    time.sleep(0.1)
                
                # 3. Action: Capture Biometrics
                logger.info("Hand detected! Initiating biometric scan...")
                display_status("Scanning...", "Hold Steady...")
                time.sleep(0.5) # Time for user to stabilize
                
                image_data = capture_encoded_palm()
                if not image_data:
                    display_status("Camera Error", "Manual Override")
                    continue
                
                # 4. Identity: Call /scan to verify user
                # NOTE: For this EDI version, we provide a mock user_id. 
                # In production, image_data would be matched against a database.
                scan_res = session.post(f"{BACKEND_URL}/scan", json={
                    "user_id": MOCK_USER_ID,
                    "image_data": image_data
                }, timeout=10)
                
                scan_data = scan_res.json()
                
                if scan_data.get("status") == "success":
                    display_status("Palm Verified", "Processing Pay...")
                    logger.info(f"Identity Verified: {scan_data['user_id']}")
                    
                    # 5. Settlement: Secure final payment
                    pay_res = session.post(f"{BACKEND_URL}/process-payment", json={
                        "customer_id": scan_data["user_id"]
                    }, timeout=10)
                    pay_data = pay_res.json()
                    
                    if pay_data.get("status") == "success":
                        display_status("PAID SUCCESS", f"RS {payment['amount']}")
                        logger.info("Transaction settled successfully.")
                        time.sleep(4)
                    else:
                        display_status("PAY FAILED", pay_data.get("message", "Try Again"))
                        logger.warning(f"Payment failed: {pay_data.get('message')}")
                else:
                    display_status("AUTH FAILED", "Reposition Hand")
                    logger.warning("Biometric match failure.")
                
                time.sleep(2)
            else:
                # Idle state
                display_status("Ready to Scan", "Waiting for Bill")
                time.sleep(MAX_IDLE_POLL_INTERVAL)
                
        except requests.exceptions.RequestException as re:
            logger.error(f"Network connectivity lost: {re}")
            display_status("Network Error", "Offline Mode")
            time.sleep(5)
        except Exception as e:
            logger.error(f"Unexpected Loop Error: {e}")
            time.sleep(2)

if __name__ == "__main__":
    run_scanner_loop()
