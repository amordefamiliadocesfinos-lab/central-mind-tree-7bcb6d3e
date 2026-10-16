import type { Contact } from '@/hooks/useContacts';
import {
  buildContactProfilePatch, getContactPatchConflicts,
  isCrmNextActionChanged,
} from './contactEditContract';

function check(ok: unknown, message: string) {
  if (!ok) throw new Error('CRM UX02 contactEditContract: ' + message);
}
const base = {
  id: 'contact-a', name: 'Ana', city: 'Porto Alegre',
  notes: 'Cadastro', commercial_opt_out: true,
  next_action_text: 'Ligar', next_action_date: '2026-10-17T12:00:00Z',
  next_contact_date: '2026-10-17T12:00:00Z',
  sales_channels: [{ platform_id: 'whatsapp', added_at: '2026-01-01' }],
} as Contact;

const patch = buildContactProfilePatch(base, {
  name: 'Ana', city: 'Cachoeirinha', notes: 'Cadastro',
});
check(Object.keys(patch).length === 1 && patch.city === 'Cachoeirinha',
  'apenas a diferença deve ser escrita');

const fullUnchanged = buildContactProfilePatch(base, { ...base });
check(Object.keys(fullUnchanged).length === 0,
  'formulário carregado sem alterações não deve gravar nada');

const empty = buildContactProfilePatch(base, { notes: '' });
check(empty.notes === '', 'limpar observações deve ser alteração explícita');

for (const forbidden of [
  { next_action_date: '2026-10-19T12:00:00Z' },
  { commercial_opt_out: false },
  { funnel_status: 'fechado' },
  { id: 'contact-b' },
  { paid_orders_count: 20 },
]) {
  let rejected = false;
  try { buildContactProfilePatch(base, forbidden as Partial<Contact>); }
  catch { rejected = true; }
  check(rejected, 'campo operacional/derivado não pode usar writer cadastral');
}

check(getContactPatchConflicts(base, { ...base, notes: 'Atualizado externamente' }, patch).length === 0,
  'alteração externa em campo independente não deve sobrescrever outra edição');

const conflict = getContactPatchConflicts(
  base, { ...base, city: 'Gravataí' }, patch,
);
check(conflict.length === 1 && conflict[0] === 'city',
  'concorrência no mesmo campo deve ser detectada');

check(getContactPatchConflicts(base, { ...base, city: 'Cachoeirinha' }, patch).length === 0,
  'valor desejado já persistido não é conflito');

check(!isCrmNextActionChanged(base, { title: 'Ligar', dueAt: base.next_action_date! }),
  'mesma Próxima Ação não deve ser regravada');

check(isCrmNextActionChanged(base, { title: 'Retornar', dueAt: base.next_action_date! }),
  'mudança de título deve ser reconhecida');

check(isCrmNextActionChanged(base, { title: null, dueAt: null }),
  'cancelamento explícito da próxima ação deve ser reconhecido');
