/**
 * Customer Dashboard
 * ==================
 * Main dashboard for customer users. Features:
 * - Wallet balance display
 * - Add Money (+₹100)
 * - Generate 4-digit PIN
 * - Scan Palm → Process Payment
 * - Transaction history
 */

import { useState, useEffect, useCallback } from 'react';
import Card from '../UI/Card';
import Button from '../UI/Button';
import { addMoney, getBalance, getTransactions } from '../../services/walletService';
import { scanPalm, processPayment } from '../../services/palmScanService';
import './Dashboard.css';

export default function CustomerDashboard({ profile, refreshProfile }) {
  const [balance, setBalance] = useState(profile?.wallet_balance || 0);
  const [transactions, setTransactions] = useState([]);
  const [pin, setPin] = useState(null);
  const [scanStatus, setScanStatus] = useState(null); // null | 'scanning' | 'processing' | 'success' | 'failed'
  const [statusMessage, setStatusMessage] = useState('');
  const [addingMoney, setAddingMoney] = useState(false);
  const [loadingTx, setLoadingTx] = useState(true);

  /**
   * Fetch latest balance and transactions on mount.
   */
  const fetchData = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const [bal, txns] = await Promise.all([
        getBalance(profile.id),
        getTransactions(profile.id),
      ]);
      setBalance(bal);
      setTransactions(txns);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoadingTx(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * Add ₹100 to wallet.
   */
  const handleAddMoney = async () => {
    setAddingMoney(true);
    try {
      const newBal = await addMoney(profile.id, 100);
      setBalance(newBal);
      refreshProfile();
      setStatusMessage('₹100 added successfully!');
      setScanStatus('success');
      setTimeout(() => { setScanStatus(null); setStatusMessage(''); }, 3000);
    } catch (err) {
      setStatusMessage('Failed to add money: ' + err.message);
      setScanStatus('failed');
    } finally {
      setAddingMoney(false);
    }
  };

  /**
   * Generate a random 4-digit PIN (stored in frontend state only).
   */
  const handleGeneratePin = () => {
    const newPin = Math.floor(1000 + Math.random() * 9000).toString();
    setPin(newPin);
    setStatusMessage(`PIN generated: ${newPin}`);
    setScanStatus('success');
    setTimeout(() => { setScanStatus(null); setStatusMessage(''); }, 5000);
  };

  /**
   * Palm Scan → Payment Flow:
   * 1. Call Flask /scan
   * 2. If success → Call Flask /process-payment
   * 3. Update UI
   */
  const handleScanPalm = async () => {
    setScanStatus('scanning');
    setStatusMessage('Scanning palm... Please hold steady.');

    try {
      // Step 1: Simulate palm scan
      const scanResult = await scanPalm(profile.id);

      if (scanResult.status !== 'success') {
        setScanStatus('failed');
        setStatusMessage('Palm authentication failed. Please try again.');
        return;
      }

      // Step 2: Process payment on backend
      setScanStatus('processing');
      setStatusMessage('Palm verified! Processing payment...');

      const paymentResult = await processPayment(profile.id);

      if (paymentResult.status === 'success') {
        setScanStatus('success');
        setStatusMessage(paymentResult.message);
        // Refresh data after successful payment
        await fetchData();
        refreshProfile();
      } else {
        setScanStatus('failed');
        setStatusMessage(paymentResult.message || 'Payment failed');
      }
    } catch (err) {
      setScanStatus('failed');
      setStatusMessage('Error: ' + err.message);
    }
  };

  /**
   * Format timestamp for display.
   */
  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Customer Dashboard</h1>
        <p className="dashboard-subtitle">Welcome back, {profile?.name}</p>
      </div>

      {/* Status Banner */}
      {scanStatus && (
        <div className={`status-banner status-${scanStatus}`}>
          {scanStatus === 'scanning' && <span className="status-spinner"></span>}
          {scanStatus === 'processing' && <span className="status-spinner"></span>}
          {scanStatus === 'success' && <span className="status-icon">✓</span>}
          {scanStatus === 'failed' && <span className="status-icon">✕</span>}
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Cards Grid */}
      <div className="dashboard-grid">
        {/* Wallet Balance */}
        <Card title="Wallet Balance" className="balance-card">
          <div className="balance-amount">
            <span className="currency">₹</span>
            <span className="amount">{parseFloat(balance).toFixed(2)}</span>
          </div>
          <Button onClick={handleAddMoney} loading={addingMoney} variant="secondary">
            + Add ₹100
          </Button>
        </Card>

        {/* Quick Actions */}
        <Card title="Quick Actions" className="actions-card">
          <Button onClick={handleGeneratePin} variant="secondary">
            🔢 Generate PIN
          </Button>
          {pin && (
            <div className="pin-display">
              <span className="pin-label">Your PIN</span>
              <span className="pin-value">{pin}</span>
            </div>
          )}
          <Button
            onClick={handleScanPalm}
            loading={scanStatus === 'scanning' || scanStatus === 'processing'}
            variant="primary"
          >
            🖐️ Scan Palm & Pay
          </Button>
        </Card>
      </div>

      {/* Transaction History */}
      <Card title="Transaction History" className="transactions-card">
        {loadingTx ? (
          <p className="empty-state">Loading transactions...</p>
        ) : transactions.length === 0 ? (
          <p className="empty-state">No transactions yet</p>
        ) : (
          <div className="transactions-table-wrapper">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  // Determine if this is a debit or credit for the customer
                  const isDebit = tx.user_id === profile.id && tx.type === 'debit';
                  return (
                    <tr key={tx.id}>
                      <td>
                        <span className={`tx-type ${isDebit ? 'tx-debit' : 'tx-credit'}`}>
                          {isDebit ? '↑ Sent' : '↓ Received'}
                        </span>
                      </td>
                      <td className={isDebit ? 'tx-debit' : 'tx-credit'}>
                        {isDebit ? '-' : '+'}₹{parseFloat(tx.amount).toFixed(2)}
                      </td>
                      <td className="tx-date">{formatDate(tx.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
