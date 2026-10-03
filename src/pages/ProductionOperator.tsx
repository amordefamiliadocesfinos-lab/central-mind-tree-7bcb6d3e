import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Product } from '@/hooks/useOrders';
import { ProductionFactMobile } from '@/components/operations/ProductionFactMobile';
import { ProductionOperatorHistory } from '@/components/operations/ProductionOperatorHistory';

type Mode = 'produce' | 'history';

export default function ProductionOperator() {
  const { appUser, signOut } = useAuth();
  const [mode, setMode] = useState<Mode>('produce');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: queryError } = await (supabase as any)
        .from('products')
        .select('*')
        .eq('is_active', true)
        .eq('is_manufactured', true)
        .order('name');

      if (!mounted) return;
      if (queryError) {
        console.error('Erro ao carregar produtos da produção:', queryError);
        setError('Não foi possível carregar os produtos da produção.');
        setProducts([]);
      } else {
        setProducts((data || []) as Product[]);
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  if (!appUser) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (mode === 'history') {
    return (
      <ProductionOperatorHistory
        operatorId={appUser.id}
        operatorName={appUser.name}
        onProduce={() => setMode('produce')}
        onSignOut={() => void signOut()}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm space-y-3 text-center">
          <p className="font-semibold text-destructive">{error}</p>
          <button type="button" onClick={() => window.location.reload()} className="text-sm underline">Tentar novamente</button>
        </div>
      </main>
    );
  }

  return <ProductionFactMobile products={products} onExit={() => setMode('history')} />;
}
