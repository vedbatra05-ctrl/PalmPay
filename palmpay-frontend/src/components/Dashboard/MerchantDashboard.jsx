/**
 * Merchant Dashboard
 * ==================
 * Professional terminal interface for merchants.
 * Syncs with the backend to manage pending bill requests.
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState(null); // null | 'success' | 'failed'
  const [loadingData, setLoadingData] = useState(true);

  /**
   * Sync merchant state.
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
      console.error('Merchant sync error:', err);
    } finally {
      setLoadingData(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchData();
    // Faster polling for merchant to detect "completed" hardware scans
    const interval = setInterval(fetchData, 3000); 
    return () => clearInterval(interval);
  }, [fetchData]);

  /**
   * Create bill on backend terminal
   */
  const handleRequestPayment = async () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) {
      setStatusMessage('Invalid sale amount.');
      setStatusType('failed');
      return;
    }

    setIsProcessing(true);
    setStatusMessage('Syncing with hardware terminal...');

    try {
      await createPendingPayment(profile.id, val);
      setStatusMessage(`Terminal Active: Bill for ₹${val.toFixed(2)} broadcasted.`);
      setStatusType('success');
      setAmount('');
      fetchData();
    } catch (err) {
      setStatusMessage('Network Error: Could not reach terminal.');
      setStatusType('failed');
    } finally {
      setIsProcessing(false);
      setTimeout(() => { setStatusType(null); setStatusMessage(''); }, 6000);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Point-Of-Sale Terminal</h1>
        <p className="dashboard-subtitle">Authenticated Merchant: {profile?.name}</p>
      </div>

      {statusMessage && (
        <div className={`status-banner status-${statusType || 'info'}`}>
          {statusMessage}
        </div>
      )}

      <div className="dashboard-grid">
        <Card title="Merchant Settlements" className="balance-card glass-card">
          <div className="balance-amount">
            <span className="currency">₹</span>
            <span className="amount">{parseFloat(balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <p className="balance-note">Settled securely via Touchless Palm Verification</p>
        </Card>

        <Card title="New Sale" className="actions-card glass-card">
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="pin-label">Input Transaction Value (INR)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="merchant-input"
              disabled={isProcessing}
            />
          </div>
          <Button
            onClick={handleRequestPayment}
            loading={isProcessing}
            variant="primary"
            fullWidth
          >
            🔊 Broadcast Bill to Hardware
          </Button>
        </Card>
      </div>

      <Card title="Terminal Queue (Pending/Active)" className="transactions-card glass-card">
        {loadingData ? (
          <p className="empty-state">Securely fetching terminal status...</p>
        ) : pendingPayments.length === 0 ? (
          <p className="empty-state">Terminal is clear. Launch a sale to begin.</p>
        ) : (
          <div className="transactions-table-wrapper">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>Sale Value</th>
                  <th>Terminal Status</th>
                  <th>Broadcasted At</th>
                </tr>
              </thead>
              <tbody>
                {pendingPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="tx-credit" style={{ fontWeight: 700 }}>₹{parseFloat(payment.amount).toFixed(2)}</td>
                    <td>
                      <span className={`payment-status status-badge-${payment.status}`}>
                        {payment.status === 'pending' ? '● Waiting for Palm Scan' : '✓ Finalized'}
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

      <Card title="Settle History" className="transactions-card glass-card" style={{ marginTop: '24px' }}>
        <div className="transactions-table-wrapper">
          <table className="transactions-table">
            <thead>
              <tr>
                <th>Reference ID</th>
                <th>Revenue</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {transactions
                .filter((tx) => tx.type === 'credit')
                .slice(0, 10)
                .map((tx) => (
                  <tr key={tx.id}>
                    <td className="tx-date">SID-{tx.id.slice(0, 8).toUpperCase()}</td>
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
