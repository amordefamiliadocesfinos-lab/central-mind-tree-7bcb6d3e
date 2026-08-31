import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Loader2, Send, Sparkles, MessageCircle, AArrowDown, AArrowUp, Paperclip, X, Mic, Video, BrainCircuit } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { normalizeCrmStage } from '@/lib/crm/model';
import { completeCrmReactivationIfDue } from '@/lib/crm/reactivation';
import { suggestCrmResultFromContext, type CrmResultSuggestion } from '@/lib/crm/aiResultSuggestion';
import { buildCrmAiContext } from '@/lib/crm/aiContext';
import { recommendCrmNextAction, type CrmNextActionRecommendation } from '@/lib/crm/aiNextActionRecommendation';

interface Message {
  id: string;
  conversation_id: string;
  sender: 'customer' | 'agent' | 'ai_suggestion';
  content: string;
  is_ai_suggested: boolean;
  created_at: string;
  source: 'mobile' | 'crm' | 'provider' | 'legacy' | null;
  delivery_status: string | null;
  message_type: string;
  media_url: string | null;
  media_mime_type: string | null;
  media_filename: string | null;
  media_caption: string | null;
}

interface ContactChatPanelProps {
  contactId: string;
  contactName?: string | null;
  contactHandle?: string | null;
  contactAvatar?: string | null;
  funnelStage?: string | null;
  /** Classe de altura do painel. Padrão: h-[60vh] min-h-[400px] */
  heightClassName?: string;
  onMessageSent?: (content: string) => void | Promise<void>;
  /** F4.2: pré-seleciona o Resultado sugerido no fluxo canônico de "Registrar resultado". */
  onUseSuggestedResult?: (resultCode: string) => void;
}

const CHAT_FONT_KEY = 'crm-chat-font-size';
const MIN_FONT = 12;
const MAX_FONT = 22;

export function ContactChatPanel({ contactId, contactName, contactHandle, contactAvatar, funnelStage, heightClassName, onMessageSent, onUseSuggestedResult }: ContactChatPanelProps) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [commercialOptOut, setCommercialOptOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [resultSuggestion, setResultSuggestion] = useState<CrmResultSuggestion | null>(null);
  const [nextActionRecommendation, setNextActionRecommendation] = useState<CrmNextActionRecommendation | null>(null);
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [fontSize, setFontSize] = useState<number>(() => {
    const stored = Number(localStorage.getItem(CHAT_FONT_KEY));
    return stored >= MIN_FONT && stored <= MAX_FONT ? stored : 14;
  });
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isCustomerReply = messages[messages.length - 1]?.sender === 'customer';
  const outboundBlocked = commercialOptOut && !isCustomerReply;

  useEffect(() => {
    let cancelled = false;
    supabase.from('contacts').select('commercial_opt_out').eq('id', contactId).maybeSingle()
      .then(({ data, error }) => {
        if (!cancelled && !error) setCommercialOptOut(Boolean(data?.commercial_opt_out));
      });
    return () => { cancelled = true; };
  }, [contactId]);

  const changeFont = (delta: number) => {
    setFontSize((prev) => {
      const next = Math.min(MAX_FONT, Math.max(MIN_FONT, prev + delta));
      localStorage.setItem(CHAT_FONT_KEY, String(next));
      return next;
    });
  };

  // Localiza ou cria a conversa para este contato
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: existing } = await supabase
        .from('service_conversations')
        .select('id,funnel_stage')
        .eq('contact_id', contactId)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (existing?.id) {
        setConversationId(existing.id);
        const canonicalStage = normalizeCrmStage(funnelStage);
        if (existing.funnel_stage !== canonicalStage) {
          await supabase
            .from('service_conversations')
            .update({ funnel_stage: canonicalStage })
            .eq('id', existing.id);
        }
      } else {
        const { data: created, error } = await supabase
          .from('service_conversations')
          .insert({
            contact_id: contactId,
            contact_name: contactName || null,
            contact_handle: contactHandle || null,
            contact_avatar_url: contactAvatar || null,
            status: 'open',
            funnel_stage: normalizeCrmStage(funnelStage),
          })
          .select('id')
          .single();
        if (error) {
          toast.error('Erro ao iniciar conversa');
          setLoading(false);
          return;
        }
        if (!cancelled) setConversationId(created.id);
      }
    })();
    return () => { cancelled = true; };
  }, [contactId, contactName, contactHandle, contactAvatar, funnelStage]);

  // Carrega mensagens e realtime
  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    const load = async () => {
      // Conversas longas ultrapassam o teto padrão de linhas da API. Buscamos as
      // mensagens mais recentes (desc) e reordenamos, garantindo que o último
      // envio (inclusive de campanha) sempre apareça na conversa.
      const { data } = await supabase
        .from('service_messages')
        .select('id, conversation_id, sender, content, is_ai_suggested, created_at, source, delivery_status, message_type, media_url, media_mime_type, media_filename, media_caption')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (!cancelled) {
        setMessages(((data || []) as Message[]).slice().reverse());
        setLoading(false);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    };

    load();

    const ch = supabase
      .channel(`contact-chat-${conversationId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'service_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, load)
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [conversationId]);

  const handleSend = async () => {
    if (!conversationId || (!text.trim() && !attachment)) return;
    if (outboundBlocked) {
      toast.error('Este contato marcou que não deseja receber contato comercial. Remova o opt-out conscientemente antes de iniciar uma nova abordagem.');
      return;
    }
    setSending(true);
    const content = text.trim();
    try {
      let mediaPayload: Record<string, string> = {};
      if (attachment) {
        const maxBytes = attachment.type.startsWith('image/') ? 5 * 1024 * 1024 : 16 * 1024 * 1024;
        if (attachment.size > maxBytes) {
          toast.error(`Arquivo excede o limite de ${maxBytes / 1024 / 1024} MB.`);
          return;
        }
        const mediaType = attachment.type.startsWith('image/') ? 'image'
          : attachment.type.startsWith('audio/') ? 'audio'
          : attachment.type.startsWith('video/') ? 'video' : 'document';
        const safeName = attachment.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `whatsapp/outbound/${conversationId}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from('media').upload(path, attachment, { contentType: attachment.type, upsert: false });
        if (uploadError) throw uploadError;
        const mediaUrl = supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
        mediaPayload = {
          media_url: mediaUrl, media_type: mediaType,
          media_mime_type: attachment.type, media_filename: attachment.name,
        };
      }
      const { data, error } = await supabase.functions.invoke('whatsapp-send', {
        body: { conversation_id: conversationId, message: content, ...mediaPayload },
      });
      const errMsg =
        (data as { error?: string } | null)?.error ??
        (error ? 'Não foi possível enviar a mensagem pelo WhatsApp' : null);
      if (errMsg) {
        toast.error(errMsg);
        return;
      }
      // A mensagem enviada consome apenas uma reativação já vencida. Uma
      // reativação futura permanece programada e não interfere no atendimento.
      try {
        await completeCrmReactivationIfDue(contactId);
      } catch (reactivationError) {
        console.warn('Mensagem enviada, mas não foi possível concluir a reativação:', reactivationError);
      }
      setText('');
      setAttachment(null);
      await onMessageSent?.(content);
    } catch {
      toast.error('Não foi possível enviar a mensagem pelo WhatsApp');
    } finally {
      setSending(false);
    }
  };

  // Garante que mensagens enviadas pelo WhatsApp do celular também retornem ao histórico.
  useEffect(() => {
    if (sessionStorage.getItem('whatsapp-sent-by-me-enabled') === 'true') return;
    supabase.functions.invoke('whatsapp-configure', { body: { action: 'enable_sent_by_me' } })
      .then(({ data, error }) => {
        if (!error && data?.ok) sessionStorage.setItem('whatsapp-sent-by-me-enabled', 'true');
      })
      .catch((error) => console.error('Falha ao configurar histórico do WhatsApp:', error));
  }, []);


  const handleSuggest = async () => {
    if (!conversationId) return;
    setSuggesting(true);
    try {
      const recent = messages.slice(-10).map(m => ({
        role: m.sender === 'customer' ? 'customer' : 'agent',
        content: m.content,
      }));
      const { data, error } = await supabase.functions.invoke('digital-trends', {
        body: {
          type: 'service_response',
          query: {
            conversation_history: recent,
            platform: 'crm',
            funnel_stage: normalizeCrmStage(funnelStage),
            contact_name: contactName || 'Cliente',
          },
        },
      });
      if (error) throw error;
      if (data?.success && data?.data?.response) {
        setText(data.data.response);
        toast.success('Sugestão pronta — revise e envie');
      }
    } catch {
      toast.error('Erro ao gerar sugestão');
    } finally {
      setSuggesting(false);
    }
  };

  // F4.2/F4.3 — Analisar atendimento: a IA sugere o Resultado provável e o motor
  // canônico deriva a Próxima Ação. Nenhum efeito colateral: nada é gravado até
  // o operador confirmar no fluxo canônico.
  const handleAnalyze = async () => {
    setAnalyzing(true);
    setNextActionRecommendation(null);
    try {
      const context = await buildCrmAiContext(contactId, conversationId);
      const suggestion = await suggestCrmResultFromContext(context);
      setResultSuggestion(suggestion);
      if (suggestion.code) {
        // getCrmTransition() é a autoridade; a IA só explica a decisão.
        const recommendation = await recommendCrmNextAction(context, suggestion.code, { explain: true });
        setNextActionRecommendation(recommendation);
      }
    } catch (error) {
      console.error('crm-ai-assistant:', error);
      toast.error('Não foi possível analisar o atendimento agora.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className={`flex flex-col ${heightClassName ?? 'h-[60vh] min-h-[400px]'}`}>
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs gap-2">
            <MessageCircle className="h-8 w-8 opacity-30" />
            <p>Nenhuma mensagem ainda</p>
            <p className="text-[10px] opacity-70">Envie a primeira mensagem ou registre uma recebida</p>
          </div>
        ) : (
          messages.map((m) => {
            const isAgent = m.sender === 'agent';
            const isAi = m.sender === 'ai_suggestion';
            return (
              <div key={m.id} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
                <div
                  style={{ fontSize: `${fontSize}px`, lineHeight: 1.45 }}
                  className={`max-w-[80%] rounded-lg px-3 py-2 whitespace-pre-wrap ${
                    isAgent
                      ? 'bg-primary text-primary-foreground'
                      : isAi
                      ? 'bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700'
                      : 'bg-muted'
                  }`}
                >

                  {isAi && <div className="text-[10px] font-semibold mb-1 opacity-70">💡 Sugestão da IA</div>}
                  {m.media_url && m.message_type === 'image' && (
                    <a href={m.media_url} target="_blank" rel="noreferrer" className="block mb-1">
                      <img src={m.media_url} alt={m.media_caption || 'Imagem recebida'} className="max-h-72 rounded-md object-contain" loading="lazy" />
                    </a>
                  )}
                  {m.media_url && m.message_type === 'audio' && (
                    <audio controls preload="metadata" className="mb-1 max-w-full" src={m.media_url}>
                      Seu navegador não conseguiu reproduzir este áudio.
                    </audio>
                  )}
                  {m.media_url && m.message_type === 'video' && (
                    <video controls preload="metadata" className="mb-1 max-h-72 max-w-full rounded-md" src={m.media_url} />
                  )}
                  {m.media_url && !['image', 'audio', 'video'].includes(m.message_type) && (
                    <a href={m.media_url} target="_blank" rel="noreferrer" className="mb-1 flex items-center gap-1 underline underline-offset-2">
                      <FileText className="h-4 w-4" /> {m.media_filename || 'Abrir anexo'}
                    </a>
                  )}
                  {(!m.media_url || Boolean(m.media_caption)) && <div>{m.media_caption || m.content}</div>}
                  {isAgent && (
                    <div className="text-[9px] mt-1 opacity-70">
                      {m.source === 'mobile'
                        ? 'Enviado pelo celular'
                        : m.source === 'crm'
                        ? 'Enviado pelo CRM'
                        : 'Enviado pelo WhatsApp'}
                      {m.delivery_status === 'failed' ? ' · Falhou' : m.delivery_status === 'pending' ? ' · Enviando' : ''}
                    </div>
                  )}
                  <div className={`text-[10px] mt-1 opacity-60`}>
                    {format(parseISO(m.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t pt-1.5 mt-1.5 space-y-1.5 bg-background/95">
        {resultSuggestion && (
          <div className="rounded-md border bg-muted/30 px-2 py-1.5 text-[11px] space-y-1">
            <div className="font-medium">
              {resultSuggestion.code
                ? `Resultado sugerido: ${resultSuggestion.code} — ${resultSuggestion.label}`
                : 'Sem Resultado sugerido no momento'}
            </div>
            {resultSuggestion.code && (
              <div className="text-muted-foreground">Confiança: {Math.round(resultSuggestion.confidence * 100)}%</div>
            )}
            <div className="text-muted-foreground">Por quê: {resultSuggestion.reason}</div>
            <div className="flex justify-end gap-2 pt-0.5">
              {resultSuggestion.code && onUseSuggestedResult && (
                <Button
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => { onUseSuggestedResult(resultSuggestion.code!); setResultSuggestion(null); }}
                >
                  Usar resultado
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setResultSuggestion(null)}>Ignorar</Button>
            </div>
          </div>
        )}
        {commercialOptOut && (
          <p className="rounded-md border border-destructive/25 bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive">
            {isCustomerReply
              ? 'Opt-out comercial ativo: resposta ao contato iniciado pelo cliente permitida.'
              : 'Este contato não deseja contato comercial. Remova o opt-out no detalhe antes de iniciar nova abordagem.'}
          </p>
        )}
        {attachment && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-2 py-1 text-xs">
            {attachment.type.startsWith('audio/') ? <Mic className="h-3.5 w-3.5" /> : attachment.type.startsWith('video/') ? <Video className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
            <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
            <span className="text-[10px] text-muted-foreground">{(attachment.size / 1024 / 1024).toFixed(1)} MB</span>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setAttachment(null)} aria-label="Remover anexo"><X className="h-3 w-3" /></Button>
          </div>
        )}
        <div className="flex items-end gap-1">
          <input ref={fileInputRef} type="file" className="hidden" accept="image/*,audio/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={(event) => setAttachment(event.target.files?.[0] || null)} />
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => fileInputRef.current?.click()} disabled={sending || !conversationId || outboundBlocked} title="Anexar imagem, áudio, vídeo ou documento"><Paperclip className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={handleSuggest} disabled={suggesting || !conversationId} title="Sugerir resposta com IA">
            {suggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={handleAnalyze} disabled={analyzing} title="Analisar atendimento (sugerir resultado)">
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
          </Button>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Digite uma mensagem…"
            rows={1}
            className="resize-none min-h-[36px] max-h-28 py-2"
            style={{ fontSize: `${fontSize}px` }}
            disabled={outboundBlocked}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => changeFont(-1)} disabled={fontSize <= MIN_FONT} title="Diminuir texto das mensagens"><AArrowDown className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => changeFont(1)} disabled={fontSize >= MAX_FONT} title="Aumentar texto das mensagens"><AArrowUp className="h-4 w-4" /></Button>
          <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleSend} disabled={sending || outboundBlocked || (!text.trim() && !attachment) || !conversationId} title="Enviar">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
