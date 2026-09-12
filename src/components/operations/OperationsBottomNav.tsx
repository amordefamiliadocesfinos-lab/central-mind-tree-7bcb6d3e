import { Button } from '@/components/ui/button';
import { ShoppingCart, Package, Boxes, Factory, Calendar, LayoutGrid, BarChart3, ClipboardCheck, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

export type OperationsTab = 'overview' | 'orders' | 'purchases' | 'separation' | 'products' | 'inventory' | 'production' | 'mrp' | 'calendar';

interface OperationsBottomNavProps {
  activeTab: OperationsTab;
  onTabChange: (tab: OperationsTab) => void;
}

const tabs: { id: OperationsTab; label: string; shortLabel: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Geral', shortLabel: 'Geral', icon: LayoutGrid },
  { id: 'orders', label: 'Pedidos', shortLabel: 'Pedidos', icon: ShoppingCart },
  { id: 'purchases', label: 'Compras', shortLabel: 'Compras', icon: Truck },
  { id: 'separation', label: 'Separação', shortLabel: 'Separar', icon: ClipboardCheck },
  { id: 'products', label: 'Produtos', shortLabel: 'Prod.', icon: Package },
  { id: 'inventory', label: 'Estoque', shortLabel: 'Estoq.', icon: Boxes },
  { id: 'production', label: 'Produção', shortLabel: 'Prod.', icon: Factory },
  { id: 'mrp', label: 'MRP', shortLabel: 'MRP', icon: BarChart3 },
  { id: 'calendar', label: 'Agenda', shortLabel: 'Agenda', icon: Calendar },
];

export function OperationsBottomNav({ activeTab, onTabChange }: OperationsBottomNavProps) {
  const isMobile = useIsMobile();
  
  // On mobile, show only 5 tabs (hide MRP and merge with production)
  const visibleTabs = isMobile 
    ? tabs.filter(t => t.id !== 'mrp') 
    : tabs;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
      {/* Safe area padding for iOS */}
      <div 
        className="flex justify-around items-center px-1"
        style={{ 
          height: 'calc(4rem + env(safe-area-inset-bottom, 0px))',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)'
        }}
      >
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-14 py-1 px-0.5 transition-colors touch-manipulation",
                "active:bg-accent/50 rounded-lg min-w-0",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />
              <span className={cn(
                "text-[10px] xs:text-xs font-medium leading-tight mt-0.5 truncate max-w-full px-0.5",
                isActive && "text-primary font-semibold"
              )}>
                {isMobile ? tab.shortLabel : tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
