// F3-A: pure policy; never trusts browser-supplied identity or role.
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validRequestedAccount(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  if (Object.keys(body).length !== 1 || typeof body.channel_account_id !== 'string') return null;
  return UUID_RE.test(body.channel_account_id) ? body.channel_account_id : null;
}

// Fail closed when a query fails, the caller is not a linked active app user,
// the platform is not the active canonical Shopee marketplace, or the grant is absent.
export function canInitiateShopeeOAuth({ user, appUser, account, platform, grant } = {}) {
  return Boolean(
    user?.id && UUID_RE.test(user.id)
    && appUser?.auth_user_id === user.id
    && appUser?.is_active === true
    && account?.id && UUID_RE.test(account.id)
    && account?.is_active === true
    && platform?.id === account.platform_id
    && platform?.is_active === true
    && platform?.group_type === 'marketplace'
    && platform?.parent_id == null
    && typeof platform?.name === 'string'
    && platform.name.toLowerCase().startsWith('shopee')
    && grant?.auth_user_id === user.id
    && grant?.channel_account_id === account.id
  );
}
