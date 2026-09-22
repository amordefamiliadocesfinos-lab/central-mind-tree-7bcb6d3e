import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import type { CrmResultSuggestion } from '@/lib/crm/aiResultSuggestion';
import type { CrmNextActionRecommendation } from '@/lib/crm/aiNextActionRecommendation';
import type { CrmReplySuggestion } from '@/lib/crm/aiReplySuggestion';
import type { PostSaleEligibilitySignal } from '@/lib/crm/postSale';
import type { RepurchaseSignal } from '@/lib/crm/repurchase';

/**
 * FRENTE 4.5 — Card único do Assistente CRM.
 * Apenas apresentação: não chama IA, não grava nada, não envia mensagem.
 * Estados tratados: analisando, sugestão pronta, sem sugestão suficiente, erro controlado.
 */
export interface CrmAssistantAnalysis {
  result: CrmResultSuggestion | null;
  nextAction: CrmNextActionRecommendation | null;
  reply: CrmReplySuggestion | null;
  postSale: PostSaleEligibilitySignal | null;
  repurchase: RepurchaseSignal | null;
}

interface CrmAssistantCardProps {
  analyzing: boolean;
  analysis: CrmAssistantAnalysis | null;
  error: boolean;
  onUseResult?: (resultCode: string) => void;
  onUseReply: (reply: string) => void;
  onDismiss: () => void;
  onRetry: () => void;
  onPreparePostSale?: () => void;
  onPrepareRepurchase?: () => void;
}

export function CrmAssistantCard({
  analyzing, analysis, error, onUseResult, onUseReply, onDismiss, onRetry, onPreparePostSale, onPrepareRepurchase,
}: CrmAssistantCardProps) {
  const [showProfileHelp, setShowProfileHelp] = useState(false);
  const [showRepurchaseDetails, setShowRepurchaseDetails] = useState(false);
  const [repurchaseDismissed, setRepurchaseDismissed] = useState(false);
  useEffect(() => {
    setRepurchaseDismissed(false);
    setShowRepurchaseDetails(false);
  }, [analysis?.repurchase?.reason]);
  if (!analyzing && !analysis && !error) return null;

  const result = analysis?.result ?? null;
  const nextAction = analysis?.nextAction ?? null;
  const reply = analysis?.reply ?? null;
  const postSale = analysis?.postSale ?? null;
  const repurchase = !repurchaseDismissed ? analysis?.repurchase ?? null : null;
  const tentativeResult = result?.tentativeCode ? result : null;
  const nextActionReason = nextAction?.aiExplanation || nextAction?.reason || null;
  // D3 — ambiguidade de Próxima Ação: a IA nunca escolhe entre candidatos;
  // exibimos espera de fato adicional e as possibilidades canônicas apenas
  // como leitura, sem botão, escolha ou aplicação.
  const isAmbiguousNextAction = Boolean(nextAction && !nextAction.nextActionCode && nextAction.candidates.length > 1);
  // Uma abstenção explicada pelo Assistente também é informação operacional.
  // Ex.: F2-B bloqueia preço/estoque/frete sem fonte viva e devolve reply=null
  // com um motivo útil. F2-F também preserva hipótese de baixa confiança apenas
  // para leitura, sem permitir que ela dirija ação operacional.
  const hasAnything = Boolean(result?.code || tentativeResult || nextAction || reply?.reply || reply?.reason || postSale || repurchase);

  return (
    <div className="rounded-md border bg-muted/30 px-2.5 py-2 text-[11px] space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Assistente CRM</span>
        {!analyzing && (
          <button type="button" onClick={onDismiss} className="text-[10px] text-muted-foreground hover:text-foreground">
            Ignorar
          </button>
        )}
      </div>

      {!analyzing && (
        <div className="rounded border border-dashed px-2 py-1 text-[10px] text-muted-foreground">
          <div className="flex items-center justify-between gap-2">
            <span>Perfil de comunicação · Em construção</span>
            <button type="button" className="underline hover:text-foreground" onClick={() => setShowProfileHelp(value => !value)}>
              O que informar para melhorar a IA?
            </button>
          </div>
          {showProfileHelp && <p className="mt-1 leading-relaxed">Informe como você fala com clientes, apresenta produto e preço, faz follow-up, expressões que usa ou evita e 3 a 5 mensagens reais que representem seu estilo. É opcional e não bloqueia o CRM.</p>}
        </div>
      )}

      {analyzing && (
        <div className="flex items-center gap-2 py-1 text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Analisando o atendimento...
        </div>
      )}

      {!analyzing && error && (
        <div className="space-y-1.5">
          <p className="text-muted-foreground">Não foi possível analisar o atendimento agora.</p>
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={onRetry}>Tentar de novo</Button>
        </div>
      )}

      {!analyzing && !error && analysis && !hasAnything && (
        <p className="text-muted-foreground">Ainda não há informação suficiente para sugerir um resultado.</p>
      )}

      {!analyzing && !error && analysis && hasAnything && (
        <div className="space-y-1.5">
          {result?.code && (
            <div className="space-y-0.5">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Resultado provável</div>
              <div className="font-medium text-foreground">{result.label}</div>
              <div className="text-muted-foreground">Confiança {Math.round(result.confidence * 100)}%</div>
              {result.reason && (
                <p className="text-muted-foreground"><span className="font-medium text-foreground/80">Por quê:</span> {result.reason}</p>
              )}
              {result.evidenceQuotes?.length > 0 && (
                <div className="text-muted-foreground">
                  <span className="font-medium text-foreground/80">Evidência no atendimento:</span>
                  <ul className="mt-0.5 space-y-0.5">
                    {result.evidenceQuotes.slice(0, 3).map((quote, index) => (
                      <li key={`${index}-${quote}`} className="italic">“{quote}”</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {tentativeResult && (
            <div className="rounded border border-amber-200 bg-amber-50/70 px-2 py-1.5 text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
              <div className="font-medium">Hipótese de Resultado: {tentativeResult.tentativeLabel}</div>
              <div className="text-[10px] text-amber-900/80 dark:text-amber-200/80">
                Confiança {Math.round(tentativeResult.confidence * 100)}% · baixa confiança, não aplicada e sem Próxima Ação derivada.
              </div>
            </div>
          )}

          {nextAction && (
            <div className="space-y-0.5 text-foreground/90">
              <div>
                <span className="text-muted-foreground">Próxima ação: </span>
                {isAmbiguousNextAction
                  ? 'aguardando fato adicional'
                  : nextAction.noImmediateAction
                    ? 'nenhuma ação imediata'
                    : nextAction.nextActionLabel}
                {nextAction.requiresDate && (
                  <span className="ml-1 text-amber-600 dark:text-amber-400">· data necessária</span>
                )}
              </div>
              {isAmbiguousNextAction && (
                <div className="text-muted-foreground">
                  <span className="font-medium text-foreground/80">Possibilidades canônicas:</span>{' '}
                  {nextAction.candidates.map((candidate) => candidate.label).join(' · ')}
                </div>
              )}
              {nextActionReason && (
                <p className="text-muted-foreground"><span className="font-medium text-foreground/80">Motivo:</span> {nextActionReason}</p>
              )}
            </div>
          )}

          {reply?.reply && (
            <div className="rounded border border-dashed bg-background/60 px-2 py-1.5">
              <div className="mb-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">Resposta sugerida</div>
              <p className="whitespace-pre-wrap text-foreground/90">{reply.reply}</p>
            </div>
          )}

          {reply && !reply.reply && reply.reason && (
            <div className="rounded border border-dashed bg-background/60 px-2 py-1.5">
              <div className="mb-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">Orientação do Assistente</div>
              <p className="text-foreground/90">{reply.reason}</p>
            </div>
          )}

          {postSale && (
            <div className="rounded border border-sky-200 bg-sky-50/70 px-2 py-1.5 text-sky-950 dark:border-sky-900 dark:bg-sky-950/20 dark:text-sky-100">
              <div className="font-medium">Pós-venda elegível</div>
              <p className="mt-0.5 text-sky-900/80 dark:text-sky-200/80">{postSale.reason}</p>
              {postSale.deliveryDate && (
                <p className="mt-1 text-[10px] text-sky-900/75 dark:text-sky-200/75">
                  Entrega registrada em {new Date(`${postSale.deliveryDate}T12:00:00`).toLocaleDateString('pt-BR')} · acompanhamento sugerido, sem ação automática.
                </p>
              )}
              {onPreparePostSale && (
                <div className="mt-1.5">
                  <Button size="sm" variant="outline" className="h-7 border-sky-300 bg-transparent px-2 text-[10px] hover:bg-sky-100 dark:border-sky-800 dark:hover:bg-sky-900/40" onClick={onPreparePostSale}>
                    Preparar mensagem
                  </Button>
                </div>
              )}
            </div>
          )}

          {repurchase && (
            <div className="rounded border border-amber-200 bg-amber-50/70 px-2 py-1.5 text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
              <div className="font-medium">Oportunidade de recompra</div>
              <p className="mt-0.5 text-amber-900/80 dark:text-amber-200/80">{repurchase.reason}</p>
              {showRepurchaseDetails && (
                <p className="mt-1 text-[10px] text-amber-900/75 dark:text-amber-200/75">
                  {repurchase.purchaseCount} compras confirmadas
                  {repurchase.lastPurchaseAt ? ` · última compra em ${new Date(repurchase.lastPurchaseAt).toLocaleDateString('pt-BR')}` : ''}
                  {repurchase.likelyProducts.length ? ' · há produtos recorrentes no histórico' : ''}
                </p>
              )}
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" className="h-7 border-amber-300 bg-transparent px-2 text-[10px] hover:bg-amber-100 dark:border-amber-800 dark:hover:bg-amber-900/40" onClick={() => setShowRepurchaseDetails(value => !value)}>
                  Analisar
                </Button>
                {onPrepareRepurchase && (
                  <Button size="sm" variant="outline" className="h-7 border-amber-300 bg-transparent px-2 text-[10px] hover:bg-amber-100 dark:border-amber-800 dark:hover:bg-amber-900/40" onClick={onPrepareRepurchase}>
                    Preparar mensagem
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => setRepurchaseDismissed(true)}>
                  Ignorar
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-1.5 pt-0.5">
            {result?.code && onUseResult && (
              <Button size="sm" className="h-7 text-[11px]" onClick={() => onUseResult(result.code!)}>
                Usar resultado
              </Button>
            )}
            {reply?.reply && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-[11px]"
                  onClick={() => onUseReply(reply.reply!)}
                >
                  Usar resposta
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  onClick={() => { navigator.clipboard?.writeText(reply.reply!); toast.success('Resposta copiada'); }}
                >
                  Copiar
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
