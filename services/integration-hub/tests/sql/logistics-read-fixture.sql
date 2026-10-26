-- Disposable CI database only; no remote credentials or operational data.
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE TABLE public.app_users(id uuid PRIMARY KEY, auth_user_id uuid, role text, is_active boolean);
INSERT INTO public.app_users
SELECT ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
       ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid, role, active
FROM (VALUES (1,'Administrador',true),(2,'VENDA',true),(3,'LIDER PRODUÇÃO',true),
 (4,'PRODUÇÃO',true),(5,'FINANCEIRO',true),(6,'Administrador',false)) AS u(n,role,active);
GRANT SELECT ON public.orders TO authenticated;
-- Deliberately broad orders visibility: the logistics policy must enforce its own role gate.
INSERT INTO public.channel_accounts VALUES
 ('b4027369-5abf-4ac1-ab24-862334fae892','SYNTHETIC',true,'11111111-1111-4111-8111-111111111111');
INSERT INTO public.orders(id,channel_account_id,order_number,sale_origin,deleted_at)
SELECT gen_random_uuid(),'b4027369-5abf-4ac1-ab24-862334fae892',sn,origin,deleted
FROM (VALUES ('ACTIVE001','shopee_open_platform',null::timestamptz),
 ('DELETED001','shopee_open_platform',now()),('DUPLICATE001','shopee_open_platform',null),
 ('DUPLICATE001','shopee_open_platform',now()),('MANUAL001','manual',null)) AS o(sn,origin,deleted);
