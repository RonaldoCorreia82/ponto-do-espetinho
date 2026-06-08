-- ============================================================
-- MIGRAÇÃO: adiciona colunas de pagamento na tabela vendas
-- (rode uma vez, mesmo que já tenha rodado a migração anterior)
-- ============================================================
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS cliente_nome   text,
  ADD COLUMN IF NOT EXISTS pago_dinheiro  numeric(10,2) default 0,
  ADD COLUMN IF NOT EXISTS pago_pix       numeric(10,2) default 0,
  ADD COLUMN IF NOT EXISTS troco          numeric(10,2) default 0;

-- ============================================================
-- MIGRAÇÃO: atualiza lista de produtos
-- ⚠️  APAGA todas as vendas existentes antes de rodar!
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Limpar dados (ordem importa por FK)
TRUNCATE public.venda_itens CASCADE;
TRUNCATE public.vendas      CASCADE;
DELETE  FROM public.produtos;

-- Reiniciar sequência de ID
ALTER SEQUENCE public.produtos_id_seq RESTART WITH 1;

-- Inserir novos produtos
INSERT INTO public.produtos (nome, preco, categoria) VALUES
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
  ('Agua',     3.00, 'bebida');
