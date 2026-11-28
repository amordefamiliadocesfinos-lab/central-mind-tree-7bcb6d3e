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
  assert.match(panel, /CRM_CONVERSATION_REVIEW_LIMIT = 1000/);
  assert.match(panel, /CRM_CONVERSATION_PAGE_SIZE = 200/);
  assert.match(panel, /\.range\(offset, offset \+ CRM_CONVERSATION_PAGE_SIZE - 1\)/);
  assert.match(panel, /\.order\('id', \{ ascending: false \}\)/);
  assert.match(panel, /setScanLimitReached\(collected.length >= CRM_CONVERSATION_REVIEW_LIMIT\)/);
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

test('B3 marks conflicting values inside one customer message ambiguous', () => {
  const evidence = proposeCrmConversationProfileFields([
    msg('multi', 'customer', 'Cidade: Itapema\nCidade: Porto Belo'),
  ], {});
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].field, 'city');
  assert.equal(evidence[0].state, 'ambiguous');
  assert.equal(evidence[0].messageId, 'multi');
});

test('B4 validates source format and keeps a bounded line excerpt', () => {
  const result = proposeCrmConversationProfileFields([
    msg('bad', 'customer', 'Telefone: 123456789\nE-mail: invalido@dominio\nCEP: 1234567'),
    msg('ok', 'customer', 'Telefone: (47) 99999-9999\nE-mail: ana@example.com\nCEP: 88220-000'),
  ], {});
  assert.equal(result.length, 3);
  const by = Object.fromEntries(result.map(p => [p.field, p]));
  assert.equal(by.phone?.value, '(47) 99999-9999');
  assert.equal(by.email?.value, 'ana@example.com');
  assert.equal(by.zip_code?.value, '88220-000');
  assert.equal(by.phone?.evidenceExcerpt, 'Telefone: (47) 99999-9999');
  assert.ok(result.every(p => p.evidenceExcerpt.length <= 160));
});

test('B4 phone and CEP formatting do not manufacture a conflict', () => {
  const result = proposeCrmConversationProfileFields([
    msg('x', 'customer', 'Telefone: (47) 99999-9999\nCEP: 88220-000'),
  ], { phone: '47999999999', zip_code: '88220000' });
  assert.equal(result.find(p => p.field === 'phone')?.state, 'same');
  assert.equal(result.find(p => p.field === 'zip_code')?.state, 'same');
});

test('B5 pagination never permits an unscoped or unlimited history query', () => {
  const panel = readFileSync('src/components/crm/ConversationProfileSuggestions.tsx', 'utf8');
  const start = panel.indexOf('for (let offset = 0;');
  const stop = panel.indexOf('if (queryError) throw queryError;', start);
  assert.ok(start >= 0 && stop > start);
  const scope = panel.slice(start, stop);
  assert.match(scope, /offset < CRM_CONVERSATION_REVIEW_LIMIT/);
  assert.match(scope, /\.eq\('conversation_id', requestedConversationId\)/);
  assert.match(scope, /\.eq\('sender', 'customer'\)/);
  assert.match(panel, /Limite de 1\.000 atingido/);
});

test('B6 does not assign third-party labelled blocks to the contact', () => {
  const items = proposeCrmConversationProfileFields([
    msg('third', 'customer', ['Dados da minha mãe:', 'Nome completo: Pessoa de Terceiro', 'Cidade: Itapema'].join(String.fromCharCode(10))),
    msg('forward', 'customer', ['Mensagem encaminhada', 'E-mail: outro@example.com'].join(String.fromCharCode(10))),
    msg('primary', 'customer', 'Meu nome é Ana Cliente'),
  ], {});
  assert.equal(items.length, 1);
  assert.equal(items[0].field, 'name');
  assert.equal(items[0].value, 'Ana Cliente');
});

test('B6 validates conversation identity before any message page and discards stale requests', () => {
  const panel = readFileSync('src/components/crm/ConversationProfileSuggestions.tsx', 'utf8');
  assert.match(panel, /from\('service_conversations'\)/);
  assert.match(panel, /\.eq\('contact_id', requestedContactId\)/);
  assert.match(panel, /\.eq\('id', requestedConversationId\)/);
  assert.match(panel, /if \(boundError \|\| !boundConversation\) throw/);
  assert.match(panel, /analysisRequestRef\.current \+= 1/);
  assert.match(panel, /if \(!isCurrentRequest\(\)\) return/);
  assert.match(panel, /if \(isCurrentRequest\(\)\) setLoading\(false\)/);
  // Guard both before reading the conversation and immediately before saving.
  assert.ok(panel.split("from('service_conversations')").length - 1 >= 2);
  assert.match(panel, /if \(scopeError \|\| !activeConversation\) throw/);
  assert.match(panel, /if \(saveRef\.current \|\| loading \|\| scanLimitReached \|\| oversizedMessageCount > 0 \|\| !analyzedHistoryRef\.current \|\| !analyzedLatestMessageId \|\| !conversationId/);
});

test('B7 blocks confirmation for truncated history and requires a fresh customer-message snapshot', () => {
  const panel = readFileSync('src/components/crm/ConversationProfileSuggestions.tsx', 'utf8');
  assert.match(panel, /setAnalyzedLatestMessageId\(collected\[0\]\?\.id \?\? null\)/);
  assert.match(panel, /scanLimitReached \|\| oversizedMessageCount > 0 \|\| !analyzedHistoryRef\.current \|\| !analyzedLatestMessageId/);
  assert.match(panel, /item\.state !== 'empty' \|\| scanLimitReached/);
  assert.match(panel, /Histórico parcialmente examinado: preenchimento automático bloqueado/);
  const confirmation = panel.slice(panel.indexOf('const confirmSelected = async'));
  const freshness = confirmation.indexOf("const { data: latestMessage, error: latestError }");
  const writer = confirmation.indexOf('await saveContactProfile(');
  assert.ok(freshness >= 0 && writer > freshness, 'message snapshot must be checked before canonical writer');
  assert.match(confirmation, /latestMessage\.id !== analyzedLatestMessageId/);
  assert.match(confirmation, /\.eq\('conversation_id', conversationId\)/);
  assert.match(confirmation, /\.eq\('sender', 'customer'\)/);
  assert.match(confirmation, /\.limit\(1\)/);
  assert.match(confirmation, /Novas mensagens ou alterações no histórico exigem conferir novamente/);
});

test('B8 reconfirms every examined customer message before the canonical writer', () => {
  const panel = readFileSync('src/components/crm/ConversationProfileSuggestions.tsx', 'utf8');
  assert.match(panel, /analyzedHistoryRef\.current = JSON\.stringify\(collected\)/);
  assert.match(panel, /analyzedHistoryRef\.current = null/);
  assert.match(panel, /const currentHistory: CrmConversationProfileMessage\[\] = \[\]/);
  const confirmation = panel.slice(panel.indexOf('const confirmSelected = async'));
  const scope = confirmation.indexOf("const { data: activeConversation, error: scopeError }");
  const currentHistory = confirmation.indexOf('const currentHistory: CrmConversationProfileMessage[]');
  const writer = confirmation.indexOf('await saveContactProfile(');
  assert.ok(scope >= 0 && currentHistory > scope && writer > currentHistory);
  const historyReview = confirmation.slice(currentHistory, writer);
  assert.match(historyReview, /\.eq\('conversation_id', conversationId\)/);
  assert.match(historyReview, /\.eq\('sender', 'customer'\)/);
  assert.match(historyReview, /offset < CRM_CONVERSATION_REVIEW_LIMIT/);
  assert.match(historyReview, /JSON\.stringify\(currentHistory\) !== analyzedHistoryRef\.current/);
  assert.match(historyReview, /currentHistory\.length >= CRM_CONVERSATION_REVIEW_LIMIT/);
  assert.match(historyReview, /O histórico mudou desde a análise ou está incompleto/);
  assert.match(panel, /disabled=\{!conversationId \|\| editing \|\| loading \|\| saving\}/);
});

test('B9 free-text email and CEP are presented only as unverified evidence', () => {
  const result = proposeCrmConversationProfileFields([
    msg('plain', 'customer', ['Pode mandar para contato@example.com, por favor', 'Acho que é 88220-000'].join(String.fromCharCode(10))),
  ], {});
  assert.deepEqual(result.map(item => item.field).sort(), ['email', 'zip_code']);
  assert.ok(result.every(item => item.state === 'unverified' && item.requiresReview));
  assert.equal(result[0].messageId, 'plain');
});

test('B9 explicit labelled evidence wins; quoted and third-party blocks stay out', () => {
  const result = proposeCrmConversationProfileFields([
    msg('quoted', 'customer', ['Dados da minha mãe:', 'E-mail: mae@example.com'].join(String.fromCharCode(10))),
    msg('agent', 'agent', 'contato@agente.com'),
    msg('plain', 'customer', 'Talvez teste@example.com'),
    msg('label', 'customer', 'Meu e-mail é cliente@example.com'),
  ], {});
  assert.equal(result.length, 1);
  assert.equal(result[0].field, 'email');
  assert.equal(result[0].value, 'cliente@example.com');
  assert.equal(result[0].state, 'empty');
});

test('B9 unverified fields are not eligible for the canonical confirmation button', () => {
  const panel = readFileSync('src/components/crm/ConversationProfileSuggestions.tsx', 'utf8');
  assert.match(panel, /selectedFields\.includes\(item\.field\) && item\.state === 'empty'/);
  assert.match(panel, /disabled=\{item\.state !== 'empty'/);
  assert.match(panel, /unverified: 'Texto livre: titularidade não comprovada/);
  assert.doesNotMatch(panel, /\.upsert\(|\.insert\(/);
});

test('B9 billing and delivery CEP never become a primary CEP hint', () => {
  const result = proposeCrmConversationProfileFields([
    msg('billing', 'customer', 'CEP de cobrança: 88220-000'),
    msg('delivery', 'customer', 'CEP de entrega: 88300-000'),
    msg('primary', 'customer', 'Pode ser no 88100-000'),
  ], {});
  const hints = result.filter(item => item.field === 'zip_code');
  assert.equal(hints.length, 1);
  assert.equal(hints[0].value, '88100-000');
  assert.equal(hints[0].state, 'unverified');
  const billing = result.find(item => item.field === 'billing_zip_code');
  assert.equal(billing?.value, '88220-000');
});

test('B10 counts distinct free-text candidates without turning hints into writable fields', () => {
  const result = proposeCrmConversationProfileFields([
    msg('first', 'customer', 'Envie para primeiro@example.com'),
    msg('second', 'customer', 'Pode usar segundo@example.com', '2026-11-27T13:00:00Z'),
    msg('third', 'customer', 'Repetindo: PRIMEIRO@example.com', '2026-11-27T14:00:00Z'),
  ], {});
  const email = result.find(item => item.field === 'email');
  assert.equal(email?.state, 'unverified');
  assert.equal(email?.distinctValues, 2);
  assert.equal(email?.requiresReview, true);
  const panel = readFileSync('src/components/crm/ConversationProfileSuggestions.tsx', 'utf8');
  assert.match(panel, /item\.distinctValues > 1/);
  assert.match(panel, /não escolha apenas a mais recente/);
  assert.match(panel, /disabled=\{item\.state !== 'empty'/);
});

test('B10 labeled contradictions remain blocked while equivalent formats count once', () => {
  const result = proposeCrmConversationProfileFields([
    msg('one', 'customer', 'Telefone: (47) 99999-9999'),
    msg('two', 'customer', 'Telefone: 47999999999', '2026-11-27T13:00:00Z'),
    msg('three', 'customer', 'Cidade: Itapema'),
    msg('four', 'customer', 'Cidade: Porto Belo', '2026-11-27T13:00:00Z'),
  ], {});
  assert.equal(result.find(item => item.field === 'phone')?.distinctValues, 1);
  assert.equal(result.find(item => item.field === 'city')?.distinctValues, 2);
  assert.equal(result.find(item => item.field === 'city')?.state, 'ambiguous');
});

test('B11 reads all free-text identifiers in one line as review-only conflicting hints', () => {
  const items = proposeCrmConversationProfileFields([
    msg('same-line','customer','Envie para um@example.com ou dois@example.com; CEPs 88220-000 e 88300-000'),
  ], {});
  const email = items.find(item => item.field === 'email');
  const cep = items.find(item => item.field === 'zip_code');
  assert.equal(email?.state, 'unverified');
  assert.equal(email?.distinctValues, 2);
  assert.equal(cep?.state, 'unverified');
  assert.equal(cep?.distinctValues, 2);
  assert.ok(items.every(item => item.requiresReview));
});

test('B11 multiple values within one labeled line are ambiguous, never writable', () => {
  const items = proposeCrmConversationProfileFields([
    msg('explicit','customer','E-mail: primeiro@example.com ou segundo@example.com'),
  ], {});
  const email = items.find(item => item.field === 'email');
  assert.equal(email?.state, 'ambiguous');
  assert.equal(email?.distinctValues, 2);
});

test('B11 other-person email and delivery CEP do not become unverified principal hints', () => {
  const items = proposeCrmConversationProfileFields([
    msg('third','customer','E-mail da minha mãe: mae@example.com'),
    msg('delivery','customer','CEP de entrega: 88220-000 ou 88300-000'),
  ], {});
  assert.equal(items.find(item => item.field === 'email'), undefined);
  assert.equal(items.find(item => item.field === 'zip_code'), undefined);
});

test('B12 quoted third-party values and explicit ownership denials never become profile proposals', () => {
  const result = proposeCrmConversationProfileFields([
    msg('mother', 'customer', 'E-mail: mae@example.com (da minha mãe)'),
    msg('notmine', 'customer', 'E-mail: nao@example.com — não é meu'),
    msg('invalid', 'customer', 'CEP: 88220-000, dado incorreto'),
    msg('revoked', 'customer', 'Cidade: Porto Belo, desconsiderar'),
    msg('address', 'customer', 'Endereço principal: Rua do Colega 7, do meu colega'),
    msg('good', 'customer', 'Meu e-mail é pessoa@example.com'),
  ], {});
  assert.deepEqual(result.map(item => item.field), ['email']);
  assert.equal(result[0].value, 'pessoa@example.com');
  assert.equal(result[0].state, 'empty');
  assert.equal(result[0].distinctValues, 1);
});

test('B12 does not convert a denied labelled field into an unverified text hint', () => {
  const result = proposeCrmConversationProfileFields([
    msg('third', 'customer', 'Meu e-mail é terceiro@example.com, pertence ao meu pai'),
    msg('retracted', 'customer', 'Pode enviar para outro@example.com, não usar'),
    msg('third-cep', 'customer', 'O CEP é 88220-000 da minha mãe'),
  ], {});
  assert.equal(result.length, 0);
});

test('B13 later denial invalidates earlier explicit email and CEP evidence', () => {
  const result = proposeCrmConversationProfileFields([
    msg('original', 'customer', 'Meu e-mail é cliente@example.com' + String.fromCharCode(10) + 'CEP: 88220-000', '2026-11-27T12:00:00Z'),
    msg('revoked', 'customer', 'E-mail: cliente@example.com não é meu' + String.fromCharCode(10) + 'CEP: 88220-000, desconsiderar', '2026-11-27T13:00:00Z'),
  ], {});
  assert.equal(result.find(item => item.field === 'email')?.state, 'ambiguous');
  assert.equal(result.find(item => item.field === 'zip_code')?.state, 'ambiguous');
  assert.ok(result.every(item => item.requiresReview));
});

test('B13 unrelated denied value does not suppress valid labelled evidence', () => {
  const result = proposeCrmConversationProfileFields([
    msg('original', 'customer', 'Meu e-mail é cliente@example.com'),
    msg('third', 'customer', 'E-mail: terceiro@example.com é do meu pai', '2026-11-27T13:00:00Z'),
  ], {});
  assert.equal(result.length, 1);
  assert.equal(result[0].state, 'empty');
  assert.equal(result[0].value, 'cliente@example.com');
});

test('B14 excludes a subsequently revoked free-text email and CEP', () => {
  const result = proposeCrmConversationProfileFields([
    msg('hint', 'customer', 'Pode usar livre@example.com e 88220-000', '2026-11-27T12:00:00Z'),
    msg('deny', 'customer', 'E-mail: livre@example.com não é meu' + String.fromCharCode(10) + 'CEP: 88220-000, desconsiderar', '2026-11-27T13:00:00Z'),
  ], {});
  assert.equal(result.find(item => item.field === 'email'), undefined);
  assert.equal(result.find(item => item.field === 'zip_code'), undefined);
});

test('B14 preserves only unrelated unverified hints, without enabling writes', () => {
  const result = proposeCrmConversationProfileFields([
    msg('hint', 'customer', 'E-mails: negado@example.com ou livre@example.com'),
    msg('deny', 'customer', 'E-mail: negado@example.com pertence ao meu pai', '2026-11-27T14:00:00Z'),
  ], {});
  const email = result.find(item => item.field === 'email');
  assert.equal(email?.state, 'unverified');
  assert.equal(email?.value, 'livre@example.com');
  assert.equal(email?.distinctValues, 1);
  assert.equal(email?.requiresReview, true);
});

test('B15 a later field-only email denial blocks earlier explicit profile suggestion', () => {
  const result = proposeCrmConversationProfileFields([
    msg('first', 'customer', 'Meu e-mail é ana@example.com', '2026-11-27T12:00:00Z'),
    msg('deny', 'customer', 'Esse e-mail não é meu', '2026-11-27T13:00:00Z'),
  ], {});
  assert.equal(result.find(item => item.field === 'email')?.state, 'ambiguous');
});

test('B15 later field-only denial blocks unverified CEP and labelled phone', () => {
  const result = proposeCrmConversationProfileFields([
    msg('cep', 'customer', 'Pode entregar em 88220-000', '2026-11-27T12:00:00Z'),
    msg('phone', 'customer', 'Meu telefone é (47) 99999-9999', '2026-11-27T12:00:00Z'),
    msg('deny-cep', 'customer', 'Esse CEP não é meu', '2026-11-27T13:00:00Z'),
    msg('deny-phone', 'customer', 'Esse telefone não é meu', '2026-11-27T13:00:00Z'),
  ], {});
  assert.equal(result.find(item => item.field === 'zip_code'), undefined);
  assert.equal(result.find(item => item.field === 'phone')?.state, 'ambiguous');
});

test('B15 old field-only denial does not revoke a newer explicit declaration', () => {
  const result = proposeCrmConversationProfileFields([
    msg('deny', 'customer', 'Esse e-mail não é meu', '2026-11-27T11:00:00Z'),
    msg('new', 'customer', 'Meu e-mail é ana@example.com', '2026-11-27T13:00:00Z'),
  ], {});
  assert.equal(result.find(item => item.field === 'email')?.state, 'empty');
});

test('B16 older explicit value revocation does not block later reaffirmation', () => {
  const result = proposeCrmConversationProfileFields([
    msg('revoke', 'customer', 'E-mail: ana@example.com não é meu' + String.fromCharCode(10) + 'CEP: 88220-000, desconsiderar', '2026-11-27T10:00:00Z'),
    msg('reconfirm', 'customer', 'Meu e-mail é ana@example.com' + String.fromCharCode(10) + 'CEP: 88220-000', '2026-11-27T13:00:00Z'),
  ], {});
  assert.equal(result.find(item => item.field === 'email')?.state, 'empty');
  assert.equal(result.find(item => item.field === 'zip_code')?.state, 'empty');
});

test('B16 later explicit value revocation still blocks earlier labelled data regardless of input order', () => {
  const result = proposeCrmConversationProfileFields([
    msg('denied', 'customer', 'E-mail: ana@example.com não é meu', '2026-11-27T14:00:00Z'),
    msg('old', 'customer', 'Meu e-mail é ana@example.com', '2026-11-27T12:00:00Z'),
  ], {});
  assert.equal(result.find(item => item.field === 'email')?.state, 'ambiguous');
});

test('B16 newer free-text hint after prior revocation remains review-only', () => {
  const result = proposeCrmConversationProfileFields([
    msg('old', 'customer', 'Use livre@example.com', '2026-11-27T11:00:00Z'),
    msg('deny', 'customer', 'E-mail: livre@example.com não é meu', '2026-11-27T12:00:00Z'),
    msg('new', 'customer', 'Considere livre@example.com', '2026-11-27T13:00:00Z'),
  ], {});
  const email = result.find(item => item.field === 'email');
  assert.equal(email?.state, 'unverified');
  assert.equal(email?.value, 'livre@example.com');
  assert.equal(email?.distinctValues, 1);
});

test('B17 quoted reply tail is excluded while direct customer preface remains', () => {
  const result = proposeCrmConversationProfileFields([
    msg('reply', 'customer', ['Meu e-mail é titular@example.com', 'Em 28 nov 2026, Fulano escreveu:', 'E-mail: terceiro@example.com', 'CEP: 88220-000'].join(String.fromCharCode(10))),
  ], {});
  assert.equal(result.length, 1);
  assert.equal(result[0].field, 'email');
  assert.equal(result[0].value, 'titular@example.com');
  assert.equal(result[0].state, 'empty');
});

test('B17 quoted original message and English reply headers do not create evidence', () => {
  const result = proposeCrmConversationProfileFields([
    msg('original', 'customer', ['On Nov 27, Person wrote:', 'E-mail: outro@example.com'].join(String.fromCharCode(10))),
    msg('marker', 'customer', ['--- Mensagem original ---', 'Meu nome é Pessoa Terceira'].join(String.fromCharCode(10))),
    msg('quote', 'customer', '> E-mail: citado@example.com' + String.fromCharCode(10) + '“CEP: 88220-000”'),
  ], {});
  assert.equal(result.length, 0);
});

test('B17 standalone customer declaration without reply header continues to work', () => {
  const result = proposeCrmConversationProfileFields([
    msg('plain', 'customer', 'E-mail: cliente@example.com' + String.fromCharCode(10) + 'Cidade: Itapema'),
  ], {});
  assert.equal(result.find(item => item.field === 'email')?.state, 'empty');
  assert.equal(result.find(item => item.field === 'city')?.value, 'Itapema');
});

test('B18 refuses to propose any field from a partially read long message', () => {
  const oversized = 'Meu e-mail é indevido@example.com' + 'x'.repeat(4000)
    + String.fromCharCode(10) + 'E-mail: outro@example.com';
  const result = proposeCrmConversationProfileFields([
    msg('long', 'customer', oversized),
    msg('short', 'customer', 'Meu nome é Ana Cliente'),
  ], {});
  assert.equal(result.find(item => item.field === 'email'), undefined);
  assert.equal(result.find(item => item.field === 'name')?.value, 'Ana Cliente');
});

test('B18 bounded messages still work but oversized history blocks all writes at UI gate', () => {
  const withinLimit = 'Meu e-mail é teste@example.com' + ' '.repeat(3900);
  const fields = proposeCrmConversationProfileFields([msg('bounded', 'customer', withinLimit)], {});
  assert.equal(fields.find(item => item.field === 'email')?.state, 'empty');
  const panel = readFileSync('src/components/crm/ConversationProfileSuggestions.tsx', 'utf8');
  assert.match(panel, /oversizedMessageCount > 0 \|\| !analyzedHistoryRef\.current/);
  assert.match(panel, /disabled=\{item\.state !== 'empty' \|\| scanLimitReached \|\| oversizedMessageCount > 0/);
  assert.match(panel, /análise integral indisponível e preenchimento bloqueado/);
  assert.match(panel, /message\.content\?\.length \?\? 0/);
});
