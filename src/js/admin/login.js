import { login, getSession } from './auth.js'

async function init() {
  // Se já estiver logado, vai direto para o painel
  const session = await getSession()
  if (session) {
    window.location.href = '/admin/'
    return
  }

  const form      = document.getElementById('loginForm')
  const errorEl   = document.getElementById('loginError')
  const btnText   = document.getElementById('loginBtnText')
  const spinner   = document.getElementById('loginSpinner')
  const toggleBtn = document.getElementById('togglePass')
  const passInput = document.getElementById('password')

  // Mostrar/ocultar senha
  toggleBtn?.addEventListener('click', () => {
    const isPass = passInput.type === 'password'
    passInput.type = isPass ? 'text' : 'password'
    toggleBtn.setAttribute('aria-label', isPass ? 'Ocultar senha' : 'Mostrar senha')
    toggleBtn.querySelector('.eye-open').style.display  = isPass ? 'none'  : 'block'
    toggleBtn.querySelector('.eye-close').style.display = isPass ? 'block' : 'none'
  })

  form?.addEventListener('submit', async (e) => {
    e.preventDefault()

    const username = form.username.value.trim()
    const password = form.password.value
    const btn      = form.querySelector('button[type=submit]')

    errorEl.hidden = true
    btnText.textContent = 'Entrando…'
    spinner.hidden = false
    btn.disabled = true

    const { error } = await login(username, password)

    if (error) {
      errorEl.textContent = error.message
      errorEl.hidden = false
      btnText.textContent = 'Entrar'
      spinner.hidden = true
      btn.disabled = false
      form.password.select()
    } else {
      window.location.href = '/admin/'
    }
  })
}

init()
