import { supabase, supabaseOk } from './supabase-client.js'

const ADMIN_EMAIL = 'pontodoespetinhosba@gmail.com'

/** Tela exibida quando .env.local não está configurado */
function mostrarTelaSetup() {
  document.body.style.cssText =
    'margin:0;background:#0c0c0c;color:#f3f3f3;font-family:Inter,sans-serif;' +
    'display:flex;align-items:center;justify-content:center;min-height:100dvh;'

  document.body.innerHTML = `
    <div style="max-width:480px;padding:32px;background:#1a1a1a;border:1px solid #2c2c2c;
                border-radius:16px;text-align:center;">
      <div style="font-size:3rem;margin-bottom:16px;">⚠️</div>
      <h2 style="color:#f59e0b;margin:0 0 12px;font-size:1.2rem;">Supabase não configurado</h2>
      <p style="color:#9ca3af;font-size:.9rem;line-height:1.6;margin:0 0 24px;">
        Crie o arquivo <code style="background:#111;padding:2px 8px;border-radius:4px;
        color:#f59e0b;">.env.local</code> na raiz do projeto com o conteúdo abaixo:
      </p>
      <pre style="background:#111;border:1px solid #2c2c2c;border-radius:10px;padding:16px;
                  text-align:left;font-size:.85rem;color:#a3e635;overflow:auto;margin:0 0 20px;">
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...</pre>
      <p style="color:#6b7280;font-size:.8rem;margin:0;">
        Encontre esses valores em<br>
        <strong style="color:#f3f3f3;">Supabase → Settings → API</strong>
      </p>
    </div>`
}

export async function login(username, password) {
  if (!supabaseOk) return { error: { message: 'Supabase não configurado.' } }
  if (username.trim().toLowerCase() !== 'espetinho')
    return { error: { message: 'Usuário ou senha incorretos.' } }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password,
  })
  return { data, error: error ? { message: 'Usuário ou senha incorretos.' } : null }
}

export async function logout() {
  if (supabaseOk && supabase) await supabase.auth.signOut()
  window.location.href = '/admin/login.html'
}

export async function getSession() {
  if (!supabaseOk || !supabase) return null
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return session
  } catch {
    return null
  }
}

export async function requireAuth() {
  if (!supabaseOk) {
    mostrarTelaSetup()
    return null
  }
  const session = await getSession()
  if (!session) {
    window.location.href = '/admin/login.html'
    return null
  }
  return session
}
