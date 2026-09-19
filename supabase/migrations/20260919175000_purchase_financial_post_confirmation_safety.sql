-- FRENTE 02D — segurança pós-confirmação Compra ↔ Financeiro.
-- Fecha bypass de confirmação, imutabilidade comercial, cancelamento auditável
-- e proteção contra pagamento de obrigação cancelada.

alter table public.financial_entries
  add column if not exists lifecycle_status text not null default 'active',
  add column if not exists cancelled_at timestamptz null,
  add column if not exists cancelled_reason text null;

alter table public.financial_entries
  drop constraint if exists financial_entries_lifecycle_status_check;
alter table public.financial_entries
  add constraint financial_entries_lifecycle_status_check
  check (lifecycle_status in ('active','cancelled'));

alter table public.financial_entries
  drop constraint if exists financial_entries_cancellation_consistency_check;
alter table public.financial_entries
  add constraint financial_entries_cancellation_consistency_check
  check (
    (lifecycle_status = 'active' and cancelled_at is null)
    or
    (lifecycle_status = 'cancelled' and cancelled_at is not null)
  );

-- Mantém obrigações canceladas no histórico do banco, mas fora da operação financeira normal.
drop policy if exists "Allow all on financial_entries" on public.financial_entries;
drop policy if exists "Active financial entries are readable" on public.financial_entries;
drop policy if exists "Financial entries can be inserted" on public.financial_entries;
drop policy if exists "Financial entries can be updated" on public.financial_entries;
drop policy if exists "Financial entries can be deleted" on public.financial_entries;

create policy "Active financial entries are readable"
on public.financial_entries for select to public
using (lifecycle_status = 'active');

create policy "Financial entries can be inserted"
on public.financial_entries for insert to public
with check (true);

create policy "Financial entries can be updated"
on public.financial_entries for update to public
using (true) with check (true);

create policy "Financial entries can be deleted"
on public.financial_entries for delete to public
using (true);

create or replace function public.guard_purchase_status_transition()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_total numeric(20,2);
  v_financial_total numeric(20,2);
  v_financial_count integer;
  v_received_lines integer;
  v_fully_received_lines integer;
begin
  if new.status = old.status then
    return new;
  end if;

  if old.status = 'rascunho' and new.status not in ('confirmado','cancelado') then
    raise exception 'Compra em rascunho deve ser confirmada pela rotina financeira antes de avançar.';
  end if;

  if old.status = 'rascunho' and new.status = 'confirmado' then
    select round(coalesce(sum(ordered_purchase_qty * unit_price), 0) + coalesce(new.freight_amount, 0), 2)
      into v_total
      from public.purchase_order_items
     where purchase_order_id = new.id;

    select count(*), round(coalesce(sum(value), 0), 2)
      into v_financial_count, v_financial_total
      from public.financial_entries
     where purchase_order_id = new.id
       and type = 'pagar'
       and lifecycle_status = 'active';

    if v_financial_count = 0 or v_financial_total <> v_total then
      raise exception 'Confirmação bloqueada: obrigações financeiras ativas devem existir e somar exatamente o total comercial (%).', v_total;
    end if;
  end if;

  if new.status in ('parcialmente_recebido','recebido') then
    select
      count(*) filter (where coalesce(r.received_qty,0) > 0),
      count(*) filter (where coalesce(r.received_qty,0) >= i.ordered_purchase_qty)
      into v_received_lines, v_fully_received_lines
      from public.purchase_order_items i
      left join (
        select pri.purchase_order_item_id, sum(pri.received_purchase_qty) as received_qty
          from public.purchase_receipt_items pri
          join public.purchase_receipts pr on pr.id = pri.purchase_receipt_id and pr.status = 'confirmed'
         group by pri.purchase_order_item_id
      ) r on r.purchase_order_item_id = i.id
     where i.purchase_order_id = new.id;

    if new.status = 'parcialmente_recebido' and v_received_lines = 0 then
      raise exception 'Status parcialmente recebido exige recebimento físico confirmado.';
    end if;

    if new.status = 'recebido' and (
      v_received_lines = 0
      or v_fully_received_lines <> (select count(*) from public.purchase_order_items where purchase_order_id = new.id)
    ) then
      raise exception 'Status recebido exige recebimento comercial total confirmado.';
    end if;
  end if;

  if new.status = 'cancelado' and old.status <> 'rascunho' then
    if exists (
      select 1 from public.purchase_receipts
       where purchase_order_id = new.id and status = 'confirmed'
    ) then
      raise exception 'Compra com recebimento físico confirmado exige reversão antes do cancelamento.';
    end if;

    if exists (
      select 1 from public.financial_entries
       where purchase_order_id = new.id and lifecycle_status = 'active'
    ) then
      raise exception 'Cancele as obrigações financeiras pela rotina canônica antes de cancelar a compra.';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_guard_purchase_status_transition on public.purchase_orders;
create trigger trg_guard_purchase_status_transition
before update of status on public.purchase_orders
for each row execute function public.guard_purchase_status_transition();

create or replace function public.guard_confirmed_purchase_header()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
begin
  if old.status <> 'rascunho' and (
    new.supplier_contact_id is distinct from old.supplier_contact_id
    or new.freight_amount is distinct from old.freight_amount
  ) then
    raise exception 'Fornecedor e frete são imutáveis após a confirmação. Regularização financeira explícita é necessária.';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_guard_confirmed_purchase_header on public.purchase_orders;
create trigger trg_guard_confirmed_purchase_header
before update on public.purchase_orders
for each row execute function public.guard_confirmed_purchase_header();

create or replace function public.guard_confirmed_purchase_items()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_purchase_order_id uuid;
  v_status text;
begin
  v_purchase_order_id := coalesce(new.purchase_order_id, old.purchase_order_id);
  select status into v_status from public.purchase_orders where id = v_purchase_order_id;
  if v_status is not null and v_status <> 'rascunho' then
    raise exception 'Itens comerciais da compra são imutáveis após a confirmação. Regularização explícita é necessária.';
  end if;
  return coalesce(new, old);
end;
$function$;

drop trigger if exists trg_guard_confirmed_purchase_items on public.purchase_order_items;
create trigger trg_guard_confirmed_purchase_items
before insert or update or delete on public.purchase_order_items
for each row execute function public.guard_confirmed_purchase_items();

create or replace function public.guard_purchase_financial_entry()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_purchase_status text;
begin
  if old.purchase_order_id is null then
    return coalesce(new, old);
  end if;

  select status into v_purchase_status from public.purchase_orders where id = old.purchase_order_id;

  if tg_op = 'DELETE' and v_purchase_status is distinct from 'cancelado' then
    raise exception 'Obrigação financeira vinculada a compra confirmada não pode ser excluída.';
  end if;

  if tg_op = 'UPDATE' then
    if new.value is distinct from old.value
       or new.due_date is distinct from old.due_date
       or new.purchase_order_id is distinct from old.purchase_order_id
       or new.purchase_installment_number is distinct from old.purchase_installment_number
       or new.type is distinct from old.type then
      raise exception 'Valor, vencimento e vínculo da obrigação da compra exigem regularização explícita.';
    end if;

    if old.lifecycle_status = 'active' and new.lifecycle_status = 'cancelled' then
      if coalesce(old.value_paid,0) > 0 or exists (
        select 1 from public.financial_movements where entry_id = old.id
      ) then
        raise exception 'Obrigação com pagamento registrado não pode ser cancelada automaticamente.';
      end if;
    end if;
  end if;

  return coalesce(new, old);
end;
$function$;

drop trigger if exists trg_guard_purchase_financial_entry on public.financial_entries;
create trigger trg_guard_purchase_financial_entry
before update or delete on public.financial_entries
for each row execute function public.guard_purchase_financial_entry();

create or replace function public.guard_cancelled_financial_payment()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_lifecycle text;
begin
  select lifecycle_status into v_lifecycle from public.financial_entries where id = new.entry_id;
  if v_lifecycle = 'cancelled' then
    raise exception 'Obrigação cancelada não aceita baixa financeira.';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_guard_cancelled_financial_payment on public.financial_movements;
create trigger trg_guard_cancelled_financial_payment
before insert on public.financial_movements
for each row execute function public.guard_cancelled_financial_payment();

create or replace function public.cancel_purchase_with_financial_entries(
  p_purchase_order_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_purchase public.purchase_orders%rowtype;
  v_entry_count integer;
  v_cancelled_count integer;
begin
  if auth.uid() is null then
    raise exception 'Usuário autenticado é obrigatório para cancelar a compra.';
  end if;

  select * into v_purchase
    from public.purchase_orders
   where id = p_purchase_order_id
   for update;

  if not found then
    raise exception 'Pedido de compra não encontrado.';
  end if;

  if v_purchase.status = 'cancelado' then
    return jsonb_build_object('purchase_order_id', p_purchase_order_id, 'status', 'cancelado', 'already_cancelled', true);
  end if;

  if exists (
    select 1 from public.purchase_receipts
     where purchase_order_id = p_purchase_order_id and status = 'confirmed'
  ) then
    raise exception 'Compra com recebimento físico confirmado não pode ser cancelada sem reversão de estoque.';
  end if;

  select count(*) into v_entry_count
    from public.financial_entries
   where purchase_order_id = p_purchase_order_id;

  if v_purchase.status <> 'rascunho' and v_entry_count = 0 then
    raise exception 'Compra confirmada sem obrigações financeiras vinculadas. Regularização manual necessária.';
  end if;

  if exists (
    select 1 from public.financial_entries fe
     where fe.purchase_order_id = p_purchase_order_id
       and (coalesce(fe.value_paid,0) > 0 or exists (
         select 1 from public.financial_movements fm where fm.entry_id = fe.id
       ))
  ) then
    raise exception 'Compra com pagamento parcial ou total exige regularização financeira antes do cancelamento.';
  end if;

  update public.financial_entries
     set lifecycle_status = 'cancelled',
         cancelled_at = now(),
         cancelled_reason = coalesce(nullif(trim(p_reason),''), 'Compra cancelada pela rotina canônica.'),
         updated_at = now()
   where purchase_order_id = p_purchase_order_id
     and lifecycle_status = 'active';
  get diagnostics v_cancelled_count = row_count;

  update public.purchase_orders
     set status = 'cancelado', updated_at = now()
   where id = p_purchase_order_id;

  return jsonb_build_object(
    'purchase_order_id', p_purchase_order_id,
    'status', 'cancelado',
    'already_cancelled', false,
    'cancelled_financial_entries', v_cancelled_count
  );
end;
$function$;

revoke all on function public.cancel_purchase_with_financial_entries(uuid, text) from public;
revoke all on function public.cancel_purchase_with_financial_entries(uuid, text) from anon;
grant execute on function public.cancel_purchase_with_financial_entries(uuid, text) to authenticated;

comment on function public.cancel_purchase_with_financial_entries(uuid, text) is
  'Cancela compra sem recebimento/pagamento e preserva as obrigações como canceladas; bloqueia quando há pagamento ou fato físico confirmado.';
