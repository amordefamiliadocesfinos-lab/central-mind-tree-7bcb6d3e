// Exact, account-scoped Adão commit authorization. Páscoa is no longer
// categorically excluded: its individually homologated pairs may be added to
// SHOPEE_ADAO_APPROVED_EASTER_MODEL_PAIRS. This only passes the policy gate;
// exact active physical mapping, projection, writer flags and individual commit
// authorization remain independent mandatory protections.
// Never infer approval from SKU/title, an active listing or mapping existence.
export const ADAO_CHANNEL_ACCOUNT_ID = 'b4027369-5abf-4ac1-ab24-862334fae892';

// Exact Páscoa Adão intake authorization of 2026-11-09, reconciled with Core.
// 37 active mappings / 15 item IDs. Includes the valid 65g x100 offer.
// Historical deleted V8 models are intentionally absent. No production or inventory release.
export const ADAO_APPROVED_EASTER_INTAKE_PAIRS = Object.freeze([
  '19299649245:238801201787',
  '19299649245:238801201788',
  '19299649245:238801201790',
  '20199663408:209185715206',
  '20199663408:209185715207',
  '20199663408:209185715209',
  '20998090100:189185718245',
  '20998090100:189185718246',
  '20998090100:189185718247',
  '20998090100:189185718248',
  '22298331606:199618170212',
  '22298331606:199618170213',
  '22397349989:189618207849',
  '22397349989:189618207851',
  '22397349996:149790270245',
  '22397349996:149790270247',
  '22397350493:209185770212',
  '22397350493:209185770213',
  '22397350493:209185770214',
  '23093820401:209185750007',
  '23098311905:149552230018',
  '23098311905:149552230019',
  '23098311905:149552230020',
  '23098311905:149552230021',
  '23193820253:219185754959',
  '23193820253:219185754960',
  '23193820253:219185754962',
  '23598316694:159790255821',
  '23598316694:159790255822',
  '23598316694:159790255824',
  '23893322483:179413652092',
  '23993804971:189618216430',
  '23993804971:189618216432',
  '58205081665:159790238280',
  '58205081665:159790238284',
  '58255187424:189618241489',
  '58255187424:189618241493',
]);
const ADAO_APPROVED_EASTER_INTAKE_CSV = ADAO_APPROVED_EASTER_INTAKE_PAIRS.join(',');

const PAIRS = /^\d+:\d+(,\d+:\d+)*$/;
function parseApprovedPairs(raw) {
  if (typeof raw !== 'string' || raw === '') return new Set();
  if (!PAIRS.test(raw)) return null; // malformed configuration: fail closed
  const pairs = raw.split(',');
  if (new Set(pairs).size !== pairs.length) return null;
  return new Set(pairs);
}

export function shopeeAdaoEasterCommitBlocker(normalized, {
  approvedPairs = process.env.SHOPEE_ADAO_NON_EASTER_MODEL_PAIRS ?? '',
  approvedEasterPairs = process.env.SHOPEE_ADAO_APPROVED_EASTER_MODEL_PAIRS || ADAO_APPROVED_EASTER_INTAKE_CSV,
} = {}) {
  if (normalized?.channelAccountId !== ADAO_CHANNEL_ACCOUNT_ID) return null;
  if (!Array.isArray(normalized?.orders) || normalized.orders.length !== 1) {
    return 'adao_pascoa_order_identity_unverified';
  }
  const regular = parseApprovedPairs(approvedPairs);
  const easter = parseApprovedPairs(approvedEasterPairs);
  if (regular === null || easter === null) {
    return 'adao_pascoa_exclusion_not_proven';
  }
  if (regular.size + easter.size === 0) {
    return 'adao_pascoa_exclusion_not_proven';
  }
  const items = normalized.orders[0]?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return 'adao_pascoa_order_identity_unverified';
  }
  for (const item of items) {
    const itemId = String(item?.itemId ?? '');
    const modelId = String(item?.modelId ?? '');
    if (!/^\d+$/.test(itemId) || !/^\d+$/.test(modelId)
        || (!regular.has(`${itemId}:${modelId}`) && !easter.has(`${itemId}:${modelId}`))) {
      return 'adao_pascoa_offer_not_approved_for_intake';
    }
  }
  return null;
}
