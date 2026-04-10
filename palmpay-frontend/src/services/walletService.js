/**
 * Wallet Service
 * ==============
 * Refactored for Production.
 * No direct database updates are allowed from the client.
 * All wallet modifications go through the Flask backend.
 */

import { supabase } from './supabaseClient';

const BACKEND_URL = 'http://localhost:5000';

/**
 * Fetch the current wallet balance (Safe to do directly via Supabase RLS).
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
 * Add money - Updated to use BACKEND API
 */
export async function addMoney(userId, amount = 100) {
  const response = await fetch(`${BACKEND_URL}/add-funds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, amount })
  });

  const result = await response.json();
  if (result.status === 'failed') {
    throw new Error(result.message);
  }
  return result.new_balance;
}

/**
 * Fetch latest 20 transactions.
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
 * Create a pending payment request (Merchant only).
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
 * Fetch pending payments per merchant.
 */
export async function getPendingPayments(merchantId) {
  const { data, error } = await supabase
    .from('pending_payments')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw error;
  return data || [];
}

/**
 * Poll for latest transaction status (post-hardware scan).
 */
export async function getLatestTransaction(userId) {
  try {
    const response = await fetch(`${BACKEND_URL}/latest-transaction/${userId}`);
    return await response.json();
  } catch (err) {
    console.error('Network error checking transaction:', err);
    return { status: 'none' };
  }
}
