import { useEffect, useRef, useState } from 'react';
import type { Contact } from '@/hooks/useContacts';
import { supabase } from '@/integrations/supabase/client';
import { saveContactProfile } from '@/lib/crm/contactProfileWriter';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  proposeCrmConversationProfileFields,
  type CrmConversationProfileMessage,
  CRM_CONVERSATION_MESSAGE_TEXT_LIMIT,
  type CrmConversationProfileField,
  type CrmConversationProfileSuggestion,
} from '@/lib/crm/conversationProfileSuggestions';

const labels = {
  name: 'Nome', email: 'E-mail', phone: 'Telefone',
  zip_code: 'CEP principal', city: 'Cidade principal', address: 'Endereço principal',
  address_number: 'Número principal', address_complement: 'Complemento principal',
  neighborhood: 'Bairro principal', billing_zip_code: 'CEP de cobrança',
  billing_city: 'Cidade de cobrança', billing_address: 'Endereço de cobrança',
  billing_number: 'Número de cobrança', billing_neighborhood: 'Bairro de cobrança',
};
const CRM_CONVERSATION_PAGE_SIZE = 200;
const CRM_CONVERSATION_REVIEW_LIMIT = 1000;

const states = {
  empty: 'Campo vazio — conferir',
  same: 'Já cadastrado',
  conflict: 'Diferente do cadastro — não substituir',
  ambiguous: 'Informações divergentes na conversa — revisar',
  unverified: 'Texto livre: titularidade não comprovada — somente conferência, não pode preencher',
};

export function ConversationProfileSuggestions({
  contact, conversationId, editing, onSaved, onReviewChange,
}: { contact: Contact; conversationId?: string | null; editing: boolean;
  onSaved?: (contact: Contact) => void; onReviewChange?: (active: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [scannedCount, setScannedCount] = useState(0);
  const [scanLimitReached, setScanLimitReached] = useState(false);
  const [oversizedMessageCount, setOversizedMessageCount] = useState(0);
  const [analyzedLatestMessageId, setAnalyzedLatestMessageId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<CrmConversationProfileSuggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFields, setSelectedFields] = useState<CrmConversationProfileField[]>([]);
  const [saving, setSaving] = useState(false);
  const saveRef = useRef(false);
  const analysisRequestRef = useRef(0);
  // Apenas RAM da aba atual; nenhuma cópia adicional em storage ou no servidor.
  const analyzedHistoryRef = useRef<string | null>(null);
  useEffect(() => {
    onReviewChange?.(selectedFields.length > 0 || saving);
  }, [selectedFields, saving, onReviewChange]);

  // A resposta de uma consulta antiga não pode ser aplicada após troca de atendimento.
  useEffect(() => {
    setLoading(false);
    setSuggestions(null);
    setSelectedFields([]);
    setScannedCount(0);
    setScanLimitReached(false);
    setOversizedMessageCount(0);
    setAnalyzedLatestMessageId(null);
    analyzedHistoryRef.current = null;
    setError(null);
    return () => { analysisRequestRef.current += 1; };
  }, [contact.id, conversationId]);

  const analyze = async () => {
    if (!conversationId || editing || loading) return;
    setLoading(true);
    setSelectedFields([]);
    setSuggestions(null);
    setScannedCount(0);
    setScanLimitReached(false);
    setOversizedMessageCount(0);
    setAnalyzedLatestMessageId(null);
    analyzedHistoryRef.current = null;
    setError(null);
    const requestedContactId = contact.id;
    const requestedConversationId = conversationId;
    const requestId = ++analysisRequestRef.current;
    const isCurrentRequest = () => analysisRequestRef.current === requestId;
    try {
      // A conversa precisa pertencer ao contato aberto; RLS da sessão continua obrigatório.
      const { data: boundConversation, error: boundError } = await supabase.from('service_conversations')
        .select('id,contact_id')
        .eq('id', requestedConversationId)
        .eq('contact_id', requestedContactId)
        .maybeSingle();
      if (!isCurrentRequest()) return;
      if (boundError || !boundConversation) throw new Error('Conversa não vinculada ao contato selecionado.');
      // Paginação somente leitura, sempre na mesma conversa autorizada.
      // O teto explícito evita consultas ilimitadas e alegações de cobertura total.
      const collected: CrmConversationProfileMessage[] = [];
      for (let offset = 0; offset < CRM_CONVERSATION_REVIEW_LIMIT; offset += CRM_CONVERSATION_PAGE_SIZE) {
        const { data, error: queryError } = await supabase.from('service_messages')
          .select('id,sender,content,created_at')
          .eq('conversation_id', requestedConversationId)
          .eq('sender', 'customer')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(offset, offset + CRM_CONVERSATION_PAGE_SIZE - 1);
        if (!isCurrentRequest()) return;
        if (queryError) throw queryError;
        const page = (data ?? []) as CrmConversationProfileMessage[];
        collected.push(...page);
        if (page.length < CRM_CONVERSATION_PAGE_SIZE) break;
      }
      // Mudança de atendimento invalida a evidência (a instância também é keyed pelo contato).
      if (!isCurrentRequest()) return;
      analyzedHistoryRef.current = JSON.stringify(collected);
      setScannedCount(collected.length);
      setOversizedMessageCount(collected.filter(message => (message.content?.length ?? 0) > CRM_CONVERSATION_MESSAGE_TEXT_LIMIT).length);
      setAnalyzedLatestMessageId(collected[0]?.id ?? null);
      setScanLimitReached(collected.length >= CRM_CONVERSATION_REVIEW_LIMIT);
      setSuggestions(proposeCrmConversationProfileFields(collected, contact));
    } catch {
      if (isCurrentRequest()) setError('Não foi possível confirmar a conversa vinculada ou consultar suas mensagens autorizadas.');
    } finally {
      if (isCurrentRequest()) setLoading(false);
    }
  };

  const confirmSelected = async () => {
    if (saveRef.current || loading || scanLimitReached || oversizedMessageCount > 0 || !analyzedHistoryRef.current || !analyzedLatestMessageId || !conversationId || !suggestions || !selectedFields.length || editing) return;
    const accepted = suggestions.filter(item => selectedFields.includes(item.field) && item.state === 'empty');
    if (!accepted.length || accepted.length !== selectedFields.length) return;
    const patch: Partial<Contact> = {};
    for (const item of accepted) {
      if (String(contact[item.field] ?? '').trim()) return;
      (patch as Record<string, unknown>)[item.field] = item.value;
    }
    saveRef.current = true;
    setSaving(true);
    try {
      // Reconfirmar o vínculo antes de permitir a persistência cadastral.
      const { data: activeConversation, error: scopeError } = await supabase.from('service_conversations')
        .select('id,contact_id')
        .eq('id', conversationId)
        .eq('contact_id', contact.id)
        .maybeSingle();
      if (scopeError || !activeConversation) throw new Error('A conversa não está mais vinculada ao contato. Reabra a ficha e consulte novamente.');
      // Novas mensagens invalidam a proposta. Exigir leitura atual antes de gravar.
      const { data: latestMessage, error: latestError } = await supabase.from('service_messages')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('sender', 'customer')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestError || !latestMessage || latestMessage.id !== analyzedLatestMessageId) {
        throw new Error('Novas mensagens ou alterações no histórico exigem conferir novamente os dados da conversa.');
      }
      // Contraprova de toda a janela examinada: edição, exclusão ou mudança de ordem
      // em mensagem antiga também invalida a proposta, não só um novo último ID.
      const currentHistory: CrmConversationProfileMessage[] = [];
      for (let offset = 0; offset < CRM_CONVERSATION_REVIEW_LIMIT; offset += CRM_CONVERSATION_PAGE_SIZE) {
        const { data: pageData, error: historyError } = await supabase.from('service_messages')
          .select('id,sender,content,created_at')
          .eq('conversation_id', conversationId)
          .eq('sender', 'customer')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(offset, offset + CRM_CONVERSATION_PAGE_SIZE - 1);
        if (historyError) throw historyError;
        const page = (pageData ?? []) as CrmConversationProfileMessage[];
        currentHistory.push(...page);
        if (page.length < CRM_CONVERSATION_PAGE_SIZE) break;
      }
      if (currentHistory.length >= CRM_CONVERSATION_REVIEW_LIMIT || JSON.stringify(currentHistory) !== analyzedHistoryRef.current) {
        throw new Error('O histórico mudou desde a análise ou está incompleto. Confira novamente antes de preencher.');
      }
      // Escritor oficial: releitura, delta e comparação de versão antes de salvar.
      const saved = await saveContactProfile({ contactId: contact.id, baseline: contact, draft: patch });
      onSaved?.(saved.contact);
      setSelectedFields([]);
      setSuggestions(null);
      analyzedHistoryRef.current = null;
      toast.success(`${saved.changedFields.length} campo(s) confirmado(s) na ficha.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Dados não confirmados; confira a ficha antes de tentar novamente.');
    } finally {
      saveRef.current = false;
      setSaving(false);
    }
  };

  return (
    <section className="space-y-2 rounded-lg border p-3" aria-label="Sugestões cadastrais da conversa">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold">Dados encontrados na conversa</h3>
          <p className="text-[11px] text-muted-foreground">Consulta de evidências. Nenhum dado é salvo automaticamente.</p>
        </div>
        <Button type="button" size="sm" variant="outline"
          disabled={!conversationId || editing || loading || saving}
          onClick={() => void analyze()}>
          {loading ? 'Conferindo...' : 'Conferir dados da conversa'}
        </Button>
      </div>
      {!conversationId && <p className="text-xs text-muted-foreground">Abra um atendimento com conversa vinculada para consultar.</p>}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      {suggestions?.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Nenhum campo explícito identificado nas mensagens examinadas. Isso não significa que o dado inexista.
        </p>
      )}
      {suggestions !== null && (
        <p className="text-[11px] text-muted-foreground">
          Mensagens do cliente examinadas: {scannedCount}.
          {scanLimitReached ? ' Limite de 1.000 atingido; o histórico pode conter outras informações.' : ''}
        </p>
      )}
      {suggestions?.map(item => (
        <div key={item.field} className="rounded-md border bg-muted/20 p-2 text-xs">
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5" aria-label={`Selecionar ${labels[item.field]}`}
              checked={selectedFields.includes(item.field)}
              disabled={item.state !== 'empty' || scanLimitReached || oversizedMessageCount > 0 || editing || saving}
              onChange={event => setSelectedFields(current => event.target.checked
                ? [...current, item.field] : current.filter(field => field !== item.field))} />
            <span className="font-semibold">{labels[item.field]}: {item.value}</span>
          </label>
          <p className="text-muted-foreground">{states[item.state]}</p>
          {item.distinctValues > 1 && (
            <p role="status" className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
              {item.distinctValues} valores diferentes encontrados na conversa. A informação exige confronto das fontes; não escolha apenas a mais recente.
            </p>
          )}
          <p className="mt-1 break-words text-[11px] text-muted-foreground">
            Trecho da conversa: “{item.evidenceExcerpt}”
          </p>
          <p className="text-[10px] text-muted-foreground">
            Fonte: mensagem {item.messageId} · {item.createdAt}
          </p>
        </div>
      ))}
      {oversizedMessageCount > 0 && suggestions !== null && (
        <p role="status" className="text-xs text-amber-700 dark:text-amber-300">
          {oversizedMessageCount} mensagem(ns) ultrapassam {CRM_CONVERSATION_MESSAGE_TEXT_LIMIT} caracteres; análise integral indisponível e preenchimento bloqueado.
        </p>
      )}
      {scanLimitReached && suggestions !== null && (
        <p role="status" className="text-xs text-amber-700 dark:text-amber-300">
          Histórico parcialmente examinado: preenchimento automático bloqueado para evitar conflito com mensagens não consultadas.
        </p>
      )}
      {suggestions && suggestions.length > 0 && (
        <div className="space-y-1.5">
          <Button type="button" size="sm" disabled={saving || scanLimitReached || oversizedMessageCount > 0 || !selectedFields.length || editing}
            onClick={() => void confirmSelected()}>
            {saving ? 'Confirmando campos...' : `Confirmar e preencher ${selectedFields.length} campo(s) vazio(s)`}
          </Button>
          {selectedFields.length > 0 && <Button type="button" size="sm" variant="ghost" disabled={saving}
            onClick={() => setSelectedFields([])}>Cancelar seleção</Button>}
          <p className="text-[11px] text-muted-foreground">
          Revise autoria, finalidade do endereço e conflitos antes de usar dados. CPF/CNPJ,
          opt-out, Próxima Ação e campos financeiros não são preenchidos nesta etapa.
          </p>
        </div>
      )}
    </section>
  );
}
