import os
import time
import base64
import requests
import cv2
import numpy as np
from gpiozero import DistanceSensor
from luma.core.interface.serial import i2c
from luma.core.render import canvas
from luma.oled.device import ssd1306
from PIL import ImageFont

# ==========================================
# CONFIGURATION
# ==========================================
BACKEND_URL = "http://<YOUR_FLASK_IP>:5000" # Replace with your laptop's local IP
# Pins for HC-SR04
ECHO_PIN = 24
TRIGGER_PIN = 23
# Threshold for hand detection (in meters)
HAND_DISTANCE_THRESHOLD = 0.15 

# ==========================================
# INITIALIZATION
# ==========================================
try:
    serial = i2c(port=1, address=0x3C)
    device = ssd1306(serial)
    sensor = DistanceSensor(echo=ECHO_PIN, trigger=TRIGGER_PIN)
    camera = cv2.VideoCapture(0) # Open default camera
except Exception as e:
    print(f"Init Error: {e}")
    print("Ensure I2C is enabled and sensors are connected.")

def display_message(line1, line2=""):
    """Update the OLED screen with status messages."""
    with canvas(device) as draw:
        draw.text((10, 20), line1, fill="white")
        if line2:
            draw.text((10, 40), line2, fill="white")

def capture_image():
    """Capture a frame from the NoIR camera."""
    ret, frame = camera.read()
    if not ret:
        return None
    # Pre-process image (grayscale for vein highlighting)
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    _, buffer = cv2.imencode('.jpg', gray)
    jpg_as_text = base64.b64encode(buffer).decode('utf-8')
    return jpg_as_text

def run_scanner():
    print("🖐️  PalmPay Hardware Scanner Active")
    display_message("System Active", "PalmPay v1.0")
    
    while True:
        try:
            # 1. Listen for pending payment requests
            response = requests.get(f"{BACKEND_URL}/get-pending-payment")
            res_data = response.json()
            
            if res_data.get("status") == "found":
                payment = res_data["payment"]
                display_message(f"Pay: RS {payment['amount']}", "Place Palm...")
                print(f"Pending payment found: ₹{payment['amount']}")

                # 2. Wait for hand detection
                while sensor.distance > HAND_DISTANCE_THRESHOLD:
                    time.sleep(0.1)
                
                # 3. Hand detected! Trigger capture
                display_message("Scanning...", "Hold Steady")
                image_data = capture_image()
                
                if not image_data:
                    display_message("Camera Error")
                    continue
                
                # 4. Simulate verification via backend
                # In a real system, the CV model identifies the UID from the palm
                # For this EDI project, we'll demonstrate the API flow
                scan_res = requests.post(f"{BACKEND_URL}/scan", json={
                    "user_id": "8664687d-8f37-434a-99ad-653a1a1f11cb", # Mock UID for demo
                    "image_data": image_data
                })
                
                scan_data = scan_res.json()
                
                if scan_data.get("status") == "success":
                    display_message("Verified!", "Processing...")
                    
                    # 5. Process the payment
                    pay_res = requests.post(f"{BACKEND_URL}/process-payment", json={
                        "customer_id": scan_data["user_id"]
                    })
                    pay_data = pay_res.json()
                    
                    if pay_data.get("status") == "success":
                        display_message("Success!", "₹" + str(payment['amount']))
                        print("Transaction complete!")
                        time.sleep(3)
                    else:
                        display_message("Pay Failed", pay_data.get("message", ""))
                else:
                    display_message("Auth Failed", "Try Again")
                
                time.sleep(2)
            else:
                # Idle state
                display_message("Ready to Scan", "Waiting for Bill")
                time.sleep(1)
                
        except Exception as e:
            print(f"Loop Error: {e}")
            display_message("Network Error")
            time.sleep(5)

if __name__ == "__main__":
    run_scanner()
