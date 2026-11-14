-- AC-01: corrigir privilégios efetivos herdados de DEFAULT PRIVILEGES no Core Lovable Cloud.
-- O original 20261114183000 foi aplicado sem alteração e mantém histórico íntegro.
-- Segurança append-only: authenticated pode apenas ler/inserir sob RLS; nunca atualizar/excluir.
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.nucleo_specialist_contributions FROM authenticated;
-- Evitar dependência de grants herdados e afirmar apenas o contrato necessário.
GRANT SELECT, INSERT ON TABLE public.nucleo_specialist_contributions TO authenticated;
