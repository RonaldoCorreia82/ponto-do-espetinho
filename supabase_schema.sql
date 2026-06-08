-- ============================================================
-- SCHEMA: Ponto do Espetinho — Área Administrativa
-- Execute no SQL Editor do seu projeto Supabase
-- ============================================================

-- Tabela de Produtos
create table if not exists public.produtos (
  id        serial primary key,
  nome      text          not null,
  preco     numeric(10,2) not null,
  categoria text          not null check (categoria in ('espetinho','bebida')),
  ativo     boolean       default true,
  criado_em timestamptz   default now()
);

-- Tabela de Vendas
create table if not exists public.vendas (
  id             uuid          default gen_random_uuid() primary key,
  criado_em      timestamptz   default now(),
  total          numeric(10,2) not null,
  observacao     text,
  cliente_nome   text,
  pago_dinheiro  numeric(10,2) default 0,
  pago_pix       numeric(10,2) default 0,
  troco          numeric(10,2) default 0
);

-- Tabela de Itens da Venda
create table if not exists public.venda_itens (
  id             uuid          default gen_random_uuid() primary key,
  venda_id       uuid          not null references public.vendas(id) on delete cascade,
  produto_id     integer       references public.produtos(id),
  produto_nome   text          not null,
  produto_preco  numeric(10,2) not null,
  quantidade     integer       not null check (quantidade > 0),
  subtotal       numeric(10,2) not null
);

-- Row Level Security
alter table public.produtos    enable row level security;
alter table public.vendas      enable row level security;
alter table public.venda_itens enable row level security;

-- Políticas (somente usuários autenticados)
create policy "auth_produtos_select"
  on public.produtos for select to authenticated using (true);

create policy "auth_vendas_all"
  on public.vendas for all to authenticated using (true) with check (true);

create policy "auth_venda_itens_all"
  on public.venda_itens for all to authenticated using (true) with check (true);

-- Produtos do cardápio
insert into public.produtos (nome, preco, categoria) values
  -- Espetinhos
  ('Ancho',    8.00, 'espetinho'),
  ('Cupim',   12.00, 'espetinho'),
  ('Picanha', 12.00, 'espetinho'),
  ('Kafita',   8.00, 'espetinho'),
  ('Medalhão',10.00, 'espetinho'),
  ('Asa',      8.00, 'espetinho'),
  ('Queijo',   8.00, 'espetinho'),
  -- Bebidas
  ('Brahma',   5.00, 'bebida'),
  ('Heinek',  10.00, 'bebida'),
  ('Cachaça',  5.00, 'bebida'),
  ('Caipijá',  8.00, 'bebida'),
  ('Coca',     5.00, 'bebida'),
  ('Suco',     5.00, 'bebida'),
  ('Agua',     3.00, 'bebida')
on conflict do nothing;

-- ============================================================
-- ATENÇÃO: Após rodar este SQL, acesse:
--   Supabase Dashboard → Authentication → Users → Add user
--   E-mail : pontodoespetinhosba@gmail.com
--   Senha  : Seabra134882
-- ============================================================
