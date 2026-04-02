import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ??
  'https://pjbpghknzqmwfykbtvzp.supabase.co';

export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  'sb_publishable_c-jEz8WNtOn5etyRxCrKNw_WIU-GBPE';

export const HAS_SUPABASE_CONFIG = Boolean(
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY,
);

export const supabase = HAS_SUPABASE_CONFIG
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
