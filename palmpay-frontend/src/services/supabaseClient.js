/**
 * Supabase Client
 * ===============
 * Initializes and exports the Supabase client instance.
 * Uses environment variables for project URL and anon key.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env'
  );
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      // Provide a no-op lock function to avoid NavigatorLockAcquireTimeoutError
      // caused by React StrictMode double-mounting in development
      lock: async (name, acquireTimeout, fn) => {
        return await fn();
      },
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);
