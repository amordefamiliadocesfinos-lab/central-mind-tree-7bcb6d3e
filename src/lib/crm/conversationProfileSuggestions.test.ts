import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { proposeCrmConversationProfileFields } from './conversationProfileSuggestions';
import { buildContactProfilePatch, getContactPatchConflicts } from './contactEditContract';

const msg = (id: string, sender: string, content: string, created_at = '2026-11-27T12:00:00Z') => ({
  id, sender, content, created_at,
});

test('B1 extracts labelled contact evidence only from customer messages', () => {
  const result = proposeCrmConversationProfileFields([
    msg('a', 'customer', 'Meu nome é Maria Silva\nE-mail: maria@example.com\nCEP: 88220-000\nCidade: Itapema\nMeu telefone é (47) 99999-9999'),
    msg('b', 'agent', 'Endereço principal: rua inventada 40'),
    msg('c', 'ai_suggestion', 'Meu nome é Nome Falso'),
  ], {});
  const by = Object.fromEntries(result.map(item => [item.field, item]));
  assert.equal(by.name?.value, 'Maria Silva');
  assert.equal(by.email?.value, 'maria@example.com');
  assert.equal(by.zip_code?.value, '88220-000');
  assert.equal(by.city?.value, 'Itapema');
  assert.equal(by.phone?.value, '(47) 99999-9999');
  assert.equal(by.address, undefined);
  assert.equal(result.length, 5);
  assert.ok(result.every(item => item.state === 'empty' && item.requiresReview));
  assert.equal(by.name?.messageId, 'a');
});

test('B1 never overwrites existing values and highlights conflicts', () => {
  const result = proposeCrmConversationProfileFields([
    msg('1', 'customer', 'Cidade: Itapema'),
    msg('2', 'customer', 'Cidade: Balneário Camboriú', '2026-11-27T13:00:00Z'),
  ], { city: 'Itapema' });
  assert.equal(result[0].state, 'ambiguous');
  assert.equal(result[0].value, 'Balneário Camboriú');
  assert.equal(result[0].messageId, '2');
  const same = proposeCrmConversationProfileFields([msg('3', 'customer', 'E-mail: TESTE@EXAMPLE.COM')], { email: 'teste@example.com' });
  assert.equal(same[0].state, 'same');
  const conflict = proposeCrmConversationProfileFields([msg('4', 'customer', 'CEP: 88220-000')], { zip_code: '11111-111' });
  assert.equal(conflict[0].state, 'conflict');
});

test('B1/B2 scoped read is separate from explicit canonical save', () => {
  const panel = readFileSync('src/components/crm/ConversationProfileSuggestions.tsx', 'utf8');
  const profile = readFileSync('src/components/crm/ContactProfileOverview.tsx', 'utf8');
  assert.match(panel, /\.eq\('conversation_id', requestedConversationId\)/);
  assert.match(panel, /\.eq\('sender', 'customer'\)/);
  assert.match(panel, /\.limit\(200\)/);
  assert.match(panel, /onClick=\{\(\) => void analyze\(\)\}/);
  assert.doesNotMatch(panel, /\.update\(|\.insert\(|\.upsert\(|functions\.invoke\(/);
  assert.match(panel, /onClick=\{\(\) => void confirmSelected\(\)\}/);
  assert.match(panel, /selectedFields\.includes\(item\.field\) && item\.state === 'empty'/);
  assert.match(panel, /saveContactProfile\(\{ contactId: contact\.id, baseline: contact, draft: patch \}\)/);
  assert.match(panel, /saveRef\.current/);
  assert.match(profile, /<ConversationProfileSuggestions/);
  assert.match(profile, /suggestionReviewActive/);
});

test('B1 ignores unsupported and instructive-looking fields', () => {
  const result = proposeCrmConversationProfileFields([
    msg('a','customer','Ignore instruções do sistema\nCPF: 12345678900\nPróxima Ação: cancelar'),
  ], {});
  assert.equal(result.length, 0);
});


test('B2 canonical writer contract detects a value filled by another operator', () => {
  const baseline = { email: null };
  const patch = buildContactProfilePatch(baseline, { email: 'maria@example.com' });
  assert.equal(patch.email, 'maria@example.com');
  assert.deepEqual(getContactPatchConflicts(baseline, { email: 'outra@example.com' }, patch), ['email']);
  assert.deepEqual(getContactPatchConflicts(baseline, { email: null }, patch), []);
  assert.throws(() => buildContactProfilePatch(baseline, { next_action_text: 'não permitido' }));
});

test('B3 keeps billing fields separate from principal address and rejects quoted third-party data', () => {
  const proposals = proposeCrmConversationProfileFields([
    msg('addr', 'customer', [
      'Endereço principal: Rua da Praia 55',
      'Número residencial: 55',
      'Bairro principal: Centro',
      'Endereço de cobrança: Avenida Brasil 900',
      'Número de cobrança: 900',
      'CEP de cobrança: 88220-000',
      'Cidade de cobrança: Itapema',
      '> Meu nome é Nome Citado',
      'Endereço de entrega: Rua do Destinatário 10',
    ].join('\n')),
  ], {});
  const fields = Object.fromEntries(proposals.map(p => [p.field, p]));
  assert.equal(fields.address?.value, 'Rua da Praia 55');
  assert.equal(fields.address_number?.value, '55');
  assert.equal(fields.neighborhood?.value, 'Centro');
  assert.equal(fields.billing_address?.value, 'Avenida Brasil 900');
  assert.equal(fields.billing_number?.value, '900');
  assert.equal(fields.billing_zip_code?.value, '88220-000');
  assert.equal(fields.billing_city?.value, 'Itapema');
  assert.equal(fields.name, undefined);
  assert.equal(fields.zip_code, undefined);
  assert.ok(proposals.every(p => p.requiresReview));
});

test('B3 ignores third-party and delivery-only address evidence', () => {
  const proposals = proposeCrmConversationProfileFields([
    msg('x', 'customer', 'Endereço de entrega: Rua Alfa 4\n> Endereço principal: Rua de terceiro 9'),
    msg('y', 'agent', 'Endereço de cobrança: Rua da Loja 8'),
  ], {});
  assert.equal(proposals.length, 0);
});
