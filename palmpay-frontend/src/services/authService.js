/**
 * Auth Service
 * ============
 * Handles all authentication operations with Supabase.
 * - Sign up (with name and role metadata)
 * - Sign in
 * - Sign out
 * - Session management
 */

import { supabase } from './supabaseClient';

/**
 * Register a new user with email, password, name, and role.
 * The database trigger auto-creates the profile row.
 */
export async function signUp(email, password, name, role) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, role }, // Stored in raw_user_meta_data, used by trigger
    },
  });

  if (error) throw error;
  return data;
}

/**
 * Sign in with email and password.
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Get the current session.
 */
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

/**
 * Fetch the profile for the currently authenticated user.
 * Returns: { id, name, email, role, wallet_balance }
 */
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}
