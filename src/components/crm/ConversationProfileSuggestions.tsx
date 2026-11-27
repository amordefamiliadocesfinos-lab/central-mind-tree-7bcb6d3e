import { useEffect, useRef, useState } from 'react';
import type { Contact } from '@/hooks/useContacts';
import { supabase } from '@/integrations/supabase/client';
import { saveContactProfile } from '@/lib/crm/contactProfileWriter';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  proposeCrmConversationProfileFields,
  type CrmConversationProfileMessage,
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
};

export function ConversationProfileSuggestions({
  contact, conversationId, editing, onSaved, onReviewChange,
}: { contact: Contact; conversationId?: string | null; editing: boolean;
  onSaved?: (contact: Contact) => void; onReviewChange?: (active: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [scannedCount, setScannedCount] = useState(0);
  const [scanLimitReached, setScanLimitReached] = useState(false);
  const [suggestions, setSuggestions] = useState<CrmConversationProfileSuggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFields, setSelectedFields] = useState<CrmConversationProfileField[]>([]);
  const [saving, setSaving] = useState(false);
  const saveRef = useRef(false);
  useEffect(() => {
    onReviewChange?.(selectedFields.length > 0 || saving);
  }, [selectedFields, saving, onReviewChange]);

  // Evidência consultiva só serve para o par contato/conversa atualmente aberto.
  useEffect(() => {
    setSuggestions(null);
    setSelectedFields([]);
    setScannedCount(0);
    setScanLimitReached(false);
    setError(null);
  }, [contact.id, conversationId]);

  const analyze = async () => {
    if (!conversationId || editing || loading) return;
    setLoading(true);
    setSelectedFields([]);
    setSuggestions(null);
    setScannedCount(0);
    setScanLimitReached(false);
    setError(null);
    const requestedContactId = contact.id;
    const requestedConversationId = conversationId;
    try {
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
        if (queryError) throw queryError;
        const page = (data ?? []) as CrmConversationProfileMessage[];
        collected.push(...page);
        if (page.length < CRM_CONVERSATION_PAGE_SIZE) break;
      }
      // Mudança de atendimento invalida a evidência (a instância também é keyed pelo contato).
      if (requestedContactId !== contact.id || requestedConversationId !== conversationId) return;
      setScannedCount(collected.length);
      setScanLimitReached(collected.length >= CRM_CONVERSATION_REVIEW_LIMIT);
      setSuggestions(proposeCrmConversationProfileFields(collected, contact));
    } catch {
      setError('Não foi possível consultar as mensagens autorizadas deste atendimento.');
    } finally {
      setLoading(false);
    }
  };

  const confirmSelected = async () => {
    if (saveRef.current || !suggestions || !selectedFields.length || editing) return;
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
      // Escritor oficial: releitura, delta e comparação de versão antes de salvar.
      const saved = await saveContactProfile({ contactId: contact.id, baseline: contact, draft: patch });
      onSaved?.(saved.contact);
      setSelectedFields([]);
      setSuggestions(null);
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
          disabled={!conversationId || editing || loading}
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
              disabled={item.state !== 'empty' || editing || saving}
              onChange={event => setSelectedFields(current => event.target.checked
                ? [...current, item.field] : current.filter(field => field !== item.field))} />
            <span className="font-semibold">{labels[item.field]}: {item.value}</span>
          </label>
          <p className="text-muted-foreground">{states[item.state]}</p>
          <p className="mt-1 break-words text-[11px] text-muted-foreground">
            Trecho da conversa: “{item.evidenceExcerpt}”
          </p>
          <p className="text-[10px] text-muted-foreground">
            Fonte: mensagem {item.messageId} · {item.createdAt}
          </p>
        </div>
      ))}
      {suggestions && suggestions.length > 0 && (
        <div className="space-y-1.5">
          <Button type="button" size="sm" disabled={saving || !selectedFields.length || editing}
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
