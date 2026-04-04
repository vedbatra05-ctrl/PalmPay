/**
 * useAuth Hook
 * ============
 * Custom React hook for managing authentication state.
 * - Tracks session, profile, and loading state
 * - Subscribes to auth state changes
 * - Provides login/logout/register functions
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { getProfile } from '../services/authService';

export function useAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * Fetch user profile from the profiles table.
   */
  const fetchProfile = useCallback(async (userId) => {
    try {
      const profileData = await getProfile(userId);
      setProfile(profileData);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    }
  }, []);

  /**
   * Refresh the profile data (useful after wallet changes).
   */
  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) {
      await fetchProfile(session.user.id);
    }
  }, [session, fetchProfile]);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession()
      .then(async ({ data: { session: currentSession } }) => {
        setSession(currentSession);
        if (currentSession?.user?.id) {
          await fetchProfile(currentSession.user.id);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error getting session:', err);
        setLoading(false);
      });

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, currentSession) => {
        setSession(currentSession);
        if (currentSession?.user?.id) {
          await fetchProfile(currentSession.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  return {
    session,
    profile,
    loading,
    refreshProfile,
    isAuthenticated: !!session,
    isCustomer: profile?.role === 'customer',
    isMerchant: profile?.role === 'merchant',
    userId: session?.user?.id || null,
  };
}
