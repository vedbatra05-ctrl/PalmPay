/**
 * Merchant Dashboard
 * ==================
 * Professional dashboard for merchants with Emerald Biometric theme.
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
    const interval = setInterval(fetchData, 5000); // Polling faster for merchant to see payment status
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRequestPayment = async () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setStatusMessage('Enter a valid payment amount');
      setStatusType('failed');
      return;
    }

    setRequesting(true);
    setStatusMessage('');

    try {
      await createPendingPayment(profile.id, parsedAmount);
      setStatusMessage(`Payment request for ₹${parsedAmount.toFixed(2)} active on terminal.`);
      setStatusType('success');
      setAmount('');
      await fetchData();
    } catch (err) {
      setStatusMessage('Request failed: ' + err.message);
      setStatusType('failed');
    } finally {
      setRequesting(false);
      setTimeout(() => { setStatusType(null); setStatusMessage(''); }, 5000);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Merchant Command Centre</h1>
        <p className="dashboard-subtitle">Business Identity: {profile?.name}</p>
      </div>

      {statusType && (
        <div className={`status-banner status-${statusType}`}>
          {statusType === 'success' ? '✓' : '✕'} {statusMessage}
        </div>
      )}

      <div className="dashboard-grid">
        {/* Merchant Revenue */}
        <Card title="Business Revenue" className="balance-card glass-card">
          <div className="balance-amount">
            <span className="currency">₹</span>
            <span className="amount">{parseFloat(balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <p className="balance-note">Settlements are processed in real-time</p>
        </Card>

        {/* Create Payment Request */}
        <Card title="Terminal Input" className="actions-card glass-card">
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="pin-label" style={{ marginBottom: '8px', display: 'block' }}>Sale Amount (INR)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="merchant-input"
            />
          </div>
          <Button
            onClick={handleRequestPayment}
            loading={requesting}
            variant="primary"
            fullWidth
          >
            ⚡ Create Payment Request
          </Button>
        </Card>
      </div>

      {/* Live Payment Requests */}
      <Card title="Active Terminals" className="transactions-card glass-card">
        {loadingData ? (
          <p className="empty-state">Securely fetching terminal status...</p>
        ) : pendingPayments.length === 0 ? (
          <p className="empty-state">No active payment requests</p>
        ) : (
          <div className="transactions-table-wrapper">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>Amount</th>
                  <th>Terminal Status</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {pendingPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="tx-credit" style={{ fontWeight: 700 }}>₹{parseFloat(payment.amount).toFixed(2)}</td>
                    <td>
                      <span className={`payment-status status-badge-${payment.status}`}>
                        {payment.status === 'pending' ? '● Waiting for Scan' : '✓ Completed'}
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

      {/* Transaction History */}
      <Card title="Recent Settlements" className="transactions-card glass-card" style={{ marginTop: '24px' }}>
        <div className="transactions-table-wrapper">
          <table className="transactions-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Revenue</th>
                <th>Processed</th>
              </tr>
            </thead>
            <tbody>
              {transactions
                .filter((tx) => tx.type === 'credit')
                .map((tx) => (
                  <tr key={tx.id}>
                    <td className="tx-date">TXN-{tx.id.slice(0, 8).toUpperCase()}</td>
                    <td className="tx-credit" style={{ fontWeight: 700 }}>
                      +₹{parseFloat(tx.amount).toFixed(2)}
                    </td>
                    <td className="tx-date">{formatDate(tx.created_at)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
