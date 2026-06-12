import { requireAuth, logout } from './auth.js'
import { supabase }           from './supabase-client.js'

// ─── Estado global ────────────────────────────────────────────
let produtos        = []
let carrinho        = []
let currentSection  = 'dashboard'
let historicoPage   = 0
const PAGE_SIZE     = 20
const TZ            = 'America/Bahia'   // Salvador-BA (UTC-3, sem horário de verão)

// ─── Boot ─────────────────────────────────────────────────────
async function init() {
  startClock()                          // relógio antes de qualquer await
  const session = await requireAuth()
  if (!session) return
  await loadProdutos()
  setupNav()
  await showSection('dashboard')
}

// ─── Relógio Salvador-BA ───────────────────────────────────────
function startClock() {
  const el = document.getElementById('reloginho')
  if (!el) return
  const DIAS  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
  function tick() {
    const now     = new Date()
    const weekday = DIAS[new Date(now.toLocaleString('en-US', { timeZone: TZ })).getDay()]
    const data    = now.toLocaleDateString('pt-BR',  { timeZone: TZ, day:'2-digit', month:'2-digit' })
    const hora    = now.toLocaleTimeString('pt-BR',  { timeZone: TZ, hour:'2-digit', minute:'2-digit', second:'2-digit' })
    el.innerHTML  = `<span class="rel-weekday">${weekday}</span><span class="rel-data">${data}</span><span class="rel-hora">${hora}</span>`
  }
  tick()
  setInterval(tick, 1000)
}

// Exposto globalmente — funciona mesmo se init() não terminar
async function sairAdmin() {
  await logout()          // signOut + redirect para /admin/login.html
}
window.sairAdmin = sairAdmin

async function loadProdutos() {
  let { data, error } = await supabase
    .from('produtos').select('*').eq('ativo', true)
    .order('categoria').order('ordem').order('id')
  if (error) {
    ;({ data, error } = await supabase
      .from('produtos').select('*').eq('ativo', true)
      .order('categoria').order('id'))
  }
  if (!error && data) produtos = data
}

// ─── Navegação ────────────────────────────────────────────────
function setupNav() {
  document.querySelectorAll('.nav-item[data-section]').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault()
      await showSection(link.dataset.section)
      document.getElementById('sidebar')?.classList.remove('open')
    })
  })
  document.getElementById('menuToggle')?.addEventListener('click', () =>
    document.getElementById('sidebar')?.classList.toggle('open'))
  document.getElementById('sidebarOverlay')?.addEventListener('click', () =>
    document.getElementById('sidebar')?.classList.remove('open'))
}

async function showSection(name) {
  document.querySelectorAll('.nav-item[data-section]').forEach(el =>
    el.classList.toggle('active', el.dataset.section === name))
  document.querySelectorAll('.admin-section').forEach(el =>
    el.classList.toggle('active', el.id === `sec-${name}`))
  currentSection = name
  const TITLES = { dashboard:'Dashboard', 'nova-venda':'Nova Venda',
                   historico:'Histórico de Vendas', relatorio:'Relatório',
                   produtos:'Produtos', saidas:'Saídas', clientes:'Clientes',
                   fiado:'Fiado' }
  document.getElementById('sectionTitle').textContent = TITLES[name] ?? name
  if      (name === 'dashboard')  await loadDashboard()
  else if (name === 'nova-venda')      renderNovaVenda()
  else if (name === 'historico')  await loadHistorico()
  else if (name === 'relatorio')  await loadRelatorio()
  else if (name === 'produtos')   await renderProdutosAdmin()
  else if (name === 'saidas')     await initSaidas()
  else if (name === 'clientes')   await loadRelatorioClientes()
  else if (name === 'fiado')      await initFiado()
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════
async function loadDashboard() {
  // Calcular início do dia/mês no fuso de Salvador (UTC-3, fixo)
  const bahiaDate    = new Date().toLocaleDateString('en-CA', { timeZone: TZ }) // "YYYY-MM-DD"
  const [y, m]       = bahiaDate.split('-')
  const startOfDay   = `${bahiaDate}T00:00:00-03:00`
  const startOfMonth = `${y}-${m}-01T00:00:00-03:00`

  const [rHoje, rMes, rGeral, rRecentes, rSaidasHoje, rSaidasMes, rSaidasRecentes] = await Promise.all([
    supabase.from('vendas').select('total').gte('criado_em', startOfDay),
    supabase.from('vendas').select('total').gte('criado_em', startOfMonth),
    supabase.from('vendas').select('total'),
    supabase.from('vendas')
      .select('*, venda_itens(produto_nome, quantidade)')
      .order('criado_em', { ascending: false }).limit(10),
    supabase.from('saidas').select('valor').eq('data', bahiaDate),
    supabase.from('saidas').select('valor').gte('data', `${y}-${m}-01`),
    supabase.from('saidas').select('*')
      .order('data', { ascending: false })
      .order('criado_em', { ascending: false }).limit(8),
  ])

  const soma  = arr => (arr || []).reduce((s, v) => s + Number(v.total), 0)
  const somaS = arr => (arr || []).reduce((s, v) => s + Number(v.valor), 0)
  const fmt   = n => `R$ ${n.toFixed(2).replace('.', ',')}`

  const saidasHoje   = somaS(rSaidasHoje.data)
  const saidasMes    = somaS(rSaidasMes.data)
  const receitaMes   = soma(rMes.data)
  const resultadoMes = receitaMes - saidasMes

  set('stat-receita-hoje',  fmt(soma(rHoje.data)))
  set('stat-vendas-hoje',   String((rHoje.data || []).length))
  set('stat-receita-mes',   fmt(receitaMes))
  set('stat-receita-total', fmt(soma(rGeral.data)))
  set('stat-saidas-hoje',   fmt(saidasHoje))
  set('stat-saidas-mes',    fmt(saidasMes))
  set('stat-resultado-mes', (resultadoMes >= 0 ? '+' : '-') + ' ' + fmt(Math.abs(resultadoMes)))

  // Cor dinâmica do card Resultado
  const resCard = document.getElementById('stat-resultado-card')
  if (resCard) {
    resCard.classList.toggle('stat-card--green', resultadoMes >= 0)
    resCard.classList.toggle('stat-card--red',   resultadoMes <  0)
  }

  renderRecentSales(rRecentes.data || [])
  renderRecentSaidas(rSaidasRecentes.data || [], fmt)
}

function renderRecentSales(vendas) {
  const tbody = document.getElementById('recentSalesBody')
  if (!tbody) return
  if (!vendas.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty">Nenhuma venda registrada ainda.</td></tr>`
    return
  }
  tbody.innerHTML = vendas.map(v => {
    const d     = new Date(v.criado_em)
    const data  = d.toLocaleDateString('pt-BR', { timeZone: TZ, day:'2-digit', month:'2-digit', year:'2-digit' })
    const hora  = d.toLocaleTimeString('pt-BR',  { timeZone: TZ, hour:'2-digit', minute:'2-digit' })
    const itens = (v.venda_itens || []).map(i => `${i.quantidade}× ${i.produto_nome}`).join(', ')
    const total = `R$ ${Number(v.total).toFixed(2).replace('.', ',')}`
    const cliente = v.cliente_nome
      ? `<span class="badge badge-blue">${v.cliente_nome}</span>`
      : '<span class="text-muted-sm">—</span>'
    const pag = pagBadge(v)
    return `
      <tr>
        <td data-label="Data">${data} ${hora}</td>
        <td data-label="Cliente">${cliente}</td>
        <td data-label="Itens" class="text-muted-sm">${itens || '—'}</td>
        <td data-label="Total">
          <span class="badge badge-green">${total}</span>
          ${pag}
        </td>
        <td>
          <span class="row-actions">
            <button class="btn-icon btn-edit" title="Editar venda"
              onclick="editarVenda('${v.id}')">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none"
                viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </button>
            <button class="btn-icon btn-danger" title="Cancelar venda"
              onclick="cancelarVenda('${v.id}')">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none"
                viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </span>
        </td>
      </tr>`
  }).join('')
}

function renderRecentSaidas(saidas, fmt) {
  const tbody = document.getElementById('recentSaidasBody')
  if (!tbody) return
  if (!saidas.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="table-empty">Nenhuma saída registrada ainda.</td></tr>`
    return
  }
  tbody.innerHTML = saidas.map(s => `
    <tr>
      <td data-label="Data">${formatDataBR(s.data)}</td>
      <td data-label="Item"><strong>${s.descricao}</strong></td>
      <td data-label="Valor">
        <span class="badge" style="background:rgba(239,68,68,.15);color:#f87171">
          ${fmt(Number(s.valor))}
        </span>
      </td>
      <td>
        <button class="btn-icon btn-danger" title="Excluir saída"
          onclick="deletarSaidaDash('${s.id}')">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none"
            viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7
                 m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      </td>
    </tr>`).join('')
}

async function deletarSaidaDash(id) {
  if (!confirm('Excluir esta saída?')) return
  const { error } = await supabase.from('saidas').delete().eq('id', id)
  if (error) { showToast('Erro ao excluir.', 'error'); return }
  showToast('Saída excluída.', 'success')
  await loadDashboard()
}

/** Gera badges 💵 / 📱 baseado nos valores da venda */
function pagBadge(v) {
  const d = Number(v.pago_dinheiro || 0)
  const p = Number(v.pago_pix      || 0)
  if (!d && !p) return ''
  const parts = []
  if (d > 0) parts.push(`<span class="pag-badge pag-badge--din">💵</span>`)
  if (p > 0) parts.push(`<span class="pag-badge pag-badge--pix">📱</span>`)
  return parts.join('')
}

// ═══════════════════════════════════════════════════════════════
// NOVA VENDA — Interface POS
// ═══════════════════════════════════════════════════════════════
function renderNovaVenda() {
  const grid = document.getElementById('produtosGrid')
  if (!grid) return

  const espetinhos = produtos.filter(p => p.categoria === 'espetinho')
  const bebidas    = produtos.filter(p => p.categoria === 'bebida')

  const counts = {}
  produtos.forEach(p => { counts[p.id] = 0 })

  const fmt = n => `R$ ${n.toFixed(2).replace('.', ',')}`

  // ── Sync carrinho ──
  function syncCarrinho() {
    carrinho = produtos.filter(p => counts[p.id] > 0).map(p => ({
      id: p.id, nome: p.nome, preco: p.preco,
      quantidade: counts[p.id], subtotal: counts[p.id] * p.preco,
    }))
  }

  // ── Cálculo do troco ──
  function calcTroco() {
    const total    = carrinho.reduce((s, i) => s + i.subtotal, 0)
    const dinheiro = parseFloat(document.getElementById('pagoDinheiro')?.value) || 0
    const pix      = parseFloat(document.getElementById('pagoPix')?.value)      || 0
    const trocoBox = document.getElementById('trocoBox')
    const trocoVal = document.getElementById('trocoValue')
    if (!trocoBox || !trocoVal) return

    if (dinheiro === 0 && pix === 0) {
      trocoBox.classList.add('hidden'); return
    }
    trocoBox.classList.remove('hidden')
    const restDin = Math.max(0, total - pix)
    const troco   = dinheiro - restDin

    if (troco > 0.005) {
      trocoVal.textContent = fmt(troco)
      trocoBox.dataset.tipo = 'ok'
    } else if (troco < -0.005) {
      trocoVal.textContent = `Falta ${fmt(Math.abs(troco))}`
      trocoBox.dataset.tipo = 'falta'
    } else {
      trocoVal.textContent = 'Exato ✓'
      trocoBox.dataset.tipo = 'exato'
    }
  }

  // ── Atualizar UI ──
  function updateUI() {
    syncCarrinho()
    const total = carrinho.reduce((s, i) => s + i.subtotal, 0)

    produtos.forEach(p => {
      const cell = grid.querySelector(`.pos-cell[data-id="${p.id}"]`)
      if (!cell) return
      const n = counts[p.id]
      cell.querySelector('.pos-count').textContent = n || ''
      cell.classList.toggle('pos-cell--active', n > 0)
      const minus = cell.querySelector('.pos-minus')
      if (minus) minus.style.display = n > 0 ? 'flex' : 'none'
    })

    const totEl = document.getElementById('posTotal')
    if (totEl) totEl.textContent = fmt(total)

    const btn = document.getElementById('btnConfirmarVenda')
    if (btn) btn.disabled = carrinho.length === 0

    const chips = document.getElementById('posSummary')
    if (chips) {
      chips.innerHTML = carrinho.length === 0
        ? `<span class="pos-hint">Toque nos produtos acima para registrar a venda</span>`
        : carrinho.map(i =>
            `<span class="summary-chip">${i.nome} <strong>×${i.quantidade}</strong></span>`
          ).join('')
    }

    calcTroco()
  }

  // ── Render linha de produtos ──
  function posRow(icon, label, items) {
    return `
      <div class="pos-block">
        <div class="pos-block-hd">${icon}&nbsp; ${label}</div>
        <div class="pos-row-cells">
          ${items.map(p => `
            <button class="pos-cell" type="button" data-id="${p.id}">
              <span class="pos-cell-name">${p.nome}</span>
              <span class="pos-count"></span>
              <span class="pos-cell-price">R$&nbsp;${Number(p.preco).toFixed(2).replace('.', ',')}</span>
              <span class="pos-minus" style="display:none" data-id="${p.id}">−</span>
            </button>`).join('')}
        </div>
      </div>`
  }

  grid.innerHTML = `
    ${posRow('🔥', 'Espetinhos', espetinhos)}
    ${posRow('🍺', 'Bebidas', bebidas)}

    <div class="pos-footer">
      <!-- Chips de resumo -->
      <div id="posSummary" class="pos-summary">
        <span class="pos-hint">Toque nos produtos acima para registrar a venda</span>
      </div>

      <!-- Formulário de pagamento -->
      <div class="pagamento-form">
        <div class="pag-row">
          <div class="pag-field pag-field--full">
            <label class="pag-label" for="clienteNome">👤 Cliente (opcional)</label>
            <input type="text" id="clienteNome" class="field-input pag-input"
              placeholder="Nome do cliente" autocomplete="off" spellcheck="false" />
          </div>
        </div>
        <div class="pag-row">
          <div class="pag-field">
            <label class="pag-label" for="pagoDinheiro">💵 Dinheiro</label>
            <input type="number" id="pagoDinheiro" class="field-input pag-input"
              placeholder="0,00" min="0" step="0.01" inputmode="decimal" />
          </div>
          <div class="pag-field">
            <label class="pag-label" for="pagoPix">📱 PIX</label>
            <input type="number" id="pagoPix" class="field-input pag-input"
              placeholder="0,00" min="0" step="0.01" inputmode="decimal" />
          </div>
          <div class="troco-box hidden" id="trocoBox" data-tipo="">
            <span class="troco-label">TROCO</span>
            <span class="troco-value" id="trocoValue">R$ 0,00</span>
          </div>
        </div>
      </div>

      <!-- Barra de ação -->
      <div class="pos-action-bar">
        <button class="btn-secondary" type="button" id="btnLimpar">🗑&nbsp; Limpar</button>
        <span class="pos-total-display">Total:&nbsp;<strong id="posTotal">R$ 0,00</strong></span>
        <button id="btnConfirmarVenda" class="btn-primary" type="button"
          onclick="confirmarVenda()" disabled>
          ✅&nbsp; Confirmar Venda
        </button>
      </div>
    </div>`

  // ── Eventos: produtos ──
  grid.querySelectorAll('.pos-cell').forEach(cell => {
    cell.addEventListener('click', e => {
      if (e.target.closest('.pos-minus')) return
      const id = Number(cell.dataset.id)
      counts[id]++
      updateUI()
      cell.classList.add('pos-cell--tap')
      setTimeout(() => cell.classList.remove('pos-cell--tap'), 120)
    })
  })
  grid.querySelectorAll('.pos-minus').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      const id = Number(btn.dataset.id)
      if (counts[id] > 0) { counts[id]--; updateUI() }
    })
  })

  // ── Eventos: pagamento ──
  document.getElementById('pagoDinheiro')?.addEventListener('input', calcTroco)
  document.getElementById('pagoPix')?.addEventListener('input', calcTroco)

  // ── Limpar ──
  document.getElementById('btnLimpar')?.addEventListener('click', () => {
    if (!carrinho.length || confirm('Limpar todos os itens?')) {
      produtos.forEach(p => { counts[p.id] = 0 })
      const dEl = document.getElementById('pagoDinheiro')
      const pEl = document.getElementById('pagoPix')
      const cEl = document.getElementById('clienteNome')
      if (dEl) dEl.value = ''
      if (pEl) pEl.value = ''
      if (cEl) cEl.value = ''
      updateUI()
    }
  })

  window.limparVenda = () => {
    produtos.forEach(p => { counts[p.id] = 0 })
    updateUI()
  }
}

// ═══════════════════════════════════════════════════════════════
// CONFIRMAR VENDA
// ═══════════════════════════════════════════════════════════════
async function confirmarVenda() {
  if (!carrinho.length) return

  const btn = document.getElementById('btnConfirmarVenda')
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando…' }

  const total         = carrinho.reduce((s, i) => s + i.subtotal, 0)
  const clienteNome   = document.getElementById('clienteNome')?.value.trim() || null
  const pagoDinheiro  = parseFloat(document.getElementById('pagoDinheiro')?.value) || 0
  const pagoPix       = parseFloat(document.getElementById('pagoPix')?.value)      || 0
  const troco         = Math.max(0, pagoDinheiro - Math.max(0, total - pagoPix))

  const { data: venda, error: ve } = await supabase
    .from('vendas')
    .insert({ total, cliente_nome: clienteNome,
              pago_dinheiro: pagoDinheiro, pago_pix: pagoPix, troco })
    .select().single()

  if (ve || !venda) {
    showToast('Erro ao registrar venda!', 'error')
    if (btn) { btn.disabled = false; btn.textContent = '✅  Confirmar Venda' }
    return
  }

  const { error: ie } = await supabase.from('venda_itens').insert(
    carrinho.map(i => ({
      venda_id: venda.id, produto_id: i.id, produto_nome: i.nome,
      produto_preco: i.preco, quantidade: i.quantidade, subtotal: i.subtotal,
    }))
  )

  if (ie) {
    await supabase.from('vendas').delete().eq('id', venda.id)
    showToast('Erro ao salvar itens!', 'error')
    if (btn) { btn.disabled = false; btn.textContent = '✅  Confirmar Venda' }
    return
  }

  // Montar mensagem de confirmação
  const fmt    = n => `R$ ${n.toFixed(2).replace('.', ',')}`
  let msgExtra = ''
  if (clienteNome)    msgExtra += ` · ${clienteNome}`
  if (pagoDinheiro)   msgExtra += ` · 💵 ${fmt(pagoDinheiro)}`
  if (pagoPix)        msgExtra += ` · 📱 ${fmt(pagoPix)}`
  if (troco > 0.005)  msgExtra += ` · Troco ${fmt(troco)}`

  showToast(`✅ Venda de ${fmt(total)} registrada!${msgExtra}`, 'success')
  carrinho = []
  renderNovaVenda()
}

// ═══════════════════════════════════════════════════════════════
// HISTÓRICO
// ═══════════════════════════════════════════════════════════════
const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

/** Preenche o <select> de meses na primeira abertura */
function populateMesSelect() {
  const sel = document.getElementById('filtroMes')
  if (!sel || sel.options.length > 1) return   // já populado

  const bahiaDate = new Date().toLocaleDateString('en-CA', { timeZone: TZ })
  let [y, m] = bahiaDate.split('-').map(Number)

  for (let i = 0; i < 24; i++) {
    if (m <= 0) { m += 12; y-- }
    const opt = document.createElement('option')
    opt.value       = `${y}-${String(m).padStart(2, '0')}`
    opt.textContent = `${MESES_PT[m - 1]} ${y}`
    sel.appendChild(opt)
    m--
  }
}

/** Preenche o <select> de anos na primeira abertura */
function populateAnoSelect() {
  const sel = document.getElementById('filtroAno')
  if (!sel || sel.options.length > 1) return   // já populado

  const bahiaDate  = new Date().toLocaleDateString('en-CA', { timeZone: TZ })
  const currentYear = parseInt(bahiaDate.split('-')[0])

  for (let y = currentYear; y >= 2024; y--) {
    const opt = document.createElement('option')
    opt.value       = String(y)
    opt.textContent = String(y)
    sel.appendChild(opt)
  }
}

function limparFiltroHistorico() {
  const data = document.getElementById('filtroData')
  const mes  = document.getElementById('filtroMes')
  const ano  = document.getElementById('filtroAno')
  if (data) data.value = ''
  if (mes)  mes.value  = ''
  if (ano)  ano.value  = ''
  loadHistorico()
}

async function loadHistorico(resetPage = true) {
  populateMesSelect()
  populateAnoSelect()
  if (resetPage) historicoPage = 0
  const container = document.getElementById('historicoContainer')
  if (!container) return
  container.innerHTML = '<div class="loading-row">Carregando…</div>'

  const dateVal = document.getElementById('filtroData')?.value
  const mesVal  = document.getElementById('filtroMes')?.value
  const anoVal  = document.getElementById('filtroAno')?.value
  const from    = historicoPage * PAGE_SIZE
  const to      = from + PAGE_SIZE - 1

  let q = supabase
    .from('vendas')
    .select('*, venda_itens(produto_nome, quantidade, produto_preco, subtotal)',
            { count: 'exact' })
    .order('criado_em', { ascending: false })
    .range(from, to)

  if (dateVal) {
    // Filtro por data específica (fuso Salvador)
    q = q.gte('criado_em', `${dateVal}T00:00:00-03:00`)
         .lte('criado_em', `${dateVal}T23:59:59-03:00`)
  } else if (mesVal) {
    // Filtro por mês completo (fuso Salvador)
    const [y, m] = mesVal.split('-').map(Number)
    const nextM  = m === 12 ? 1   : m + 1
    const nextY  = m === 12 ? y+1 : y
    const start  = new Date(`${y}-${String(m).padStart(2,'0')}-01T00:00:00-03:00`).toISOString()
    const end    = new Date(`${nextY}-${String(nextM).padStart(2,'0')}-01T00:00:00-03:00`).toISOString()
    q = q.gte('criado_em', start).lt('criado_em', end)
  } else if (anoVal) {
    // Filtro por ano completo (fuso Salvador)
    const y     = parseInt(anoVal)
    const start = new Date(`${y}-01-01T00:00:00-03:00`).toISOString()
    const end   = new Date(`${y + 1}-01-01T00:00:00-03:00`).toISOString()
    q = q.gte('criado_em', start).lt('criado_em', end)
  }

  const { data, error, count } = await q
  if (error) {
    container.innerHTML = '<div class="loading-row error">Erro ao carregar histórico.</div>'
    return
  }

  const fmt = n => `R$ ${n.toFixed(2).replace('.', ',')}`

  // --- Total do Ano ---
  const badgeEl    = document.getElementById('historicoTotalAno')
  const badgeLblEl = document.getElementById('historicoTotalAnoLabel')
  const badgeValEl = document.getElementById('historicoTotalAnoValor')
  if (badgeEl) {
    if (anoVal) {
      const y     = parseInt(anoVal)
      const start = new Date(`${y}-01-01T00:00:00-03:00`).toISOString()
      const end   = new Date(`${y + 1}-01-01T00:00:00-03:00`).toISOString()
      const { data: allAno } = await supabase.from('vendas').select('total')
        .gte('criado_em', start).lt('criado_em', end)
      const totalAno = (allAno || []).reduce((s, v) => s + Number(v.total), 0)
      if (badgeLblEl) badgeLblEl.textContent = anoVal
      if (badgeValEl) badgeValEl.textContent = fmt(totalAno)
      badgeEl.style.display = 'flex'
    } else {
      badgeEl.style.display = 'none'
    }
  }

  const vendas = data || []
  if (!vendas.length) {
    container.innerHTML = '<div class="loading-row">Nenhuma venda encontrada.</div>'
    renderPaginacao(0); return
  }

  const somaTotal = vendas.reduce((s, v) => s + Number(v.total), 0)

  container.innerHTML = `
    <div class="historico-summary">
      ${vendas.length} venda(s) &nbsp;•&nbsp; Total:
      <strong>${fmt(somaTotal)}</strong>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Data / Hora</th>
            <th>Cliente</th>
            <th>Itens</th>
            <th>Pagamento</th>
            <th>Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${vendas.map(v => historicoRow(v, fmt)).join('')}</tbody>
      </table>
    </div>`

  container.querySelectorAll('.expand-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id  = btn.dataset.id
      const row = document.getElementById(`det-${id}`)
      const vis = !row.classList.contains('hidden')
      row.classList.toggle('hidden', vis)
      btn.textContent = vis ? '▼' : '▲'
    })
  })

  renderPaginacao(count ?? 0)
}

function historicoRow(v, fmt) {
  const d      = new Date(v.criado_em)
  const data   = d.toLocaleDateString('pt-BR', { timeZone: TZ })
  const hora   = d.toLocaleTimeString('pt-BR',  { timeZone: TZ, hour:'2-digit', minute:'2-digit' })
  const qtd    = (v.venda_itens || []).reduce((s, i) => s + i.quantidade, 0)
  const total  = Number(v.total)
  const din    = Number(v.pago_dinheiro || 0)
  const pix    = Number(v.pago_pix      || 0)
  const troco  = Number(v.troco         || 0)

  // Coluna pagamento
  const pagParts = []
  if (din > 0) pagParts.push(`<span class="pag-badge pag-badge--din">💵 ${fmt(din)}</span>`)
  if (pix > 0) pagParts.push(`<span class="pag-badge pag-badge--pix">📱 ${fmt(pix)}</span>`)
  if (troco > 0.005) pagParts.push(`<span class="pag-badge pag-badge--troco">↩ ${fmt(troco)}</span>`)
  const pagCol = pagParts.length ? pagParts.join(' ') : '<span class="text-muted-sm">—</span>'

  const itensHTML = (v.venda_itens || [])
    .map(i => `<li>${i.quantidade}× ${i.produto_nome} — ${fmt(Number(i.subtotal))}</li>`)
    .join('')

  return `
    <tr>
      <td data-label="Data">${data} ${hora}</td>
      <td data-label="Cliente">
        ${v.cliente_nome
          ? `<span class="badge badge-blue">${v.cliente_nome}</span>`
          : '<span class="text-muted-sm">—</span>'}
      </td>
      <td data-label="Itens">${qtd} item(s)</td>
      <td data-label="Pagamento">${pagCol}</td>
      <td data-label="Total"><span class="badge badge-green">${fmt(total)}</span></td>
      <td>
        <span class="row-actions">
          <button class="expand-btn" data-id="${v.id}" title="Ver itens">▼</button>
          <button class="btn-icon btn-edit" title="Editar venda"
            onclick="editarVenda('${v.id}')">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none"
              viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
          <button class="btn-icon btn-danger" title="Cancelar"
            onclick="cancelarVenda('${v.id}')">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none"
              viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </span>
      </td>
    </tr>
    <tr id="det-${v.id}" class="detail-row hidden">
      <td colspan="6">
        <ul class="detail-list">${itensHTML || '<li>—</li>'}</ul>
      </td>
    </tr>`
}

function renderPaginacao(total) {
  const el = document.getElementById('paginacao')
  if (!el) return
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  el.innerHTML = `
    <button class="btn-page" onclick="prevPage()"
      ${historicoPage === 0 ? 'disabled' : ''}>← Anterior</button>
    <span class="page-info">Página ${historicoPage + 1} de ${pages}</span>
    <button class="btn-page" onclick="nextPage(${pages})"
      ${historicoPage >= pages - 1 ? 'disabled' : ''}>Próxima →</button>`
}
function prevPage() { if (historicoPage > 0) { historicoPage--; loadHistorico(false) } }
function nextPage(p) { if (historicoPage < p - 1) { historicoPage++; loadHistorico(false) } }

// ═══════════════════════════════════════════════════════════════
// RELATÓRIO
// ═══════════════════════════════════════════════════════════════
async function loadRelatorio() {
  const container = document.getElementById('relatorioContainer')
  if (!container) return
  container.innerHTML = '<div class="loading-row">Calculando…</div>'

  const dias     = Number(document.getElementById('filtroPeriodo')?.value ?? 7)
  const since    = new Date()
  since.setDate(since.getDate() - dias)
  const sinceISO = since.toISOString()
  const fmt = n => `R$ ${n.toFixed(2).replace('.', ',')}`

  const [rVendas, rItens] = await Promise.all([
    supabase.from('vendas')
      .select('total, criado_em, pago_dinheiro, pago_pix')
      .gte('criado_em', sinceISO),
    supabase.from('venda_itens')
      .select('produto_nome, quantidade, subtotal, vendas!inner(criado_em)')
      .gte('vendas.criado_em', sinceISO),
  ])

  const vendas = rVendas.data || []
  const itens  = rItens.data  || []

  const totalReceita  = vendas.reduce((s, v) => s + Number(v.total), 0)
  const totalVendas   = vendas.length
  const totalDinheiro = vendas.reduce((s, v) => s + Number(v.pago_dinheiro || 0), 0)
  const totalPix      = vendas.reduce((s, v) => s + Number(v.pago_pix      || 0), 0)
  const ticketMedio   = totalVendas ? totalReceita / totalVendas : 0

  const porProd = {}
  itens.forEach(i => {
    if (!porProd[i.produto_nome]) porProd[i.produto_nome] = { qtd: 0, receita: 0 }
    porProd[i.produto_nome].qtd     += i.quantidade
    porProd[i.produto_nome].receita += Number(i.subtotal)
  })
  const topProd  = Object.entries(porProd).sort((a, b) => b[1].receita - a[1].receita)
  const maxRec   = topProd[0]?.[1].receita || 1

  const porDia = {}
  vendas.forEach(v => {
    const dia = new Date(v.criado_em).toLocaleDateString('pt-BR', { timeZone: TZ })
    if (!porDia[dia]) porDia[dia] = { vendas: 0, receita: 0 }
    porDia[dia].vendas++
    porDia[dia].receita += Number(v.total)
  })
  const diasOrd = Object.entries(porDia).sort((a, b) => {
    const p = s => { const [d,m,y] = s.split('/'); return new Date(`20${y}-${m}-${d}`) }
    return p(a[0]) - p(b[0])
  })

  container.innerHTML = `
    <div class="rel-stats">
      <div class="rel-stat-card">
        <div class="rel-stat-label">Vendas no período</div>
        <div class="rel-stat-val">${totalVendas}</div>
      </div>
      <div class="rel-stat-card">
        <div class="rel-stat-label">Receita total</div>
        <div class="rel-stat-val">${fmt(totalReceita)}</div>
      </div>
      <div class="rel-stat-card">
        <div class="rel-stat-label">Ticket médio</div>
        <div class="rel-stat-val">${fmt(ticketMedio)}</div>
      </div>
      <div class="rel-stat-card">
        <div class="rel-stat-label">💵 Dinheiro</div>
        <div class="rel-stat-val">${fmt(totalDinheiro)}</div>
      </div>
      <div class="rel-stat-card">
        <div class="rel-stat-label">📱 PIX</div>
        <div class="rel-stat-val">${fmt(totalPix)}</div>
      </div>
    </div>

    <div class="rel-block">
      <h3 class="rel-block-title">🏆 Produtos mais vendidos</h3>
      ${topProd.length === 0 ? '<p class="text-muted">Sem dados no período.</p>'
        : topProd.map(([nome, s]) => `
          <div class="bar-row">
            <div class="bar-header">
              <span class="bar-label">${nome}</span>
              <span class="bar-meta">${s.qtd}× &nbsp; ${fmt(s.receita)}</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill" style="width:${(s.receita/maxRec*100).toFixed(1)}%"></div>
            </div>
          </div>`).join('')}
    </div>

    <div class="rel-block">
      <h3 class="rel-block-title">📅 Receita por dia</h3>
      ${diasOrd.length === 0 ? '<p class="text-muted">Sem dados no período.</p>'
        : `<div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Data</th><th>Vendas</th><th>Receita</th></tr></thead>
              <tbody>
                ${diasOrd.map(([dia, s]) => `
                  <tr>
                    <td>${dia}</td><td>${s.vendas}</td>
                    <td><span class="badge badge-green">${fmt(s.receita)}</span></td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>`}
    </div>`
}

// ═══════════════════════════════════════════════════════════════
// RELATÓRIO POR CLIENTE
// ═══════════════════════════════════════════════════════════════
async function loadRelatorioClientes() {
  const container = document.getElementById('clientesContainer')
  if (!container) return
  container.innerHTML = '<div class="loading-row">Calculando…</div>'

  const busca = document.getElementById('clienteBusca')?.value.trim().toLowerCase() || ''
  const dias  = Number(document.getElementById('clientePeriodo')?.value ?? 0)
  const fmt   = n => `R$ ${Number(n).toFixed(2).replace('.', ',')}`

  let q = supabase
    .from('vendas')
    .select('id, criado_em, total, cliente_nome, pago_dinheiro, pago_pix, venda_itens(produto_nome, quantidade, subtotal)')
    .order('criado_em', { ascending: false })

  if (dias > 0) {
    const since = new Date()
    since.setDate(since.getDate() - dias)
    q = q.gte('criado_em', since.toISOString())
  }

  const { data, error } = await q
  if (error) {
    container.innerHTML = '<div class="loading-row">Erro ao carregar dados.</div>'
    return
  }

  const vendas = data || []

  // ── Agrupa por cliente_nome ──────────────────────────────────
  const map = {}
  vendas.forEach(v => {
    const nomeOriginal = v.cliente_nome?.trim() || null
    const key          = nomeOriginal ? nomeOriginal.toLowerCase() : '__sem_nome__'
    if (!map[key]) {
      map[key] = { nome: nomeOriginal || 'Sem nome', pedidos: [], total_gasto: 0, ultima_visita: null }
    }
    map[key].pedidos.push(v)
    map[key].total_gasto += Number(v.total)
    const dt = new Date(v.criado_em)
    if (!map[key].ultima_visita || dt > map[key].ultima_visita) map[key].ultima_visita = dt
  })

  // ── Ordena: nomeados por total desc, "Sem nome" no final ─────
  let lista = Object.values(map).sort((a, b) => {
    if (a.nome === 'Sem nome' && b.nome !== 'Sem nome') return  1
    if (b.nome === 'Sem nome' && a.nome !== 'Sem nome') return -1
    return b.total_gasto - a.total_gasto
  })

  if (busca) lista = lista.filter(c => c.nome.toLowerCase().includes(busca))

  const totalClientes = Object.keys(map).filter(k => k !== '__sem_nome__').length
  const totalPedidos  = vendas.length
  const identificados = vendas.filter(v => v.cliente_nome?.trim()).length

  const statsHTML = `
    <div class="rel-stats" style="margin-bottom:24px">
      <div class="rel-stat-card">
        <div class="rel-stat-label">Clientes com nome</div>
        <div class="rel-stat-val">${totalClientes}</div>
      </div>
      <div class="rel-stat-card">
        <div class="rel-stat-label">Total de pedidos</div>
        <div class="rel-stat-val">${totalPedidos}</div>
      </div>
      <div class="rel-stat-card">
        <div class="rel-stat-label">Identificados</div>
        <div class="rel-stat-val">${identificados}</div>
      </div>
      <div class="rel-stat-card">
        <div class="rel-stat-label">Sem nome</div>
        <div class="rel-stat-val">${totalPedidos - identificados}</div>
      </div>
    </div>`

  if (!lista.length) {
    container.innerHTML = statsHTML + '<div class="loading-row">Nenhum cliente encontrado.</div>'
    return
  }

  // ── Renderiza tabela ─────────────────────────────────────────
  const tbodyHTML = lista.map((c, idx) => {
    const isSemNome = c.nome === 'Sem nome'
    const ticket    = c.pedidos.length ? c.total_gasto / c.pedidos.length : 0
    const ultima    = c.ultima_visita
      ? c.ultima_visita.toLocaleDateString('pt-BR', { timeZone: TZ }) : '—'

    // Medalha para top 3
    const medal = !isSemNome && idx < 3
      ? ['🥇','🥈','🥉'][idx] + ' '
      : ''

    // Linhas de pedidos (expandíveis)
    const pedidosHTML = c.pedidos.map(p => {
      const d     = new Date(p.criado_em)
      const data  = d.toLocaleDateString('pt-BR',  { timeZone: TZ })
      const hora  = d.toLocaleTimeString('pt-BR',  { timeZone: TZ, hour:'2-digit', minute:'2-digit' })
      const itens = (p.venda_itens || []).map(i => `${i.quantidade}× ${i.produto_nome}`).join(', ')
      const pag   = (Number(p.pago_pix) > 0 && Number(p.pago_dinheiro) > 0)
        ? 'Misto'
        : Number(p.pago_pix) > 0 ? '📱 PIX' : '💵 Dinheiro'
      return `
        <div class="cli-pedido">
          <div class="cli-pedido-meta">
            <span>${data} ${hora}</span>
            <span class="badge badge-amber">${fmt(p.total)}</span>
            <span class="badge badge-muted">${pag}</span>
          </div>
          ${itens ? `<div class="cli-pedido-itens">${itens}</div>` : ''}
        </div>`
    }).join('')

    return `
      <tr class="cli-row${isSemNome ? ' cli-row--sem-nome' : ''}">
        <td>
          <button class="expand-btn cli-expand-btn" data-key="${idx}" title="Ver pedidos">▼</button>
        </td>
        <td>
          <span class="${isSemNome ? '' : 'cli-nome'}" style="${isSemNome ? 'color:var(--muted)' : ''}">
            ${medal}${isSemNome ? '— Sem nome' : c.nome}
          </span>
        </td>
        <td><span class="badge badge-muted">${c.pedidos.length}</span></td>
        <td><span class="badge badge-green">${fmt(c.total_gasto)}</span></td>
        <td style="color:var(--muted)">${fmt(ticket)}</td>
        <td style="color:var(--muted)">${ultima}</td>
      </tr>
      <tr id="cli-det-${idx}" class="detail-row hidden">
        <td colspan="6">
          <div class="cli-pedidos-list">${pedidosHTML}</div>
        </td>
      </tr>`
  }).join('')

  container.innerHTML = statsHTML + `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:36px"></th>
            <th>Cliente</th>
            <th>Pedidos</th>
            <th>Total Gasto</th>
            <th>Ticket Médio</th>
            <th>Última Visita</th>
          </tr>
        </thead>
        <tbody>${tbodyHTML}</tbody>
      </table>
    </div>`

  // Bind botões de expandir
  container.querySelectorAll('.cli-expand-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key
      const row = document.getElementById(`cli-det-${key}`)
      const vis = !row.classList.contains('hidden')
      row.classList.toggle('hidden', vis)
      btn.textContent = vis ? '▼' : '▲'
    })
  })
}
window.loadRelatorioClientes = loadRelatorioClientes

// ═══════════════════════════════════════════════════════════════
// PRODUTOS — listagem + edição + criação
// ═══════════════════════════════════════════════════════════════
const ICONE_CAT = { espetinho: '🔥', bebida: '🍺' }
const NOME_CAT  = { espetinho: 'Espetinhos', bebida: 'Bebidas' }
const CATS_KEY  = 'espetinho-cats'
const BASE_CATS = [
  { id: 'espetinho', nome: 'Espetinhos', icone: '🔥' },
  { id: 'bebida',    nome: 'Bebidas',    icone: '🍺' },
]

function getTodasCats(prodsArr = []) {
  let custom = []
  try { custom = JSON.parse(localStorage.getItem(CATS_KEY) ?? '[]') } catch {}
  const result = [...BASE_CATS]
  // Adiciona categorias do banco que não estão nas base
  prodsArr.forEach(p => {
    if (!result.find(c => c.id === p.categoria))
      result.push({ id: p.categoria, nome: p.categoria, icone: '📦' })
  })
  // Adiciona categorias custom (localStorage)
  custom.forEach(c => { if (!result.find(x => x.id === c.id)) result.push(c) })
  return result
}

function salvarCustomCat(cat) {
  let custom = []
  try { custom = JSON.parse(localStorage.getItem(CATS_KEY) ?? '[]') } catch {}
  if (!custom.find(c => c.id === cat.id)) {
    custom.push(cat)
    localStorage.setItem(CATS_KEY, JSON.stringify(custom))
  }
}

function populateProdCatSelect(selectedId = '') {
  const sel = document.getElementById('editProdCat')
  if (!sel) return
  const cats = getTodasCats(produtos)
  sel.innerHTML = cats.map(c =>
    `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${c.icone} ${c.nome}</option>`
  ).join('')
}

async function renderProdutosAdmin() {
  const container = document.getElementById('produtosAdmin')
  if (!container) return
  container.innerHTML = '<div class="loading-row">Carregando…</div>'

  let { data: prods, error } = await supabase
    .from('produtos').select('*').order('categoria').order('ordem').order('id')
  // fallback se coluna 'ordem' ainda não existir
  if (error) {
    ;({ data: prods, error } = await supabase
      .from('produtos').select('*').order('categoria').order('id'))
  }
  if (error) {
    container.innerHTML = '<div class="loading-row">Erro ao carregar produtos.</div>'
    return
  }

  const fmt       = n => `R$ ${Number(n).toFixed(2).replace('.', ',')}`
  const todasCats = getTodasCats(prods)

  const EDIT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none"
    viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round"
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5
         m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
  </svg>`

  container.innerHTML = todasCats.map(cat => {
    const itens = prods.filter(p => p.categoria === cat.id)
    return `
      <div class="card">
        <h2 class="card-title">${cat.icone} ${cat.nome}</h2>
        ${itens.length === 0
          ? `<p class="text-muted-italic">Nenhum produto nesta categoria ainda.</p>`
          : `<div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th class="drag-th"></th>
                <th>Produto</th>
                <th>Preço</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody class="drag-tbody">
              ${itens.map(p => `
                <tr draggable="true" data-prod-id="${p.id}">
                  <td class="drag-handle" title="Arrastar para reordenar">⠿</td>
                  <td><strong>${p.nome}</strong></td>
                  <td><span class="badge badge-amber">${fmt(p.preco)}</span></td>
                  <td>
                    <span class="badge ${p.ativo ? 'badge-green' : 'badge-muted'}">
                      ${p.ativo ? '● Ativo' : '○ Inativo'}
                    </span>
                  </td>
                  <td>
                    <button class="btn-icon btn-edit" title="Editar produto"
                      onclick="editarProduto(${p.id})">
                      ${EDIT_SVG}
                    </button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`}
      </div>`
  }).join('')

  initDragDrop(container)
}

// ── Drag-and-drop para reordenar produtos ──
function initDragDrop(container) {
  let dragSrc = null

  container.querySelectorAll('.drag-tbody').forEach(tbody => {
    tbody.querySelectorAll('tr[draggable]').forEach(row => {
      row.addEventListener('dragstart', e => {
        dragSrc = row
        e.dataTransfer.effectAllowed = 'move'
        setTimeout(() => row.classList.add('row-dragging'), 0)
      })

      row.addEventListener('dragend', async () => {
        row.classList.remove('row-dragging')
        container.querySelectorAll('.row-drag-over').forEach(r => r.classList.remove('row-drag-over'))
        if (dragSrc) await salvarOrdemProdutos(container)
        dragSrc = null
      })

      row.addEventListener('dragover', e => {
        e.preventDefault()
        if (!dragSrc || dragSrc === row || dragSrc.parentNode !== row.parentNode) return
        e.dataTransfer.dropEffect = 'move'
        container.querySelectorAll('.row-drag-over').forEach(r => r.classList.remove('row-drag-over'))
        row.classList.add('row-drag-over')

        const tbody   = row.parentNode
        const rows    = [...tbody.querySelectorAll('tr')]
        const srcIdx  = rows.indexOf(dragSrc)
        const tgtIdx  = rows.indexOf(row)
        if (srcIdx < tgtIdx) tbody.insertBefore(dragSrc, row.nextSibling)
        else                 tbody.insertBefore(dragSrc, row)
      })

      row.addEventListener('dragleave', () => row.classList.remove('row-drag-over'))
      row.addEventListener('drop',      e => { e.preventDefault() })
    })
  })
}

async function salvarOrdemProdutos(container) {
  const updates = []
  container.querySelectorAll('.drag-tbody').forEach(tbody => {
    tbody.querySelectorAll('tr[data-prod-id]').forEach((row, idx) => {
      updates.push({ id: Number(row.dataset.prodId), ordem: idx + 1 })
    })
  })

  const results = await Promise.all(
    updates.map(u => supabase.from('produtos').update({ ordem: u.ordem }).eq('id', u.id))
  )
  const hasError = results.some(r => r.error)
  if (hasError) {
    showToast('Erro ao salvar ordem. Rode o SQL de migração no Supabase.', 'error')
  } else {
    showToast('Ordem salva!', 'success')
  }
}

// ── Modal produto (editar / novo) ──
let editandoProdId = null

function novoProduto() {
  editandoProdId = null
  document.getElementById('editProdModalTitle').textContent = '➕ Novo Produto'
  document.getElementById('editProdNome').value    = ''
  document.getElementById('editProdPreco').value   = ''
  document.getElementById('editProdAtivo').checked = true
  populateProdCatSelect('espetinho')
  document.getElementById('editProdModal').classList.add('open')
}

async function editarProduto(id) {
  const { data: p, error } = await supabase.from('produtos').select('*').eq('id', id).single()
  if (error || !p) { showToast('Erro ao carregar produto.', 'error'); return }

  editandoProdId = id
  document.getElementById('editProdModalTitle').textContent = '✏️ Editar Produto'
  document.getElementById('editProdNome').value    = p.nome
  document.getElementById('editProdPreco').value   = Number(p.preco).toFixed(2)
  document.getElementById('editProdAtivo').checked = p.ativo
  populateProdCatSelect(p.categoria)
  document.getElementById('editProdModal').classList.add('open')
}

async function salvarProduto() {
  const btn = document.getElementById('btnSalvarProd')
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando…' }

  const nome      = document.getElementById('editProdNome')?.value.trim()
  const preco     = parseFloat(document.getElementById('editProdPreco')?.value) || 0
  const ativo     = document.getElementById('editProdAtivo')?.checked ?? true
  const categoria = document.getElementById('editProdCat')?.value ?? 'espetinho'

  if (!nome) {
    showToast('Informe o nome do produto.', 'error')
    if (btn) { btn.disabled = false; btn.textContent = 'Salvar' }
    return
  }

  let error
  if (editandoProdId) {
    ;({ error } = await supabase.from('produtos')
      .update({ nome, preco, ativo, categoria }).eq('id', editandoProdId))
  } else {
    ;({ error } = await supabase.from('produtos')
      .insert({ nome, preco, ativo, categoria }))
  }

  if (btn) { btn.disabled = false; btn.textContent = 'Salvar' }
  if (error) { showToast('Erro ao salvar produto.', 'error'); return }

  const foiEdicao = !!editandoProdId   // salva ANTES de fecharEditProdModal() zerar
  await loadProdutos()
  fecharEditProdModal()
  showToast(foiEdicao ? 'Produto atualizado!' : 'Produto criado!', 'success')
  await renderProdutosAdmin()
}

function fecharEditProdModal() {
  document.getElementById('editProdModal')?.classList.remove('open')
  editandoProdId = null
}

// ── Modal nova categoria ──
function novaCategoria() {
  document.getElementById('novaCatNome').value  = ''
  document.getElementById('novaCatIcone').value = ''
  document.getElementById('novaCatModal').classList.add('open')
}

function salvarNovaCategoria() {
  const nome  = document.getElementById('novaCatNome')?.value.trim()
  const icone = document.getElementById('novaCatIcone')?.value.trim() || '📦'
  if (!nome) { showToast('Informe o nome da categoria.', 'error'); return }

  const id = nome.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
  salvarCustomCat({ id, nome, icone })
  fecharNovaCatModal()
  showToast(`Categoria "${nome}" criada!`, 'success')
  renderProdutosAdmin()
}

function fecharNovaCatModal() {
  document.getElementById('novaCatModal')?.classList.remove('open')
}

// ═══════════════════════════════════════════════════════════════
// EDITAR VENDA — modal
// ═══════════════════════════════════════════════════════════════
let editandoId = null

/** Converte ISO UTC → "YYYY-MM-DDTHH:mm" no fuso de Salvador */
function toDatetimeLocal(iso) {
  const d = new Date(iso)
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', hour12: false,
  }).formatToParts(d)
  const get = t => p.find(x => x.type === t)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

async function editarVenda(id) {
  const { data: v, error } = await supabase.from('vendas').select('*').eq('id', id).single()
  if (error || !v) { showToast('Erro ao carregar venda.', 'error'); return }

  editandoId = id
  document.getElementById('editData').value     = toDatetimeLocal(v.criado_em)
  document.getElementById('editCliente').value  = v.cliente_nome ?? ''
  document.getElementById('editTotal').value    = Number(v.total).toFixed(2)
  document.getElementById('editDinheiro').value = Number(v.pago_dinheiro ?? 0).toFixed(2)
  document.getElementById('editPix').value      = Number(v.pago_pix      ?? 0).toFixed(2)
  calcEditTroco()
  document.getElementById('editModal').classList.add('open')
}

function calcEditTroco() {
  const total    = parseFloat(document.getElementById('editTotal')?.value)    || 0
  const dinheiro = parseFloat(document.getElementById('editDinheiro')?.value) || 0
  const pix      = parseFloat(document.getElementById('editPix')?.value)      || 0
  const troco    = Math.max(0, dinheiro - Math.max(0, total - pix))
  const el = document.getElementById('editTroco')
  if (el) el.value = troco.toFixed(2)
}

async function salvarEdicao() {
  if (!editandoId) return
  const btn = document.getElementById('btnSalvarEdicao')
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando…' }

  const dataLocal = document.getElementById('editData').value  // "YYYY-MM-DDTHH:mm"
  const criado_em = dataLocal ? new Date(dataLocal + ':00-03:00').toISOString() : undefined

  const total         = parseFloat(document.getElementById('editTotal')?.value)    || 0
  const cliente_nome  = document.getElementById('editCliente')?.value.trim() || null
  const pago_dinheiro = parseFloat(document.getElementById('editDinheiro')?.value) || 0
  const pago_pix      = parseFloat(document.getElementById('editPix')?.value)      || 0
  const troco         = Math.max(0, pago_dinheiro - Math.max(0, total - pago_pix))

  const patch = { total, cliente_nome, pago_dinheiro, pago_pix, troco }
  if (criado_em) patch.criado_em = criado_em

  const { error } = await supabase.from('vendas').update(patch).eq('id', editandoId)
  if (btn) { btn.disabled = false; btn.textContent = 'Salvar' }

  if (error) { showToast('Erro ao salvar.', 'error'); return }

  fecharEditModal()
  showToast('Venda atualizada!', 'success')
  if      (currentSection === 'dashboard')  await loadDashboard()
  else if (currentSection === 'historico')  await loadHistorico()
}

function fecharEditModal() {
  document.getElementById('editModal')?.classList.remove('open')
  editandoId = null
}

// ═══════════════════════════════════════════════════════════════
// CANCELAR VENDA
// ═══════════════════════════════════════════════════════════════
async function cancelarVenda(id) {
  if (!confirm('Cancelar esta venda? Ação irreversível.')) return
  const { error } = await supabase.from('vendas').delete().eq('id', id)
  if (error) { showToast('Erro ao cancelar venda.', 'error'); return }
  showToast('Venda cancelada.', 'success')
  if (currentSection === 'dashboard') await loadDashboard()
  else if (currentSection === 'historico') await loadHistorico()
}

// ═══════════════════════════════════════════════════════════════
// SAÍDAS
// ═══════════════════════════════════════════════════════════════
function formatDataBR(dateStr) {
  // "YYYY-MM-DD" → "DD/MM/YYYY"
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function populateSaidaMesSelect() {
  const sel = document.getElementById('filtroSaidaMes')
  if (!sel || sel.options.length > 1) return
  const bahiaDate = new Date().toLocaleDateString('en-CA', { timeZone: TZ })
  let [y, m] = bahiaDate.split('-').map(Number)
  for (let i = 0; i < 24; i++) {
    if (m <= 0) { m += 12; y-- }
    const opt = document.createElement('option')
    opt.value       = `${y}-${String(m).padStart(2, '0')}`
    opt.textContent = `${MESES_PT[m - 1]} ${y}`
    sel.appendChild(opt)
    m--
  }
}

async function initSaidas() {
  // Preenche data padrão = hoje em Salvador
  const dataInput = document.getElementById('saidaData')
  if (dataInput && !dataInput.value)
    dataInput.value = new Date().toLocaleDateString('en-CA', { timeZone: TZ })
  populateSaidaMesSelect()
  await loadSaidas()
}

async function loadSaidas() {
  populateSaidaMesSelect()
  const container = document.getElementById('saidasContainer')
  if (!container) return
  container.innerHTML = '<div class="loading-row">Carregando…</div>'

  const dateVal = document.getElementById('filtroSaidaData')?.value
  const mesVal  = document.getElementById('filtroSaidaMes')?.value
  const fmt     = n => `R$ ${Number(n).toFixed(2).replace('.', ',')}`

  let q = supabase.from('saidas').select('*').order('data', { ascending: false })
                  .order('criado_em', { ascending: false })

  if (dateVal) {
    q = q.eq('data', dateVal)
  } else if (mesVal) {
    const [y, m] = mesVal.split('-').map(Number)
    const nextM  = m === 12 ? 1   : m + 1
    const nextY  = m === 12 ? y+1 : y
    q = q.gte('data', `${y}-${String(m).padStart(2,'0')}-01`)
         .lt ('data', `${nextY}-${String(nextM).padStart(2,'0')}-01`)
  }

  const { data, error } = await q
  if (error) {
    container.innerHTML = '<div class="loading-row">Erro ao carregar saídas.</div>'
    return
  }

  const saidas = data || []
  if (!saidas.length) {
    container.innerHTML = '<div class="loading-row">Nenhuma saída registrada.</div>'
    return
  }

  const total = saidas.reduce((s, v) => s + Number(v.valor), 0)

  container.innerHTML = `
    <div class="historico-summary">
      ${saidas.length} saída(s) &nbsp;•&nbsp; Total:
      <strong style="color:var(--red)">${fmt(total)}</strong>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Item / Descrição</th>
            <th>Valor</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${saidas.map(s => `
            <tr>
              <td data-label="Data">${formatDataBR(s.data)}</td>
              <td data-label="Item"><strong>${s.descricao}</strong></td>
              <td data-label="Valor">
                <span class="badge" style="background:rgba(239,68,68,.15);color:#f87171">
                  ${fmt(s.valor)}
                </span>
              </td>
              <td>
                <button class="btn-icon btn-danger" title="Excluir saída"
                  onclick="deletarSaida('${s.id}')">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none"
                    viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7
                         m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`
}

async function adicionarSaida() {
  const data     = document.getElementById('saidaData')?.value
  const descricao = document.getElementById('saidaDesc')?.value.trim()
  const valor    = parseFloat(document.getElementById('saidaValor')?.value) || 0

  if (!data)     { showToast('Informe a data.',       'error'); return }
  if (!descricao){ showToast('Informe o item.',        'error'); return }
  if (valor <= 0){ showToast('Informe um valor válido.','error'); return }

  const { error } = await supabase.from('saidas').insert({ data, descricao, valor })
  if (error) { showToast('Erro ao registrar saída.', 'error'); return }

  // Limpa campos (mantém data)
  document.getElementById('saidaDesc').value  = ''
  document.getElementById('saidaValor').value = ''
  showToast(`✅ Saída de R$ ${valor.toFixed(2).replace('.',',')} registrada!`, 'success')
  await loadSaidas()
}

async function deletarSaida(id) {
  if (!confirm('Excluir esta saída?')) return
  const { error } = await supabase.from('saidas').delete().eq('id', id)
  if (error) { showToast('Erro ao excluir saída.', 'error'); return }
  showToast('Saída excluída.', 'success')
  await loadSaidas()
}

function limparFiltroSaidas() {
  const data = document.getElementById('filtroSaidaData')
  const mes  = document.getElementById('filtroSaidaMes')
  if (data) data.value = ''
  if (mes)  mes.value  = ''
  loadSaidas()
}

// ─── Toast ────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  document.getElementById('toast')?.remove()
  const t = document.createElement('div')
  t.id = 'toast'; t.className = `toast toast-${type}`; t.textContent = msg
  document.body.appendChild(t)
  requestAnimationFrame(() => t.classList.add('show'))
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 350) }, 3500)
}

function set(id, val) { const el = document.getElementById(id); if (el) el.textContent = val }

// ─── Globals ──────────────────────────────────────────────────
window.confirmarVenda        = confirmarVenda
window.cancelarVenda         = cancelarVenda
window.editarVenda           = editarVenda
window.salvarEdicao          = salvarEdicao
window.fecharEditModal       = fecharEditModal
window.calcEditTroco         = calcEditTroco
window.novoProduto           = novoProduto
window.editarProduto         = editarProduto
window.salvarProduto         = salvarProduto
window.fecharEditProdModal   = fecharEditProdModal
window.novaCategoria         = novaCategoria
window.salvarNovaCategoria   = salvarNovaCategoria
window.fecharNovaCatModal    = fecharNovaCatModal
window.prevPage              = prevPage
window.nextPage              = nextPage
window.loadHistorico         = loadHistorico
window.loadRelatorio         = loadRelatorio
window.limparFiltroHistorico = limparFiltroHistorico
window.deletarSaidaDash      = deletarSaidaDash
window.adicionarSaida        = adicionarSaida
window.deletarSaida          = deletarSaida
window.loadSaidas            = loadSaidas
window.limparFiltroSaidas    = limparFiltroSaidas

// ═══════════════════════════════════════════════════════════════
// FIADO — Supabase
// ═══════════════════════════════════════════════════════════════
const fmtR  = (v) => Number(v).toLocaleString('pt-BR', { style:'currency', currency:'BRL' })
const fIni  = (n) => n.trim().split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase()
const fData = (ts)=> new Date(ts).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'})

let fiadoFiltro  = 'todos'
let fiadoInited  = false
let fiadoPending = null

async function initFiado() {
  if (fiadoInited) { await renderFiadoAll(); return }
  fiadoInited = true

  // Novo cliente
  document.getElementById('btnNovoCliente').addEventListener('click', () => {
    const w = document.getElementById('formClienteWrap')
    w.style.display = w.style.display === 'none' ? 'block' : 'none'
    if (w.style.display === 'block') document.getElementById('fNome').focus()
  })
  document.getElementById('btnCancelarCliente').addEventListener('click', () => {
    document.getElementById('formClienteWrap').style.display = 'none'
    document.getElementById('fNome').value = ''
    document.getElementById('fTel').value  = ''
  })
  document.getElementById('btnSalvarCliente').addEventListener('click', async () => {
    const nome = document.getElementById('fNome').value.trim()
    if (!nome) { document.getElementById('fNome').focus(); return }
    const { error } = await supabase.from('clientes_fiado')
      .insert({ nome, tel: document.getElementById('fTel').value.trim() || null })
    if (error) { showToast('Erro ao salvar cliente.', 'error'); return }
    document.getElementById('fNome').value = ''
    document.getElementById('fTel').value  = ''
    document.getElementById('formClienteWrap').style.display = 'none'
    await renderFiadoAll()
  })
  document.getElementById('fNome').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btnSalvarCliente').click()
  })

  // Delegação: deletar cliente
  document.getElementById('fiadoClientesGrid').addEventListener('click', e => {
    const btn = e.target.closest('[data-del-cliente]')
    if (!btn) return
    const cId   = btn.dataset.delCliente
    const cNome = btn.closest('.fiado-cliente-card')?.querySelector('.fiado-cliente-nome')?.textContent || ''
    fiadoConfirm(`Remover "${cNome}"? Os lançamentos também serão excluídos.`, async () => {
      const { error } = await supabase.from('clientes_fiado').delete().eq('id', cId)
      if (error) { showToast('Erro ao remover cliente.', 'error'); return }
      await renderFiadoAll()
    })
  })

  // Novo fiado
  document.getElementById('btnNovoFiado').addEventListener('click', () => {
    const w = document.getElementById('formFiadoWrap')
    w.style.display = w.style.display === 'none' ? 'block' : 'none'
    if (w.style.display === 'block') document.getElementById('fClienteSel').focus()
  })
  document.getElementById('btnCancelarFiado').addEventListener('click', () => {
    document.getElementById('formFiadoWrap').style.display  = 'none'
    document.getElementById('fClienteSel').value = ''
    document.getElementById('fValor').value = ''
    document.getElementById('fDesc').value  = ''
  })
  document.getElementById('btnSalvarFiado').addEventListener('click', async () => {
    const cliente_id = document.getElementById('fClienteSel').value
    const valor      = parseFloat(document.getElementById('fValor').value)
    if (!cliente_id) { document.getElementById('fClienteSel').focus(); return }
    if (!valor || valor <= 0) { document.getElementById('fValor').focus(); return }
    const { error } = await supabase.from('fiados').insert({
      cliente_id,
      valor,
      descricao: document.getElementById('fDesc').value.trim() || null,
      status: 'aberto',
    })
    if (error) { showToast('Erro ao salvar lançamento.', 'error'); return }
    document.getElementById('fClienteSel').value = ''
    document.getElementById('fValor').value = ''
    document.getElementById('fDesc').value  = ''
    document.getElementById('formFiadoWrap').style.display = 'none'
    await renderFiadoAll()
  })

  // Filtros
  document.querySelectorAll('.fiado-filtro').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.fiado-filtro').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      fiadoFiltro = btn.dataset.f
      await renderFiadoTabela()
    })
  })

  // Delegação: pagar / deletar lançamento
  document.getElementById('fiadoTbody').addEventListener('click', e => {
    const btnPagar = e.target.closest('[data-pagar]')
    const btnDel   = e.target.closest('[data-del-fiado]')
    if (btnPagar) {
      const fId    = btnPagar.dataset.pagar
      const valTxt = btnPagar.closest('tr')?.querySelector('td:nth-child(4)')?.textContent?.trim() || ''
      fiadoConfirm(`Marcar como pago: ${valTxt}?`, async () => {
        const { error } = await supabase.from('fiados')
          .update({ status: 'pago', pago_em: new Date().toISOString() })
          .eq('id', fId)
        if (error) { showToast('Erro ao atualizar.', 'error'); return }
        await renderFiadoAll()
      })
    }
    if (btnDel) {
      fiadoConfirm('Excluir este lançamento?', async () => {
        const { error } = await supabase.from('fiados').delete().eq('id', btnDel.dataset.delFiado)
        if (error) { showToast('Erro ao excluir.', 'error'); return }
        await renderFiadoAll()
      })
    }
  })

  // Modal
  document.getElementById('fiadoModalFechar').addEventListener('click',   fiadoModalClose)
  document.getElementById('fiadoModalCancelar').addEventListener('click',  fiadoModalClose)
  document.getElementById('fiadoModalConfirmar').addEventListener('click', () => {
    fiadoModalClose()
    fiadoPending?.()
    fiadoPending = null
  })

  await renderFiadoAll()
}

function fiadoConfirm(msg, cb) {
  document.getElementById('fiadoModalMsg').textContent = msg
  fiadoPending = cb
  document.getElementById('fiadoModal').style.display = 'flex'
}
function fiadoModalClose() {
  document.getElementById('fiadoModal').style.display = 'none'
  fiadoPending = null
}

async function renderFiadoClientes() {
  const { data: clientes } = await supabase.from('clientes_fiado').select('*').order('nome')
  const { data: abFiados  } = await supabase.from('fiados')
    .select('cliente_id, valor').eq('status', 'aberto')

  const grid  = document.getElementById('fiadoClientesGrid')
  const empty = document.getElementById('fiadoClientesEmpty')
  const list  = clientes || []

  empty.style.display = list.length ? 'none' : 'block'
  grid.innerHTML = list.map(c => {
    const divida = (abFiados || [])
      .filter(f => f.cliente_id === c.id)
      .reduce((s, f) => s + Number(f.valor), 0)
    return `
      <div class="fiado-cliente-card">
        <div class="fiado-avatar">${fIni(c.nome)}</div>
        <div class="fiado-cliente-info">
          <div class="fiado-cliente-nome">${c.nome}</div>
          <div class="fiado-cliente-tel">${c.tel || 'Sem telefone'}</div>
        </div>
        <span class="fiado-divida ${divida > 0 ? 'fiado-divida--open' : 'fiado-divida--ok'}">
          ${divida > 0 ? fmtR(divida) : '✓ Quitado'}
        </span>
        <button class="fiado-del-btn" data-del-cliente="${c.id}" title="Remover">✕</button>
      </div>`
  }).join('')

  // Atualiza select
  const sel  = document.getElementById('fClienteSel')
  const prev = sel.value
  sel.innerHTML = '<option value="">Selecione um cliente</option>' +
    list.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')
  if (prev) sel.value = prev
}

async function renderFiadoTabela() {
  const { data: all } = await supabase.from('fiados')
    .select('*, clientes_fiado(nome)')
    .order('criado_em', { ascending: false })

  const fiados  = all || []
  const abertos = fiados.filter(f => f.status === 'aberto')
  const pagos   = fiados.filter(f => f.status === 'pago')

  document.getElementById('fTotalAberto').textContent = fmtR(abertos.reduce((s,f) => s + Number(f.valor), 0))
  document.getElementById('fTotalPago').textContent   = fmtR(pagos.reduce((s,f) => s + Number(f.valor), 0))
  document.getElementById('fTotalCount').textContent  = fiados.length

  const rows  = fiadoFiltro === 'todos' ? fiados : fiados.filter(f => f.status === fiadoFiltro)
  const tbody = document.getElementById('fiadoTbody')

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Nenhum lançamento encontrado.</td></tr>'
    return
  }
  tbody.innerHTML = rows.map(f => {
    const nome = f.clientes_fiado?.nome ?? 'Cliente removido'
    const pago = f.status === 'pago'
    return `
      <tr class="${pago ? 'fiado-row--pago' : ''}">
        <td><div class="fiado-td-cliente"><div class="fiado-avatar fiado-avatar--sm">${fIni(nome)}</div>${nome}</div></td>
        <td style="color:var(--muted);font-size:.85rem">${f.descricao || '—'}</td>
        <td style="color:var(--muted);font-size:.85rem;white-space:nowrap">${fData(f.criado_em)}</td>
        <td style="font-weight:600;white-space:nowrap;${pago?'text-decoration:line-through;color:var(--muted)':''}">${fmtR(f.valor)}</td>
        <td><span class="fiado-badge fiado-badge--${f.status}">${pago?'Pago':'Em aberto'}</span></td>
        <td>
          <div style="display:flex;gap:6px;justify-content:flex-end">
            ${!pago ? `<button class="btn-secondary fiado-action-btn" data-pagar="${f.id}">✓ Pago</button>` : ''}
            <button class="btn-secondary fiado-action-btn fiado-action-btn--del" data-del-fiado="${f.id}">✕</button>
          </div>
        </td>
      </tr>`
  }).join('')
}

async function renderFiadoAll() {
  await Promise.all([renderFiadoClientes(), renderFiadoTabela()])
}

init()
