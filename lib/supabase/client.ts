import { BrowserCookieAuthStorageAdapter } from '@supabase/auth-helpers-shared'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient<any> | null = null

export const createClient = () => {
  if (browserClient) return browserClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required'
    )
  }

  browserClient = createSupabaseClient<any>(supabaseUrl, supabaseKey, {
    auth: {
      flowType: 'pkce',
      storage: new BrowserCookieAuthStorageAdapter(),
      persistSession: true,
      detectSessionInUrl: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'delta-browser-client',
      },
    },
  })

  return browserClient
}
