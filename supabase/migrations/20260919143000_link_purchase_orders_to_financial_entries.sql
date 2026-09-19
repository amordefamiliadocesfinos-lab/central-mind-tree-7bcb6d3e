-- Frente 02A — vínculo canônico Compra -> Financeiro.
--
-- Esta migration é estritamente aditiva: não cria obrigações financeiras,
-- não altera dados existentes e não muda o fluxo de confirmação de compras.
-- A geração das obrigações pertence às etapas 02B/02C.

alter table public.financial_entries
  add column purchase_order_id uuid,
  add column purchase_installment_number integer;

-- Preserva o histórico comercial: uma compra que já possua obrigação vinculada
-- não pode ser apagada fisicamente enquanto o vínculo financeiro existir.
alter table public.financial_entries
  add constraint financial_entries_purchase_order_id_fkey
  foreign key (purchase_order_id)
  references public.purchase_orders(id)
  on delete restrict;

-- Toda obrigação originada de compra deve ser uma conta a pagar.
alter table public.financial_entries
  add constraint financial_entries_purchase_order_type_check
  check (purchase_order_id is null or type = 'pagar');

-- O número da parcela só existe quando há compra de origem e deve começar em 1.
alter table public.financial_entries
  add constraint financial_entries_purchase_installment_check
  check (
    (purchase_order_id is null and purchase_installment_number is null)
    or (
      purchase_order_id is not null
      and purchase_installment_number is not null
      and purchase_installment_number > 0
    )
  );

-- Acelera rastreabilidade Compra -> obrigações financeiras.
create index idx_financial_entries_purchase_order
  on public.financial_entries (purchase_order_id)
  where purchase_order_id is not null;

-- Idempotência canônica por compra + parcela.
-- Permite 1:N obrigações por compra, mas impede criar a mesma parcela duas vezes.
create unique index uq_financial_entries_purchase_installment
  on public.financial_entries (purchase_order_id, purchase_installment_number)
  where purchase_order_id is not null;

comment on column public.financial_entries.purchase_order_id is
  'Pedido de Compra que originou esta obrigação financeira. Nulo para lançamentos sem origem em Compras.';

comment on column public.financial_entries.purchase_installment_number is
  'Número estável da parcela dentro da compra de origem, iniciando em 1.';