-- ============================================================
-- Tabela de Saídas (despesas/custos)
-- Execute no Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.saidas (
  id        UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  descricao TEXT         NOT NULL,
  valor     NUMERIC(10,2) NOT NULL DEFAULT 0,
  data      DATE         NOT NULL DEFAULT CURRENT_DATE,
  criado_em TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE public.saidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin acessa saidas"
  ON public.saidas
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
