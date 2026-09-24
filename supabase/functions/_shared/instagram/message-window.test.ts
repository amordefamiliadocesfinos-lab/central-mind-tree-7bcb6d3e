import { isInstagramCustomerServiceWindowOpen, INSTAGRAM_CUSTOMER_SERVICE_WINDOW_MS } from './message-window.ts';

const now = Date.parse('2026-09-24T15:00:00.000Z');

Deno.test('janela Instagram fica aberta antes de 24 horas', () => {
  const inbound = new Date(now - INSTAGRAM_CUSTOMER_SERVICE_WINDOW_MS + 1).toISOString();
  if (!isInstagramCustomerServiceWindowOpen(inbound, now)) throw new Error('Janela recente deveria estar aberta');
});

Deno.test('limite exato de 24 horas permanece aberto', () => {
  const inbound = new Date(now - INSTAGRAM_CUSTOMER_SERVICE_WINDOW_MS).toISOString();
  if (!isInstagramCustomerServiceWindowOpen(inbound, now)) throw new Error('Limite de 24h deveria permanecer aberto');
});

Deno.test('janela Instagram fecha acima de 24 horas ou sem inbound', () => {
  const expired = new Date(now - INSTAGRAM_CUSTOMER_SERVICE_WINDOW_MS - 1).toISOString();
  if (isInstagramCustomerServiceWindowOpen(expired, now)) throw new Error('Janela vencida foi aceita');
  if (isInstagramCustomerServiceWindowOpen(null, now)) throw new Error('Janela sem inbound foi aceita');
});
