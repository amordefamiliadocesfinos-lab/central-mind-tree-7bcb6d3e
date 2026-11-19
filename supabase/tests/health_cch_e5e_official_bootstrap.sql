-- Isolated compatibility bootstrap for *official* Health migrations; not a Supabase clone.
CREATE SCHEMA auth;
CREATE SCHEMA storage;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
  CREATE ROLE authenticated NOLOGIN;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
  CREATE ROLE anon NOLOGIN;
 END IF;
END $$;
GRANT USAGE ON SCHEMA public,auth,storage TO authenticated,anon;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,public boolean,
 file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 bucket_id text,name text NOT NULL);
CREATE FUNCTION storage.foldername(p_name text) RETURNS text[]
 LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array(p_name,'/') $$;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
 LANGUAGE plpgsql AS $$
 BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
GRANT SELECT ON auth.users TO authenticated;
-- Only synthetic identities. No real account or remote connection.
INSERT INTO auth.users(id) VALUES
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222'),
 ('33333333-3333-4333-8333-333333333333');
