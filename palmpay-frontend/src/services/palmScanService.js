/**
 * Palm Scan Service
 * =================
 * Communicates with the Flask backend for:
 * - Palm scan biometric simulation
 * - Secure payment processing
 */

const FLASK_API_URL = import.meta.env.VITE_FLASK_API_URL || 'http://localhost:5000';

/**
 * Simulate a biometric palm scan.
 * Calls Flask POST /scan endpoint.
 * 
 * @param {string} userId - The authenticated user's ID
 * @returns {Object} - { status, user_id, confidence, message }
 */
export async function scanPalm(userId) {
  try {
    const response = await fetch(`${FLASK_API_URL}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Palm scan error:', error);
    return {
      status: 'failed',
      message: 'Unable to connect to biometric scanner. Is the Flask server running?',
    };
  }
}

/**
 * Process payment securely on the backend.
 * Calls Flask POST /process-payment endpoint.
 * 
 * @param {string} customerId - The customer's user ID
 * @returns {Object} - { status, message, transaction? }
 */
export async function processPayment(customerId) {
  try {
    const response = await fetch(`${FLASK_API_URL}/process-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: customerId }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Payment processing error:', error);
    return {
      status: 'failed',
      message: 'Unable to connect to payment server. Is the Flask server running?',
    };
  }
}
