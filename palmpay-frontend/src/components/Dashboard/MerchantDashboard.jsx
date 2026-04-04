/**
 * Merchant Dashboard
 * ==================
 * Dashboard for merchant users. Features:
 * - Enter payment amount
 * - Request Payment (creates pending_payment)
 * - View recent received payments with status
 */

import { useState, useEffect, useCallback } from 'react';
import Card from '../UI/Card';
import Button from '../UI/Button';
import {
  createPendingPayment,
  getPendingPayments,
  getBalance,
  getTransactions,
} from '../../services/walletService';
import './Dashboard.css';

export default function MerchantDashboard({ profile, refreshProfile }) {
  const [balance, setBalance] = useState(profile?.wallet_balance || 0);
  const [amount, setAmount] = useState('');
  const [pendingPayments, setPendingPayments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [requesting, setRequesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState(null); // null | 'success' | 'failed'
  const [loadingData, setLoadingData] = useState(true);

  /**
   * Fetch balance, pending payments, and transactions on mount.
   */
  const fetchData = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const [bal, pending, txns] = await Promise.all([
        getBalance(profile.id),
        getPendingPayments(profile.id),
        getTransactions(profile.id),
      ]);
      setBalance(bal);
      setPendingPayments(pending);
      setTransactions(txns);
    } catch (err) {
      console.error('Error fetching merchant data:', err);
    } finally {
      setLoadingData(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 10 seconds to catch incoming payments
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  /**
   * Create a new pending payment request.
   */
  const handleRequestPayment = async () => {
    const parsedAmount = parseFloat(amount);

    if (!parsedAmount || parsedAmount <= 0) {
      setStatusMessage('Please enter a valid amount');
      setStatusType('failed');
      return;
    }

    setRequesting(true);
    setStatusMessage('');

    try {
      await createPendingPayment(profile.id, parsedAmount);
      setStatusMessage(`Payment request of ₹${parsedAmount.toFixed(2)} created!`);
      setStatusType('success');
      setAmount('');
      // Refresh pending payments list
      await fetchData();
      refreshProfile();
    } catch (err) {
      setStatusMessage('Failed to create request: ' + err.message);
      setStatusType('failed');
    } finally {
      setRequesting(false);
      setTimeout(() => { setStatusType(null); setStatusMessage(''); }, 4000);
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
        <h1 className="dashboard-title">Merchant Dashboard</h1>
        <p className="dashboard-subtitle">Welcome back, {profile?.name}</p>
      </div>

      {/* Status Banner */}
      {statusType && (
        <div className={`status-banner status-${statusType}`}>
          {statusType === 'success' && <span className="status-icon">✓</span>}
          {statusType === 'failed' && <span className="status-icon">✕</span>}
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Cards Grid */}
      <div className="dashboard-grid">
        {/* Merchant Balance */}
        <Card title="Merchant Balance" className="balance-card">
          <div className="balance-amount">
            <span className="currency">₹</span>
            <span className="amount">{parseFloat(balance).toFixed(2)}</span>
          </div>
          <p className="balance-note">Updated automatically on payment</p>
        </Card>

        {/* Request Payment */}
        <Card title="Request Payment" className="actions-card">
          <div className="form-group">
            <label htmlFor="payment-amount">Amount (₹)</label>
            <input
              id="payment-amount"
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="merchant-input"
            />
          </div>
          <Button
            onClick={handleRequestPayment}
            loading={requesting}
            variant="primary"
            fullWidth
          >
            💳 Request Payment
          </Button>
        </Card>
      </div>

      {/* Pending Payments */}
      <Card title="Payment Requests" className="transactions-card">
        {loadingData ? (
          <p className="empty-state">Loading...</p>
        ) : pendingPayments.length === 0 ? (
          <p className="empty-state">No payment requests yet</p>
        ) : (
          <div className="transactions-table-wrapper">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {pendingPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="tx-credit">₹{parseFloat(payment.amount).toFixed(2)}</td>
                    <td>
                      <span className={`payment-status status-badge-${payment.status}`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="tx-date">{formatDate(payment.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Recent Transactions */}
      {transactions.length > 0 && (
        <Card title="Recent Received Payments" className="transactions-card">
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
                {transactions
                  .filter((tx) => tx.type === 'credit')
                  .map((tx) => (
                    <tr key={tx.id}>
                      <td>
                        <span className="tx-type tx-credit">↓ Received</span>
                      </td>
                      <td className="tx-credit">
                        +₹{parseFloat(tx.amount).toFixed(2)}
                      </td>
                      <td className="tx-date">{formatDate(tx.created_at)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
