import { supabase } from '@/integrations/supabase/client';

const LOGISTICS_MARKER = 'FIN-F17:order-logistics';
const CANONICAL_CATEGORY = 'Fretes / Logística';

export type OrderLogisticsExpenseStatus = 'pago' | 'pendente';

export interface OrderLogisticsExpenseInput {
  orderId: string;
  orderNumber?: string | null;
  amount: number;
  status: OrderLogisticsExpenseStatus;
  accountId?: string | null;
  paymentDate?: string | null;
  dueDate?: string | null;
  providerLabel?: string | null;
}

async function ensureLogisticsCategory() {
  const { data: existing, error } = await supabase
    .from('financial_categories')
    .select('id,name,type')
    .eq('is_active', true)
    .in('type', ['pagar', 'ambos'])
    .order('name');

  if (error) throw error;

  const aliases = new Set([
    'fretes / logística',
    'fretes/logística',
    'fretes',
    'logística',
    'logistica',
    'transporte',
  ]);

  const match = (existing || []).find((category) =>
    aliases.has(String(category.name || '').trim().toLocaleLowerCase('pt-BR')),
  );
  if (match) return match.id;

  const { data: created, error: createError } = await supabase
    .from('financial_categories')
    .insert({
      name: CANONICAL_CATEGORY,
      type: 'pagar',
      is_active: true,
      color: '#f97316',
    })
    .select('id')
    .single();

  if (createError) throw createError;
  return created.id;
}

export async function upsertOrderLogisticsExpense(input: OrderLogisticsExpenseInput) {
  const amount = Number(input.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Informe um custo de frete maior que zero.');
  }
  if (input.status === 'pago' && !input.accountId) {
    throw new Error('Selecione a conta que pagou o frete.');
  }

  const categoryId = await ensureLogisticsCategory();
  const today = new Date().toISOString().slice(0, 10);
  const dueDate = input.status === 'pago'
    ? (input.paymentDate || today)
    : (input.dueDate || today);
  const provider = input.providerLabel?.trim();
  const description = `Frete Pedido ${input.orderNumber || input.orderId.slice(0, 8)}${provider ? ` — ${provider}` : ''}`;
  const notes = `${LOGISTICS_MARKER} · custo logístico real vinculado ao Pedido`;

  const { data: existing, error: existingError } = await supabase
    .from('financial_entries')
    .select('id,value,value_paid,account_id,payment_date')
    .eq('order_id', input.orderId)
    .eq('type', 'pagar')
    .ilike('notes', `%${LOGISTICS_MARKER}%`)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;

  let entryId = existing?.id as string | undefined;

  if (existing) {
    if (Number(existing.value_paid || 0) > 0 && Math.abs(Number(existing.value) - amount) > 0.005) {
      throw new Error('O custo logístico deste Pedido já possui pagamento e não pode ter o valor alterado automaticamente.');
    }

    if (Number(existing.value_paid || 0) === 0) {
      const { error: updateError } = await supabase
        .from('financial_entries')
        .update({
          description,
          value: amount,
          due_date: dueDate,
          original_due_date: dueDate,
          competence_date: dueDate,
          category_id: categoryId,
          account_id: input.status === 'pago' ? input.accountId : null,
          notes,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', existing.id);
      if (updateError) throw updateError;
    }
  } else {
    const { data: created, error: createError } = await supabase
      .from('financial_entries')
      .insert({
        type: 'pagar',
        description,
        value: amount,
        due_date: dueDate,
        original_due_date: dueDate,
        competence_date: dueDate,
        order_id: input.orderId,
        category_id: categoryId,
        account_id: input.status === 'pago' ? input.accountId : null,
        notes,
      } as any)
      .select('id')
      .single();

    if (createError) throw createError;
    entryId = created.id;
  }

  if (!entryId || input.status !== 'pago') {
    return { entryId, movementCreated: false };
  }

  const { data: movement, error: movementLookupError } = await supabase
    .from('financial_movements')
    .select('id')
    .eq('entry_id', entryId)
    .limit(1)
    .maybeSingle();

  if (movementLookupError) throw movementLookupError;
  if (movement) return { entryId, movementCreated: false };

  const { error: movementError } = await supabase
    .from('financial_movements')
    .insert({
      entry_id: entryId,
      account_id: input.accountId,
      value: amount,
      movement_date: input.paymentDate || today,
      notes: `${LOGISTICS_MARKER} · pagamento do custo logístico`,
    });
  if (movementError) throw movementError;

  return { entryId, movementCreated: true };
}

export const ORDER_LOGISTICS_EXPENSE_MARKER = LOGISTICS_MARKER;
