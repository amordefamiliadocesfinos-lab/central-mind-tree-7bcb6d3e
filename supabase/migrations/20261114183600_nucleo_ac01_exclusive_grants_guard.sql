-- Núcleo V1.3 A+ AC-01: exclusividade temporal por escopo e prova do concedente.
-- Hardening ADITIVO: não cria tabelas, dados, UI ou permissões de escrita.
-- Exclusividade conservadora: um decisor ou executor por módulo/especialidade/tipo
-- no mesmo instante. Uma ampliação colegiada exigirá deliberação separada.
-- Triggers recebem uma advisory transaction lock determinística do escopo;
-- revogação/suspensão terminal corta a linha do tempo sem reescrever originais.
CREATE OR REPLACE FUNCTION public.nucleo_ac01_authority_grant_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $f$
DECLARE m public.nucleo_specialist_mandate_records%ROWTYPE;
BEGIN

 PERFORM pg_advisory_xact_lock(hashtextextended(
  NEW.module_id::text||':'||NEW.specialist_role||':'||
  NEW.contribution_kind||':'||NEW.authority_kind,0));
 SELECT * INTO m FROM public.nucleo_specialist_mandate_records WHERE id=NEW.mandate_record_id;
 IF NOT FOUND OR m.record_kind<>'certificacao' OR m.module_id<>NEW.module_id
 OR m.specialist_role<>NEW.specialist_role OR m.specialist_auth_uid IS NULL
 OR m.authority_decision_ref='' OR m.effective_from IS NULL OR m.effective_from>now()
 OR (m.effective_until IS NOT NULL AND m.effective_until<=now())
 THEN RAISE EXCEPTION 'AC01: certified and current mandate required'; END IF;
 -- Certificação posteriormente revogada não fundamenta delegação.
 IF EXISTS (SELECT 1 FROM public.nucleo_specialist_mandate_records rev
 WHERE rev.record_kind='revogacao' AND rev.supersedes_record_id=m.id)
 THEN RAISE EXCEPTION 'AC01: revoked mandate'; END IF;
 IF NEW.effective_from<m.effective_from OR
 (m.effective_until IS NOT NULL AND
  (NEW.effective_until IS NULL OR NEW.effective_until>m.effective_until))
 THEN RAISE EXCEPTION 'AC01: delegation outside mandate validity'; END IF;

 -- Grantor must be the real documented mandate certifier, not merely a nucleo_manage account.
 IF NEW.granted_by_auth_uid IS DISTINCT FROM m.decided_by_auth_uid OR
    NEW.granted_by_auth_uid = NEW.delegate_auth_uid OR
    NEW.granted_by_auth_uid = m.specialist_auth_uid
 THEN RAISE EXCEPTION 'AC01: grantor lacks matching mandate certification'; END IF;
 -- Exclusive (module, specialist, category, authority_kind) timeline. Revocation
 -- clips the historical validity without mutating the original grant.
 IF EXISTS (
  SELECT 1 FROM public.nucleo_ac01_authority_grants prior
  LEFT JOIN public.nucleo_ac01_authority_revocations revoked
   ON revoked.authority_grant_id=prior.id
  WHERE prior.module_id=NEW.module_id
   AND prior.specialist_role=NEW.specialist_role
   AND prior.contribution_kind=NEW.contribution_kind
   AND prior.authority_kind=NEW.authority_kind
   AND tstzrange(prior.effective_from,
     CASE
       WHEN prior.effective_until IS NULL THEN GREATEST(prior.effective_from,revoked.recorded_at)
       WHEN revoked.recorded_at IS NULL THEN prior.effective_until
       ELSE GREATEST(prior.effective_from,LEAST(prior.effective_until,revoked.recorded_at))
     END,'[)') &&
     tstzrange(NEW.effective_from,NEW.effective_until,'[)')
 ) THEN RAISE EXCEPTION 'AC01: overlapping authority grant in scope'; END IF;
 IF NEW.supersedes_grant_id IS NOT NULL THEN
  PERFORM 1 FROM public.nucleo_ac01_authority_grants prior
  WHERE prior.id=NEW.supersedes_grant_id AND prior.module_id=NEW.module_id
   AND prior.specialist_role=NEW.specialist_role AND prior.contribution_kind=NEW.contribution_kind
   AND prior.authority_kind=NEW.authority_kind;
  IF NOT FOUND OR NOT EXISTS (
   SELECT 1 FROM public.nucleo_ac01_authority_revocations rv
   WHERE rv.authority_grant_id=NEW.supersedes_grant_id AND rv.revocation_kind='revogacao'
  ) THEN RAISE EXCEPTION 'AC01: replacement requires revoked predecessor in same scope'; END IF;
 END IF;
 RETURN NEW;
END $f$;
CREATE OR REPLACE FUNCTION public.nucleo_ac01_revocation_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $guard$
DECLARE g public.nucleo_ac01_authority_grants%ROWTYPE;
BEGIN
 -- Serialize termination against concurrent grant creation in same scope.
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AC01: revocation needs authenticated human'; END IF;
 SELECT * INTO g FROM public.nucleo_ac01_authority_grants WHERE id=NEW.authority_grant_id;

 IF NOT FOUND THEN RAISE EXCEPTION 'AC01: grant not found'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(
  g.module_id::text||':'||g.specialist_role||':'||
  g.contribution_kind||':'||g.authority_kind,0));
 IF auth.uid()=g.delegate_auth_uid THEN RAISE EXCEPTION 'AC01: delegate cannot revoke own authority'; END IF;
 NEW.revoked_by_auth_uid:=auth.uid();
 NEW.recorded_at:=now();
 RETURN NEW;
END $guard$;
-- Sem concessão de INSERT/RPC: decisão, publicação, revogação e grants
-- seguem com suas políticas/ACL anteriores fechadas.
