# F12 — ENCERRAMENTO ADMINISTRATIVO DA RODADA E REPASSE DE PENDÊNCIAS
**Projeto:** Painel Central — Integração Shopee
**Data:** 12/11/2026
**Decisão do proprietário:** encerrar a rodada corrente de desenvolvimento da F12 e prosseguir a outra frente do Mapa Mestre.
**Classificação:** ENCERRADA PARA ESTA RODADA, **NÃO** homologada integralmente.
**Fonte soberana:** `docs/operations/MAPA_MESTRE_INTEGRACAO_SHOPEE_PAINEL_CENTRAL_V2.md`; plano `docs/operations/F12_MINI_MAPA_ESCALABILIDADE_SHOPEE_2026-11-11.md`.

## 1. Entregas e evidências comprovadas
- F12.1: motor Adão até 3 tentativas de organização e 3 de etiquetas por ciclo, limiar global de 48 segundos para iniciar novas operações, claims duráveis Core, preflight Live, isolamento de conta e repetição proibida para tentativas incertas.
- PR #618: contadores operacionais sanitizados no Cloud Logging; PR #620: logística por página para não consumir o orçamento somente com leitura.
- Evidência Cloud Run: revisão `integration-hub-00255-rug` publicada na tag `adao-teste`, 0% do tráfego principal, a partir da PR #620; os ciclos seguintes registraram 2 candidatos, 2 tentativas, 2 `shipment_acknowledged` e até 3 tentativas de etiqueta. A capacidade **máxima simultânea de 3+3 não foi homologada**.
- Evidência Core/Shopee: PED-00417 a PED-00422 com `ship_order` confirmado `api_success` e PDFs oficiais em `order_documents`/Storage. A confirmação logística não implica postagem, entrega, separação física nem baixa de estoque.
- F12.2: PR #623 (antiguidade/rotação) e PR #625 (`ship_by_date` oficial validado no detalhe de pedido) incorporadas à `main`; testes de Hub/contêiner e Core/Postgres aprovados. O TypeScript global permanece falhando em módulo Saúde alheio à frente.
- A publicação **da F12.2** no Cloud Run **não está comprovada**. Não substituir o estado da revisão Adão acima por suposição.

## 2. Pendências deliberadamente preservadas
1. Publicar/homologar F12.2 quando retomada; verificar prazo da Shopee, fallback, rotação e observação de dados reais.
2. Justiça **global** entre páginas: o trabalho por página impede que candidatos de páginas não lidas sejam ranqueados globalmente.
3. Evidência operacional de 3 tentativas de envio + 3 de etiqueta em um mesmo ciclo, com latência/custo.
4. F12.3: desenho resumível e ensaio sintético de 100 pedidos, seguido de rollout real progressivo de 10/30/100; nenhum resultado de 100 pedidos/dia deve ser anunciado.
5. F12.4: multiconsta após comprovação da escala; Viviane não herda a configuração Adão automaticamente.
6. F11 complementar: impressão física em uma folha, observação real de comprador quando disponível.

## 3. Congelamento de segurança
- GitHub como fonte de código; Core/Supabase como fonte de verdade operacional; Cloud Shell para execução GCP; sem construtor visual Lovable.
- Preservar origem e identidade multicontas, bloqueios de tentativas incertas, tombstones, idempotência, histórico de claims, separação `todo/preparing/finalized` independente de `status` comercial e da logística.
- Importar pedido, organizar `ship_order`, criar etiqueta e imprimir **não** equivalem à ordem de produção, baixa de estoque, postagem/coleta ou conclusão da separação.
- Nenhum deploy, migration, processamento de pedidos, mudança em scheduler ou alteração de Viviane é autorizado implicitamente por este encerramento.

## 4. Continuidade na frente já existente do Mapa Mestre
**Próximo foco técnico proposto:** F6-O / Operações — clareza da Central de Separação, com estados distintos para separação física, status comercial Shopee e documento/etiqueta. Evidências de 12/11/2026: `customer_name` vazio nos recentes; cartões finalizados com status comercial pendente; documentos PDF comprovados no Core. Não reclassificar estados por aparência, não preencher cliente sem fonte legítima.
**Método:** diagnóstico cirúrgico no código e contrato do Core, testes de regressão, PR pequena e publicação isolada conforme escopo; sem reconstruir o Hub nem reabrir F12.
