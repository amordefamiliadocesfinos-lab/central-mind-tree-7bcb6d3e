# MAPA MESTRE — INTEGRAÇÃO SHOPEE ↔ PAINEL CENTRAL V2

**Data de consolidação:** 2026-10-14  
**Status:** mapa operacional vigente após F6-K  
**Escopo:** Shopee Open Platform BR + Integration Hub + Painel Central  
**Princípio:** CONSTRUIR → USAR → OBSERVAR → CORRIGIR → EVOLUIR

---

## 1. OBJETIVO OPERACIONAL FINAL

O operador deve trabalhar prioritariamente dentro da **Central de Separação do Painel Central**.

Fluxo-alvo:

**Pedido entra na Shopee → Hub detecta/recebe → Raw → normaliza → mapping → Pedido + Itens + Separação → fiscal/logística Shopee → etiqueta pronta no Painel → imprimir → separar → finalizar → expedir.**

O operador não deve depender de alternância contínua entre Painel Central e Seller Center Shopee para executar a rotina física.

### Decisão operacional congelada

Para pedidos Shopee:

- a **Shopee permanece fonte primária do fluxo fiscal/logístico**;
- a emissão de NF-e já é feita atualmente no Seller Center pelo botão **Emitir NF-e**;
- depois da NF-e, o operador usa **Organizar Envio**;
- a etiqueta/documento de postagem é gerado a partir desse fluxo;
- o Painel Central deve evoluir para **acompanhar/acionar essas etapas quando permitido pela API e trazer a etiqueta pronta para a Central de Separação**;
- não criar, neste momento, emissor fiscal paralelo para substituir a Shopee.

---

## 2. REGRAS SOBERANAS PRESERVADAS

- Pedido ≠ OP.
- Criar Pedido ≠ baixar estoque.
- Estoque muda apenas por fato físico.
- Estado externo Shopee ≠ estado interno do Painel.
- API/webhook/XLSX precisam ser idempotentes.
- Integração é multi-conta.
- XLSX permanece contingência.
- Secrets ficam somente no backend.
- Hub executa integração; Core continua soberano sobre negócio.
- Dados externos entram em quatro camadas: **Origem → Registro bruto → Projeção → Ação**.
- Mapeamento de anúncio/variação deve ser exato e fail-closed; não usar fuzzy para nascimento automático de pedido.
- A criação automática de Pedido não cria Financeiro, CRM, Contato, OP ou baixa de estoque.

---

## 3. ESTADO ATUAL COMPROVADO

### F1–F5 — Fundação / OAuth / Hub
**CONCLUÍDO**

- Integration Hub no Google Cloud Run.
- VPC/NAT/IPv4 estático.
- Core Bridge HMAC.
- OAuth Live Shopee comprovado.
- conta piloto: **SHOPEE VIVIANE**.
- serviço privado por IAM.
- egress IPv4: **34.151.213.190**.

### F6-B / B.1 — leitura segura + refresh de token
**CONCLUÍDO**

- leitura de conexão OAuth;
- Raw Snapshot list/detail;
- refresh atômico;
- sem efeitos operacionais.

### F6-C — ingestão Live para Raw
**CONCLUÍDO**

- get_order_list;
- get_order_detail;
- refresh controlado;
- persistência apenas Raw.

### F6-D — normalização
**CONCLUÍDO**

- contrato puro e fail-closed;
- PII não necessária suprimida.

### F6-E — mapping preview
**CONCLUÍDO**

- reconhecimento exato anúncio/variação;
- isolamento por conta;
- estados recognized / needs_mapping / ambiguous / invalid_mapping.

### F6-F — mappings faltantes do piloto
**CONCLUÍDO**

- Alfajor SH-002-015;
- Glucodry SH-002-006 / 1 kg.

### F6-G — projeção interna
**CONCLUÍDO**

- Raw + mapping → candidato a Pedido;
- composição física expandida;
- sem escrita.

### F6-H — contrato de nascimento do Pedido
**CONCLUÍDO**

Nascimento congelado:

- status = pendente;
- operational_status = todo;
- order_type = stock;
- payment_status = pendente;
- sale_origin = shopee_open_platform;
- sem Contato/CRM/Financeiro/OP;
- Separação criada em todo.

### F6-I — writer real Pedido + Itens + Separação
**CONCLUÍDO**

- Core Bridge writer;
- idempotência por conta + order_number;
- sem estoque/financeiro/CRM/OP.

### F6-J — ingestão automática controlada / preview oficial
**CONCLUÍDO E COMPROVADO EM RUNTIME**

- seleção server-side de Raw elegível;
- normalização + mapping + projeção + contrato;
- rota privada preview-only;
- 2 pedidos reais ready;
- zero writes comprovado.

### F6-K — primeiro commit real controlado
**CONCLUÍDO E COMPROVADO EM PRODUÇÃO**

Pedido real persistido:

- order_sn: **261014HRQJ4QHT**
- 1 Pedido;
- 2 order_items;
- 1 Separação todo;
- composição: 3 Branco + 3 Meio Amargo;
- total comercial R$ 20,21;
- nenhum efeito proibido;
- commit gate desarmado após a prova.

Pedido real ainda elegível e não persistido:

- **261013HKHWK3V7**

---

## 4. NOVO MAPA DE FRENTES

A partir deste ponto, as frentes deixam de ser apenas “trazer pedido” e passam a fechar a operação Shopee completa.

### F6-K.1 — Política operacional de commit
**PRÓXIMA**

Objetivo:
- transformar o commit comprovado em política segura de execução;
- definir lote máximo, concorrência, retries, erro parcial, auditoria e condição de reprocessamento;
- manter fail-closed e idempotência.

Critério de saída:
- regra formal para execução automática sem intervenção manual por pedido.

---

### F6-L — Scheduler / execução recorrente
**PENDENTE**

Objetivo:
- disparar a ingestão automaticamente em cadência definida;
- eliminar comando manual;
- manter Cloud Run privado.

Inclui:
- scheduler/job;
- controle por conta;
- limite de lote;
- registro da rodada;
- retentativa segura.

Critério de saída:
- novo pedido elegível entra sozinho no Painel em poucos minutos.

---

### F6-M — Webhooks Shopee
**PENDENTE**

Objetivo:
- receber eventos oficiais Shopee para reduzir polling e latência;
- Raw primeiro, ação depois.

Inclui:
- autenticação/validação webhook;
- deduplicação;
- persistência Raw;
- reconciliação com polling.

Critério de saída:
- eventos Shopee chegam de forma confiável e idempotente.

---

### F6-N — Reconciliação de pedidos
**PENDENTE**

Objetivo:
- comparar Shopee x Painel ao longo do ciclo;
- detectar divergências sem corromper estado interno.

Inclui:
- cancelamento;
- alteração de status;
- pedido ausente;
- reprocessamento;
- pedido já existente;
- eventos fora de ordem.

Critério de saída:
- inconsistências ficam visíveis e tratáveis.

---

### F6-O — Fiscal + Logística Shopee + Etiqueta na Separação
**PRIORIDADE OPERACIONAL ALTA**

Objetivo final:
**operador abre somente a Central de Separação e encontra a etiqueta pronta para imprimir.**

Fluxo real hoje observado no Seller Center:

**Emitir NF-e → Organizar Envio → obter etiqueta/documento de postagem.**

Missão técnica:
1. mapear capacidades reais da Open Platform BR para:
   - consultar estado fiscal;
   - emissão/acionamento de NF-e, se permitido;
   - consultar estado de envio;
   - organizar envio, se permitido;
   - obter/download de etiqueta/documento logístico;
2. preservar a Shopee como fonte primária fiscal/logística;
3. integrar documentos/estado à Separação;
4. permitir impressão pelo card do Painel.

Resultado-alvo na Central de Separação:
- NF-e: pendente / emitida / erro;
- envio: pendente / organizado / erro;
- etiqueta: indisponível / pronta;
- botão **Imprimir etiqueta**;
- documento vinculado ao Pedido/Separação.

Regra:
- se uma ação fiscal/logística não estiver disponível por API, o Painel acompanha o estado e mantém a etapa manual mínima no Seller Center;
- não inventar automação por scraping como arquitetura canônica.

Critério de saída:
- pedido Shopee pronto para operação física dentro do Painel, com etiqueta disponível sem navegação rotineira no Seller Center.

---

### F6-P — Exceções logísticas / cancelamentos / devoluções
**PENDENTE**

Objetivo:
- tratar eventos que acontecem depois do nascimento do Pedido.

Inclui:
- cancelado;
- falha fiscal;
- falha ao organizar envio;
- etiqueta indisponível;
- devolução;
- retorno;
- alteração logística.

Critério de saída:
- exceções não exigem correção manual de banco e ficam operáveis no Painel.

---

### F6-Q — Multi-conta real
**PENDENTE**

Objetivo:
- expandir da loja piloto para demais contas Shopee;
- cada conta isolada em OAuth, mappings, cursor, execução e erros.

Critério de saída:
- duas ou mais contas funcionando sem cruzamento de dados.

---

### F6-R — Observabilidade operacional
**PENDENTE**

Objetivo:
- tornar a integração administrável no dia a dia.

Inclui:
- última sincronização;
- pedidos ready;
- bloqueados;
- erro de mapping;
- erro fiscal/logístico;
- retry;
- tempo desde evento Shopee;
- status por conta.

Critério de saída:
- operador/supervisor consegue saber o estado da integração sem olhar logs técnicos.

---

## 5. CAMADAS POSTERIORES À F6

### F7 — Financeiro Shopee
Marketplace → taxas → comissão → repasse → recebimento → conciliação.

Não confundir criação de Pedido com recebimento financeiro.

### F8 — Sincronização de estoque
Painel → disponibilidade publicável → Shopee.

Somente depois que regras de estoque físico e reserva estiverem congeladas para marketplace.

### F9 — Catálogo / anúncios / preço
Anúncios, variações, SKU, estoque comercial, preço, promoções e estado ativo/pausado.

Não misturar com Motor Econômico enquanto essa frente permanecer separada.

### F10 — Inteligência / exceções avançadas
Indicadores, performance por conta/anúncio, falhas recorrentes, alertas e automações supervisionadas.

---

## 6. ORDEM RECOMENDADA ATUALIZADA

**F6-K.1 → F6-L → F6-M → F6-N → F6-O → F6-P → F6-Q → F6-R → F7 → F8 → F9 → F10**

### Observação de prioridade

A **F6-O** ganhou importância operacional após observação de uso real.

Assim que a ingestão automática estiver estável (K.1 + L), a frente fiscal/logística deve ser antecipada se necessário para reduzir troca de sistemas na operação.

Sequência prática possível:

**K.1 → L → O → M → N → P → Q → R**

se a necessidade operacional de etiqueta pronta superar a prioridade de webhook.

---

## 7. EXPERIÊNCIA FINAL DO OPERADOR

O estado desejado da Central de Separação para um Pedido Shopee é:

**Pedido recebido**  
→ **NF-e emitida**  
→ **Envio organizado**  
→ **Etiqueta pronta**  
→ **IMPRIMIR**  
→ Em preparação  
→ Finalizado / expedido

O operador não precisa conhecer OAuth, Raw Snapshot, mappings, Hub, Core Bridge ou Open Platform.

Essas camadas existem para garantir que a operação física seja simples, segura e rastreável.

---

## 8. NÃO FAZER

- não criar emissor fiscal paralelo para Shopee sem necessidade real;
- não baixar estoque na criação do Pedido;
- não expor commit genérico ao browser;
- não permitir account/order controlado pelo caller;
- não criar pedido com mapping incerto;
- não usar scraping do Seller Center como contrato principal;
- não misturar integração de Pedido com Financeiro, Estoque ou Motor Econômico;
- não forçar o operador a abrir múltiplos sistemas se a API permitir centralização no Painel.

---

## 9. MARCO ATUAL

**Marco comprovado em 2026-10-14:**

Um pedido real da Shopee já percorreu a cadeia e nasceu corretamente no Painel Central como:

**Pedido + Itens + Separação**

sem efeitos colaterais proibidos.

O próximo marco é:

**pedido novo entrar e nascer automaticamente sem comando manual.**

O marco operacional posterior é:

**pedido Shopee aparecer na Central de Separação já com a etiqueta pronta para imprimir.**
