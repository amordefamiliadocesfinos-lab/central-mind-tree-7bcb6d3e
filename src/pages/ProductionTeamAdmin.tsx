import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ProductionTeamSummary } from '@/components/operations/ProductionTeamSummary';

/** Administrators can consult all operators; the operator's original entry flow stays unchanged. */
export default function ProductionTeamAdmin() {
  const { appUser, profileLoading } = useAuth();
  const navigate = useNavigate();
  if (profileLoading) return <div className="flex min-h-[100dvh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin"/></div>;
  if (appUser?.role?.trim().toLocaleUpperCase('pt-BR') !== 'ADMINISTRADOR') {
    return <Navigate to="/operacoes" replace/>;
  }
  return <ProductionTeamSummary onProduce={() => navigate('/operacoes?tab=production')} onSignOut={() => navigate('/operacoes?tab=production')} />;
}
