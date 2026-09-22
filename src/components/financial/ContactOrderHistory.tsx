import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Contact } from '@/hooks/useContacts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, parseISO, differenceInDays, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Package, 
  ShoppingCart, 
  TrendingUp, 
  Calendar, 
  Clock, 
  AlertTriangle,
  Star,
  Repeat,
  BarChart3,
  Award,
} from 'lucide-react';

interface Order {
  id: string;
  order_number: string | null;
  status: string;
  total_value: number | null;
  order_date: string;
  due_date: string | null;
  channel: string | null;
  notes: string | null;
  items: Array<{
    id: string;
    quantity: number;
    unit_price: number | null;
    product: {
      id: string;
      name: string;
      sku: string;
    } | null;
  }>;
}

interface ProductStats {
  productId: string;
  productName: string;
  sku: string;
  totalQty: number;
  totalValue: number;
  orderCount: number;
}

interface ContactOrderHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pendente: { label: 'Pendente', variant: 'secondary' },
  confirmado: { label: 'Confirmado', variant: 'default' },
  em_producao: { label: 'Em Produção', variant: 'default' },
  producao: { label: 'Em Produção', variant: 'default' },
  pronto: { label: 'Pronto', variant: 'default' },
  entregue: { label: 'Entregue', variant: 'default' },
  enviado: { label: 'Enviado', variant: 'default' },
  concluido: { label: 'Concluído', variant: 'default' },
  cancelado: { label: 'Cancelado', variant: 'destructive' },
};

type ClientClassification = 'vip' | 'ativo' | 'inativo' | 'em_risco' | 'novo';

const CLASSIFICATION_CONFIG: Record<ClientClassification, { label: string; color: string; icon: typeof Star }> = {
  vip: { label: 'VIP', color: 'bg-amber-500 text-white', icon: Award },
  ativo: { label: 'Ativo', color: 'bg-green-500 text-white', icon: TrendingUp },
  inativo: { label: 'Inativo', color: 'bg-gray-400 text-white', icon: Clock },
  em_risco: { label: 'Em Risco', color: 'bg-red-500 text-white', icon: AlertTriangle },
  novo: { label: 'Novo', color: 'bg-blue-500 text-white', icon: Star },
};

export function ContactOrderHistory({ open, onOpenChange, contact }: ContactOrderHistoryProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('resumo');
  const navigate = useNavigate();

  useEffect(() => {
    if (open && contact) {
      fetchOrders();
    }
  }, [open, contact]);

  const fetchOrders = async () => {
    if (!contact) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          total_value,
          order_date,
          due_date,
          channel,
          notes,
          order_items (
            id,
            quantity,
            unit_price,
            product:products (
              id,
              name,
              sku
            )
          )
        `)
        .eq('contact_id', contact.id)
        .is('deleted_at', null)
        .order('order_date', { ascending: false });

      if (error) {
        console.error('Error fetching orders:', error);
        return;
      }

      const ordersWithItems = (data || []).map(order => ({
        ...order,
        items: order.order_items || [],
      }));

      setOrders(ordersWithItems as unknown as Order[]);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate metrics
  const metrics = useMemo(() => {
    const now = new Date();
    const totalOrders = orders.length;
    const totalValue = orders.reduce((acc, order) => acc + (order.total_value || 0), 0);
    const avgTicket = totalOrders > 0 ? totalValue / totalOrders : 0;
    
    const lastOrder = orders[0];
    const lastOrderDate = lastOrder ? parseISO(lastOrder.order_date) : null;
    const daysSinceLastOrder = lastOrderDate ? differenceInDays(now, lastOrderDate) : null;

    // Calculate average purchase frequency (days between orders)
    let avgFrequency = 0;
    if (orders.length > 1) {
      const orderDates = orders.map(o => parseISO(o.order_date).getTime()).sort((a, b) => b - a);
      let totalDays = 0;
      for (let i = 0; i < orderDates.length - 1; i++) {
        totalDays += (orderDates[i] - orderDates[i + 1]) / (1000 * 60 * 60 * 24);
      }
      avgFrequency = Math.round(totalDays / (orderDates.length - 1));
    }

    // Orders in last 3 months
    const threeMonthsAgo = subMonths(now, 3);
    const recentOrders = orders.filter(o => parseISO(o.order_date) >= threeMonthsAgo);
    const recentOrderCount = recentOrders.length;
    const recentValue = recentOrders.reduce((acc, o) => acc + (o.total_value || 0), 0);

    // Product statistics
    const productMap = new Map<string, ProductStats>();
    orders.forEach(order => {
      order.items.forEach(item => {
        if (!item.product) return;
        const existing = productMap.get(item.product.id);
        const itemValue = (item.quantity ?? 0) * (item.unit_price || 0);
        if (existing) {
          existing.totalQty += item.quantity || 0;
          existing.totalValue += itemValue;
          existing.orderCount += 1;
        } else {
          productMap.set(item.product.id, {
            productId: item.product.id,
            productName: item.product.name,
            sku: item.product.sku,
            totalQty: item.quantity || 0,
            totalValue: itemValue,
            orderCount: 1,
          });
        }
      });
    });
    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, 5);

    // Classification logic
    let classification: ClientClassification = 'novo';
    if (totalOrders === 0) {
      classification = 'novo';
    } else if (totalOrders >= 10 || totalValue >= 10000) {
      classification = 'vip';
    } else if (daysSinceLastOrder !== null) {
      if (daysSinceLastOrder <= 30) {
        classification = 'ativo';
      } else if (daysSinceLastOrder <= 90) {
        classification = 'em_risco';
      } else {
        classification = 'inativo';
      }
    }

    return {
      totalOrders,
      totalValue,
      avgTicket,
      lastOrderDate,
      daysSinceLastOrder,
      avgFrequency,
      recentOrderCount,
      recentValue,
      topProducts,
      classification,
    };
  }, [orders]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const ClassificationIcon = CLASSIFICATION_CONFIG[metrics.classification].icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              {contact?.name}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Badge className={CLASSIFICATION_CONFIG[metrics.classification].color}>
                <ClassificationIcon className="h-3 w-3 mr-1" />
                {CLASSIFICATION_CONFIG[metrics.classification].label}
              </Badge>
              {contact && (
                <Button
                  size="sm"
                  className="gap-1 bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    const params = new URLSearchParams({
                      tab: 'orders',
                      newOrder: 'true',
                      contactId: contact.id,
                      contactName: contact.name || '',
                      contactPhone: contact.phone || contact.whatsapp || contact.mobile || '',
                      contactEmail: contact.email || '',
                      ...(contact.notes ? { contactNotes: contact.notes } : {}),
                    });
                    onOpenChange(false);
                    navigate(`/operacoes?${params.toString()}`);
                  }}
                >
                  <ShoppingCart className="h-4 w-4" />
                  Novo Pedido
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="resumo" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Resumo
            </TabsTrigger>
            <TabsTrigger value="produtos" className="gap-2">
              <Package className="h-4 w-4" />
              Produtos
            </TabsTrigger>
            <TabsTrigger value="pedidos" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Pedidos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="resumo" className="mt-4 space-y-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <Package className="h-4 w-4" />
                  Total de Pedidos
                </div>
                <div className="text-2xl font-bold">{metrics.totalOrders}</div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <TrendingUp className="h-4 w-4" />
                  Valor Total
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(metrics.totalValue)}
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <ShoppingCart className="h-4 w-4" />
                  Ticket Médio
                </div>
                <div className="text-2xl font-bold">
                  {formatCurrency(metrics.avgTicket)}
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <Repeat className="h-4 w-4" />
                  Frequência Média
                </div>
                <div className="text-2xl font-bold">
                  {metrics.avgFrequency > 0 ? `${metrics.avgFrequency} dias` : '-'}
                </div>
              </Card>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Última Compra
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data</span>
                    <span className="font-medium">
                      {metrics.lastOrderDate ? formatDate(metrics.lastOrderDate.toISOString()) : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dias sem comprar</span>
                    <span className={`font-medium ${(metrics.daysSinceLastOrder ?? 0) > 60 ? 'text-red-500' : ''}`}>
                      {metrics.daysSinceLastOrder !== null ? `${metrics.daysSinceLastOrder} dias` : '-'}
                    </span>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Últimos 3 Meses
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pedidos</span>
                    <span className="font-medium">{metrics.recentOrderCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor total</span>
                    <span className="font-medium text-green-600">
                      {formatCurrency(metrics.recentValue)}
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="produtos" className="mt-4">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Qtd. Total</TableHead>
                    <TableHead className="text-right">Pedidos</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={4}>
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : metrics.topProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Nenhum produto encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    metrics.topProducts.map((product, idx) => (
                      <TableRow key={product.productId}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {idx === 0 && <Badge className="bg-amber-500">Top</Badge>}
                            <div>
                              <div className="font-medium">{product.productName}</div>
                              <div className="text-xs text-muted-foreground">{product.sku}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {product.totalQty}
                        </TableCell>
                        <TableCell className="text-right">
                          {product.orderCount}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(product.totalValue)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="pedidos" className="mt-4">
            <Card>
              {loading ? (
                <div className="p-4 space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : orders.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum pedido encontrado para este cliente</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Itens</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">
                          {order.order_number || order.id.slice(0, 8)}
                        </TableCell>
                        <TableCell>
                          {formatDate(order.order_date)}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {order.items.slice(0, 3).map((item, idx) => (
                              <div key={idx} className="text-sm">
                                {item.quantity}x {item.product?.name || 'Produto'}
                              </div>
                            ))}
                            {order.items.length > 3 && (
                              <div className="text-xs text-muted-foreground">
                                +{order.items.length - 3} itens
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_CONFIG[order.status]?.variant || 'secondary'}>
                            {STATUS_CONFIG[order.status]?.label || order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(order.total_value || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
