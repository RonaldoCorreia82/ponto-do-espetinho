-- ============================================================
-- Políticas de acesso admin na tabela produtos
-- Execute no Supabase SQL Editor
-- ============================================================

-- Remove políticas antigas (caso existam) para evitar conflito
DROP POLICY IF EXISTS "Admin pode ler produtos"      ON public.produtos;
DROP POLICY IF EXISTS "Admin pode inserir produtos"  ON public.produtos;
DROP POLICY IF EXISTS "Admin pode atualizar produtos" ON public.produtos;
DROP POLICY IF EXISTS "Admin pode deletar produtos"  ON public.produtos;

-- Permite que o admin (authenticated) leia todos os produtos
CREATE POLICY "Admin pode ler produtos"
  ON public.produtos FOR SELECT
  TO authenticated
  USING (true);

-- Permite que o admin insira novos produtos
CREATE POLICY "Admin pode inserir produtos"
  ON public.produtos FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Permite que o admin atualize produtos (ativo, preço, nome, ordem...)
CREATE POLICY "Admin pode atualizar produtos"
  ON public.produtos FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Permite que o admin delete produtos
CREATE POLICY "Admin pode deletar produtos"
  ON public.produtos FOR DELETE
  TO authenticated
  USING (true);
