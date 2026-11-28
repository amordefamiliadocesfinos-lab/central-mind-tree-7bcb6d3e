import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeCrmInboxFilterSession, DEFAULT_CRM_INBOX_FILTER_SESSION } from './inboxFilterSession';

test('U4: dados inválidos ou antigos não alteram o estado operacional', () => {
  assert.deepEqual(decodeCrmInboxFilterSession(null), DEFAULT_CRM_INBOX_FILTER_SESSION);
  assert.deepEqual(decodeCrmInboxFilterSession('{invalid'), DEFAULT_CRM_INBOX_FILTER_SESSION);
  assert.deepEqual(decodeCrmInboxFilterSession('[]'), DEFAULT_CRM_INBOX_FILTER_SESSION);
  const bad = decodeCrmInboxFilterSession(JSON.stringify({
    inboxFilter: 'forced_closed', conversationScope: 'all', assignmentFilter: 'admin',
    stageFilter: 'hidden', waitingCustomerOnly: 'true',
  }));
  assert.deepEqual(bad, DEFAULT_CRM_INBOX_FILTER_SESSION);
});

test('U4: seletores suportados permanecem na sessão e não carregam busca livre', () => {
  const parsed = decodeCrmInboxFilterSession(JSON.stringify({
    inboxFilter: 'overdue', conversationScope: 'suppliers', assignmentFilter: 'assigned',
    stageFilter: 'negociacao', waitingCustomerOnly: true, search: 'nome sensível', contactId: 'privado',
  }));
  assert.deepEqual(parsed, {
    inboxFilter: 'overdue', conversationScope: 'suppliers', assignmentFilter: 'assigned',
    stageFilter: 'negociacao', waitingCustomerOnly: true,
  });
  assert.equal('search' in parsed, false);
  assert.equal('contactId' in parsed, false);
});

test('U4: tela usa sessão somente para filtros, sem redefinir writer ou prioridade', () => {
  const screen = readFileSync('src/pages/ContatosInbox.tsx', 'utf8');
  assert.match(screen, /useState\(readCrmInboxFilterSession\)/);
  assert.match(screen, /writeCrmInboxFilterSession\(\{ inboxFilter, conversationScope, assignmentFilter, stageFilter, waitingCustomerOnly \}\)/);
  assert.doesNotMatch(screen, /writeCrmInboxFilterSession\(\{[^\n]*search/);
  assert.match(screen, /getCrmPriority\(/);
});
