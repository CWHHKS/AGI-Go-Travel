import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// URL이 없으면 더미 클라이언트를 생성하여 앱이 깨지지 않도록 방어
const DUMMY_URL = 'https://placeholder.supabase.co';

export const supabase = createClient(
  supabaseUrl || DUMMY_URL,
  supabaseAnonKey || 'dummy-anon-key',
  {
    auth: {
      autoRefreshToken: !!supabaseUrl,
      persistSession: !!supabaseUrl,
      detectSessionInUrl: !!supabaseUrl,
      // React StrictMode 이중 마운트로 인한 Lock 경고 방지
      lock: supabaseUrl
        ? undefined
        : async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>) => fn(),
    },
  }
);

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

