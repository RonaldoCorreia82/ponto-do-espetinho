import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseOk = Boolean(url && key)

// Só cria o client se as credenciais existirem
// (evita crash ao rodar localmente sem .env.local)
export const supabase = supabaseOk
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'espetinho-admin-session',
      },
    })
  : null
