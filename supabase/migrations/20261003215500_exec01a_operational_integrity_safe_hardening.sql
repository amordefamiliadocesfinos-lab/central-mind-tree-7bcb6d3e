-- EXECUÇÃO 01-A — Integridade Operacional
-- Saneamento de baixo risco já comprovado pela auditoria:
-- 1) eventos físicos de Separação/Recebimento deixam de ser executáveis por anon;
-- 2) app_users deixa de aceitar escrita pública direta;
-- 3) leitura autenticada permanece disponível e a política restritiva do perfil PRODUÇÃO
--    continua limitando esse perfil a colaboradores ativos;
-- 4) criação/edição/exclusão de colaboradores fica restrita a Administrador e LIDER PRODUÇÃO.

-- -----------------------------------------------------------------------------
-- RPCs físicas: somente usuários autenticados e service_role
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.finalize_order_separation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_order_separation(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.finalize_order_separation(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.confirm_purchase_receipt(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_purchase_receipt(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.confirm_purchase_receipt(uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- app_users: identidade operacional canônica
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow all on app_users" ON public.app_users;
DROP POLICY IF EXISTS "Authenticated users read app_users" ON public.app_users;
DROP POLICY IF EXISTS "Managers insert app_users" ON public.app_users;
DROP POLICY IF EXISTS "Managers update app_users" ON public.app_users;
DROP POLICY IF EXISTS "Managers delete app_users" ON public.app_users;

-- Política permissiva-base de leitura. A política RESTRICTIVE
-- "Production operator reads active collaborators", já existente, continua
-- reduzindo o conjunto visível para role PRODUÇÃO.
CREATE POLICY "Authenticated users read app_users"
ON public.app_users
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Managers insert app_users"
ON public.app_users
FOR INSERT
TO authenticated
WITH CHECK (
  upper(coalesce(public.current_app_user_role(), '')) IN ('ADMINISTRADOR', 'LIDER PRODUÇÃO')
);

CREATE POLICY "Managers update app_users"
ON public.app_users
FOR UPDATE
TO authenticated
USING (
  upper(coalesce(public.current_app_user_role(), '')) IN ('ADMINISTRADOR', 'LIDER PRODUÇÃO')
)
WITH CHECK (
  upper(coalesce(public.current_app_user_role(), '')) IN ('ADMINISTRADOR', 'LIDER PRODUÇÃO')
);

CREATE POLICY "Managers delete app_users"
ON public.app_users
FOR DELETE
TO authenticated
USING (
  upper(coalesce(public.current_app_user_role(), '')) IN ('ADMINISTRADOR', 'LIDER PRODUÇÃO')
);

-- Remove privilégios de tabela que contornariam a intenção operacional
-- (TRUNCATE/REFERENCES/TRIGGER etc.) e devolve apenas o necessário ao app.
REVOKE ALL PRIVILEGES ON TABLE public.app_users FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.app_users FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.app_users FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.app_users TO authenticated;

COMMENT ON TABLE public.app_users IS
'Identidade operacional canônica. Leitura autenticada; escrita normal restrita a Administrador/LIDER PRODUÇÃO por RLS.';
