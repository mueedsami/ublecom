import { createClient } from '@supabase/supabase-js'

export function hasServiceRoleKey(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url) {
    throw new Error('Supabase URL not configured (NEXT_PUBLIC_SUPABASE_URL is missing).')
  }

  const key = serviceKey || anonKey || ''
  if (!key) {
    throw new Error(
      'Supabase credentials not configured. Please define SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )
  }

  if (!serviceKey) {
    console.warn(
      '⚠️ [SupabaseAdmin] SUPABASE_SERVICE_ROLE_KEY is not defined in environment variables. ' +
      'Falling back to NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Admin operations (such as bulk Excel imports) may violate PostgreSQL Row-Level Security (RLS) ' +
      'unless SUPABASE_SERVICE_ROLE_KEY is added to dashboard/.env.local (or your cloud hosting environment) ' +
      'or migration 013_fix_rls_policies.sql is applied.'
    )
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
