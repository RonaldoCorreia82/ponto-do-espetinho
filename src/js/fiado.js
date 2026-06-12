// ── Persistência ──────────────────────────────────────────────
const DB = {
  clientes: () => JSON.parse(localStorage.getItem('pde_clientes') || '[]'),
  fiados:   () => JSON.parse(localStorage.getItem('pde_fiados')   || '[]'),
  saveClientes: (d) => localStorage.setItem('pde_clientes', JSON.stringify(d)),
  saveFiados:   (d) => localStorage.setItem('pde_fiados',   JSON.stringify(d)),
};

// ── Helpers ────────────────────────────────────────────────────
const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const id  = ()  => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const iniciais = (nome) => nome.trim().split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
const fmtData = (ts) => new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

// ── Estado ──────────────────────────────────────────────────────
let filtroAtivo = 'todos';
let pendingCallback = null;

// ── Referências DOM ─────────────────────────────────────────────
const clientesGrid   = document.getElementById('clientes-grid');
const clientesEmpty  = document.getElementById('clientes-empty');
const formCliente    = document.getElementById('form-cliente');
const inputNome      = document.getElementById('cliente-nome');
const inputTel       = document.getElementById('cliente-tel');

const fiadoLista     = document.getElementById('fiado-lista');
const fiadoEmpty     = document.getElementById('fiado-empty');
const formFiado      = document.getElementById('form-fiado');
const selectCliente  = document.getElementById('fiado-cliente');
const inputValor     = document.getElementById('fiado-valor');
const inputDesc      = document.getElementById('fiado-descricao');

const totalAberto    = document.getElementById('total-aberto');
const totalPago      = document.getElementById('total-pago');
const totalCount     = document.getElementById('total-count');

const modalOverlay   = document.getElementById('modal-overlay');
const modalMsg       = document.getElementById('modal-msg');
const modalConfirmar = document.getElementById('modal-confirmar');
const modalCancelar  = document.getElementById('modal-cancelar');

// ── Render Clientes ─────────────────────────────────────────────
function renderClientes() {
  const clientes = DB.clientes();
  const fiados   = DB.fiados();

  clientesEmpty.hidden = clientes.length > 0;
  clientesGrid.innerHTML = '';

  clientes.forEach(c => {
    const divida = fiados
      .filter(f => f.clienteId === c.id && f.status === 'aberto')
      .reduce((s, f) => s + f.valor, 0);

    const card = document.createElement('div');
    card.className = 'cliente-card';
    card.innerHTML = `
      <div class="cliente-card__avatar">${iniciais(c.nome)}</div>
      <div class="cliente-card__info">
        <div class="cliente-card__nome">${c.nome}</div>
        <div class="cliente-card__tel">${c.tel || 'Sem telefone'}</div>
      </div>
      <span class="cliente-card__divida ${divida > 0 ? 'cliente-card__divida--aberto' : 'cliente-card__divida--zerado'}">
        ${divida > 0 ? fmt(divida) : '✓ Quitado'}
      </span>
      <button class="cliente-card__del" data-id="${c.id}" title="Remover cliente">✕</button>
    `;
    clientesGrid.appendChild(card);
  });

  // Atualiza select do formulário de fiado
  const valorAtual = selectCliente.value;
  selectCliente.innerHTML = '<option value="">Selecione um cliente</option>';
  clientes.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.nome;
    selectCliente.appendChild(opt);
  });
  if (valorAtual) selectCliente.value = valorAtual;
}

// ── Render Fiados ───────────────────────────────────────────────
function renderFiados() {
  const clientes = DB.clientes();
  const fiados   = DB.fiados();

  const lista = fiados.filter(f => {
    if (filtroAtivo === 'aberto') return f.status === 'aberto';
    if (filtroAtivo === 'pago')   return f.status === 'pago';
    return true;
  }).sort((a, b) => b.ts - a.ts);

  fiadoEmpty.hidden = lista.length > 0;
  fiadoLista.innerHTML = '';

  // Resumo
  const abertos = fiados.filter(f => f.status === 'aberto');
  const pagos   = fiados.filter(f => f.status === 'pago');
  totalAberto.textContent = fmt(abertos.reduce((s, f) => s + f.valor, 0));
  totalPago.textContent   = fmt(pagos.reduce((s, f) => s + f.valor, 0));
  totalCount.textContent  = fiados.length;

  lista.forEach(f => {
    const cliente = clientes.find(c => c.id === f.clienteId);
    const nome    = cliente ? cliente.nome : 'Cliente removido';
    const pago    = f.status === 'pago';

    const item = document.createElement('div');
    item.className = `fiado-item${pago ? ' fiado-item--pago' : ''}`;
    item.innerHTML = `
      <div class="fiado-item__avatar">${iniciais(nome)}</div>
      <div class="fiado-item__info">
        <div class="fiado-item__nome">${nome}</div>
        <div class="fiado-item__desc">${f.descricao || '—'}</div>
      </div>
      <span class="fiado-item__data">${fmtData(f.ts)}</span>
      <span class="fiado-item__valor">${fmt(f.valor)}</span>
      <span class="fiado-item__badge fiado-item__badge--${f.status}">
        ${pago ? 'Pago' : 'Em aberto'}
      </span>
      <div class="fiado-item__actions">
        ${!pago ? `<button class="fiado-item__btn fiado-item__btn--pagar" data-id="${f.id}">✓ Pago</button>` : ''}
        <button class="fiado-item__btn fiado-item__btn--del" data-id="${f.id}">✕</button>
      </div>
    `;
    fiadoLista.appendChild(item);
  });
}

function renderAll() {
  renderClientes();
  renderFiados();
}

// ── Modal ───────────────────────────────────────────────────────
function confirmar(msg, cb) {
  modalMsg.textContent = msg;
  pendingCallback = cb;
  modalOverlay.hidden = false;
}

modalConfirmar.addEventListener('click', () => {
  modalOverlay.hidden = true;
  if (pendingCallback) { pendingCallback(); pendingCallback = null; }
});

modalCancelar.addEventListener('click', () => {
  modalOverlay.hidden = true;
  pendingCallback = null;
});

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) {
    modalOverlay.hidden = true;
    pendingCallback = null;
  }
});

// ── Clientes — eventos ──────────────────────────────────────────
document.getElementById('btn-novo-cliente').addEventListener('click', () => {
  formCliente.hidden = !formCliente.hidden;
  if (!formCliente.hidden) inputNome.focus();
});

document.getElementById('btn-cancelar-cliente').addEventListener('click', () => {
  formCliente.hidden = true;
  inputNome.value = '';
  inputTel.value  = '';
});

document.getElementById('btn-salvar-cliente').addEventListener('click', () => {
  const nome = inputNome.value.trim();
  if (!nome) { inputNome.focus(); return; }

  const clientes = DB.clientes();
  clientes.push({ id: id(), nome, tel: inputTel.value.trim() });
  DB.saveClientes(clientes);

  inputNome.value = '';
  inputTel.value  = '';
  formCliente.hidden = true;
  renderAll();
});

inputNome.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('btn-salvar-cliente').click();
});

// Delegação: botão deletar cliente
clientesGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('.cliente-card__del');
  if (!btn) return;
  const cId = btn.dataset.id;
  const c   = DB.clientes().find(x => x.id === cId);
  confirmar(`Remover "${c?.nome}"? Os lançamentos de fiado também serão excluídos.`, () => {
    DB.saveClientes(DB.clientes().filter(x => x.id !== cId));
    DB.saveFiados(DB.fiados().filter(f => f.clienteId !== cId));
    renderAll();
  });
});

// ── Fiado — eventos ─────────────────────────────────────────────
document.getElementById('btn-novo-fiado').addEventListener('click', () => {
  formFiado.hidden = !formFiado.hidden;
  if (!formFiado.hidden) selectCliente.focus();
});

document.getElementById('btn-cancelar-fiado').addEventListener('click', () => {
  formFiado.hidden = true;
  selectCliente.value = '';
  inputValor.value    = '';
  inputDesc.value     = '';
});

document.getElementById('btn-salvar-fiado').addEventListener('click', () => {
  const clienteId = selectCliente.value;
  const valor     = parseFloat(inputValor.value);
  if (!clienteId) { selectCliente.focus(); return; }
  if (!valor || valor <= 0) { inputValor.focus(); return; }

  const fiados = DB.fiados();
  fiados.push({
    id: id(),
    clienteId,
    valor,
    descricao: inputDesc.value.trim(),
    status: 'aberto',
    ts: Date.now(),
  });
  DB.saveFiados(fiados);

  selectCliente.value = '';
  inputValor.value    = '';
  inputDesc.value     = '';
  formFiado.hidden    = true;
  renderAll();
});

// Filtros
document.querySelectorAll('.filtro-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filtroAtivo = btn.dataset.filtro;
    renderFiados();
  });
});

// Delegação: marcar pago / deletar fiado
fiadoLista.addEventListener('click', (e) => {
  const btnPagar = e.target.closest('.fiado-item__btn--pagar');
  const btnDel   = e.target.closest('.fiado-item__btn--del');

  if (btnPagar) {
    const fId    = btnPagar.dataset.id;
    const fiados = DB.fiados();
    const item   = fiados.find(f => f.id === fId);
    confirmar(`Marcar como pago: ${fmt(item?.valor || 0)}?`, () => {
      fiados.find(f => f.id === fId).status = 'pago';
      DB.saveFiados(fiados);
      renderAll();
    });
  }

  if (btnDel) {
    const fId = btnDel.dataset.id;
    confirmar('Excluir este lançamento?', () => {
      DB.saveFiados(DB.fiados().filter(f => f.id !== fId));
      renderAll();
    });
  }
});

// ── Init ────────────────────────────────────────────────────────
renderAll();
