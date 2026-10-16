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
| B-02 | Ficha integral somente consulta na terceira coluna, seções expansíveis | B-01 | Todos os grupos e vínculos; assistente/ação/conversa | Merge/CI aprovadas; preview/UAT pendente | [#287](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/287) |
| B-03 | Edição simples, confirmação visual e proteção de troca de contexto | B-02 | Debounce, erros, troca contato, aba e seção sem perda | Merge/CI aprovadas; UAT pendente | [#290](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/290) |
| B-04 | Edição fiscal/endereço/financeiro; Salvar/Cancelar por seção | B-03 | Campos completos, CEP, crédito, canais, sem sobrescrita | Merge/CI aprovadas; UAT pendente | [#291](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/291) |
| B-05 | Próxima Ação canônica, opt-out, reativação/vínculos; harmonização controlada Gestão/Financeiro | B-04 | Uma obrigação oficial; sem reativação após opt-out; histórico/pedidos íntegros | Código preparado; CI do HEAD final pendente; NÃO integrada | [#294](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/294) |
| B-06 | Responsividade da ficha, remover apenas acessos redundantes da Inbox | B-05 | UAT em preview; nenhuma abertura de modal/drawer/cadastro externo; conversa preservada | Código preparado; PR Draft, sem CI final, sem merge | [#293](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/293) |

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

## Checkpoint técnico — 2026-10-16
- **A-01:** PR #283 integrada; TypeScript, build e regressões CRM aprovados; UAT autenticado pendente.
- **A-02:** PR #284 integrada; TypeScript, build e regressões CRM aprovados; UAT autenticado pendente.
- **B-01:** PR #286 integrada; infraestrutura de leitura/gravação parcial e teste de contrato aprovados; ainda **não conectada** aos editores da Gestão/Financeiro nem à nova ficha.
- **B-02:** PR #287 integrada; ficha na terceira coluna **somente leitura**, com seções expansíveis; mantém editores antigos na Inbox até B-06. Regressões/TypeScript/build aprovados; UAT autenticado pendente.
- **B-03–B-06:** permanecem autorizadas mas **não implementadas**. Não declarar a B3.1-A finalizada nem retirar acessos de edição enquanto não houver proteção de rascunho, integração de gravação e validação funcional.
- **Lovable:** sincronização SHA da main confirmada no commit 09f92169a2dbff26e56fd5ac17634aba1dbf9ff3 na verificação deste checkpoint. Isso não equivale a publicação adicional nem prova de experiência autenticada.
- **Roteiro objetivo de UAT:** revisar cabeçalho em desktop/intermediário/mobile, chips/menus e avisos de filtros; abrir contato com ficha na terceira coluna, expandir dados fiscal/endereço/financeiro; alternar Assistente/Ação; executar Anotação rápida; confirmar que a conversa permanece operável; verificar Registrar conversa extinto. Não editar dados reais para testar B-01 pois a ficha ainda é somente leitura.

## Checkpoint B-03 a B-06 — implementação em 16/10/2026
- B-03 (#290): merge `9605778eda4fa83ce2337db9749e8c5353d13069`; CI completa passou; UAT pendente.
- B-04 (#291): merge `e3afcb1b9bc32b5a5f01f104730b9ee8a8a962e7`; CI completa passou; UAT pendente.
- B-05: código em PR **#294 aberta**, **sem merge**. A PR de preparação #292 foi encerrada sem merge; última execução de CI da #292 ocorreu num commit anterior às correções de criação; NÃO reutilizar aprovação para o SHA final da #294. Nova CI e avaliação do diff são obrigatórias.
- B-06: código em PR **#293 Draft**, **sem merge**. Inclui responsividade, alternância interna mobile, recursos de mídia IA/foto, status cadastral, pedido e retirada de acessos redundantes **somente na branch**, não em produção. Depende da B-05, CI final e verificação real das funcionalidades antes de merge.
- **Não publicar/deployar PRs #294 e #293** até validação de seus próprios SHAs. Manter todos os editores existentes da Inbox na `main` enquanto a B-06 não for integrada.
- O especialista UX deve verificar em preview autenticado a cobertura por seção, a alternância conversa/ficha sem overlay, os fluxos de upload/foto, as ações críticas e a preservação da experiência mobile. Esse teste exige sessão autenticada e não foi concluído pelo CRM 7.
- A sincronização Lovable↔GitHub e o deploy serão conferidos novamente somente após novas merges autorizadas/validadas.
