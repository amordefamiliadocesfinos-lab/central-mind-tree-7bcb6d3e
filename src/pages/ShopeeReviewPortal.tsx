import { ReactNode, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { useReviewSession } from '@/shopee-review/ReviewSessionContext';
import { reviewAccounts, reviewAudit, reviewOrders, reviewProducts, reviewReceivables } from '@/shopee-review/fixtures';

const sections = ['Visão geral', 'Contas Shopee', 'Pedidos', 'Catálogo e mapeamentos', 'Logística', 'Taxas e recebíveis', 'Auditoria', 'Segurança'] as const;
type Section = typeof sections[number];
const Block = ({ title, children }: { title: string; children: ReactNode }) => <Card className="border-slate-700 bg-slate-900 p-5 text-slate-100"><h2 className="mb-4 text-base font-semibold">{title}</h2>{children}</Card>;

export default function ShopeeReviewPortal() {
  const { expiresAt, loading, signOut } = useReviewSession();
  const [section, setSection] = useState<Section>('Visão geral');
  if (!loading && !expiresAt) return <Navigate to="/shopee-review/login" replace />;
  if (loading) return <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></main>;

  const content: Record<Section, ReactNode> = {
    'Visão geral': <div className="grid gap-4 md:grid-cols-3"><Block title="Integração multi-conta"><p className="text-sm text-slate-300">Cada loja terá autorização e token independentes. A demonstração não contém contas reais.</p></Block><Block title="Fluxo proposto"><p className="text-sm text-slate-300">Pedido externo → validação → projeção interna → ação controlada e auditável.</p></Block><Block title="Escopo da revisão"><p className="text-sm text-slate-300">Catálogo, pedidos, logística, taxas e auditoria somente com dados fictícios.</p></Block></div>,
    'Contas Shopee': <div className="grid gap-4 md:grid-cols-2">{reviewAccounts.map((account) => <Block key={account.shopId} title={account.name}><div className="space-y-2 text-sm text-slate-300"><p>Identificador: <strong>{account.shopId}</strong></p><p>{account.scope}</p><Badge variant="secondary">{account.status}</Badge></div></Block>)}</div>,
    'Pedidos': <Block title="Pedidos demonstrativos"><div className="space-y-3">{reviewOrders.map((order) => <div key={order.id} className="rounded-md border border-slate-700 p-3 text-sm"><div className="flex flex-wrap gap-2 justify-between"><strong>{order.id}</strong><Badge variant="outline">Somente leitura</Badge></div><p className="mt-2 text-slate-300">{order.buyer} · Externo: {order.external} · Interno: {order.internal}</p><p className="text-slate-400">Logística: {order.logistics}</p></div>)}</div></Block>,
    'Catálogo e mapeamentos': <Block title="Anúncios e variações demonstrativos"><div className="space-y-3">{reviewProducts.map((product) => <div className="rounded-md border border-slate-700 p-3 text-sm" key={product.listing}><strong>{product.name}</strong><p className="text-slate-300">Variação: {product.variation} · Anúncio: {product.listing}</p><p className="text-slate-400">{product.conversion}</p></div>)}</div></Block>,
    'Logística': <Block title="Logística demonstrativa"><p className="text-sm text-slate-300">Separação, coleta e expedição são projeções visuais. Este portal não cria etiqueta, não baixa estoque e não aciona transportadora.</p></Block>,
    'Taxas e recebíveis': <Block title="Visão conceitual de recebíveis"><div className="space-y-3">{reviewReceivables.map((item) => <div className="rounded-md border border-slate-700 p-3 text-sm" key={item.reference}><strong>{item.reference}</strong><p className="mt-1 text-slate-300">Bruto {item.gross} · Comissão {item.commission} · Descontos {item.discounts}</p><p className="text-slate-400">Líquido {item.net} · {item.expected}</p></div>)}</div></Block>,
    'Auditoria': <Block title="Cadeia demonstrativa de auditoria"><ol className="space-y-3">{reviewAudit.map(([label, value], index) => <li key={label} className="flex gap-3 text-sm"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-orange-200">{index + 1}</span><p><strong>{label}</strong><br /><span className="text-slate-300">{value}</span></p></li>)}</ol></Block>,
    'Segurança': <Block title="Segregação e proteção"><ul className="space-y-2 text-sm text-slate-300"><li>✓ Sessão própria, temporária e revogável; não é sessão Supabase Auth.</li><li>✓ Dados estáticos sintéticos incluídos no bundle; nenhuma consulta a tabelas, RPCs ou módulos internos.</li><li>✓ CRM, Financeiro, documentos, administração, escrita e exportação não existem nesta superfície.</li><li>✓ Rotação da versão de sessão ou desativação do controle invalida o acesso.</li></ul></Block>,
  };

  return <main className="min-h-screen bg-slate-950 text-slate-100"><header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4"><div><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-orange-300" /><h1 className="font-semibold">Painel Central · Ambiente de Revisão Shopee</h1></div><p className="mt-1 text-xs text-slate-400">Dados sintéticos · somente leitura · sessão expira em {new Date(expiresAt).toLocaleTimeString('pt-BR')}</p></div><Button variant="outline" size="sm" onClick={() => void signOut()}><LogOut className="mr-2 h-4 w-4" />Encerrar</Button></div></header><div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[220px_1fr]"><nav className="flex gap-2 overflow-x-auto md:block md:space-y-1">{sections.map((item) => <Button key={item} variant={section === item ? 'secondary' : 'ghost'} className="whitespace-nowrap md:w-full md:justify-start" onClick={() => setSection(item)}>{item}</Button>)}</nav><section>{content[section]}</section></div></main>;
}
