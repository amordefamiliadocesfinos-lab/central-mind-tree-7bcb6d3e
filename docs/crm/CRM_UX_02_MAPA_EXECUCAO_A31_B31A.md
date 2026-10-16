# CRM–UX 02 — Mapa executivo A3.1 + B3.1-A
**Data de fechamento:** 2026-10-16  
**Origem:** mapa UX fechado e decisões do usuário, parecer funcional CRM 7  
**Fonte canônica:** GitHub `main`; Lovable oficial preservado na `main`  
**Estado geral:** Execução autorizada pelo usuário em 16/10/2026; incrementos devem ser aprovados tecnicamente, integrados em sequência, testados em preview e observados em uso real.  
**Regra:** não considerar `PR merged` igual a `homologado em uso real`.

## Decisões congeladas de experiência
- **A3.1:** faixa única horizontal: Gestão, Inbox, busca, Prioridade, Responder, Hoje, Atrasados, Filtros, Escopo e Mais; Esfriando e filtros avançados agrupados; Duplicados em Mais; indicador de filtros ativos, limpeza explícita, consulta geral visível, preservação das prioridades/filtros e responsividade.
- **B3.1-A:** Ficha do contato integral na terceira coluna, Dados principais abertos, consulta padrão, múltiplas seções abertas em leitura, **uma só seção em edição**; dados simples gravam diretamente; fiscal/endereço/financeiro salvam/cancelam por seção; estados Pendente/Salvando/Salvo/Erro; proteção de edições pendentes; Assistente CRM e Ação preservados; conversa sempre acessível.
- **Ações críticas preservadas:** Concluir atendimento, Registrar venda, Tirar/Voltar para fila, Registrar Resultado e Adiar.
- **Eliminação dos caminhos de edição antigos:** somente depois de validação de cobertura funcional completa.
- **Registrar conversa:** removido globalmente na PR #281; conferência visual autenticada ainda pendente.
- Não alterar regras comerciais; não recriar formulário concorrente; manter Gestão/Financeiro/Operações/Captura Central e dados históricos.

## Matriz de execução e acompanhamento
| ID | Escopo congelado | Dependência | Evidência mínima | Status | PR |
|---|---|---|---|---|---|
| A-01 | Faixa única do cabeçalho; busca/4 filtros críticos, menu Filtros, Escopo e Mais | nenhuma | Filtros e ações existentes preservados; TypeScript/build/CRM CI | Merge/CI aprovadas; preview/UAT pendente | [#283](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/283) |
| A-02 | Estados visíveis (consulta geral, filtros ativos, limpar), responsive | A-01 | Busca/etapa/fornecedor crítico/Fora da fila/etapas e largura de tela | Merge/CI aprovadas; preview/UAT pendente | [#284](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/284) |
| B-01 | Contrato compartilhado de leitura + gravação parcial, escritor canônico para Próxima Ação | A-02, independente de layout | Testes de alteração parcial, opt-out, título/data, erros, concorrência | Merge/CI aprovadas; integração na UI pendente | [#286](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/286) |
| B-02 | Ficha integral somente consulta na terceira coluna, seções expansíveis | B-01 | Todos os grupos e vínculos; assistente/ação/conversa | Em validação/CI | [#287](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/287) |
| B-03 | Edição simples, confirmação visual e proteção de troca de contexto | B-02 | Debounce, erros, troca contato, aba e seção sem perda | Autorizado, pendente | — |
| B-04 | Edição fiscal/endereço/financeiro; Salvar/Cancelar por seção | B-03 | Campos completos, CEP, crédito, canais, sem sobrescrita | Autorizado, pendente | — |
| B-05 | Próxima Ação canônica, opt-out, reativação/vínculos; harmonização controlada Gestão/Financeiro | B-04 | Uma obrigação oficial; sem reativação após opt-out; histórico/pedidos íntegros | Autorizado, pendente | — |
| B-06 | Responsividade da ficha, remover apenas acessos redundantes da Inbox | B-05 | UAT em preview; nenhuma abertura de modal/drawer/cadastro externo; conversa preservada | Autorizado, pendente | — |

## Contrato de integridade para B-01...B-06
1. Todo update precisa de `contactId` explícito e imutável e leitura do registro completo.
2. Salvar apenas campos alterados, com validação de tipo e separação de campos operacionais.
3. Não escrever `next_action_text`, `next_action_date`, `next_contact_date` por `contacts.update` genérico; usar `setCrmNextAction`/`clearCrmNextAction`, `setCrmReactivation`/`clearCrmReactivation` quando aplicável.
4. `funnel_status`, Resultado e atendimento não sofrem transição artificial por edição cadastral.
5. Opt-out requer alteração explícita; preservar permissão comercial quando qualquer outro grupo é salvo.
6. `notes` é campo cadastral; eventos `contact_history` continuam pelo fluxo de histórico/anotação.
7. Evitar sobrescrita de `sales_channels` ou valores de outro módulo. Dados em conflito exigem recarregar/decidir, não substituir silenciosamente.
8. Estados visuais **Pendente → Salvando → Salvo/Erro** refletem confirmação real. Erros não apagam o rascunho.
9. Troca de contato, aba, seção ou rota deve preservar/concluir explicitamente edições pendentes e não redirecionar escrita ao próximo contato.
10. Não apagar `LeadDetailDrawer`, `ContactFormDialog` nem acesso funcional da Gestão/Financeiro antes do teste de cobertura do substituto.

## Governança por incremento
`main` atualizada → branch isolada → commit(s) → PR → TypeScript + build + testes CRM → revisão de diff → merge controlado → conferir SHA GitHub/Lovable → preview → observação real.  
Nenhum deploy/publicação extra ou migration fica implícito. Toda PR deve atualizar este mapa com status/links e registrar pendências de UAT.  
Responsável técnico: CRM 7; experiência: UX/UI; aprovação de produto e execução: usuário; impacto transversal: especialista do módulo envolvido.
