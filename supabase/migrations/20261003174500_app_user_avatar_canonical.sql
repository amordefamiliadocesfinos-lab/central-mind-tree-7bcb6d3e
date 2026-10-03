-- Perfil operacional canônico: foto pertence a app_users.
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS avatar_url text;

COMMENT ON COLUMN public.app_users.avatar_url IS
  'Foto canônica da identidade operacional. Consumida por Produção e demais módulos; não duplicar por módulo.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'app-user-avatars',
  'app-user-avatars',
  true,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read app user avatars" ON storage.objects;
CREATE POLICY "Public read app user avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'app-user-avatars');

DROP POLICY IF EXISTS "Managers upload app user avatars" ON storage.objects;
CREATE POLICY "Managers upload app user avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'app-user-avatars'
  AND EXISTS (
    SELECT 1
    FROM public.app_users au
    WHERE au.auth_user_id = auth.uid()
      AND au.is_active = true
      AND upper(coalesce(au.role, '')) IN ('ADMINISTRADOR', 'LIDER PRODUÇÃO', 'LIDER PRODUCAO')
  )
);

DROP POLICY IF EXISTS "Managers update app user avatars" ON storage.objects;
CREATE POLICY "Managers update app user avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'app-user-avatars'
  AND EXISTS (
    SELECT 1
    FROM public.app_users au
    WHERE au.auth_user_id = auth.uid()
      AND au.is_active = true
      AND upper(coalesce(au.role, '')) IN ('ADMINISTRADOR', 'LIDER PRODUÇÃO', 'LIDER PRODUCAO')
  )
)
WITH CHECK (
  bucket_id = 'app-user-avatars'
  AND EXISTS (
    SELECT 1
    FROM public.app_users au
    WHERE au.auth_user_id = auth.uid()
      AND au.is_active = true
      AND upper(coalesce(au.role, '')) IN ('ADMINISTRADOR', 'LIDER PRODUÇÃO', 'LIDER PRODUCAO')
  )
);

DROP POLICY IF EXISTS "Managers delete app user avatars" ON storage.objects;
CREATE POLICY "Managers delete app user avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'app-user-avatars'
  AND EXISTS (
    SELECT 1
    FROM public.app_users au
    WHERE au.auth_user_id = auth.uid()
      AND au.is_active = true
      AND upper(coalesce(au.role, '')) IN ('ADMINISTRADOR', 'LIDER PRODUÇÃO', 'LIDER PRODUCAO')
  )
);
