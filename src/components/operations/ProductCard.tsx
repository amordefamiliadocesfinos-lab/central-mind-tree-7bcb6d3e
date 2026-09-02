import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Image, AlertTriangle, ArrowUpDown, History, Edit, Lightbulb, Plus } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { Product } from '@/hooks/useOrders';
import { useNavigate } from 'react-router-dom';
import { PlatformIcon } from '@/components/digital/PlatformsManager';
import type { LinkedIdeaSummary } from '@/hooks/useProductIdeas';
import type { Platform } from '@/hooks/usePlatforms';

interface ProductCardProps {
  product: Product;
  balance: number;
  onEdit: (product: Product) => void;
  onMovement?: (product: { id: string; name: string; balance: number }) => void;
  onHistory?: (productId: string) => void;
  showInventoryActions?: boolean;
  linkedIdeas?: LinkedIdeaSummary[];
  platformsMap?: Record<string, Platform>;
}

export function ProductCard({ 
  product, 
  balance, 
  onEdit, 
  onMovement, 
  onHistory,
  showInventoryActions = false,
  linkedIdeas = [],
  platformsMap = {},
}: ProductCardProps) {
  const navigate = useNavigate();
  const isLow = balance <= product.min_stock;
  const hasIdeas = linkedIdeas.length > 0;
  // Aggregate unique platforms across linked ideas
  const linkedPlatformIds = Array.from(
    new Set(linkedIdeas.flatMap(i => i.platforms))
  );

  const handleIdeaClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasIdeas) {
      navigate(`/digital?product_id=${product.id}`);
    } else {
      navigate(`/digital?newIdea=1&product_id=${product.id}`);
    }
  };

  return (
    <Card 
      className="touch-manipulation active:scale-[0.98] transition-transform"
      onClick={() => !showInventoryActions && onEdit(product)}
    >
      <CardContent className="p-3">
        <div className="flex gap-3">
          {product.cover_image_url ? (
            <img 
              src={product.cover_image_url} 
              alt={product.name}
              className="h-16 w-16 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <Image className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-medium text-sm truncate">{product.name}</h3>
                <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
              </div>
              {isLow && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertTriangle
                      className="h-4 w-4 text-amber-500 shrink-0"
                      aria-label="Estoque baixo"
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top">Estoque abaixo do mínimo</TooltipContent>
                </Tooltip>
              )}
            </div>
            
            <div className="flex items-center flex-wrap gap-1.5 mt-1">
              {product.category && (
                <Badge variant="secondary" className="text-xs">
                  {product.category}
                </Badge>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleIdeaClick}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors',
                      hasIdeas
                        ? 'border-amber-400/60 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-300'
                        : 'border-dashed text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {hasIdeas ? (
                      <Lightbulb className="h-3 w-3 fill-current" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    <span>
                      {hasIdeas
                        ? `Vinculado a ${linkedIdeas.length} ideia${linkedIdeas.length > 1 ? 's' : ''}`
                        : 'Vincular a ideia'}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {hasIdeas
                    ? 'Ver ideias vinculadas no Digital'
                    : 'Criar nova ideia no Digital com este produto'}
                </TooltipContent>
              </Tooltip>
              {hasIdeas && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/digital?newIdea=1&product_id=${product.id}`);
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary/40 px-2 py-0.5 text-xs text-primary hover:bg-primary/10 transition-colors"
                      aria-label="Vincular nova ideia"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Vincular</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Vincular outra ideia a este produto</TooltipContent>
                </Tooltip>
              )}
              {linkedPlatformIds.map(pid => {
                const p = platformsMap[pid];
                if (!p) return null;
                return (
                  <Tooltip key={pid}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/digital?product_id=${product.id}`);
                        }}
                        className="inline-flex items-center justify-center rounded-md bg-muted/60 hover:bg-muted p-0.5"
                        aria-label={p.name}
                      >
                        <PlatformIcon icon={p.icon} size="sm" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{p.name}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
            
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm font-bold">
                {formatCurrency(product.price || 0)}
              </span>
              <span className={cn(
                "text-xs",
                isLow ? "text-amber-500 font-bold" : "text-muted-foreground"
              )}>
                Est: {balance} {product.unit || 'un'}
              </span>
            </div>
            
            {showInventoryActions && balance > 0 && (product.cost || 0) > 0 && (
              <div className="flex items-center justify-between mt-1 pt-1 border-t border-dashed border-muted">
                <span className="text-xs text-muted-foreground">Valor em estoque:</span>
                <span className="text-sm font-semibold text-primary">
                  {formatCurrency(balance * (product.cost || 0))}
                </span>
              </div>
            )}
          </div>
        </div>
        
        {showInventoryActions && (
          <div className="flex gap-2 mt-3 pt-3 border-t">
            {onMovement && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-10"
                onClick={(e) => {
                  e.stopPropagation();
                  onMovement({ id: product.id, name: product.name, balance });
                }}
              >
                <ArrowUpDown className="h-4 w-4 mr-1" />
                Movimentar
              </Button>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-10"
                  aria-label="Histórico do produto"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onHistory) {
                      onHistory(product.id);
                    }
                  }}
                >
                  <History className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Histórico</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-10"
                  aria-label="Editar produto"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(product);
                  }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Editar</TooltipContent>
            </Tooltip>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
