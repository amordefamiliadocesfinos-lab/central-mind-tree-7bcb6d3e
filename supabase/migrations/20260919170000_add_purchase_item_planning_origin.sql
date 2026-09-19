-- FRENTE 03C — Rastreabilidade mínima MRP -> Compra
-- O MRP continua sendo cálculo dinâmico. Este snapshot registra apenas a origem
-- que motivou a criação do item comercial, sem virar uma nova fonte de verdade.

alter table public.purchase_order_items
  add column if not exists planning_source text null,
  add column if not exists planning_context jsonb null;

alter table public.purchase_order_items
  drop constraint if exists purchase_order_items_planning_origin_check;

alter table public.purchase_order_items
  add constraint purchase_order_items_planning_origin_check
  check (
    (planning_source is null and planning_context is null)
    or
    (planning_source = 'mrp' and planning_context is not null)
  );

comment on column public.purchase_order_items.planning_source is
  'Origem opcional do planejamento que motivou o item. V1: mrp.';

comment on column public.purchase_order_items.planning_context is
  'Snapshot informativo da origem de planejamento; não substitui MRP, Estoque, Compras ou Recebimento como fonte canônica.';
