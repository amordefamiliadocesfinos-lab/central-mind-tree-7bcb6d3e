import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useReviewSession } from '@/shopee-review/ReviewSessionContext';

export default function ShopeeReviewLogin() {
  const { expiresAt, loading, signIn } = useReviewSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!loading && expiresAt) return <Navigate to="/shopee-review" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true); setError(null);
    try { await signIn(username.trim(), password); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível iniciar a revisão.'); }
    finally { setSubmitting(false); }
  };

  return <main className="min-h-screen bg-slate-950 p-4 text-slate-100 flex items-center justify-center">
    <Card className="w-full max-w-md border-slate-700 bg-slate-900 p-7 text-slate-100 shadow-2xl">
      <div className="mb-6 flex items-start gap-3"><div className="rounded-full bg-orange-500/15 p-2 text-orange-300"><ShieldCheck className="h-6 w-6" /></div><div><h1 className="text-xl font-semibold">Painel Central · Revisão Shopee</h1><p className="mt-1 text-sm text-slate-300">Portal demonstrativo isolado. Não utiliza a sessão normal do Painel.</p></div></div>
      <form className="space-y-4" onSubmit={submit} noValidate>
        <div className="space-y-1.5"><Label htmlFor="review-username">Identificador de revisão</Label><Input id="review-username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></div>
        <div className="space-y-1.5"><Label htmlFor="review-password">Senha temporária</Label><Input id="review-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <Button className="w-full" type="submit" disabled={loading || submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LockKeyhole className="mr-2 h-4 w-4" />Acessar ambiente demonstrativo</>}</Button>
      </form>
      <p className="mt-5 text-xs leading-relaxed text-slate-400">Acesso temporário, somente leitura e revogável. Nenhum dado operacional, cliente ou token real é exibido.</p>
    </Card>
  </main>;
}
