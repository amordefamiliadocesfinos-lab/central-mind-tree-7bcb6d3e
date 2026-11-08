import { createClient } from 'npm:@supabase/supabase-js@2';

const MODULES = new Set([
  'saude', 'planejamento', 'calendario', 'rotina', 'foco', 'metas',
  'minha-area', 'assistente', 'nucleo', 'captura', 'operacoes',
  'financeiro', 'crm', 'digital', 'producao', 'academia', 'dashboard',
]);
const CORS = {
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};
function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}
function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const adminUids = (Deno.env.get('ADMIN_ACCESS_BOOTSTRAP_UIDS') || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  if (!url || !serviceKey || adminUids.length === 0) {
    return reply(503, { error: 'Admin enrollment not configured' });
  }
  const bearer = req.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!bearer) return reply(401, { error: 'Authentication required' });

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await db.auth.getUser(bearer);
  if (authError || !auth.user || !adminUids.includes(auth.user.id)) {
    return reply(403, { error: 'Not authorized to administer access' });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw Error('Invalid');
  } catch {
    return reply(400, { error: 'Invalid JSON' });
  }
  const action = payload.action;

  if (action === 'list') {
    const [{ data: users, error: usersError }, { data: grants, error: grantsError }] = await Promise.all([
      db.from('app_users').select('id,name,email,is_active,auth_user_id').order('name').limit(300),
      db.from('app_module_access').select('auth_user_id,module_key').limit(3000),
    ]);
    if (usersError || grantsError) return reply(500, { error: 'Unable to read access registry' });
    return reply(200, { users, grants, module_keys: [...MODULES] });
  }

  if (Deno.env.get('ACCESS_ADMIN_ENROLLMENT_ENABLED') !== 'true') {
    return reply(403, { error: 'Access administration not activated: RLS gates pending' });
  }

  if (action === 'grant') {
    const authUserId = nonEmpty(payload.auth_user_id);
    if (!authUserId || !Array.isArray(payload.modules)
      || payload.modules.length > MODULES.size
      || payload.modules.some((m) => typeof m !== 'string' || !MODULES.has(m))) {
      return reply(400, { error: 'Invalid access grant' });
    }
    if (adminUids.includes(authUserId)) {
      return reply(409, { error: 'Bootstrap administrators are not managed here' });
    }
    const { data: linked, error: linkedError } = await db.from('app_users')
      .select('id,is_active').eq('auth_user_id', authUserId).maybeSingle();
    if (linkedError || !linked?.is_active) return reply(409, { error: 'Active linked profile required' });
    const desired = [...new Set(payload.modules as string[])];
    // Guarded draft: the feature flag MUST stay off until transactional grants and
    // all domain RLS policies are independently audited and tested.
    const { error: deleteError } = await db.from('app_module_access')
      .delete().eq('auth_user_id', authUserId);
    if (deleteError) return reply(500, { error: 'Could not update access' });
    if (desired.length > 0) {
      const { error: insertError } = await db.from('app_module_access').insert(
        desired.map((module_key) => ({
          auth_user_id: authUserId, module_key, granted_by: auth.user.id,
        })),
      );
      if (insertError) return reply(500, { error: 'Grant update incomplete: reconcile before retry' });
    }
    return reply(200, { ok: true, auth_user_id: authUserId, modules: desired });
  }

  if (action === 'invite') {
    const appUserId = nonEmpty(payload.app_user_id);
    const athleteId = payload.athlete_id == null ? null : nonEmpty(payload.athlete_id);
    if (!appUserId || (payload.athlete_id != null && !athleteId)) {
      return reply(400, { error: 'Existing application user required' });
    }
    const { data: appUser, error: appError } = await db.from('app_users')
      .select('id,name,email,auth_user_id,is_active').eq('id', appUserId).maybeSingle();
    if (appError || !appUser?.is_active || !appUser.email || appUser.auth_user_id) {
      return reply(409, { error: 'Existing, active, unlinked user with email required' });
    }
    if (athleteId) {
      const { data: athlete, error: athleteError } = await db.from('health_athletes')
        .select('id,auth_user_id,display_name').eq('id', athleteId).maybeSingle();
      if (athleteError || !athlete || athlete.auth_user_id
        || athlete.display_name.trim().toLocaleLowerCase() !== appUser.name.trim().toLocaleLowerCase()) {
        return reply(409, { error: 'Existing, unlinked matching athlete required' });
      }
    }
    const { data: invite, error: inviteError } = await db.auth.admin.inviteUserByEmail(appUser.email, {
      data: { name: appUser.name },
    });
    if (inviteError || !invite.user?.id) {
      return reply(409, { error: 'Invite not completed; reconcile Auth before retry' });
    }
    const authId = invite.user.id;
    const { data: updated, error: linkError } = await db.from('app_users')
      .update({ auth_user_id: authId }).eq('id', appUser.id)
      .is('auth_user_id', null).select('id').maybeSingle();
    if (linkError || !updated) {
      return reply(409, { error: 'Auth invited, application link not confirmed; reconcile before retry' });
    }
    if (athleteId) {
      const { data: healthLink, error: healthError } = await db.from('health_athletes')
        .update({ auth_user_id: authId }).eq('id', athleteId)
        .is('auth_user_id', null).select('id').maybeSingle();
      if (healthError || !healthLink) {
        return reply(409, { error: 'Auth and application linked; health athlete link requires reconciliation' });
      }
    }
    return reply(200, { ok: true, auth_user_id: authId, invited: true, app_user_id: appUser.id, athlete_id: athleteId });
  }
  return reply(400, { error: 'Unknown action' });
});
