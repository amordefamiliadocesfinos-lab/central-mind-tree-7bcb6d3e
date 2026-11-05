-- DISPOSABLE-ONLY auth fixture, installed after previous P2 checks.
-- Cannot be used as real identity; live wrapper reads canonical auth.uid and app_users.
DO $guard$
BEGIN
 IF to_regclass('public.p2_disposable_test_marker') IS NULL
 THEN RAISE EXCEPTION 'p2_auth_fixture_disposable_only'; END IF;
END $guard$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('app.p2_test_actor',true),'')::uuid
$$;
CREATE OR REPLACE FUNCTION public.current_app_user_role() RETURNS text
LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('app.p2_test_role',true),'')
$$;
