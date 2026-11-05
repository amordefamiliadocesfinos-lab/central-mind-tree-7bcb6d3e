# CRM F3 — Garantia de tarefa oficial única (05/11/2026)

## Problema comprovado
O contato WhatsApp 9498 (`7638365a-fb7c-409a-8823-6e88dcc19624`) tinha duas tarefas ativas idênticas no registro `tasks`, ambas com `source=crm_next_action`, título "Verificar resposta no WhatsApp" e vencimento em 16/10/2026.

## Reconciliação realizada no Lovable Cloud de produção
- Tarefa preservada: `5d8c028f-ed27-4771-abb2-4f0a6e119702`.
- Cópia desativada por soft-delete (`deleted_at`): `7ebb0796-d192-492a-8da9-89c25161ea28`.
- Evento de auditoria: `contact_history.event_code=crm_duplicate_task_reconciled`, com IDs e a afirmação explícita de que **nenhuma execução ocorreu**.
- Sem alteração do prazo, do estado do contato, de Resultado ou de mensagens.
- Restrição parcial criada e verificada no banco vigente:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS ux_tasks_crm_one_active_next_action_per_contact
ON public.tasks(contact_id)
WHERE source='crm_next_action' AND deleted_at IS NULL
  AND status IN ('pendente','andamento') AND contact_id IS NOT NULL;
```

## Writer
`src/lib/crm/nextAction.ts` passa a considerar somente estados efetivamente ativos, não marcar duplicidade como tarefa concluída, e reutilizar a linha criada por outra requisição quando receber erro de unicidade PostgreSQL `23505`.

## Limites
Essa restrição pertence ao **Lovable Cloud de produção atual**. Antes de migrar para outro banco, aplicar a restrição por um processo de migrations supervisionado e verificar duplicidades históricas. Não aplicar indiscriminadamente em projetos antigos de Supabase.

## Caso pendente de revisão humana
**José Carlos — Curitiba:** o inbound solicita catálogo/tabela de preços; há retorno antigo agendado para 29/08/2026 e nenhuma classificação de Resultado localizada na auditoria. O CRM deve orientar conferência e atualização pelo fluxo canônico, não responder nem registrar desfecho sem o operador.
