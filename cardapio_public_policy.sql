-- ============================================================
-- Políticas públicas do Cardápio
-- Execute no Supabase SQL Editor
-- ============================================================

-- 1. Leitura pública dos produtos ativos
CREATE POLICY "Cardápio público: ler produtos ativos"
  ON public.produtos
  FOR SELECT
  TO anon
  USING (ativo = true);

-- 2. Registrar pedido na tabela de vendas
CREATE POLICY "Cardápio público: registrar pedido"
  ON public.vendas
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- 3. Registrar itens do pedido
CREATE POLICY "Cardápio público: registrar itens do pedido"
  ON public.venda_itens
  FOR INSERT
  TO anon
  WITH CHECK (true);
