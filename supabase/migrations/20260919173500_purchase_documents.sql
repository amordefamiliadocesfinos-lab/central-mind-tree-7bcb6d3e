-- FRENTE 01D — documentos/evidências de compras e recebimentos.
-- Reutiliza o bucket privado order-documents, separando semanticamente os metadados
-- de documentos de venda e de compra.

create table if not exists public.purchase_documents (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  purchase_receipt_id uuid null references public.purchase_receipts(id) on delete set null,
  document_type text not null default 'other',
  file_name text not null,
  source text not null default 'manual',
  storage_bucket text not null default 'order-documents',
  storage_path text not null,
  mime_type text null,
  file_size bigint null,
  notes text null,
  uploaded_by uuid null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint purchase_documents_document_type_check
    check (document_type in ('invoice','xml','pdf','image','receipt','shipping','other')),
  constraint purchase_documents_file_size_check
    check (file_size is null or file_size >= 0),
  constraint purchase_documents_storage_path_unique unique (storage_bucket, storage_path)
);

create index if not exists purchase_documents_purchase_order_idx
  on public.purchase_documents(purchase_order_id, created_at desc);

create index if not exists purchase_documents_purchase_receipt_idx
  on public.purchase_documents(purchase_receipt_id)
  where purchase_receipt_id is not null;

create or replace function public.validate_purchase_document_receipt_link()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_receipt_purchase_order_id uuid;
begin
  if new.purchase_receipt_id is null then
    return new;
  end if;

  select purchase_order_id
    into v_receipt_purchase_order_id
    from public.purchase_receipts
   where id = new.purchase_receipt_id;

  if v_receipt_purchase_order_id is null then
    raise exception 'Recebimento informado não existe.';
  end if;

  if v_receipt_purchase_order_id <> new.purchase_order_id then
    raise exception 'O documento não pode vincular um recebimento de outra compra.';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_validate_purchase_document_receipt_link on public.purchase_documents;
create trigger trg_validate_purchase_document_receipt_link
before insert or update of purchase_order_id, purchase_receipt_id
on public.purchase_documents
for each row
execute function public.validate_purchase_document_receipt_link();

alter table public.purchase_documents enable row level security;

drop policy if exists "Authenticated users manage purchase documents" on public.purchase_documents;
create policy "Authenticated users manage purchase documents"
on public.purchase_documents
for all
to authenticated
using (true)
with check (true);

comment on table public.purchase_documents is
  'Documentos e evidências de compras, vinculados obrigatoriamente ao Pedido de Compra e opcionalmente a um recebimento da mesma compra.';
comment on column public.purchase_documents.purchase_receipt_id is
  'Vínculo opcional ao recebimento físico específico; trigger garante que pertence ao mesmo Pedido de Compra.';
