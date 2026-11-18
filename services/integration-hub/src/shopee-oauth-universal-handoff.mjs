// F3-B — primitives only. No public route can initiate OAuth with these helpers.
// The issuing endpoint must revalidate authenticated user+specific account grant.
import { createHash, randomBytes } from 'node:crypto';

export const HANDOFF_TTL_MS = 90_000;

export function newHandoffTicket() {
  return randomBytes(32).toString('base64url');
}

export function hashHandoffTicket(ticket) {
  if (typeof ticket !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(ticket)) return null;
  return createHash('sha256').update(ticket).digest('hex');
}

export function validHandoffIdentity(payload, allowedPartnerIds = [2047685]) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const channelAccountId = payload.channel_account_id;
  const partnerId = Number(payload.partner_id);
  if (typeof channelAccountId !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(channelAccountId)
    || !Number.isSafeInteger(partnerId)
    || !allowedPartnerIds.includes(partnerId)) return null;
  return { channel_account_id: channelAccountId, partner_id: partnerId };
}

// Consumer gets only account+partner after atomic, authorized, non-replayed RPC.
// The browser's query must never supply channel_account_id or partner_id.
export function validateHandoffConsumeResult(consumed, allowedPartnerIds = [2047685]) {
  if (!consumed || consumed.ok !== true) return null;
  return validHandoffIdentity(consumed.payload, allowedPartnerIds);
}

export function validApprovedUniversalIdentity(payload, expectedPartner = 2047685) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const scoped = validHandoffIdentity(payload, [expectedPartner]);
  const userId = payload.auth_user_id;
  const shopId = Number(payload.shop_id);
  if (!scoped || typeof userId !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)
    || !Number.isSafeInteger(shopId) || shopId <= 0) return null;
  return { ...scoped, auth_user_id: userId, shop_id: shopId };
}
