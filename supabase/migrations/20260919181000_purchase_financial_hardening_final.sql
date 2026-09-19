-- FRENTE 02D — hardening final pós-validação técnica.
-- Fecha bypasses residuais sem alterar fatos operacionais existentes.

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
  v_item_count integer;
  v_cancel_authorized boolean;
begin
  if new.status = old.status then
    return new;
  end if;

  v_cancel_authorized := coalesce(current_setting('app.purchase_cancel_authorized', true), '') = '1';

  -- Máquina de estados canônica.
  if old.status = 'rascunho' and new.status not in ('confirmado','cancelado') then
    raise exception 'Compra em rascunho deve ser confirmada pela rotina financeira antes de avançar.';
  elsif old.status = 'confirmado' and new.status not in ('em_transito','parcialmente_recebido','recebido','cancelado') then
    raise exception 'Transição inválida para compra confirmada.';
  elsif old.status = 'em_transito' and new.status not in ('parcialmente_recebido','recebido','cancelado') then
    raise exception 'Transição inválida para compra em trânsito.';
  elsif old.status = 'parcialmente_recebido' and new.status <> 'recebido' then
    raise exception 'Compra parcialmente recebida só pode avançar para recebido.';
  elsif old.status in ('recebido','cancelado') then
    raise exception 'Compra recebida ou cancelada não pode mudar de status.';
  end if;

  -- Confirmação comercial só existe junto das obrigações financeiras corretas.
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

  -- Estados físicos só podem refletir recebimentos já confirmados.
  if new.status in ('parcialmente_recebido','recebido') then
    select count(*) into v_item_count
      from public.purchase_order_items where purchase_order_id = new.id;

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

    if new.status = 'recebido' and (v_item_count = 0 or v_fully_received_lines <> v_item_count) then
      raise exception 'Status recebido exige recebimento comercial total confirmado.';
    end if;
  end if;

  -- Cancelamento após confirmação só pode ocorrer dentro da RPC canônica.
  if new.status = 'cancelado' and old.status <> 'rascunho' then
    if not v_cancel_authorized then
      raise exception 'Compra confirmada só pode ser cancelada pela rotina canônica de cancelamento.';
    end if;

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
    or new.ordered_at is distinct from old.ordered_at
    or new.internal_purchase_number is distinct from old.internal_purchase_number
  ) then
    raise exception 'Identidade comercial da compra é imutável após a confirmação. Regularização explícita é necessária.';
  end if;
  return new;
end;
$function$;

create or replace function public.guard_purchase_financial_entry()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_cancel_authorized boolean;
begin
  if old.purchase_order_id is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  -- Histórico financeiro de compra nunca é apagado.
  if tg_op = 'DELETE' then
    raise exception 'Obrigação financeira vinculada a compra não pode ser excluída; o histórico deve ser preservado.';
  end if;

  if new.value is distinct from old.value
     or new.due_date is distinct from old.due_date
     or new.purchase_order_id is distinct from old.purchase_order_id
     or new.purchase_installment_number is distinct from old.purchase_installment_number
     or new.type is distinct from old.type then
    raise exception 'Valor, vencimento e vínculo da obrigação da compra exigem regularização explícita.';
  end if;

  if old.lifecycle_status = 'active' and new.lifecycle_status = 'cancelled' then
    v_cancel_authorized := coalesce(current_setting('app.purchase_cancel_authorized', true), '') = '1';
    if not v_cancel_authorized then
      raise exception 'Obrigação vinculada a compra só pode ser cancelada pela rotina canônica da compra.';
    end if;
    if coalesce(old.value_paid,0) > 0 or exists (
      select 1 from public.financial_movements where entry_id = old.id
    ) then
      raise exception 'Obrigação com pagamento registrado não pode ser cancelada automaticamente.';
    end if;
  end if;

  -- Não permite reativar silenciosamente uma obrigação cancelada.
  if old.lifecycle_status = 'cancelled' and new.lifecycle_status <> old.lifecycle_status then
    raise exception 'Obrigação cancelada não pode ser reativada sem regularização explícita.';
  end if;

  return new;
end;
$function$;

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

  -- Autorização vale somente nesta transação/RPC e é exigida pelos guards.
  perform set_config('app.purchase_cancel_authorized', '1', true);

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
  'Única rotina autorizada a cancelar compra confirmada e suas obrigações sem pagamento/recebimento, preservando todo o histórico.';
