import { ShoppingCart, Factory, Boxes, Package, LayoutGrid, ClipboardCheck, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OperationsTab } from "@/components/operations/OperationsBottomNav";

const TOP_TABS: { id: OperationsTab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Visão Geral", icon: LayoutGrid },
  { id: "orders", label: "Pedidos", icon: ShoppingCart },
  { id: "purchases", label: "Compras", icon: Truck },
  { id: "separation", label: "Separação", icon: ClipboardCheck },
  { id: "production", label: "Produção", icon: Factory },
  { id: "mrp", label: "MRP", icon: Boxes },
  { id: "inventory", label: "Estoque", icon: Boxes },
  { id: "products", label: "Produtos", icon: Package },
];

interface OperationsTopTabsProps {
  activeTab: OperationsTab;
  onTabChange: (tab: OperationsTab) => void;
}

export function OperationsTopTabs({ activeTab, onTabChange }: OperationsTopTabsProps) {
  return (
    <nav aria-label="Seções de operações" className="w-full">
      <div className="rounded-xl border bg-card/50 p-1">
        {/* Mobile: scroll horizontal com snap */}
        <div className="sm:hidden flex gap-1 overflow-x-auto tab-strip-scroll [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {TOP_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "snap-start shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                <span className="text-xs whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </div>
        {/* Desktop: grid */}
        <div className="hidden sm:grid grid-cols-8 gap-1">
          {TOP_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
