-- Frente 02C — confirmação comercial + geração idempotente de obrigações.
--
-- Cria uma única operação transacional para:
-- 1) validar a compra em rascunho;
-- 2) recalcular o total comercial no banco;
-- 3) validar 1..N parcelas;
-- 4) criar financial_entries vinculadas à compra;
-- 5) confirmar a compra somente após a criação das obrigações.
--
-- Não registra pagamento, não cria financial_movements e não depende de recebimento físico.

create or replace function public.confirm_purchase_with_financial_entries(
  p_purchase_order_id uuid,
  p_installments jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_purchase public.purchase_orders%rowtype;
  v_supplier_name text;
  v_total numeric(20,2);
  v_installments_total numeric(20,2);
  v_installment_count integer;
  v_distinct_installment_count integer;
  v_min_installment integer;
  v_max_installment integer;
  v_existing_count integer;
  v_entry_ids jsonb;
begin
  if auth.uid() is null then
    raise exception 'Usuário autenticado é obrigatório para confirmar a compra.';
  end if;

  if p_installments is null or jsonb_typeof(p_installments) <> 'array' or jsonb_array_length(p_installments) = 0 then
    raise exception 'Informe ao menos uma parcela financeira.';
  end if;

  select *
    into v_purchase
    from public.purchase_orders
   where id = p_purchase_order_id
   for update;

  if not found then
    raise exception 'Pedido de compra não encontrado.';
  end if;

  -- Retry seguro: se a operação já concluiu, não duplica obrigações.
  if v_purchase.status = 'confirmado' then
    select count(*)
      into v_existing_count
      from public.financial_entries
     where purchase_order_id = p_purchase_order_id
       and type = 'pagar';

    if v_existing_count > 0 then
      select coalesce(jsonb_agg(id order by purchase_installment_number), '[]'::jsonb)
        into v_entry_ids
        from public.financial_entries
       where purchase_order_id = p_purchase_order_id
         and type = 'pagar';

      return jsonb_build_object(
        'purchase_order_id', p_purchase_order_id,
        'status', 'confirmado',
        'already_confirmed', true,
        'financial_entry_ids', v_entry_ids
      );
    end if;

    raise exception 'Compra já confirmada sem obrigações financeiras vinculadas. Regularização manual necessária.';
  end if;

  if v_purchase.status <> 'rascunho' then
    raise exception 'Somente compras em rascunho podem gerar obrigações financeiras.';
  end if;

  if not exists (
    select 1 from public.purchase_order_items where purchase_order_id = p_purchase_order_id
  ) then
    raise exception 'A compra precisa ter ao menos um item antes da confirmação.';
  end if;

  if exists (
    select 1
      from public.purchase_order_items
     where purchase_order_id = p_purchase_order_id
       and unit_price is null
  ) then
    raise exception 'Todos os itens da compra precisam ter preço comercial antes da confirmação.';
  end if;

  select round(
           coalesce(sum(ordered_purchase_qty * unit_price), 0)
           + coalesce(v_purchase.freight_amount, 0),
           2
         )
    into v_total
    from public.purchase_order_items
   where purchase_order_id = p_purchase_order_id;

  if v_total <= 0 then
    raise exception 'O total comercial da compra deve ser maior que zero.';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_installments) as installment
     where (installment->>'installment_number') is null
        or (installment->>'value') is null
        or (installment->>'due_date') is null
        or (installment->>'installment_number') !~ '^[0-9]+$'
        or (installment->>'value') !~ '^[0-9]+([.][0-9]{1,2})?$'
        or (installment->>'due_date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        or (installment->>'installment_number')::integer <= 0
        or (installment->>'value')::numeric <= 0
  ) then
    raise exception 'Parcelas inválidas. Informe número, valor positivo e vencimento válido.';
  end if;

  -- Força o cast de todas as datas antes de qualquer escrita.
  perform (installment->>'due_date')::date
    from jsonb_array_elements(p_installments) as installment;

  select
    count(*)::integer,
    count(distinct (installment->>'installment_number')::integer)::integer,
    min((installment->>'installment_number')::integer),
    max((installment->>'installment_number')::integer),
    round(sum((installment->>'value')::numeric), 2)
  into
    v_installment_count,
    v_distinct_installment_count,
    v_min_installment,
    v_max_installment,
    v_installments_total
  from jsonb_array_elements(p_installments) as installment;

  if v_distinct_installment_count <> v_installment_count
     or v_min_installment <> 1
     or v_max_installment <> v_installment_count then
    raise exception 'As parcelas devem ser numeradas sequencialmente a partir de 1, sem duplicidade.';
  end if;

  if v_installments_total <> v_total then
    raise exception 'A soma das parcelas (%) deve ser igual ao total comercial da compra (%).', v_installments_total, v_total;
  end if;

  select count(*)
    into v_existing_count
    from public.financial_entries
   where purchase_order_id = p_purchase_order_id;

  if v_existing_count > 0 then
    raise exception 'Esta compra já possui obrigações financeiras vinculadas.';
  end if;

  select name
    into v_supplier_name
    from public.contacts
   where id = v_purchase.supplier_contact_id;

  with inserted as (
    insert into public.financial_entries (
      type,
      description,
      value,
      due_date,
      contact_id,
      document_number,
      notes,
      purchase_order_id,
      purchase_installment_number
    )
    select
      'pagar',
      format(
        'Compra %s — %s · Parcela %s/%s',
        coalesce(v_purchase.internal_purchase_number, left(v_purchase.id::text, 8)),
        coalesce(v_supplier_name, 'Fornecedor'),
        (installment->>'installment_number')::integer,
        v_installment_count
      ),
      round((installment->>'value')::numeric, 2),
      (installment->>'due_date')::date,
      v_purchase.supplier_contact_id,
      v_purchase.internal_purchase_number,
      'Gerado automaticamente na confirmação comercial da compra.',
      p_purchase_order_id,
      (installment->>'installment_number')::integer
    from jsonb_array_elements(p_installments) as installment
    order by (installment->>'installment_number')::integer
    returning id, purchase_installment_number
  )
  select coalesce(jsonb_agg(id order by purchase_installment_number), '[]'::jsonb)
    into v_entry_ids
    from inserted;

  update public.purchase_orders
     set status = 'confirmado',
         ordered_at = coalesce(ordered_at, now()),
         updated_at = now()
   where id = p_purchase_order_id;

  return jsonb_build_object(
    'purchase_order_id', p_purchase_order_id,
    'status', 'confirmado',
    'already_confirmed', false,
    'commercial_total', v_total,
    'financial_entry_ids', v_entry_ids
  );
end;
$function$;

revoke all on function public.confirm_purchase_with_financial_entries(uuid, jsonb) from public;
revoke all on function public.confirm_purchase_with_financial_entries(uuid, jsonb) from anon;
grant execute on function public.confirm_purchase_with_financial_entries(uuid, jsonb) to authenticated;

comment on function public.confirm_purchase_with_financial_entries(uuid, jsonb) is
  'Confirma uma compra em rascunho e cria atomicamente suas obrigações financeiras parceladas, sem depender de recebimento físico ou pagamento.';
