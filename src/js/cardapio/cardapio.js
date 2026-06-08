// ═══════════════════════════════════════════════
// CARDÁPIO WHATSAPP — Ponto do Espetinho
// ═══════════════════════════════════════════════

// ── CONFIG ──────────────────────────────────────
const WHATSAPP = '5575981806299'
const LOJA     = 'Ponto do Espetinho'

// ── SUPABASE (anon, sem sessão) ──────────────────
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// ── PRODUTOS PADRÃO (fallback = cópia atual do banco) ────────
const FALLBACK = [
  // Espetinhos
  { id:'1',  categoria:'espetinho', nome:'Ancho',    preco:8,  ativo:true },
  { id:'6',  categoria:'espetinho', nome:'Asa',      preco:8,  ativo:true },
  { id:'2',  categoria:'espetinho', nome:'Cupim',    preco:12, ativo:true },
  { id:'4',  categoria:'espetinho', nome:'Kafita',   preco:8,  ativo:true },
  { id:'5',  categoria:'espetinho', nome:'Medalhão', preco:10, ativo:true },
  { id:'3',  categoria:'espetinho', nome:'Picanha',  preco:12, ativo:true },
  { id:'7',  categoria:'espetinho', nome:'Queijo',   preco:8,  ativo:true },
  // Bebidas
  { id:'14', categoria:'bebida',    nome:'Agua',     preco:3,  ativo:true },
  { id:'8',  categoria:'bebida',    nome:'Brahma',   preco:5,  ativo:true },
  { id:'10', categoria:'bebida',    nome:'Cachaça',  preco:5,  ativo:true },
  { id:'11', categoria:'bebida',    nome:'Caipijá',  preco:8,  ativo:true },
  { id:'12', categoria:'bebida',    nome:'Coca',     preco:5,  ativo:true },
  { id:'9',  categoria:'bebida',    nome:'Heinek',   preco:10, ativo:true },
  { id:'13', categoria:'bebida',    nome:'Suco',     preco:5,  ativo:true },
]

// ── EMOJI MAP ────────────────────────────────────
function getEmoji(cat, nome) {
  const n = nome.toLowerCase()
  if (n.includes('frango') || n.includes('medalhão') || n.includes('asa')) return '🍗'
  if (n.includes('queijo'))                                 return '🧀'
  if (n.includes('bacon'))                                  return '🥓'
  if (n.includes('picanha') || n.includes('cupim') ||
      n.includes('ancho')   || n.includes('carne'))        return '🥩'
  if (n.includes('kafita')  || n.includes('kofta'))        return '🥙'
  if (n.includes('costela'))                                return '🍖'
  if (n.includes('linguiça') || n.includes('linguica'))    return '🌭'
  if (n.includes('heineken') || n.includes('heinek'))      return '🍻'
  if (n.includes('brahma')   || n.includes('cerveja'))     return '🍺'
  if (n.includes('cacha'))                                  return '🥃'
  if (n.includes('caipir'))                                 return '🍹'
  if (n.includes('água') || n.includes('agua'))            return '💧'
  if (n.includes('coca') || n.includes('refri') || n.includes('soda')) return '🥤'
  if (n.includes('suco'))                                   return '🧃'
  return cat === 'espetinho' ? '🔥' : cat === 'bebida' ? '🍺' : '🍽️'
}

// ── CATEGORY LABELS ──────────────────────────────
const CAT_LABEL = {
  espetinho: '🔥 Espetinhos',
  bebida:    '🍺 Bebidas',
}
function catLabel(c) {
  return CAT_LABEL[c] ?? (c.charAt(0).toUpperCase() + c.slice(1))
}

// ── HELPERS ──────────────────────────────────────
const fmt = n => `R$ ${Number(n).toFixed(2).replace('.', ',')}`

// ── CART STATE ───────────────────────────────────
const cart = {}   // { id: { ...produto, qty } }

const cartCount = () => Object.values(cart).reduce((s, i) => s + i.qty, 0)
const cartTotal = () => Object.values(cart).reduce((s, i) => s + i.preco * i.qty, 0)

function addItem(p) {
  if (cart[p.id]) cart[p.id].qty++
  else            cart[p.id] = { ...p, qty: 1 }
  updateCartBar()
  updateQtyBadge(p.id)

  const btn = document.querySelector(`[data-add="${p.id}"]`)
  if (btn) {
    btn.classList.add('added')
    setTimeout(() => btn.classList.remove('added'), 300)
  }
}

function changeQty(id, delta) {
  if (!cart[id]) return
  cart[id].qty += delta
  if (cart[id].qty <= 0) delete cart[id]
  updateCartBar()
  updateQtyBadge(id)
}

function updateQtyBadge(id) {
  const badge = document.getElementById(`qty-${id}`)
  const btn   = document.querySelector(`[data-add="${id}"]`)
  const qty   = cart[id]?.qty ?? 0
  if (badge) badge.textContent = qty > 0 ? qty : ''
  if (btn) btn.classList.toggle('has-qty', qty > 0)
}

function updateCartBar() {
  const bar   = document.getElementById('cartBar')
  const count = document.getElementById('cbCount')
  const total = document.getElementById('cbTotal')
  const n     = cartCount()
  bar.classList.toggle('visible', n > 0)
  if (count) count.textContent = `${n} item${n !== 1 ? 's' : ''}`
  if (total) total.textContent = fmt(cartTotal())
}

// ── RENDER: CATEGORIES ───────────────────────────
let allProducts = []
let activeCat   = ''

// ordem preferida de exibição das categorias
const CAT_ORDER = ['espetinho', 'bebida']

function renderCategories() {
  const raw  = [...new Set(allProducts.map(p => p.categoria))]
  const cats = [
    ...CAT_ORDER.filter(c => raw.includes(c)),
    ...raw.filter(c => !CAT_ORDER.includes(c)),
  ]
  activeCat  = cats[0] ?? ''

  const nav = document.getElementById('catTabs')
  nav.innerHTML = cats.map(c => `
    <button class="cat-tab${c === activeCat ? ' active' : ''}" data-cat="${c}">
      ${catLabel(c)}
    </button>`).join('')

  nav.querySelectorAll('.cat-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCat = btn.dataset.cat
      nav.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      renderProducts()
    })
  })
}

// ── RENDER: PRODUCTS ─────────────────────────────
function renderProducts() {
  const main = document.getElementById('menuMain')
  const list = allProducts.filter(p => p.categoria === activeCat && p.ativo)

  if (!list.length) {
    main.innerHTML = '<p class="empty-msg">Nenhum item disponível no momento.</p>'
    return
  }

  main.innerHTML = list.map(p => {
    const emoji = getEmoji(p.categoria, p.nome)
    const qty   = cart[p.id]?.qty ?? 0
    return `
      <div class="prod-card" id="card-${p.id}">
        <div class="prod-emoji">${emoji}</div>
        <div class="prod-info">
          <p class="prod-nome">${p.nome}</p>
          <p class="prod-preco">${fmt(p.preco)}</p>
        </div>
        <button class="add-btn${qty > 0 ? ' has-qty' : ''}" data-add="${p.id}" aria-label="Adicionar ${p.nome}">
          <span class="qty-badge" id="qty-${p.id}">${qty > 0 ? qty : ''}</span>
          <span class="add-icon">+</span>
        </button>
      </div>`
  }).join('')

  main.querySelectorAll('[data-add]').forEach(btn => {
    const p = allProducts.find(x => String(x.id) === btn.dataset.add)
    if (p) btn.addEventListener('click', () => addItem(p))
  })
}

// ── CART MODAL ───────────────────────────────────
function openCart() {
  renderCartModal()
  document.getElementById('cartOverlay').classList.add('open')
  document.body.style.overflow = 'hidden'
}
function closeCart() {
  document.getElementById('cartOverlay').classList.remove('open')
  document.body.style.overflow = ''
  renderProducts()   // atualiza badges após edição no modal
}

function renderCartModal() {
  const items  = Object.values(cart).filter(i => i.qty > 0)
  const bodyEl = document.getElementById('cartItems')
  const totEl  = document.getElementById('cartTotalModal')

  if (!items.length) {
    bodyEl.innerHTML = '<p class="empty-msg" style="padding:32px 0">Carrinho vazio.</p>'
    totEl.textContent = fmt(0)
    return
  }

  bodyEl.innerHTML = items.map(i => `
    <div class="ci-row">
      <div class="ci-left">
        <span class="ci-emoji">${getEmoji(i.categoria, i.nome)}</span>
        <span class="ci-nome">${i.nome}</span>
      </div>
      <div class="ci-right">
        <span class="ci-sub">${fmt(i.preco * i.qty)}</span>
        <div class="ci-ctrl">
          <button class="ci-btn minus" data-id="${i.id}">−</button>
          <span class="ci-n">${i.qty}</span>
          <button class="ci-btn plus"  data-id="${i.id}">+</button>
        </div>
      </div>
    </div>`).join('')

  totEl.textContent = fmt(cartTotal())

  bodyEl.querySelectorAll('.ci-btn').forEach(btn => {
    const id    = btn.dataset.id
    const delta = btn.classList.contains('plus') ? 1 : -1
    btn.addEventListener('click', () => {
      changeQty(id, delta)
      renderCartModal()
    })
  })
}

// ── PAGAMENTO TOGGLE ─────────────────────────────
let pagamento = 'dinheiro'

function initPayToggle() {
  document.querySelectorAll('.pay-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      pagamento = btn.dataset.pay
      document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      const pixInfo = document.getElementById('pixInfo')
      if (pixInfo) pixInfo.classList.toggle('visible', pagamento === 'pix')
    })
  })

  // Copiar chave PIX ao clicar
  document.getElementById('pixKey')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText('75981806299')
    } catch {
      // fallback para browsers sem clipboard API
      const ta = document.createElement('textarea')
      ta.value = '75981806299'
      ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    const badge = document.getElementById('pixCopied')
    if (badge) {
      badge.classList.add('show')
      setTimeout(() => badge.classList.remove('show'), 2000)
    }
  })
}

// ── REGISTRAR VENDA ──────────────────────────────
async function registrarVenda(items, total, nome) {
  if (!SUPA_URL || !SUPA_KEY) return
  try {
    await fetch(`${SUPA_URL}/rest/v1/rpc/registrar_pedido_cardapio`, {
      method:  'POST',
      headers: {
        apikey:         SUPA_KEY,
        Authorization:  `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_total:         total,
        p_cliente_nome:  nome || null,
        p_observacao:    items.map(i => `${i.qty}× ${i.nome}`).join(', '),
        p_pago_dinheiro: pagamento === 'dinheiro' ? total : 0,
        p_pago_pix:      pagamento === 'pix'      ? total : 0,
        p_itens: items.map(i => ({
          produto_id:    Number(i.id),
          produto_nome:  i.nome,
          quantidade:    i.qty,
          produto_preco: i.preco,
          subtotal:      i.preco * i.qty,
        })),
      }),
    })
  } catch { /* silencia — não bloqueia o pedido */ }
}

// ── WHATSAPP ─────────────────────────────────────
async function sendWhatsApp() {
  const items = Object.values(cart).filter(i => i.qty > 0)
  if (!items.length) return

  const nome     = document.getElementById('clienteNome')?.value.trim()
  const pagLabel = pagamento === 'pix' ? 'PIX' : 'Dinheiro'
  const total    = cartTotal()

  const header = nome ? `Pedido de ${nome}:` : `Pedido:`
  const linhas = items.map(i =>
    `${i.nome} - QDT: ${i.qty} - R$ ${Number(i.preco).toFixed(2)}`)

  const msg = [
    header,
    ...linhas,
    `Total: R$ ${Number(total).toFixed(2)}`,
    `Pagamento: ${pagLabel}`,
  ].join('\n')

  // Registra no banco (sem aguardar — não bloqueia o WhatsApp)
  registrarVenda(items, total, nome)

  window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank')
}

// ── LOAD PRODUCTS ────────────────────────────────
async function loadProducts() {
  if (SUPA_URL && SUPA_KEY) {
    try {
      // tenta com ordem; fallback para nome se a coluna ainda não existir
      let r = await fetch(
        `${SUPA_URL}/rest/v1/produtos?ativo=eq.true&order=ordem,nome`,
        { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } }
      )
      if (!r.ok) {
        r = await fetch(
          `${SUPA_URL}/rest/v1/produtos?ativo=eq.true&order=nome`,
          { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } }
        )
      }
      if (r.ok) {
        const data = await r.json()
        if (Array.isArray(data) && data.length) {
          allProducts = data.map(p => ({ ...p, id: String(p.id) }))
          return
        }
      }
    } catch { /* usa fallback */ }
  }
  allProducts = FALLBACK
}

// ── INIT ─────────────────────────────────────────
async function init() {
  await loadProducts()
  renderCategories()
  renderProducts()

  document.getElementById('cartBtn')
    .addEventListener('click', openCart)

  document.getElementById('cartClose')
    .addEventListener('click', closeCart)

  document.getElementById('cartOverlay')
    .addEventListener('click', e => { if (e.target.id === 'cartOverlay') closeCart() })

  document.getElementById('wppBtn')
    .addEventListener('click', sendWhatsApp)

  initPayToggle()
}

init()
