-- EXECUCAO 01-B — limpeza final de privilegios residuais em orders.
-- O cliente autenticado precisa apenas SELECT/INSERT/UPDATE; REFERENCES/TRIGGER nao fazem parte do contrato operacional.

REVOKE REFERENCES, TRIGGER ON TABLE public.orders FROM authenticated;
