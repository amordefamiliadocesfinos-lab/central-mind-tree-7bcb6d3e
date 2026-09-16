import { useMemo, useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors, useDroppable, useDraggable, closestCenter } from '@dnd-kit/core';
import { parseISO, format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ProductionOrder, PRODUCTION_ORDER_STATUS } from '@/hooks/useProductionOrders';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Package, PackagePlus, Factory, GripVertical, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPhysicalIdentityUnit } from '@/lib/productVariants';

interface Props {
  orders: ProductionOrder[];
  calculateConsolidation: (o: ProductionOrder) => number;
  onSelectOrder: (o: ProductionOrder) => void;
  onRefresh: () => void;
}

const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function getOrderDate(o: ProductionOrder): Date {
  if (o.scheduled_date) return parseISO(o.scheduled_date);
  if (o.source_order?.due_date) return parseISO(o.source_order.due_date);
  return parseISO(o.created_at);
}

function MiniCard({ order, calculateConsolidation, onClick, dragHandleProps }: {
  order: ProductionOrder;
  calculateConsolidation: (o: ProductionOrder) => number;
  onClick: () => void;
  dragHandleProps?: any;
}) {
  const statusConfig = PRODUCTION_ORDER_STATUS[order.status as keyof typeof PRODUCTION_ORDER_STATUS];
  const isForStock = !order.source_order_id;
  const consolidated = calculateConsolidation(order);
  const unit = getPhysicalIdentityUnit(order.product, order.variant);

  return (
    <Card
      onClick={onClick}
      className={cn(
        'cursor-pointer hover:bg-muted/50 transition-colors border-l-4 mb-2',
        isForStock ? 'border-l-emerald-500' : 'border-l-amber-500'
      )}
    >
      <CardContent className="p-2.5">
        <div className="flex items-start gap-1.5">
          <button {...dragHandleProps} className="touch-none shrink-0 pt-0.5 text-muted-foreground" onClick={(e) => e.stopPropagation()}>
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-[10px] font-semibold text-primary tabular-nums">
              {order.internal_production_number || order.order_number || 'OP'}
            </p>
            <div className="flex items-center gap-1 text-xs font-semibold truncate">
              {isForStock ? (
                <><PackagePlus className="h-3 w-3 text-emerald-600 shrink-0" /><span className="truncate">Para Estoque</span></>
              ) : (
                <span className="truncate">{order.source_order?.customer_name || order.product?.name || 'Sem cliente'}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge className={cn('text-[9px] py-0 h-4 text-white', statusConfig?.color)}>
                {statusConfig?.label}
              </Badge>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {consolidated}/{order.target_quantity} {unit}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Package className="h-3 w-3 shrink-0" />
              <span className="truncate">
                <span className="font-medium text-foreground">{order.target_quantity} {unit}</span> {order.product?.name || '—'}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DraggableCard(props: Parameters<typeof MiniCard>[0] & { id: string; disabled?: boolean }) {
  const { id, disabled, ...rest } = props;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, disabled });
  return (
    <div ref={setNodeRef} style={{ opacity: isDragging ? 0.4 : 1 }}>
      <MiniCard {...rest} dragHandleProps={disabled ? undefined : { ...attributes, ...listeners }} />
    </div>
  );
}

function DayColumn({ dayId, date, orders, calculateConsolidation, onSelectOrder, isToday }: {
  dayId: string;
  date: Date;
  orders: ProductionOrder[];
  calculateConsolidation: (o: ProductionOrder) => number;
  onSelectOrder: (o: ProductionOrder) => void;
  isToday: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayId });
  const weekdayIdx = (date.getDay() + 6) % 7;

  return (
    <div ref={setNodeRef} className={cn(
      'flex-shrink-0 w-64 rounded-lg border bg-card transition-colors',
      isOver && 'ring-2 ring-primary bg-primary/5',
      isToday && 'border-primary'
    )}>
      <div className={cn(
        'p-2 border-b flex items-center justify-between sticky top-0 bg-card rounded-t-lg',
        isToday && 'bg-primary/10'
      )}>
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase">{WEEKDAY_LABELS[weekdayIdx]}</span>
          <span className="text-[10px] text-muted-foreground">{format(date, "dd 'de' MMM", { locale: ptBR })}</span>
        </div>
        <Badge variant="secondary" className="text-[10px]">{orders.length}</Badge>
      </div>
      <div className="p-2 min-h-[200px] max-h-[calc(100vh-340px)] overflow-y-auto">
        {orders.length === 0 ? (
          <div className="text-center text-[11px] text-muted-foreground py-6">
            Arraste OPs aqui
          </div>
        ) : (
          orders.map(o => (
            <DraggableCard
              key={o.id}
              id={o.id}
              order={o}
              calculateConsolidation={calculateConsolidation}
              onClick={() => onSelectOrder(o)}
              disabled={false}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function ProductionWeekView({ orders, calculateConsolidation, onSelectOrder, onRefresh }: Props) {
  const [weekAnchor, setWeekAnchor] = useState<Date>(new Date());
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const weekStart = useMemo(() => startOfWeek(weekAnchor, { weekStartsOn: 1 }), [weekAnchor]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const ordersByDay = useMemo(() => {
    const map: Record<string, ProductionOrder[]> = {};
    days.forEach(d => { map[format(d, 'yyyy-MM-dd')] = []; });
    const unscheduled: ProductionOrder[] = [];
    orders.forEach(o => {
      const d = getOrderDate(o);
      const key = format(d, 'yyyy-MM-dd');
      if (map[key]) map[key].push(o);
      else unscheduled.push(o);
    });
    return { map, unscheduled };
  }, [orders, days]);

  const activeOrder = activeId ? orders.find(o => o.id === activeId) : null;

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const order = orders.find(o => o.id === active.id);
    if (!order) return;

    const targetDateKey = over.id as string;
    const currentDate = getOrderDate(order);
    if (format(currentDate, 'yyyy-MM-dd') === targetDateKey) return;

    // Always persist on the production order itself (works for stock + customer OPs)
    const { error: opError } = await supabase
      .from('production_orders')
      .update({ scheduled_date: targetDateKey })
      .eq('id', order.id);

    if (opError) {
      toast.error('Erro ao reagendar OP');
      return;
    }

    toast.success(`Movido para ${format(parseISO(targetDateKey), "dd/MM (EEE)", { locale: ptBR })}`);
    onRefresh();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {format(weekStart, 'dd MMM', { locale: ptBR })} – {format(addDays(weekStart, 6), 'dd MMM yyyy', { locale: ptBR })}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => setWeekAnchor(subWeeks(weekAnchor, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setWeekAnchor(new Date())}>
            Hoje
          </Button>
          <Button size="sm" variant="outline" onClick={() => setWeekAnchor(addWeeks(weekAnchor, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(e) => setActiveId(e.active.id as string)}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4">
          {days.map(d => {
            const key = format(d, 'yyyy-MM-dd');
            return (
              <DayColumn
                key={key}
                dayId={key}
                date={d}
                orders={ordersByDay.map[key] || []}
                calculateConsolidation={calculateConsolidation}
                onSelectOrder={onSelectOrder}
                isToday={isSameDay(d, new Date())}
              />
            );
          })}
        </div>

        {ordersByDay.unscheduled.length > 0 && (
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Factory className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                Fora desta semana ({ordersByDay.unscheduled.length})
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {ordersByDay.unscheduled.slice(0, 6).map(o => (
                <MiniCard
                  key={o.id}
                  order={o}
                  calculateConsolidation={calculateConsolidation}
                  onClick={() => onSelectOrder(o)}
                />
              ))}
            </div>
          </div>
        )}

        <DragOverlay>
          {activeOrder && (
            <div className="opacity-90 rotate-2 w-64">
              <MiniCard order={activeOrder} calculateConsolidation={calculateConsolidation} onClick={() => {}} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
