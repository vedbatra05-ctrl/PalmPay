/**
 * Customer Dashboard
 * ==================
 * Modernized with a "Premium Biometric" aesthetic.
 * Automatically waits for hardware scans when idle.
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
  const [scanStatus, setScanStatus] = useState(null); // null | 'scanning' | 'processing' | 'success' | 'failed'
  const [statusMessage, setStatusMessage] = useState('');
  const [addingMoney, setAddingMoney] = useState(false);
  const [loadingTx, setLoadingTx] = useState(true);
  
  const lastTxId = useRef(null);

  /**
   * Fetch balance and transactions.
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
      console.error('Error fetching data:', err);
    } finally {
      setLoadingTx(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * Hardware Polling:
   * Keep an eye on the latest transaction to see if the RPi has processed one.
   */
  useEffect(() => {
    if (!profile?.id) return;

    const pollInterval = setInterval(async () => {
      const result = await getLatestTransaction(profile.id);
      if (result.status === 'success' && result.transaction.id !== lastTxId.current) {
        // New transaction detected!
        lastTxId.current = result.transaction.id;
        setScanStatus('success');
        setStatusMessage(`Payment of ₹${result.transaction.amount} successful!`);
        fetchData();
        refreshProfile();
        setTimeout(() => { setScanStatus(null); setStatusMessage(''); }, 5000);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [profile?.id, fetchData, refreshProfile]);

  const handleAddMoney = async () => {
    setAddingMoney(true);
    try {
      const newBal = await addMoney(profile.id, 100);
      setBalance(newBal);
      refreshProfile();
      setStatusMessage('₹100 added to your wallet');
      setScanStatus('success');
      setTimeout(() => { setScanStatus(null); setStatusMessage(''); }, 3000);
    } catch (err) {
      setStatusMessage('Oops! Could not add money');
      setScanStatus('failed');
    } finally {
      setAddingMoney(false);
    }
  };

  const handleGeneratePin = () => {
    const newPin = Math.floor(1000 + Math.random() * 9000).toString();
    setPin(newPin);
    setStatusMessage(`Security PIN active: ${newPin}`);
    setScanStatus('success');
    setTimeout(() => { setScanStatus(null); setStatusMessage(''); }, 8000);
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
        <h1 className="dashboard-title">System Status: Active</h1>
        <p className="dashboard-subtitle">Authenticated as {profile?.name}</p>
      </div>

      {/* Modern Status Banner */}
      {scanStatus && (
        <div className={`status-banner status-${scanStatus}`}>
          {scanStatus === 'success' ? '✓' : '✕'} {statusMessage}
        </div>
      )}

      <div className="dashboard-grid">
        {/* Wallet Balance (Premium Circle) */}
        <Card title="Your Wealth" className="balance-card glass-card">
          <div className="balance-amount">
            <span className="currency">₹</span>
            <span className="amount">{parseFloat(balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <p className="balance-note">Ready for biometric verification</p>
          <div style={{ marginTop: '24px' }}>
            <Button onClick={handleAddMoney} loading={addingMoney} variant="secondary" fullWidth>
              + Quick Recharge (₹100)
            </Button>
          </div>
        </Card>

        {/* Biometric Pulse (Passive Mode) */}
        <Card title="Hardware Link" className="actions-card glass-card">
          <div className="biometric-pulse-container">
            <div className="biometric-pulse">
              🖐️
            </div>
            <div className="pulse-label">Waiting for Palm Scan</div>
            <p className="empty-state" style={{ padding: 0 }}>Place hand over the scanner at the counter to initiate payment.</p>
          </div>
          <Button onClick={handleGeneratePin} variant="secondary" fullWidth>
            🔢 {pin ? 'Refresh Security PIN' : 'Generate Transaction PIN'}
          </Button>
          {pin && (
            <div className="pin-display" style={{ marginTop: '16px' }}>
              <span className="pin-label">SECURE PIN</span>
              <span className="pin-value">{pin}</span>
            </div>
          )}
        </Card>
      </div>

      {/* Transaction History (Sleek List) */}
      <Card title="Recent Activity" className="transactions-card glass-card">
        {loadingTx ? (
          <p className="empty-state">Securely fetching history...</p>
        ) : transactions.length === 0 ? (
          <p className="empty-state">No transactions yet. Complete your first palm payment!</p>
        ) : (
          <div className="transactions-table-wrapper">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Value</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const isDebit = tx.user_id === profile.id && tx.type === 'debit';
                  return (
                    <tr key={tx.id}>
                      <td>
                        <span className={`tx-type ${isDebit ? 'tx-debit' : 'tx-credit'}`}>
                          {isDebit ? '↑ SEND' : '↓ LOADED'}
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
