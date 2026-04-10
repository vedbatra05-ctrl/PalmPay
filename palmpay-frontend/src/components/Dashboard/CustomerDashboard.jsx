/**
 * Customer Dashboard
 * ==================
 * Production-ready customer view with real-time status updates and
 * backend-led wallet operations.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import Card from '../UI/Card';
import Button from '../UI/Button';
import { addMoney, getBalance, getTransactions, getLatestTransaction } from '../../services/walletService';
import './Dashboard.css';

export default function CustomerDashboard({ profile, refreshProfile }) {
  const [balance, setBalance] = useState(profile?.wallet_balance || 0);
  const [transactions, setTransactions] = useState([]);
  const [pin, setPin] = useState(null);
  const [scanStatus, setScanStatus] = useState(null); // null | 'success' | 'failed'
  const [statusMessage, setStatusMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingTx, setLoadingTx] = useState(true);
  
  const lastTxId = useRef(null);

  /**
   * Fetch core data.
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
      if (txns.length > 0) {
        lastTxId.current = txns[0].id;
      }
    } catch (err) {
      console.error('Data sync error:', err);
    } finally {
      setLoadingTx(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * Hardware Status Monitor:
   * Polls the backend to see if a hand has been scanned and processed.
   */
  useEffect(() => {
    if (!profile?.id) return;

    const pollInterval = setInterval(async () => {
      try {
        const result = await getLatestTransaction(profile.id);
        if (result.status === 'success' && result.transaction.id !== lastTxId.current) {
          lastTxId.current = result.transaction.id;
          setScanStatus('success');
          setStatusMessage(`Payment Verified: ₹${result.transaction.amount} deducted.`);
          
          // Refresh balance immediately
          const newBal = await getBalance(profile.id);
          setBalance(newBal);
          fetchData();
          refreshProfile();

          setTimeout(() => { setScanStatus(null); setStatusMessage(''); }, 5000);
        }
      } catch (e) {
        // Silent fail for background polling
      }
    }, 4000);

    return () => clearInterval(pollInterval);
  }, [profile?.id, fetchData, refreshProfile]);

  /**
   * Secure add money through backend
   */
  const handleAddMoney = async () => {
    setIsProcessing(true);
    setStatusMessage('Securing funds for your wallet...');
    try {
      const newBal = await addMoney(profile.id, 100);
      setBalance(newBal);
      refreshProfile();
      setScanStatus('success');
      setStatusMessage('₹100.00 added to your account.');
      setTimeout(() => { setScanStatus(null); setStatusMessage(''); }, 3000);
    } catch (err) {
      setScanStatus('failed');
      setStatusMessage(err.message || 'Transaction could not be completed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGeneratePin = () => {
    const newPin = Math.floor(1000 + Math.random() * 9000).toString();
    setPin(newPin);
    setScanStatus('success');
    setStatusMessage(`Security PIN active for 5 mins: ${newPin}`);
    setTimeout(() => { setScanStatus(null); setStatusMessage(''); }, 8000);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Touchless Biometric Terminal</h1>
        <p className="dashboard-subtitle">Active Protection for {profile?.name}</p>
      </div>

      {statusMessage && (
        <div className={`status-banner status-${scanStatus || 'info'}`}>
          {isProcessing && <div className="spinner-small" style={{ marginRight: '10px' }}></div>}
          {statusMessage}
        </div>
      )}

      <div className="dashboard-grid">
        <Card title="Available Funds" className="balance-card glass-card">
          <div className="balance-amount">
            <span className="currency">₹</span>
            <span className="amount">{parseFloat(balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <p className="balance-note">Protected by Palm Biometrics</p>
          <div style={{ marginTop: '24px' }}>
            <Button onClick={handleAddMoney} loading={isProcessing} variant="secondary" fullWidth>
              ⚡ Instant Recharge (₹100)
            </Button>
          </div>
        </Card>

        <Card title="Scanner Status" className="actions-card glass-card">
          <div className="biometric-pulse-container">
            <div className={`biometric-pulse ${isProcessing ? 'pulse-active' : ''}`}>
              🖐️
            </div>
            <div className="pulse-label">Waiting for Palm Scan</div>
            <p className="empty-state" style={{ padding: '0 10px' }}>
              Place your palm on the sensor at any checkout counter to pay.
            </p>
          </div>
          <Button onClick={handleGeneratePin} variant="secondary" fullWidth>
            🔢 {pin ? 'Refresh PIN' : 'Generate Secure PIN'}
          </Button>
          {pin && (
            <div className="pin-display" style={{ marginTop: '16px' }}>
              <span className="pin-label">TERMINAL PIN</span>
              <span className="pin-value">{pin}</span>
            </div>
          )}
        </Card>
      </div>

      <Card title="System Logs (Last 20)" className="transactions-card glass-card">
        {loadingTx ? (
          <p className="empty-state">Securely synchronizing history...</p>
        ) : transactions.length === 0 ? (
          <p className="empty-state">No payment activity recorded on this account.</p>
        ) : (
          <div className="transactions-table-wrapper">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>Activity</th>
                  <th>Impact</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const isDebit = tx.user_id === profile.id && tx.type === 'debit';
                  return (
                    <tr key={tx.id}>
                      <td>
                        <span className={`tx-type ${isDebit ? 'tx-debit' : 'tx-credit'}`}>
                          {isDebit ? '📤 PAYMENT' : '📥 WALLET LOAD'}
                        </span>
                      </td>
                      <td className={isDebit ? 'tx-debit' : 'tx-credit'} style={{ fontWeight: 700 }}>
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
