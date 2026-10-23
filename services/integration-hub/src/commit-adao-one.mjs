import { pathToFileURL } from 'node:url';
import { ADAO } from './read-adao-orders.mjs';
import { CORE_BRIDGE_URL, readLiveShopeeOrderIntakeBatch } from './core-bridge.mjs';
import { createShopeeControlledAutoIntake } from './shopee-order-auto-intake.mjs';
import { buildShopeeOrderCreateRequest, persistShopeeOrderContract } from './shopee-order-writer.mjs';

export const PILOT = Object.freeze({
  account: ADAO.channel_account_id,
  shopName: 'SHOPEE ADÃO',
  order: '261023C0CDYM5H',
  mapping: 'e067bd9d-1220-4e24-8b12-7b389797137c',
  product: '62cf9f63-be04-4261-ad11-569028dd1125',
  key: 'code:SH-001-014|variation:',
  item: '18599184676',
  variants: ['d89e1dba-ca80-4136-b9f3-225fb80b6dfb',
    'e4d756c8-f324-4ac0-b9ff-6adae24f5310'],
});
const CONFIRM = '--confirm=COMMIT_ADAO_261023C0CDYM5H';
const READ = 'shopee.order_intake_batch.read';
const WRITE = 'shopee.order.create';

function fail(code, attempted = 0) {
  return { ok: false, code, account_id: PILOT.account,
    order_sn: PILOT.order, attempted, written: 0 };
}

function exactContract(contract) {
  const d = buildShopeeOrderCreateRequest(contract);
  if (d.channel_account_id !== PILOT.account
    || d.marketplace_account !== PILOT.shopName
    || d.order_number !== PILOT.order
    || d.external_status !== 'PROCESSED'
    || !Array.isArray(d.items) || d.items.length !== 2) return false;
  return PILOT.variants.every(id => d.items.filter(i =>
    i.variant_id === id && i.product_id === PILOT.product
    && i.mapping_id === PILOT.mapping && i.external_item_key === PILOT.key
    && String(i.item_id) === PILOT.item && Number(i.quantity) === 9
    && Number(i.commercial_quantity) === 1
    && Number(i.physical_multiplier) === 9).length === 1);
}

export async function commitAdaoOne({
  confirmed = false, env = process.env, fetchImpl = globalThis.fetch,
} = {}) {
  if (!confirmed) return fail('confirmation_required');
  if (!env.CORE_BRIDGE_HMAC_SECRET) return fail('configuration_missing');
  let reads = 0, writes = 0, attempted = 0;
  const guardedFetch = async (input, init) => {
    const url = new URL(input);
    if (url.href !== CORE_BRIDGE_URL || init.method !== 'POST') {
      throw new Error('forbidden_destination');
    }
    const body = JSON.parse(init.body);
    if (body.action === READ) {
      reads++;
      if (reads !== 1 || writes !== 0 || body.channel_account_id !== PILOT.account
        || body.order_sn !== PILOT.order || body.limit !== 1) {
        throw new Error('forbidden_read');
      }
    } else if (body.action === WRITE) {
      writes++;
      if (reads !== 1 || writes !== 1 || attempted !== 1
        || body.channel_account_id !== PILOT.account
        || body.order_number !== PILOT.order || body.marketplace_account !== PILOT.shopName
        || body.verify_existing !== true
        || body.items?.length !== 2
        || body.items.some(x => x.mapping_id !== PILOT.mapping)) {
        throw new Error('forbidden_write');
      }
    } else throw new Error('forbidden_action');
    return fetchImpl(input, init);
  };
  const options = { url: CORE_BRIDGE_URL, secret: env.CORE_BRIDGE_HMAC_SECRET,
    fetchImpl: guardedFetch, logger: () => {} };
  try {
    const intake = createShopeeControlledAutoIntake({
      readBatch: data => readLiveShopeeOrderIntakeBatch(data, options),
      persistOrder: (contract, args) => {
        if (!exactContract(contract) || args?.verifyExisting !== true) {
          throw new Error('unexpected_order');
        }
        attempted++;
        return persistShopeeOrderContract(contract, { ...options, verifyExisting: true });
      },
    });
    const result = await intake({
      channelAccountId: PILOT.account, limit: 1, mode: 'commit',
      expectedOrderSn: PILOT.order, verifyExisting: true,
    });
    const row = result.results?.[0];
    if (!result.ok || result.marketplaceAccount !== PILOT.shopName
      || result.selected !== 1 || result.results.length !== 1
      || row?.orderSn !== PILOT.order || attempted !== 1 || writes !== 1
      || !['written','already_registered'].includes(row.status) || !row.write?.ok
      || typeof row.write.orderId !== 'string'
      || typeof row.write.separationId !== 'string') {
      return fail('commit_unconfirmed', attempted);
    }
    return { ok: true, code: row.status, account_id: PILOT.account,
      order_sn: PILOT.order, attempted, written: result.written,
      order_id: row.write.orderId, separation_id: row.write.separationId };
  } catch {
    return fail('execution_unconfirmed', attempted);
  }
}

export async function main(args = process.argv.slice(2)) {
  if (args.length !== 2 || args[0] !== '--commit-one' || args[1] !== CONFIRM) {
    console.log('Usage: --commit-one --confirm=COMMIT_ADAO_261023C0CDYM5H');
    return 2;
  }
  const result = await commitAdaoOne({ confirmed: true });
  console.log(JSON.stringify(result));
  return result.ok ? 0 : 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
