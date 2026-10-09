import { requiresLiveStockForReply } from './reply-live-stock.ts';

Deno.test('bloqueia estoque pendente mesmo depois de confirmação curta', () => {
  if (!requiresLiveStockForReply([
    { direction: 'inbound', content: 'Quais vc tem em estoque hoje?' },
    { direction: 'inbound', content: 'Sss' },
  ])) throw new Error('estoque pendente sem fonte viva deve bloquear sugestão');
});

Deno.test('reconhece pedido de sabores disponíveis mesmo sem palavra estoque', () => {
  if (!requiresLiveStockForReply([{ direction: 'inbound', content: 'Quais sabores vocês tem?' }]))
    throw new Error('pergunta de disponibilidade de sabores deve exigir fato vivo');
});

Deno.test('não bloqueia pedidos gerais sem declaração de disponibilidade', () => {
  if (requiresLiveStockForReply([{ direction: 'inbound', content: 'Quero comprar trufas de 40g' }]))
    throw new Error('interesse genérico deve continuar permitido');
});

Deno.test('outbound encerra bloco de disponibilidade anterior', () => {
  if (requiresLiveStockForReply([
    { direction: 'inbound', content: 'O que tem em estoque?' },
    { direction: 'outbound', content: 'Vou conferir a disponibilidade.' },
    { direction: 'inbound', content: 'Obrigado' },
  ])) throw new Error('fato anterior já respondido não deve bloquear novo assunto');
});
