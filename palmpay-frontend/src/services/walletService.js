/**
 * Wallet Service
 * ==============
 * Handles wallet operations: balance, add money, transactions,
 * pending payments (merchant side).
 */

import { supabase } from './supabaseClient';

/**
 * Fetch the current wallet balance for a user.
 */
export async function getBalance(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('wallet_balance')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data.wallet_balance;
}

/**
 * Add money to the user's wallet (₹100 increment).
 */
export async function addMoney(userId, amount = 100) {
  // First get current balance
  const currentBalance = await getBalance(userId);
  const newBalance = parseFloat(currentBalance) + amount;

  const { data, error } = await supabase
    .from('profiles')
    .update({ wallet_balance: newBalance })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data.wallet_balance;
}

/**
 * Fetch transaction history for a user (as customer or merchant).
 * Ordered by most recent first.
 */
export async function getTransactions(userId) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .or(`user_id.eq.${userId},merchant_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return data || [];
}

/**
 * Create a pending payment request (merchant action).
 */
export async function createPendingPayment(merchantId, amount) {
  const { data, error } = await supabase
    .from('pending_payments')
    .insert({
      merchant_id: merchantId,
      amount: parseFloat(amount),
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Fetch pending payments for a merchant.
 */
export async function getPendingPayments(merchantId) {
  const { data, error } = await supabase
    .from('pending_payments')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return data || [];
}

/**
 * Fetch the latest transaction for a user from the Flask backend.
 * Used for polling after hardware scan.
 */
export async function getLatestTransaction(userId) {
  try {
    const response = await fetch(`http://localhost:5000/latest-transaction/${userId}`);
    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Error fetching latest transaction:', err);
    return { status: 'none' };
  }
}
