# F12 — MINI MAPA: ESCALABILIDADE OPERACIONAL SHOPEE
**Projeto:** Painel Central — Amor de Família
**Data:** 11/11/2026
**Situação:** **MAPA/ESCOPO CONGELADO EM 12/11/2026 — F12 ABERTA E EM DESENVOLVIMENTO**, paralela à F11, sem substituir seu critério de homologação da impressão
**Fonte soberana:** docs/operations/MAPA_MESTRE_INTEGRACAO_SHOPEE_PAINEL_CENTRAL_V2.md

## Objetivo
Transformar o fluxo já comprovado da conta Shopee Adão — pedido → separação → organizar envio → preparar etiqueta → PDF — em um processamento capaz de acompanhar **100 pedidos por dia** sem uma fila operacional de muitas horas. Não criar sistema paralelo. Não alterar Viviane sem uma frente própria e testes específicos.

## Diagnóstico observado
- Agendamento atual: a cada 5 minutos, disparando a rota Adão na revisão Cloud Run `adao-teste`, 0% de tráfego principal.
- Descoberta: até 10 páginas de até 10 pedidos na janela de 48 horas, mas o limite é de **pedidos consultados**, não promessa de ingestão/execução de 100 pedidos em cada ciclo (cada pedido exige Core).
- Writer atual: **máximo de uma organização de envio e uma tentativa de etiqueta por ciclo**; as duas etapas podem coexistir no mesmo ciclo.
- Dois pedidos reais, PED-00417 e PED-00418: `ship_order` confirmado na API da Shopee em 11/11/2026 após reparo do campo `package_number`; as tarefas oficiais de criação da etiqueta também foram confirmadas. Um PDF, PED-00418, vinculado às 15h41 BRT; manter a F11 até homologar `Imprimir Etiqueta + Composição` para esses casos.
- Com apenas 1 ação por ciclo a cada 5 minutos, 100 organizações exigiriam **aproximadamente 8h20 de capacidade acumulada**, sob hipótese ideal de ciclos sucessivos sem falha; não é prazo real garantido.

## F12.1 — Escala inicial controlada (prioridade imediata)
**Implementar:** execução de lotes pequenos e configuráveis na mesma rota Adão, respeitando o limite de tempo por requisição. Primeiro **3 envios e 3 etiquetas por ciclo** em fase piloto; valores maiores só com evidência de desempenho.
**Preservar:** uma organização por pedido validada no preflight Live e claim durável no Core, respostas incertas não reenviadas, histórico de tentativas, nenhuma criação paralela de pedidos, nenhum estoque ou despacho físico artificial.
**Comprovar:** contadores por ciclo e tempo de execução, taxa de sucessos, pendências e recusas por motivo, e se a rota termina antes do limite Cloud Run.

## F12.2 — Fila operacional justa e sem retrabalho
**Implementar:** priorização por prazo real disponível da Shopee e idade da pendência quando fontes confiáveis existirem; rotação justa provisória, tratamento independente de falhas por pedido, reconciliação da etiqueta sem reinvocar `ship_order`.
**Comprovar:** pedido com falha não bloqueia os demais; nenhuma tentativa duplicada; documento existente é reconhecido pelo Core, sem gerar nova etiqueta desnecessária.

## F12.3 — Capacidade para 100 pedidos/dia
**Implementar:** separar leitura e execução em etapas/batches resumíveis, evitar que 100 chamadas individuais ao Core consumam toda a janela de 60s antes de iniciar logística; cursor/paginação duráveis se comprovadamente necessários.
**Comprovar:** ensaio automatizado com 100 pedidos simulados e medição real progressiva em Adão (p. ex., 10, 30, 100), taxas de erro e custo da API/Cloud Run. Ajustar volume e frequência sem assumir limites da Shopee não medidos.

## F12.4 — Operação multiconsta
**Implementar apenas após F12.1–F12.3 comprovadas:** adaptar capacidades à conta Viviane (e futuras contas) com isolamento por identidade, conta, scheduler e claims; não replicar configurações sem medir diferenças de modalidade e etiqueta.

## Regras de convivência com F11
1. **F11 continua prioritária para o PDF oficial e homologação visual do botão `Imprimir Etiqueta + Composição`.**
2. **F12 segue em paralelo no GitHub**, mas toda publicação nova deve preservar a rota e os recursos necessários da F11.
3. Primeiro roll-out de lote deve usar a tag isolada Adão e o agendamento atual; não mudar tráfego principal Viviane, nem criar agendador concorrente.
4. Desempenho sem idempotência não é sucesso: é obrigatório deixar os claims originais intactos, impedir repetição e publicar evidências de regressão.
5. Aumentar de 3 para 5/10 por ciclo apenas quando houver prova real de latência, comportamento da Shopee e integridade dos dados. **3 por ciclo é meta inicial, não capacidade comprovada.**
6. Nenhuma execução de testes deve mudar ou finalizar pedido de cliente fora de pré-verificações válidas e escopo Adão.

## Aceite macro
Receber pedidos, organizar envios e recuperar etiquetas automaticamente em uma janela compatível com a operação, sem fila acumulada, sem duplicação e sem depender do Seller Center para operações elegíveis; o Seller Center continua contingência em caso real de falha externa.

## Estado de execução — checkpoint ativo em 12/11/2026
- **Mapa F12: CONGELADO; frente F12: ABERTA e em desenvolvimento.** Ver arquivo de controle `docs/operations/F12_MAPA_CONGELADO_ESCOPO_CONTROLADO_ATIVO_2026-11-12.md`.
- F12.1: Hub Adão 3+3 publicado; dois envios no mesmo ciclo comprovados e seis PDFs no Core; 3+3 máximo ainda não homologado.
- F12.2: PRs #623 e #625 mergeadas; publicação da última F12.2 no Cloud Run não comprovada; prioridade global entre páginas pendente.
- F12.3: pendente (100 pedidos/dia não homologados).
- F12.4: pendente, condicionada às provas anteriores.
- A interpretação de encerramento da PR #638 foi expressamente **retificada**, sem apagar histórico. A PR #639 da Central de Separação não altera a prioridade da F12.
