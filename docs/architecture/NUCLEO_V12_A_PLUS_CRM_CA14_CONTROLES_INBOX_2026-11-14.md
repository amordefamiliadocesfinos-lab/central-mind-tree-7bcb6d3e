# Núcleo 2.0 — A+ V1.2 | CA-14 — Controles críticos da Inbox CRM

**Frente:** M3/M4 do Núcleo e piloto operacional CRM, conforme Mapa Mestre V1.2, sem criar nova fase.

**Motivação comprovada:** o catálogo `CRM_ACTIONS` já descrevia preparar contato externo, Registrar resultado, Confirmar resultado e Adiar. Porém a Inbox `src/pages/ContatosInbox.tsx` possui comandos críticos não descritos nesse catálogo, cujos efeitos são diferentes do Resultado comercial. A ausência prejudica o trajeto do operador humano/IA autorizado, CA-14/15.

| Controle literal | Referência atual no código | Efeito a diferenciar |
|---|---|---|
| Concluir | `requestConcludeSelectedConversation`, `updateAttendance` | Conclui **conversa**, não Resultado comercial ou tarefa oficial; pendências geram aviso |
| Reabrir | `updateAttendance` em status resolved | Reabre conversa, não desfaz Resultado histórico |
| Tirar da fila | `toggleSelectedOutOfQueue` | Etiqueta de exclusão de fila, sem arquivar ou concluir; reversão por Voltar à fila |
| Próximo atendimento | `nextAttendance` | Avança fila mantendo obrigação pendente, se houver; aviso contextual |
| Sem fato novo — retirar da prioridade | `acknowledgeNoNewFact` | Insere `crm_attendance_no_new_fact` após guardas/relê contexto; **não** cria Resultado |

**Entregue:** cinco entradas no catálogo M3 já apresentado pelo Atlas, com rótulos, pré-condições, efeito, confirmação, limites e referência exata ao componente, mais teste determinístico no workflow M5 que confirma os tokens de implementação na origem e distinções semânticas. Não há nova UI, novos writers, mudança em CRM, alteração de status, migração, cópia de documentos nem promoção de autoridade.

**Limites:** código e confirmação documentada não equivalem a teste de uso real, e o catálogo não é necessariamente exaustivo. CA-14/15 só podem ser homologados após conferência funcional dos controles e observação de operador independente, explicitamente adiadas pelo proprietário. A Etapa B não está autorizada. Este relatório não modifica o Mapa Mestre e não gera frente nova.

**Continuidade:** usar conhecimento e fontes originais para completar somente lacunas documentais comprovadas, sem repetir PRs de cosmetização ou declarar a A+ concluída.
