import { useEffect, useState } from 'react';
import type { Contact } from '@/hooks/useContacts';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  proposeCrmConversationProfileFields,
  type CrmConversationProfileMessage,
  type CrmConversationProfileSuggestion,
} from '@/lib/crm/conversationProfileSuggestions';

const labels = {
  name: 'Nome', email: 'E-mail', phone: 'Telefone',
  zip_code: 'CEP', city: 'Cidade', address: 'Endereço principal',
};
const states = {
  empty: 'Campo vazio — conferir',
  same: 'Já cadastrado',
  conflict: 'Diferente do cadastro — não substituir',
  ambiguous: 'Informações divergentes na conversa — revisar',
};

export function ConversationProfileSuggestions({
  contact, conversationId, editing,
}: { contact: Contact; conversationId?: string | null; editing: boolean }) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<CrmConversationProfileSuggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Evidência consultiva só serve para o par contato/conversa atualmente aberto.
  useEffect(() => {
    setSuggestions(null);
    setError(null);
  }, [contact.id, conversationId]);

  const analyze = async () => {
    if (!conversationId || editing || loading) return;
    setLoading(true);
    setSuggestions(null);
    setError(null);
    const requestedContactId = contact.id;
    const requestedConversationId = conversationId;
    try {
      // Apenas mensagens textuais acessíveis à sessão atual, em conversa já conhecida.
      const { data, error: queryError } = await supabase.from('service_messages')
        .select('id,sender,content,created_at')
        .eq('conversation_id', requestedConversationId)
        .eq('sender', 'customer')
        .order('created_at', { ascending: false })
        .limit(200);
      if (queryError) throw queryError;
      // A mudança de contato invalida a proposta pela remontagem do componente.
      if (requestedContactId !== contact.id || requestedConversationId !== conversationId) return;
      setSuggestions(proposeCrmConversationProfileFields(
        (data ?? []) as CrmConversationProfileMessage[], contact,
      ));
    } catch {
      setError('Não foi possível consultar as mensagens autorizadas deste atendimento.');
    } finally {
      setLoading(false);
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
          Nenhum campo explícito identificado nas últimas 200 mensagens. Isso não significa que o dado inexista.
        </p>
      )}
      {suggestions?.map(item => (
        <div key={item.field} className="rounded-md border bg-muted/20 p-2 text-xs">
          <p className="font-semibold">{labels[item.field]}: {item.value}</p>
          <p className="text-muted-foreground">{states[item.state]}</p>
          <p className="text-[10px] text-muted-foreground">
            Fonte: mensagem {item.messageId} · {item.createdAt}
          </p>
        </div>
      ))}
      {suggestions && suggestions.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Revise autoria, finalidade do endereço e conflitos antes de usar dados. CPF/CNPJ,
          opt-out, Próxima Ação e campos financeiros não são preenchidos nesta etapa.
        </p>
      )}
    </section>
  );
}
