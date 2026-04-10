# PalmPay Hardware Integration Guide

This guide details how to set up the Raspberry Pi-based palm vein biometric scanner and connect it to the PalmPay backend.

## 1. Components List
| Component | Purpose | Connection Type |
| :--- | :--- | :--- |
| **Raspberry Pi 3A+** | Main Compute Unit | - |
| **NoIR Camera Module** | Palm Vein Capture | CSI Ribbon Cable |
| **HC-SR04 Sensor** | Hand Detection | GPIO (Digital) |
| **850nm IR LEDs** | Vein Illumination | 5V / GPIO |
| **0.96" SSD1306 OLED** | User Feedback | I2C |

---

## 2. Wiring Diagram (GPIO)

### HC-SR04 Ultrasonic Sensor
| Sensor Pin | RPi GPIO Pin | Physical Pin |
| :--- | :--- | :--- |
| **VCC** | 5V | Pin 2 or 4 |
| **GND** | Ground | Pin 6 |
| **Trig** | GPIO 23 | Pin 16 |
| **Echo** | GPIO 24 | Pin 18 (Use a voltage divider: 1kΩ & 2kΩ) |

### SSD1306 OLED Display (I2C)
| OLED Pin | RPi GPIO Pin | Physical Pin |
| :--- | :--- | :--- |
| **VCC** | 3.3V | Pin 1 |
| **GND** | Ground | Pin 9 |
| **SCL** | SCL (GPIO 3) | Pin 5 |
| **SDA** | SDA (GPIO 2) | Pin 2 |

---

## 3. Raspberry Pi Setup Instructions

### A. Enable Interfaces
Run `sudo raspi-config` on your Pi and enable:
- **I2C** (for OLED)
- **Camera** (for NoIR module)

### B. Install Dependencies
```bash
sudo apt-get update
sudo apt-get install python3-pip python3-pil python3-numpy libatlas-base-dev
pip3 install requests opencv-python gpiozero luma.oled
```

### C. Run the Scanner
1. Copy `pi_palm_scanner.py` to your Pi.
2. Update the `BACKEND_URL` in the script with your computer's local IP address (e.g., `http://192.168.1.5:5000`).
3. Run the script:
   ```bash
   python3 pi_palm_scanner.py
   ```

---

## 4. Operational Flow
1. **Merchant Side**: Enters amount in the web app and clicks "Request Payment".
2. **Backend side**: Stores a `pending` payment record.
3. **Hardware Side**:
   - The Pi script detects the pending payment via polling.
   - OLED displays "Wait for Scan".
   - Ultrasonic sensor monitors for a hand (threshold: 15cm).
   - Once a hand is detected, NoIR camera captures a grayscale image.
   - Image is sent to `/scan` then `/process-payment`.
4. **Conclusion**: If successful, OLED shows "Success" and the Web UI (Customer Dashboard) automatically updates its balance within 3 seconds.

---

## 5. Circuit Note
**Voltage Divider for HC-SR04 Echo**:
The RPi GPIO pins are 3.3V tolerant. The HC-SR04 Echo pin outputs 5V. Use two resistors to drop the voltage:
- Echo Pin -> 1kΩ Resistor -> Pin A
- Pin A -> GPIO 24
- Pin A -> 2kΩ Resistor -> GND
