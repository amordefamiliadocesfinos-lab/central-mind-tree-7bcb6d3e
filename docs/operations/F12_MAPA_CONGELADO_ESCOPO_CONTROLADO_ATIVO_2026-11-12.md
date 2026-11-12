# F12 — MAPA CONGELADO, ESCOPO CONTROLADO E FRENTE ATIVA
**Projeto:** PAINEL CENTRAL — AMOR DE FAMÍLIA
**Especialidade:** Integração Shopee / Integration Hub
**Decisão expressa:** 12/11/2026 — congelar mapa/escopo, **não encerrar a frente**.
**Estado:** **F12 ABERTA — DESENVOLVIMENTO CONTÍNUO SOB ESCOPO CONGELADO**.
**Autoridade:** Mapa Mestre Integração Shopee V2; mini-mapa F12 de 11/11/2026.
**Substitui somente:** interpretação errada de "encerramento administrativo" na PR #638 / documento histórico de 12/11; não apaga evidências nem muda a arquitetura.

## Objetivo imutável
Tornar o processo automático da conta Shopee Adão — captura, registro no Core, `ship_order`, criação e vinculação do PDF oficial — seguro e capaz de acompanhar meta de **100 pedidos/dia**, com observabilidade, fila justa, idempotência e posterior expansão multicontas. A meta de escala **não está homologada**. Não criar sistema paralelo.

## Frentes congeladas — nenhuma nova frente implícita
| Frente | Entrega | Situação comprovada em 12/11/2026 | Saída ainda exigida |
|---|---|---|---|
| **F12.1 — Lote inicial 3+3** | Até 3 envios + 3 etiquetas sequenciais por ciclo, com proteção de orçamento | Código na `main`, Cloud Run Adão `integration-hub-00255-rug` evidenciado; 2 envios confirmados no mesmo ciclo; PED-00417 a PED-00422 com `ship_order` API success e PDF no Core | Homologação máxima de 3 por tipo no mesmo ciclo; métricas de latência/erros |
| **F12.2 — Fila justa** | Prioridade por prazo oficial, idade, rotação, reconciliação sem reenvio | PR #623 (antiguidade) e #625 (`ship_by_date` validado) mergeadas na `main` | Build/deploy F12.2 na revisão isolada Adão ainda não comprovados; validar em uso real e superar injustiça entre páginas |
| **F12.3 — 100 pedidos/dia** | Fases resumíveis e ensaio sintético com 100 pedidos; rollout real 10→30→100 | Planejada; sem prova de desempenho de 100/dia | Implementação e medições por fase, sem pressupor limite da API |
| **F12.4 — Multicontas** | Escalar para Viviane e demais contas com isolamento | Não iniciada nesta frente | Somente depois de F12.1–F12.3 comprovadas, com verificação própria por conta |

## Método de execução congelado
1. Trabalhar **na F12**, avançando em sequência F12.1 → F12.2 → F12.3 → F12.4; pendências documentadas não autorizam fuga para F6-O ou nova frente.
2. GitHub oficial como fonte de código e documentação. Core/Supabase como verdade operacional e evidência; Cloud Shell do operador para build/deploy GCP. **Não usar construtor visual da Lovable**.
3. Para cada recorte: diagnóstico mínimo com evidência; mudança pequena; testes de Hub/Node e Core; PR e merge; build/deploy **somente** na tag `adao-teste` com `--no-traffic`; conferir métricas e Core; atualizar mapa e seguir.
4. Preservar os writers e preflight Live, claims duráveis e incertos, tombstones, conta+pedido+pacote, 48s para iniciar novas ações, limites 3+3 até decisão sustentada por provas, snapshots brutos e logs sanitizados; não inserir retries de `ship_order` sem reconciliação.
5. Não acionar OP, produção, estoque, financeiro, CRM, finalização física, postagem ou impressão a partir do mero recebimento/etiqueta; nunca alterar tráfego principal/Viviane implicitamente.
6. F11 impressão visual e status de Central de Separação seguem com seus respectivos responsáveis; PR #639 de interface **não é continuação nem encerramento da F12**. Não reabrir F6-O neste escopo.
7. Registrar distintamente **implementado no GitHub**, **publicado**, **testado sinteticamente**, **comprovado em operação real** e **homologado**. Não confundir esses estados.

## Checkpoint exato para continuidade
- Última versão da F12.2 incorporada no GitHub: PR #625, merge `fef67976a9f5d2b052f1b5dcc1d0bacf3886fc9f`. PR #623: merge `115e0e73c91c1e26f52e551f6fc3e32676274afc`.
- Última revisão Adão comprovada no Cloud Run: `integration-hub-00255-rug` (`adao-teste`, 0% tráfego principal); **não presumir** que contém PR #625.
- **Ação imediata F12.2:** conferir se build/deploy da PR #625 já foram feitos; se não, construir imagem do merge exato e publicar somente na tag Adão após validação de ambiente. Confirmar ciclos naturais, prioridades e integridade no Core.
- **Ação subsequente:** tornar a priorização justa entre páginas, articulada com processamento resumível F12.3. Escopo não pode ser encerrado até evidências e aprovação de congelamento final.

## Critério para eventual encerramento (não atingido)
Somente após as quatro frentes terem seus critérios de aceite provados, com escala medida, integridade validada e decisão expressa do proprietário. **Congelamento do mapa NÃO significa encerramento do desenvolvimento.**


## Checkpoint incremental — F12.3, 12/11/2026 (sem alterar o escopo)
**F12.3 INICIADA EM CÓDIGO, NÃO HOMOLOGADA.** PR #647 introduz `services/integration-hub/src/shopee-adao-resumable-discovery.mjs` e testes de 100 pedidos **sintéticos**, somente leitura e fora de qualquer rota ativa. O teste cobre dez páginas em cinco fatias de até duas páginas com janela temporal congelada, identidade Adão, cursores validados, máximo de 100 pedidos e rejeição de estado inválido. Testes Node22 Hub/contêiner e Core/Postgres aprovados; TypeScript geral permanece falhando no módulo Saúde sem ligação com F12. Não houve chamadas de envio, escrita de pedidos, migration, deploy ou mudança de Scheduler nesta PR.

**Próximos recortes dentro da mesma F12.3:** (1) definir contrato durável Core para checkpoint/fencing e controle contra execução concorrente, preservando claims por pedido; (2) integrar leituras resumíveis com writer existente sem falsos reprocessamentos; (3) ensaiar 100 pedidos simulados end-to-end e medir latência, chamadas e falhas; (4) observar rollout Adão 10/30/100 apenas com evidência de segurança e condições reais. Não afirmar capacidade real de 100 pedidos/dia por causa do teste de leitura.
