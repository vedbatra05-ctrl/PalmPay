"""
PalmPay Hardware Scanner (Production Ready)
===========================================
Primary edge script for Raspberry Pi.
Features: 
- Hand detection polling (HC-SR04)
- Active Buzzer Feedback (GPIO 18)
- 30-Second Session Timeout
- NoIR camera capture with OpenCV encoding
- I2C OLED status reporting
"""

import os
import time
import base64
import requests
import cv2
import logging
import numpy as np
from gpiozero import DistanceSensor, Buzzer
from luma.core.interface.serial import i2c
from luma.core.render import canvas
from luma.oled.device import ssd1306
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry

# ==========================================
# CONFIGURATION
# ==========================================
BACKEND_URL = "http://localhost:5000" # Update for network use
MAX_IDLE_POLL_INTERVAL = 1.0 
HAND_DISTANCE_THRESHOLD = 0.15 
SESSION_TIMEOUT = 30.0 # Seconds to wait for a hand
MOCK_USER_ID = "8664687d-8f37-434a-99ad-653a1a1f11cb"

# GPIO Pins
ECHO_PIN = 24
TRIGGER_PIN = 23
BUZZER_PIN = 18

# Logging setup
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("PalmPayHardware")

# ==========================================
# HARDWARE INITIALIZATION
# ==========================================
try:
    serial = i2c(port=1, address=0x3C)
    device = ssd1306(serial)
    sensor = DistanceSensor(echo=ECHO_PIN, trigger=TRIGGER_PIN)
    buzzer = Buzzer(BUZZER_PIN)
    camera = cv2.VideoCapture(0)
    logger.info("Hardware components initialized.")
except Exception as e:
    logger.error(f"Hardware init failed: {e}")

# ==========================================
# UTILS
# ==========================================
session = requests.Session()
retries = Retry(total=2, backoff_factor=0.3, status_forcelist=[500, 502, 503, 504])
session.mount('http://', HTTPAdapter(max_retries=retries))

def display_status(line1, line2=""):
    try:
        with canvas(device) as draw:
            draw.text((10, 15), line1, fill="white")
            if line2:
                draw.text((10, 35), line2, fill="white")
    except: pass

def play_sound(mode):
    """Play Active Buzzer patterns."""
    try:
        if mode == "start":
            buzzer.on(); time.sleep(0.05); buzzer.off()
        elif mode == "success":
            buzzer.on(); time.sleep(0.3); buzzer.off()
        elif mode == "failure":
            buzzer.on(); time.sleep(0.1); buzzer.off()
            time.sleep(0.1)
            buzzer.on(); time.sleep(0.1); buzzer.off()
    except: pass

def capture_encoded_palm():
    ret, frame = camera.read()
    if not ret: return None
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    _, buffer = cv2.imencode('.jpg', gray, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
    return base64.b64encode(buffer).decode('utf-8')

def run_scanner_loop():
    logger.info("PalmPay Terminal: STANDBY")
    
    while True:
        try:
            # 1. Check for Pending Payment
            sync_res = session.get(f"{BACKEND_URL}/get-pending-payment", timeout=5)
            sync_data = sync_res.json()
            
            if sync_data.get("status") == "found":
                payment = sync_data["payment"]
                payment_id = payment['id']
                logger.info(f"Payment request: {payment_id} (₹{payment['amount']})")
                
                start_time = time.time()
                play_sound("start")
                
                # 2. Wait for Hand with 30s Timeout
                hand_found = False
                while (time.time() - start_time) < SESSION_TIMEOUT:
                    display_status(f"Pay: RS {payment['amount']}", f"Time: {int(SESSION_TIMEOUT - (time.time() - start_time))}s")
                    if sensor.distance < HAND_DISTANCE_THRESHOLD:
                        hand_found = True
                        break
                    time.sleep(0.2)
                
                if not hand_found:
                    logger.warning("Session timed out.")
                    display_status("Session Expired", "Payment Cancelled")
                    play_sound("failure")
                    # Tell backend to expire this payment
                    session.post(f"{BACKEND_URL}/cancel-payment", json={"payment_id": payment_id, "status": "expired"}, timeout=5)
                    time.sleep(3)
                    continue

                # 3. Biometric Verification
                display_status("Scanning...", "Hold Steady")
                time.sleep(0.5)
                image_data = capture_encoded_palm()
                
                scan_res = session.post(f"{BACKEND_URL}/scan", json={
                    "user_id": MOCK_USER_ID, "image_data": image_data
                }, timeout=10)
                scan_data = scan_res.json()
                
                if scan_data.get("status") == "success":
                    display_status("Verifying...", "ID Verified")
                    # 4. Final Settlement
                    pay_res = session.post(f"{BACKEND_URL}/process-payment", json={
                        "customer_id": scan_data["user_id"]
                    }, timeout=10)
                    pay_data = pay_res.json()
                    
                    if pay_data.get("status") == "success":
                        display_status("Success", f"Paid ₹{payment['amount']}")
                        play_sound("success")
                        logger.info("Payment Successful.")
                    else:
                        display_status("Pay Failed", pay_data.get("message", "Try Again"))
                        play_sound("failure")
                else:
                    display_status("Auth Failed", "Try Again")
                    play_sound("failure")
                
                time.sleep(3)
            else:
                display_status("PalmPay Ready", "Waiting for Bill")
                time.sleep(MAX_IDLE_POLL_INTERVAL)
                
        except Exception as e:
            logger.error(f"Loop Error: {e}")
            display_status("Network Error", "Retrying...")
            time.sleep(3)

if __name__ == "__main__":
    run_scanner_loop()
