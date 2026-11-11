# MAPA MESTRE — INTEGRAÇÃO SHOPEE ↔ PAINEL CENTRAL V2

**Data de consolidação:** 2026-10-14  
**Estado documental:** marco histórico original datado de 14/10/2026; **atualização incremental comprovada de 10/11/2026 na Seção 12**. As seções históricas não foram reclassificadas retroativamente.  
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

---

## 10. F6-O — FLUXO OPERACIONAL DE SEPARAÇÃO CONGELADO (15/10/2026)

**Decisão vigente aprovada após observação do Seller Center e da Central de Separação.** Esta seção refina a descrição fiscal/logística genérica anterior, sem substituir as regras soberanas das seções 1–2 nem criar outro Kanban.

### 10.1 Experiência-alvo

**Pedido Shopee com composição e etiqueta disponível → IMPRIMIR → separar/embalar → entregar fisicamente → integração confirma coleta/postagem → FINALIZADO.**

Manter exatamente três colunas de Operações: **A FAZER (todo)**, **EM PREPARAÇÃO (preparing)** e **FINALIZADO (finalized)**.

- **A FAZER:** mostrar itens, variações, quantidades físicas, etiqueta Shopee oficial quando disponível e estado claro quando pendente. A ação principal IMPRIMIR abre a etiqueta; resumo interno de composição deve permanecer acessível quando necessário. São documentos distintos.
- **EM PREPARAÇÃO:** após acesso válido à impressão, operador separa, embala e encaminha ao ponto de coleta. Exibir **Aguardando coleta** como informação dentro da coluna, não como quarto status.
- **FINALIZADO:** finalizar a separação só com confirmação confiável de coleta/postagem física pela transportadora, recebida via Shopee, ou contingência manual controlada. Finalizar separação não conclui automaticamente o pedido comercial.

**Não considerar** geração de etiqueta, rastreio, Organizar Envio nem o texto genérico SHIPPED, isoladamente, como prova de coleta física. Comprovar a semântica do evento logístico antes de habilitar finalização automática.

### 10.2 Variação fiscal e documental

- **Conta CPF (fluxo observado):** Organizar Envio → rastreio → etiqueta oficial e DACE, quando aplicável.
- **Conta PJ (fluxo observado):** emissão/validação de NF-e pode ser exigida antes de Organizar Envio. Determinar pendência por conta e pedido; não impor NF-e universalmente apenas pelo perfil CPF/PJ.
- A Shopee permanece origem fiscal/logística. Não criar emissor fiscal paralelo por padrão.
- Etiqueta Shopee, resumo interno, DACE e NF-e são documentos de finalidades diferentes; preservar tipo, origem, vínculo com conta, pedido e pacote.
- Impressão individual confiável é prioridade; emissão/impressão em massa é evolução futura, não bloqueio inicial.

### 10.3 Evento físico, estoque e contingência

- Impressão não é postagem e **não baixa estoque**. Documento indisponível ou abertura bloqueada não deve marcar impresso nem mover A FAZER para EM PREPARAÇÃO.
- A finalização atual centraliza baixa física idempotente na RPC **finalize_order_separation**; automação futura deve reutilizar caminho seguro no Core, identificar precisamente conta + pedido + pacote, deduplicar e auditar.
- Confirmar coleta por sinal confiável de transportadora/postagem real, com referência temporal, evento e testes no piloto, antes de disparar a finalização e respectiva saída física.
- Sem evidência suficiente, manter EM PREPARAÇÃO, indicar aguardando coleta e permitir contingência manual conforme permissões existentes.
- Outros canais e modalidades logísticas não são alterados; respeitar as regras de estoque e destino físico. Hub não pode escrever diretamente entidades soberanas do Core.

### 10.4 Execução progressiva

1. **F6-O.2a — Impressão segura no Painel:** quando existir documento shipping_label, priorizá-lo em IMPRIMIR; manter composição interna disponível. Uma falha ao abrir documento não pode marcar a impressão. PR e preview antes de uso real.
2. **F6-O.2b — Etiqueta oficial Shopee:** consultar disponibilidade, tipo, tarefa e download usando API autorizada, vincular documento à separação e identificar pendências. Geração de documento ou mudança externa de envio depende de janela específica de autorização.
3. **F6-O.2c — Coleta confirmada → finalização:** investigar eventos de rastreio/webhook, comprovar semântica de coleta real, sincronizar pelo Hub/Core de maneira idempotente e registrar saída física no evento correto. Nunca finalizar por SHIPPED isoladamente.
4. **F6-O.2d — Exceções e evolução:** falha fiscal, etiqueta indisponível, divergência de pacote, falta de confirmação, fallback manual e depois lote/impressão em massa.

**Estado da F6-O.1d em 15/10/2026:** Hub publicou SHA a0db175e0f2ebd6e9f93cac28d55ae3361611477 e comprovou saúde. A prova Live no pedido 261013HKHWK3V7, estado SHIPPED, teve GET get_shipping_parameter rejeitado por error_param (causa específica não comprovada), mas POST get_shipping_document_parameter aceito com tipos NORMAL_AIR_WAYBILL e THERMAL_AIR_WAYBILL. Isso não significa etiqueta gerada. Não insistir no GET de pedido já expedido por tentativa e erro.

**Congelado como regra, NÃO como implementação concluída:** O.2b/O.2c dependem de código, testes e autorização produtiva específicos; scheduler e gates permanecem desarmados.



### 10.5 F6-O.2b — Sincronização de etiqueta pronta (implementação em validação)

**Escopo em branch (não comprova deploy nem prova Live):**
- Fonte oficial BR: get_shipping_document_parameter → create_shipping_document (quando necessário; NÃO acionado aqui) → get_shipping_document_result (somente consulta) → download_shipping_document (somente se READY).
- O.2b suporta **PDF NORMAL_AIR_WAYBILL** único de um pedido/pacote piloto, previamente preparado pela Shopee; impede PDF/ZIP/HTML inválido, múltiplos pacotes, status PROCESSING/FAILED e token expirado.
- O Hub possui rota privada POST /internal/shopee/live/logistics/label/sync-once, sem corpo nem query; pedido fixado pelo ambiente e gate SHOPEE_LIVE_LABEL_SYNC_ENABLED **false por padrão**.
- O Hub obtém o PDF somente de Shopee, valida tipo, tamanho máximo 4 MiB, assinatura PDF e SHA-256. A Edge Function Core verifica conta/pedido Shop-ID e emite URL temporária de upload privado; o Hub envia bytes diretamente ao bucket privado dedicado shopee-labels (acesso restrito por papel operacional); o Core baixa de novo, confere tamanho/hash/assinatura e registra order_documents.shipping_label.
- Vinculação é determinística e deve ser única por storage_bucket/storage_path; migration da unicidade precisa ser aplicada no Lovable Cloud **antes de autorizar sync-once em produção**, mediante aprovação específica.
- O Painel já consulta a metadata order_documents na Central de Separação em tempo real; PR #272 prioriza shipping_label no botão IMPRIMIR. A RLS existente para documentos legados era ampla, portanto a migration inclui bucket isolado shopee-labels e restrição específica para metadados Shopee sem alterar documentos de outras origens. Nenhum endereço assinado ou credencial aparece no frontend; somente documento autorizado com URL temporária privada.
- O operador **não** recebe mensagem de sucesso sem documento persistido. A funcionalidade não cria tarefas de documento, organiza envio, emite NF-e ou finaliza separação.
- Enquanto não houver documento READY, mostrar indisponibilidade e manter trabalho manual normal no Seller Center. Fluxo de geração da tarefa, tratamento de formatos ZIP/ZPL e operação em massa ficam para uma etapa explicitamente autorizada.
- A sincronização periódica/por pedido ainda não é ativada nesta entrega piloto; requer validação do caminho privado e política de agendamento e idempotência apropriadas.

**Evidência técnica para revisão:** Guia de Logistics para Brasil (cópia de referência Shopee Open Platform) e FAQ integrado indicam download após READY e PDF binário, não URL do Seller Center. Não reutilizar links de sessão de navegador como fontes permanentes de etiqueta.


---

## 11. F6-O — AUTOMACAO DE PREPARACAO, FISCAL POR CONTA (15/10/2026)

**Decisão operacional aprovada:** priorizar o recebimento e a preparação de pedidos 100% automáticos até a disponibilização da etiqueta oficial na Central de Separação, sem exigir operação diária no Seller Center. O operador deve concentrar-se em **IMPRIMIR, SEPARAR, EMBALAR E ENTREGAR**; confirmação confiável de coleta finaliza a Separação posteriormente (F6-O.2c). Isso refina as seções 10.2–10.4, sem reabrir ou invalidar O.2a/O.2b.

### 11.1 Dois caminhos por conta, sem presumir pela etiqueta ou pelo nome

- **Fluxo operacional CPF:** no funcionamento mostrado pelo usuário, a conta prepara envio sem etapa de emissão de NF-e no Seller Center. O Painel deve seguir as exigências efetivas do pedido e as obrigações fiscais aplicáveis; perfil CPF não comprova dispensa fiscal universal.
- **Fluxo operacional PJ:** a conta piloto utiliza emissor fiscal **da própria Shopee**, já configurado no Seller Center. **Primeira opção é reutilizar esse emissor, sem usar o Fiscal Pro como rotina.** O Hub deve ler `invoice_data.status`/`pending_reason` e só avançar logisticamente quando a validação fiscal estiver adequada.
- **Decisão de roteamento precisa de perfil explícito por conta, e não inferência por nome:** natureza da conta, origem do emissor e regras aplicáveis devem ser verificáveis e auditáveis. Atualmente o cadastro de `channel_accounts` não possui perfil fiscal dedicado; `metadata` das contas Shopee ativas está vazio, e apenas **SHOPEE VIVIANE** possui OAuth Live registrado. Não ativar automaticamente fluxo CPF para uma loja sem conexão.
- **Fallback desejado:** se a API/conta não suportar a emissão fiscal Shopee ou a organização de envio/etiqueta, o operador resolve **somente a etapa indisponível** no Seller Center; após confirmação por API, a automação retoma as etapas seguintes. Não obrigar operador a fazer tudo manualmente.

### 11.2 Matriz de capacidade: existente ≠ comprovado na conta

- **Pedido → Core:** importação/persistência real já comprovadas em piloto; automatização contínua de novos pedidos depende da ativação controlada do pipeline existente.
- **Status fiscal:** Open API `get_order_detail` informa `invoice_data.status` (`pending`/`valid`) e motivo da pendência; validação de elegibilidade por loja/pedido é obrigatória.
- **Emissão fiscal pelo emissor nativo Shopee:** funcionalidade do Seller Center informada como já configurada pelo operador; **NÃO foi identificada ainda operação pública Open Platform comprovada que acione esse emissor diretamente em pedidos comuns do Brasil**. Não confundir com `add_invoice_data` (informar nota existente), `download_invoice_doc` (baixar documento previamente disponibilizado), nem `generate_fbs_invoices` (documentos FBS).
- **Organizar envio:** `get_shipping_parameter` seguido de `ship_order` é capacidade documentada; exige parâmetros elegíveis e estado logístico correto. A implementação atual do Hub ainda não invoca `ship_order`; esse writer requer janela de autorização, idempotência, logs e fail closed.
- **Etiqueta:** `get_tracking_number` → `create_shipping_document` (quando faltar tarefa) → `get_shipping_document_result=READY` → `download_shipping_document`; F6-O.2b implementou **somente consulta/download de documento READY**, não solicitação de tarefa nem preparo de envio.
- **Coleta física:** deve continuar independente da criação da etiqueta ou do status genérico SHIPPED; automatização de finalização/baixa apenas com evento de transportadora devidamente comprovado.

### 11.3 Próxima execução técnica e evidências exigidas

1. **F6-O.2e.1 — laboratório fiscal/logístico somente leitura:** verificar capacidades da conta-piloto PJ no contrato autenticado Shopee Open Platform (principalmente a possibilidade real de acionar emissor nativo) e observar `invoice_data.status`, `pending_reason`, `package_detail` e opções de envio em pedidos elegíveis. Evidência da interface Seller Center serve para compreender fluxo, mas não prova acesso pela API.
2. **F6-O.2e.2 — preparação logística piloto:** se API suportar, implementar `get_shipping_parameter` → `ship_order` para um pedido elegível com gates próprios, anti-replay, conta/pacote exatos, sem baixa de estoque e sem ativação geral.
3. **F6-O.2e.3 — completar geração de etiqueta:** após rastreio disponível, implementar `create_shipping_document`, aguardar `READY` e reutilizar download privado F6-O.2b. Tratar indisponibilidade fiscal ou do documento como exceção legível no card.
4. **F6-O.2e.4 — dois fluxos e escalonamento:** habilitar progressivamente por conta, após prova CPF/PJ e perfil fiscal explícito; fluxo manual estritamente limitado ao bloqueio comprovado do emissor/etiqueta.
5. **F6-O.2c — confirmação de coleta e finalização física:** permanece como frente distinta e posterior, com evidência externa e writer idempotente do Core.

**Não autorizado por este registro:** emissão fiscal, `ship_order`, `create_shipping_document`, refresh OAuth, mudanças no scheduler/gates, alterações fiscais, migrations, Cloud Run ou writes produtivos. Não habilitar integração para outras contas sem vínculo OAuth válido e regras por loja comprovadas.


### 11.4 F6-O.2e.2a — Pré-check fiscal e logístico read-only (código em validação)

**Entrega mínima anterior a qualquer writer `ship_order`.** Em branch, o Hub expõe a rota IAM privada `POST /internal/shopee/live/logistics/shipping/preflight-once`, desligada por padrão pela variável `SHOPEE_LIVE_SHIPPING_PREFLIGHT_ENABLED`. A rota não aceita filtros de pedido enviados pelo cliente; consulta apenas o pedido-piloto fixado em `SHOPEE_LIVE_SHIPPING_PREFLIGHT_ORDER_SN`.

- `SHOPEE_LIVE_SHIPPING_FISCAL_MODE` **não tem default**: piloto exige configuração explícita `pj_shopee_issuer` ou `cpf_no_invoice_step`; **não equivale a dispensa fiscal legal** e não habilita fluxo produtivo.
- Exige conexão OAuth piloto válida e parceiro correto, sem executar refresh.
- Consulta pedido Shopee (ordem e pacote único exatos) e rejeita status diferente de `READY_TO_SHIP` para primeira organização de envio. Estados de reagendamento e múltiplos pacotes são casos posteriores.
- Antes de `get_shipping_parameter`, exige evidência em `package_list[].logistics_status`: `LOGISTICS_READY` ou `LOGISTICS_PICKUP_RETRY`. Pacote/status ausente ou desconhecido bloqueia. `LOGISTICS_REQUEST_CREATED` exige condições específicas de reagendamento não implementadas e permanece bloqueado. Contratos: [parâmetros de envio](https://open.shopee.com/documents/v2/v2.logistics.get_shipping_parameter?module=95&type=1) e [detalhe do pedido](https://open.shopee.com/documents/v2/v2.order.get_order_detail?module=94&type=1).
- PJ exige `invoice_data.status=valid`; pendência fiscal detectada bloqueia ambos os modos. Estado fiscal ausente no PJ bloqueia. O preflight não emite, envia nem baixa NF-e.
- Se elegível, chama **apenas GET assinado** de `get_shipping_parameter`; a saída sanitiza as modalidades `pickup`, `dropoff` ou `non_integrated`, sem devolver endereços, campos pessoais nem tokens.
- A saída fixa `auto_arrangement_authorized=false` até existir política explícita de escolha de modalidade/endereço/filial e writer idempotente persistido no Core. Não chamar `ship_order`, `create_shipping_document`, `get_tracking_number` ou qualquer operação de escrita nesta etapa.

**Estado:** F6-O.2e.2a aprovada, testes 268/268 PASS no ambiente Codex/Node22 e Docker, integrada à main pela PR #276 no merge `309b2a706ffb5e9ab9565873c70413ea8f373b1a` (15/10/2026). Rota preflight permanece desligada; nenhuma execução Shopee Live nem implantação da nova rota. Próxima prova read-only exige janela própria. Organizar envio requer writer idempotente separado.


### 11.5 F6-O.2e.2b — Contratos assinados de `ship_order` / rastreio (código em validação)

**Escopo estritamente de biblioteca — NÃO acionável em produção nesta etapa.** `shipOrderSimpleDropoff()` monta uma chamada POST assinada Shopee `/api/v2/logistics/ship_order` com pedido e pacote exatos, **somente** quando `get_shipping_parameter.info_needed` contém exclusivamente `dropoff: []`. O payload é `{order_sn,package_number,dropoff:{}}`. Outros requisitos (`sender_real_name`, `branch_id`, pickup, não integrado, campos adicionais, multimodalidade) bloqueiam, sem adivinhar parâmetros. `getTrackingNumber()` implementa GET assinado para ler rastreio do pedido/pacote; resultado vazio não é confirmação de postagem.

- Não expor rota `ship_order`, não acrescentar scheduler nem ativar gate nesta PR. O cliente da Open Platform é capaz de enviar POST **somente se uma futura camada de orquestração chamá-lo**. A implementação atual não efetua chamadas por si mesma.
- **Futura condição obrigatória:** confirmar evidência atualizada de conta, perfil fiscal, pedido, pacote e parâmetros, garantir token íntegro, política logística permitida e adquirir **claim durável atômico de idempotência no Core** para conta + pedido + pacote + operação antes de qualquer writer.
- Após POST, registrar request_id, resposta/situação, transições e ambiguidades com trilha auditável; timeout/resultado incerto deve impedir retry cego e exigir reconciliação por leitura.
- A devolução de rastreio não prova coleta física. A finalização/baixa continua exclusiva do processo F6-O.2c mediante sinal confiável de evento físico.
- Referências contratuais: [ship_order](https://open.shopee.com/documents/v2/v2.logistics.ship_order?module=95&type=1), [get_tracking_number](https://open.shopee.com/documents/v2/v2.logistics.get_tracking_number?module=95&type=1). Para Brasil, `dropoff: []` documentado em anúncio Shopee de 19/01/2026; seguir estritamente `info_needed` do pedido real.

**Estado:** PR #277 aprovada (295/295 testes PASS, build Docker PASS), mesclada na `main` pelo commit `3f76bc8178f7c78a68394d4492f9170b13b32f23`. Biblioteca assinada presente no código, sem rota executável nem deploy posterior ao F6-O.2b.


### 11.6 F6-O.2e.2c — Controle durável de idempotência de `ship_order` (em implementação isolada)

**Alvo:** impedir que instâncias concorrentes do Hub, dois cliques, timeouts ou reprocessamentos organizem o mesmo envio da Shopee mais de uma vez. A **reserva e a verdade das tentativas são soberanas do Core**, jamais gravadas diretamente pelo Hub ou no browser.

**Novo ledger preparado:** `public.shopee_shipping_arrangement_attempts` com identidade única `(channel_account_id,order_sn,package_number,operation)`, vínculo com o pedido canônico, shop_id da conexão OAuth, hash SHA-256 do payload de POST, estado `claimed | succeeded | uncertain`, instante de claim e resolução. Sem autoexpiração do claim, sem retry automático e com RLS sem políticas de leitura/escrita para usuários; duas RPCs `claim_shopee_shipping_arrangement` e `resolve_shopee_shipping_arrangement` somente `service_role`. A nova migration `20261015233000_shopee_shipping_arrangement_idempotency.sql` **NÃO FOI APLICADA**.

**Core Bridge:** apenas ações HMAC v1 `shopee.shipping_arrangement.claim` e `shopee.shipping_arrangement.resolve`, schema estrito. O Core valida conta Shopee ativa, Shop-ID OAuth Live, um pedido canônico da mesma conta, operação limitada a `ship_order`; claim concorrente é barrado no índice único. Status já `claimed`, `succeeded`, `uncertain` ou alteração de hash/Shop-ID não permite nova autorização de envio.

**Hub:** `createGuardedShopeeShipOrder()` está preparado como biblioteca interna, **sem rota HTTP e sem agendamento**, com gate extra `SHOPEE_LIVE_SHIP_ORDER_ENABLED` desabilitado por padrão. Só admite preflight fiscal/logístico atual bem-sucedido para **pedido/pacote exatos** com `info_needed={dropoff: []}`, perfil configurado e OAuth válido; obtém claim fresco no Core antes de chamar `ship_order` exatamente uma vez. Um retorno positivo da API registra `succeeded`; timeout/erro/resposta ambígua vira `uncertain`, sem assumir postagem/coleta física. Se o resultado não puder ser registrado no Core, a reserva permanece bloqueada: reportar `sent_but_core_confirmation_missing` e reconciliar antes de qualquer novo envio.

**Validação concluída:** PR #278 aprovada, testes Node22 316/316 PASS, Docker e Deno PASS, concorrência PostgreSQL local 100 tentativas = 1 claim; merge `5eff0025b40c24ca6e6d3cb0fbe9dab3c55ae8e7`. A migration continua **não aplicada** ao Lovable Cloud. A publicação do Hub/Core e a ativação produtiva continuam separadas. A criação de rota `ship-once`, a seleção de pedido piloto, habilitação temporária de gates e a prova Shopee Live requerem frente/janela específicas posteriores. Não sincronizar etiquetas nem finalizar separação como efeito implícito de `ship_order`.

**Estados não são os três status do Kanban:** este ledger é técnico e independente das colunas `A FAZER → EM PREPARAÇÃO → FINALIZADO`, que permanecem inalteradas. A coleta física ainda precisa de comprovação F6-O.2c.


### 11.7 F6-O.2e.2d — Rota privada de execução única (em validação, sem deploy)

**Entregável:** conectar o executor interno já protegido por `claim → ship_order → resolve` à rota **IAM privada** `POST /internal/shopee/live/logistics/shipping/ship-once`, exclusivamente para **um pedido-piloto conhecido**. Continua desligada por padrão; nenhum disparo por scheduler, UI ou pedido novo nesta etapa.

**Travas cumulativas:**
- `SHOPEE_LIVE_SHIP_ORDER_ROUTE_ENABLED=true` **e** `SHOPEE_LIVE_SHIP_ORDER_ENABLED=true`; sem ambos, HTTP 503 antes de chamar preflight/Core/Shopee.
- Escopo do piloto precisa coincidir com `SHOPEE_LIVE_SHIPPING_PREFLIGHT_ORDER_SN`, `SHOPEE_LIVE_CHANNEL_ACCOUNT_ID` e `SHOPEE_LIVE_SHIPPING_FISCAL_MODE` por meio de `SHOPEE_LIVE_SHIP_ORDER_PILOT_ORDER_SN`, `_PILOT_ACCOUNT_ID` e `_PILOT_FISCAL_MODE`, além de `_PILOT_PACKAGE_NUMBER` e `_PILOT_SHOP_ID`. Nenhum parâmetro de pedido vindo do request.
- `SHOPEE_LIVE_SHIP_ORDER_WINDOW_EXPIRES_AT` explícito em UTC, expirando **no máximo 30 minutos** à frente e exigindo mais de 60 segundos restantes no início/antes do claim. Janela encerrada bloqueia; se expirar após claim, proibir POST e reter resultado incerto bloqueado.
- Pedido atual `READY_TO_SHIP`; **somente** pacote `LOGISTICS_READY`, excluindo `LOGISTICS_PICKUP_RETRY` e reagendamentos no primeiro piloto. Apenas `get_shipping_parameter.info_needed = { dropoff: [] }`, sem pickup, filial extra nem dados de coleta. Fiscal conforme perfil explícito da conta: PJ requer `invoice_data.status=valid`; CPF não presume dispensa legal nem ignora pendência informada pela Shopee.
- OAuth Live válido da conta autorizada, Shop-ID e parceiro exatos; nenhuma renovação automática dentro da rota. Claim durável fresco no Core obrigatório antes de 1 POST; reserva anterior, conflito, erro fiscal, retorno incerto ou falha de confirmação impedem novo `ship_order`.
- Resposta e log sanitizados sem token, assinatura, comprador, endereço, XML/NF-e, payload ou URL assinada. HTTP 200 significa apenas **API confirmou organizar envio**, não prova postagem/coleta e não afeta Kanban/estoque.

**Proibições explícitas:** não aplicar migration `20261015233000` neste PR, não acionar Shopee Live nem OAuth, não publicar Hub/Edge, não habilitar gates/scheduler, não gerar etiqueta automaticamente, não marcar `FINALIZADO`. Só após testes da PR será preparada uma janela separada para migration, publicação e uma prova real autorizada.

**Nota de continuidade:** a rota de preflight read-only continua separada, e o fluxo F6-O.2e.3 de criação/recuperação de etiqueta não é substituído por `ship_order`.

### 11.8 F6 — ciclo mínimo recorrente (implementação para revisão, não habilitado)

Continuidade localizada de F6, preservando as frentes F1–F10: descoberta por
`update_time` com cursor e fila duráveis por conta; lease exclusivo; intake/raw/
projeção/mappings existentes; conferência de integridade do pedido canônico;
reutilização do preparador com claim permanente e sincronização do PDF privado.
Somente SHOPEE VIVIANE é admitida nesta entrega. Nenhum novo Order SN precisa
ser cadastrado no código para o ciclo recorrente. NF-e e organização do envio
continuam no Seller Center; fato físico, impressão, separação e estoque continuam
sob autoridade exclusiva de Operações.

Status: código e migration **preparados para PR em rascunho**. Não representa
migration aplicada, publicação, Scheduler/gates habilitados ou validação Live.
Habilitação e observação produtiva dependem de autorização separada. Contrato,
limites e sequência de ativação em [F6_CICLO_MINIMO_RECORRENTE_SHOPEE.md](F6_CICLO_MINIMO_RECORRENTE_SHOPEE.md).

PED-00281: etiqueta existente preservada; coleta física informada pelo operador
em 21/10/2026. Nenhuma nova ação desse pedido é autorizada por este registro.

---

## 12. CHECKPOINT EVOLUTIVO — 10/11/2026 (SEM SUBSTITUIR O HISTÓRICO)

**Natureza:** adendo de continuidade e rastreabilidade. As seções anteriores retratam marcos datados de outubro; quando houver diferença temporal, este checkpoint informa o estado **mais recente comprovado** sem reescrever as decisões históricas. A **Arquitetura Mestre Shopee V1.0 congelada** e a **prioridade executiva do ciclo funcional (20/10)** continuam soberanas. A numeração F6-K/O deste mapa é **taxonomia técnica histórica**, enquanto as frentes soberanas são **F1 → F2 → F6 → F7-A → F3 → F5 → F4 → F7-B**.

### 12.1 Resultado que governa a próxima execução

**Missão atual:** **pedido originado na Shopee → Hub recebe → Pedido + Itens + Separação no Painel Central → etiqueta oficial vinculada e imprimível na Separação**, com operação assistida onde o Seller Center ainda seja necessário. O passo seguinte é **USO REAL da Central de Separação**, não mais uma nova infraestrutura, ciclo, auditoria ampla ou controle preventivo sem falha material.

Critério de prova próximo: selecionar **pedido real já importado**, encontrá-lo visualmente na Central de Separação com composição correta, verificar documento oficial do pedido/pacote e realizar abertura/impressão conforme contrato de Operações. Distinguir **PDF persistido** de **PDF visível/imprimível pelo operador**. Não executar expedição, emissão fiscal, baixa de estoque ou finalização física apenas para provar a interface.

### 12.2 Estado real comprovado por camada

| Camada / frente | Marco após o mapa original | Evidência e limite |
|---|---|---|
| **F1 Conector / Core** | OAuth e Core Bridge HMAC existentes; expansão SQL do lease para contas Viviane e Adão aplicada no Lovable Cloud | Migration `20261109214500_f5_cycle_lease_account_scope_adao` **aplicada e registrada** em `supabase_migrations.schema_migrations` no Core canônico. SQL não significa ativação do ciclo. |
| **F1 Edge Function** | `integration-core-bridge` publicada com suporte ao escopo compartilhado; exceção de publicação pelo agente Lovable encerrada | Relatório do executor de deploy: `source_sha256 05c03296ab36c4867ed62da3bf66225b71d9620bd60acfd732719f47ebae62b0`. O conector normal não publica Edge Functions isoladas. |
| **F1 Hub / Cloud Run** | Imagem de teste construída e revisão isolada `adao-teste` implantada | Imagem `adao-f5u4-43793e2af68f`, revisão apontada pela tag `adao-teste` **(consultar nome exato em tempo real; houve erro de transcrição do sufixo em consultas anteriores)**, 0% do tráfego; revisão principal `integration-hub-00142-tlv` permaneceu com 100% no teste. Saúde `/health/core` respondeu HTTP 200. |
| **F1 ciclo compartilhado Adão** | Adapter reutiliza lease/checkpoint da Viviane; nova rota IAM privada publicada, mas **OFF** | PR #548 mergeada `bad5dca4124c1279926ca5976271e64b6e2168ed`. POST `/internal/shopee/adao/cycle/run` retornou **HTTP 503 com `adao_cycle_not_enabled`**, bloqueio intencional. Não houve prova de ciclo Adão ativo. |
| **F1 recorrência atual** | Dois Cloud Scheduler jobs reais, ativos, a cada cinco minutos | `shopee-adao-intake-v1` → importador independente Adão; `shopee-live-intake-v1` → ciclo Viviane. Ambos POST com OIDC. `SHOPEE_ADAO_AUTO_INTAKE_ENABLED=true`, `SHOPEE_ADAO_CYCLE_ENABLED` ausente, `SHOPEE_ADAO_LABEL_SYNC_ENABLED=true`. **Não ativar escritores Adão concorrentes.** |
| **F2 Pedidos Adão** | Entrada automática real demonstrada no banco, apresentação/uso em tela ainda não comprovados | Consulta ao Core: **26** registros na conta; **16** com `sale_origin=shopee_open_platform`, `status=pendente`, `operational_status=todo` (06–09/11); **10** antigos `enviado/finalized` sem origem preenchida. Não afirmar que usuário realizou pedidos no Painel; vendas nasceram na Shopee. |
| **F2 estado externo × interno** | Divergência material identificada, sem reconciliação automática | Entre os 16 pendentes internos, última captura Shopee de 10/11: **6 SHIPPED, 2 COMPLETED, 1 TO_CONFIRM_RECEIVE, 6 PROCESSED, 1 READY_TO_SHIP**. Desses PROCESSED, **5** capturas antigas de 06/11. Captura é evidência histórica; não equivale a elegibilidade Live agora. |
| **F2 proteção de atualidade** | Guarda Adão-only implementado no GitHub, ainda **não implantado na Edge Function operacional** | PR #565, merge `4ee1cb4e76ab6437fe9ceac56b1eb4673bf31464`: `observed_at` e `created_at` com janela de 5 minutos, sem tocar comportamento Viviane. Isso protege **novas importações**, **não** reconcilia pedidos já registrados, nem substitui confirmação Live antes de ações irreversíveis. |
| **F5 Etiquetas oficiais** | Documentos oficiais já persistidos; impressão na Separação ainda precisa prova operacional | Checkpoints Core de **6 PDFs Adão** com tentativas `succeeded`, e **20 documentos Viviane**. PRs #537/#538 ampliaram geração conforme exigência oficial `shipping_document_should_print_first`. PDF no Core não prova impressão real no Painel. |
| **F5 Organização do envio** | Bibliotecas, preflight, claims e rotas técnicas são parciais | Não afirmar automação geral de `ship_order`, NF-e ou coleta. Para pedidos já despachados, jamais reexecutar preparação/envio. Seller Center ainda é contingência operacional vigente. |
| **Operações / Separação** | Três colunas e contrato físico preservados | **A FAZER → EM PREPARAÇÃO → FINALIZADO**; impressão não comprova postagem/coleta, nem baixa estoque. Ação física e baixa pertencem ao módulo Operações. |
| **Exceções / observabilidade** | `DEADLINE_EXCEEDED` no job Adão e erros HTTP Cloud Run vistos em logs | Erro do agendador **não demonstra ausência de registro do pedido**, nem identifica causa sozinho. Investigar apenas se obstruir o próximo pedido real; correlacionar horário, request/revisão e efeito canônico. |
| **Catálogo / mappings** | Registros comerciais e mappings por conta evoluíram em paralelo | Respeitar matriz única, identidades Item/Model e histórico; não reabrir catálogo inteiro na prova do fluxo. Autoridade do especialista Mappings/Comercial permanece. |

**Observação de precisão:** a revisão da tag `adao-teste` foi recuperada por consulta de tráfego e listagem; utilizar sempre `gcloud run services describe`/listagem para obter o identificador exato do instante, pois houve erro de transcrição manual em consultas anteriores. Os números de pedidos e documentos são **checkpoints**, não contagens permanentes.

### 12.3 Próximas frentes por resultado — sem reabrir a arquitetura

1. **P1 — F2 + Operações: comprovar o pedido na Separação (AGORA).** Abrir o Painel Central e validar **um pedido real já registrado** com itens, quantities, mapping e canal. Corrigir apenas diferença demonstrada na interface ou no vínculo canônico.
2. **P2 — F5 + Operações: comprovar a etiqueta no mesmo fluxo (AGORA).** Localizar documento oficial já persistido, verificar associação conta + pedido + pacote, botão **IMPRIMIR**, abertura e impressão. Não confundir resumo interno com etiqueta Shopee.
3. **P3 — F1: manter e observar importador recorrente existente.** Comparar pedidos Live com resultados do Core, sem criar outro scheduler/worker. Investigar deadline somente quando houver falha material e evidência correlacionada.
4. **P4 — Operações/F5: fechar preparação física e coleta.** Respeitar contrato de impressão, aguardando coleta e baixa única idempotente; sem automatizar `finalized` por `SHIPPED` genérico.
5. **P5 — F1/F5: ampliar automação logística.** Reduzir Seller Center por capacidade real da Open Platform, inclusive fiscal/organização do envio, sem bloquear P1/P2. Avaliar transição do importador independente para ciclo compartilhado **depois** da prova operacional; sem competição entre escritores.

### 12.4 Regras de eficiência comprovadas em 10/11

- **Não transformar hipótese em bloqueio:** uma divergência comprovada do uso real orienta a próxima correção; guardas úteis no GitHub não substituem a prova da interface.
- **Fonte e prova por camada:** PR mergeada ≠ Edge deploy; Edge deploy ≠ Cloud Run 100%; PDF persistido ≠ etiqueta imprimível; HTTP 200 do health ≠ pedido/Separação validados.
- **Diagnosticar efeito, não somente log:** `DEADLINE_EXCEEDED` requer cruzamento com Pedido/Itens/Separação antes de repetir ou classificar como perda de pedido.
- **Usar revisões e caminhos reais:** consultar tag em vez de supor nome; testar revisão 0% sem promover tráfego; não colar exemplos JSON como comandos no Shell.
- **Não extrapolar permissão:** a autorização pontual de construtor Lovable para deploy foi encerrada; quando usada, houve edição indevida de arquivo Saúde, revertida pela PR #550. Manter GitHub como editor oficial e delimitar a exceção de publicação.
- **Não apagar patrimônio:** preservar arquiteturas, provas, contas, tombstones, PDFs, migrations e históricos; se o caminho atual atende P1/P2, reaproveitá-lo sem reconstruir.

### 12.5 Checkpoint transferível

**RESULTADO:** F1/F2/F5 implementadas em grau suficiente para iniciar prova de uso da Central de Separação; ciclo compartilhado Adão pronto tecnicamente mas OFF.  
**FONTES / PROVAS:** Core Lovable Cloud (consultas SQL de 10/11), Cloud Run/Cloud Scheduler (capturas e comandos de 10/11), GitHub PRs #537, #538, #548, #550, #565, Mapa Mestre V2, Panorama V1.1 (06/11).  
**PENDÊNCIA MATERIAL:** visibilidade e composição de um pedido Shopee real no Painel e acesso à etiqueta oficial no card.  
**PRÓXIMA AÇÃO ÚNICA:** abrir a Central de Separação do Painel Central, localizar pedido real e confrontar seu card e impressão com `orders`/`order_items`/`order_separation`/`order_documents`.  
**NÃO ALTERAR NESTE CHECKPOINT:** dados produtivos, scheduler, OAuth, Cloud Run, Edge Function, etiquetas, estoque, roteamento fiscal ou código funcional.

---

## 13. PROVA DE USO REAL — PED-00409 / ETIQUETA AUTOMÁTICA (10/11/2026)

**Natureza:** checkpoint complementar, posterior à seção 12. Não altera a arquitetura soberana nem apaga pendências de outros pedidos/contas. As menções anteriores a “ainda não comprovado” pertencem às datas originais e foram superadas **somente no escopo expressamente demonstrado abaixo**.

### 13.1 Resultado comprovado na conta Shopee Adão

1. **F10 — recebimento automático:** PR #569 (merge `9d3841bd7af`) retirou as listas de autorização comerciais redundantes para ofertas com mapping/composição válidos. Revisão isolada `integration-hub-00242-tov` e scheduler `shopee-adao-intake-v1` direcionado à tag `adao-teste`; os **sete pedidos anteriormente ausentes** ingressaram no Core como **PED-00406 a PED-00412**, com itens e separação `todo`. Os registros de importação têm horário aproximado **19h20–19h21 BRT**. Isso demonstra o recebimento do lote observado, não universalidade para qualquer pedido.
2. **F10/F5 — etiquetas automáticas:** PR #570 (merge `1918038be8459ce62ae9eab53228d1bb44fbae4b`) conectou a sincronização oficial de PDF ao **scheduler Adão existente** (a cada cinco minutos), sem adicionar job. A execução trata no máximo um candidato por ciclo; recebimento e etiquetas são operações distintas. Cloud Build da imagem `etiquetas-auto-1918038be845` concluiu `SUCCESS`; revisões com tag `adao-teste` foram publicadas, a mais recente observada `integration-hub-00244-sah` com **0% do tráfego principal**. Viviane permaneceu na revisão principal `integration-hub-00142-tlv`, 100%. A tag permite invocação pelo scheduler sem promoção do tráfego público.
3. **PED-00409 (Shopee `261110UM3PJTUT`) — prova canônica da etiqueta:** tentativa `create_shipping_document` / `NORMAL_AIR_WAYBILL` registrada `succeeded` em **10/11/2026 20h50min56s BRT**, com `outcome_source=api_success`. O PDF `shipping_label`, `application/pdf`, **117.112 bytes**, foi anexado em **20h56min03s BRT** ao `order_documents` no bucket privado `shopee-labels`, com caminho de armazenamento presente. `order_separation.separation_status=todo`, `print_count=0` na última consulta: não comprova impressão física nem postagem pelo Painel.
4. **Evidência visual:** gravação enviada pelo usuário **`PEDIDO SHOPEE EXCLUIR 2.mp4`** demonstra o pedido PED-00409 na Central de Separação e a pré-visualização **“Imprimir etiqueta + composição”** em **uma folha A4**: etiqueta oficial no topo e composição interna de **Alfajor Artesanal 60 g Doce de Leite — Chocolate Meio Amargo, 108 unidades** abaixo. O fluxo antes comprovado pela Viviane foi reutilizado. A composição não equivale a segunda página DACE da Shopee, cuja cópia integral permanece na impressão oficial separada. A gravação não prova impressão física nem entrega/coleta.
5. **Observação do comprador:** mecanismo foi implementado para incluir a mensagem Shopee quando existir, mas **não havia mensagem comprovada nesse pedido**. A prova da observação em pedido real com mensagem continua pendente, sem impedir a operação.
6. **Estado atual dos sete pedidos:** última captura Raw Shopee examinada em **10/11/2026 ~21h10 BRT** confirmou **seis pedidos `SHIPPED`** (`261110UXKV2JPU`, `2611100KQSYW2B`, `261110V6FD1CSA`, `261109SED9K3B4`, `261109SB1D9BDV`, `261109SMFT8BR9`) e **um pedido `PROCESSED`** (`261110UM3PJTUT`, PED-00409). O operador informou que os seis já foram despachados no Seller Center. **Não iniciar nova preparação nem organização de envio para `SHIPPED`; confirmar status Live no momento de qualquer ação futura.** Pedidos existentes não devem ser apagados ou classificados como concluídos fisicamente apenas pela situação externa.

**Resultado prático:** **pedido Shopee → Hub automático → pedido e itens no Core → separação no Painel → PDF oficial automático → etiqueta + composição em uma folha na pré-visualização: COMPROVADO para o PED-00409.**

### 13.2 Limites e aprendizado de operação

- **Não confundir preparo de etiqueta com organizar envio:** o envio dos sete pedidos foi organizado pelo operador no Seller Center. Nenhum `ship_order` automático do Painel Central foi demonstrado.
- **Não confundir pré-visualização com impressão física:** a tela oferece impressão/salvar PDF; o registro canônico ainda reportou `print_count=0`.
- **Não repetir checklists históricos:** os sete pedidos de 09–10/11 serviram como lote de prova; evitar investigações genéricas sobre pedidos já despachados. Comparar dados novos e elegibilidade Live quando for necessário.
- **Sem desdobrar scheduler ou reconstruir workflows:** F10 utiliza o agendamento existente. Cada mudança de Cloud Run deve distinguir imagem construída, revisão publicada, tag e execução real. Não repetir builds/deploys apenas por instabilidade do Cloud Shell.
- **Preservar limites de Operações:** movimentação física, controle de estoque, emissão fiscal, postagem e coleta não são comprovados pela criação do PDF.

### 13.3 Próxima frente do Mapa — F5 / Operações (organização do envio)

**Meta de negócio:** reduzir gradualmente a dependência do Seller Center, possibilitando **organizar envio por dentro do Painel Central** quando a Shopee e o perfil da conta permitirem, sem interromper a operação normal da loja.

**Primeira execução:** **rastrear e reaproveitar** a implementação existente de pré-verificação logística, API `ship_order`, claims de idempotência e rotas privadas. Entregar um levantamento enxuto do que está pronto versus o que falta para uma **primeira prova Live com pedido elegível novo**, sem usar os seis já despachados nem assumir que o PED-00409 pode ser reorganizado. **Não executar `ship_order` no estágio de investigação** e não acionar NF-e, finalizar separação ou baixar estoque para produzir evidência.

**Critério de encerramento da frente futura:** com pedido elegível real e autorização operacional específica, registrar organização de envio confirmada pela Shopee, seguida de etiqueta oficial obtida automaticamente e apresentada na Separação. Isso ainda é **pendente**.

### 13.4 Checkpoint de repasse

**CONCLUÍDO:** recebimento automático, mapping utilizado, criação da Separação, PDF oficial automático e pré-visualização da impressão combinada em uma folha no PED-00409.  
**AINDA NÃO COMPROVADO:** impressão física; mensagem do comprador real; organização automática do envio; coleta; conciliação fiscal/financeira; baixa de estoque.  
**PRÓXIMA AÇÃO ÚNICA:** leitura dirigida do fluxo de organização do envio já existente no GitHub, separar capacidades prontas das pendentes e prosseguir com um pedido novo elegível sem reabrir a prova de impressão.  
**FONTE:** consultas Core e capturas Cloud Run/Scheduler em 10/11/2026; PRs #569/#570; vídeo de operação `PEDIDO SHOPEE EXCLUIR 2.mp4`.

---

## 14. F11 — ORGANIZAÇÃO AUTOMÁTICA DO ENVIO: IMPLEMENTAÇÃO E LIMPEZA (11/11/2026)

### 14.1 Limpeza administrativa de separações de teste

Por solicitação do operador, os pedidos Shopee que permaneciam em Separação nos canais **Adão** e **Viviane** foram encerrados administrativamente como **histórico de teste**, mantendo a operação real no Seller Center. A primeira passagem finalizou **29 registros** (22 Adão, 7 Viviane). A segunda passagem identificou **quatro pedidos adicionais Adão**, ainda criados antes do marco operacional de **11/11/2026 13:22 UTC**, que haviam entrado após a primeira limpeza, e finalizou **PED-00413 a PED-00416**.

**Total encerrado nessa ação: 33 pedidos (26 Adão, 7 Viviane)**. Todos mantêm seu pedido, documentos, itens, vínculos e anotação histórica; **nenhuma baixa de estoque, emissão fiscal, expedição Shopee, movimentação financeira ou impressão física foi executada**. A situação comercial antiga permanece preservada; este é um encerramento *administrativo da fila de Separação*, não uma declaração de postagem física pelo Painel. Pedidos cancelados não foram convertidos em finalizados. Consulta após a segunda passagem: **Adão 37 finalizados; Viviane 17 finalizados e 1 cancelado** no recorte de canal/conta da Central (inclui finalizações anteriores).

### 14.2 F11 — evolução de código registrada

**GitHub PR #577 — merge `a587af9c21ca84ca5ed4f0dcf3fe24efdefbb044`.** Evolução do Hub para utilizar o scheduler existente do Adão, **sem criar outro job** e sem modificar Viviane:

- O leitor Live fornece opcionalmente a relação de **pedidos atualmente `READY_TO_SHIP`** e a data real de criação na Shopee, mantendo Raw e os caminhos de leitura antigos.
- O motor só propõe `ship_order` para **pedido recém-criado depois de 11/11/2026 13:22 UTC**, **recém-importado com sucesso no Core na mesma execução** e dentro da conta Adão. Pedidos históricos encerrados, SHIPPED, cancelados ou anteriores ao corte não são candidatos.
- O executor reutiliza `inspectShopeeShippingPreflight` e `createGuardedShopeeShipOrder`, com conferência Live da conta/pacote, operação `dropoff` simples apenas quando Shopee informa `info_needed.dropoff=[]`, perfil fiscal da conta, claim Core único por pedido/pacote, POST assinado e resolução durável. No máximo **uma organização por ciclo**; resultado incerto não deve ser repetido pelo writer.
- A etiqueta permanece no sincronizador automático já existente. O transporte físico, postagem/coleta, NF-e, inventário e finalização física **não são realizados** por F11.
- Feature flag separada **`SHOPEE_ADAO_AUTO_SHIP_ENABLED`**, inicialmente ausente/**OFF**. O código mergeado **não está implantado/ativado no Cloud Run apenas por existir na main**.

**Limite funcional explícito da primeira versão:** pedidos que entram no Core antes de ficarem `READY_TO_SHIP` poderão exigir evolução de conciliação canônica de status para entrar em organização automática mais tarde; não tratar o simples fato de estarem cadastrados como prova de que ainda estão na fila operacional. Evitar reautorizar históricos encerrados sem dados canônicos atuais.

### 14.3 Próxima comprovação

1. **Publicar a imagem atualizada do Hub** na tag isolada `adao-teste`, preservando 100% do tráfego principal da Viviane.
2. Ativar `SHOPEE_ADAO_AUTO_SHIP_ENABLED=true` **apenas na revisão Adão** quando sua saúde e configuração forem confirmadas. Manter o agendamento já existente, sem segundo writer.
3. Com **um novo pedido criado após o corte**, conferir a sequência **READY_TO_SHIP → pré-verificação → confirmação da Shopee da organização → etiqueta oficial → documento na Central de Separação**.
4. Se a Shopee exigir modalidade diferente de dropoff simples, preservar envio via Seller Center e desenvolver a alternativa **com evidência real**, sem inventar parâmetros. HTTP 200 de `ship_order` nunca comprova coleta/postagem.

**Estado:** base de código e testes direcionados entregues; implantação e prova Live pendentes. Não confundir fila de Separação limpa com inexistência de pedidos históricos; seus dados permanecem preservados.

---

## 15. F11 — REABERTURA DIRIGIDA E EVIDÊNCIA LIVE (11/11/2026)

**Autorização operacional:** após a limpeza da separação, o usuário identificou no Seller Center Adão três pedidos ainda com ação "Organizar Envio": PED-00413 (`2611111W8T6TE3`), PED-00414 (`2611112RP7B34Q`) e PED-00415 (`2611112W8Y81TH`). O usuário autorizou a reabertura exclusiva desses três para prova da Frente 11.

**Executado no Core:** três pedidos e respectivas separações alterados administrativamente de `finalized` para `todo` em uma operação de escopo exato e com anotação de reabertura no histórico do pedido. Nenhuma baixa/movimentação de estoque, criação de postagem ou alteração de NF-e. PED-00409 e os demais históricos permaneceram finalizados.

**Correção em código:** PR #579 mergeada na `main` (`fcc6318fb4d2a8c36ee81fc761547e5e28da214b`). Ajuste da F11 para incluir **somente os três pedidos reabertos** na seleção de envio, desde que o leitor observe `READY_TO_SHIP` e o `ship_order` passe por preflight Live e claim permanente; não abrir todos os históricos. Corrigida a ausência de `ready_to_ship_candidates` em páginas não vazias do leitor F11 e referência indevida a `detailedOrders` no caminho vazio. Testes do Hub e Core aprovados; verificação TypeScript global segue falhando pelo erro existente de Saúde em `useHealthMealPlanF18.ts`.

**Mudança observada durante a execução:** a última captura Raw Shopee consultada em **11/11/2026 ~11h25 BRT** apresentou os três pedidos como `PROCESSED`, quando capturas anteriores os mostravam `READY_TO_SHIP`. A conta Adão não possui tentativas `shopee_shipping_arrangement_attempts` nessa hora; logo, **não há prova de organização de envio pelo Hub**, tampouco autorização para repetir automaticamente o envio se a Shopee não o exige mais. PED-00413 já apresentava tentativa de documento `succeeded`, porém sem PDF no momento da consulta; PED-00414 e PED-00415 sem tentativas/PDF.

**Estado de entrega:** PR mergeada ≠ Cloud Run publicado. A revisão operacional `adao-teste` usada anteriormente permanece com F11 anterior até nova publicação verificada. Após publicação, o motor só enviará `ship_order` se houver estado elegível atual confirmado; pedidos `PROCESSED` poderão seguir ao processo de recuperação de etiqueta sem reorganização. Validar na fonte antes de atribuir qualquer organização de envio à integração. Não alterar Viviane.

---

## 16. F11 — CORREÇÃO DA TRANSIÇÃO READY_TO_SHIP E GUARDA DO CORE (11/11/2026)

**Evidência de operação:** PED-00413/00414/00415 foram organizados **pelo Seller Center**, não pelo Hub. Etiquetas oficiais em PDF foram vinculadas automaticamente aos três pedidos (PED-00414 em 11/11/2026 ~12h11 BRT). O Hub não tinha qualquer `shopee_shipping_arrangement_attempts` para esses pedidos; organização automática continua **não comprovada**. Não atribuir ao Hub a passagem para `PROCESSED`.

**Defeito de código demonstrado:** o importador programado antes da PR #581 reconhecia apenas `written` no mesmo ciclo ou três exceções antigas. Um pedido realmente novo que entrasse no Core em `PROCESSED` e depois fosse atualizado para `READY_TO_SHIP` seria ignorado como `already_registered`/`expected_order_unavailable` e **jamais passaria à organização automática**, mesmo que ainda estivesse ativo. O algoritmo ainda favorecia o primeiro candidato, deixando os seguintes sem tentativa se aquele falhasse. A investigação do código demonstra essa lacuna; não demonstra que ela, isoladamente, causou os três casos, porque o operador concluiu manualmente a organização antes de haver prova da execução da nova revisão.

**Correção implementada:** PR #581 mergeada na `main` (`d6feb44fcffb6b502b4257b45e2c636758ee684a`) faz o Hub reconciliar `READY_TO_SHIP` atual de pedidos **criados depois do marco de 11/11/2026 13:22 UTC**, inclusive se já estiverem cadastrados; preserva exceções exatas dos três pilotos reabertos; roda no máximo uma tentativa por ciclo, com rotação entre candidatos; expõe contagem agregada e motivo padronizado do preflight no caminho Adão. Nenhum pedido `PROCESSED` ou `SHIPPED` é organizado novamente. A obtenção de etiqueta e Separação permanece igual.

**Governança do writer:** migration `20261111160000_f11_adao_shipping_claim_operational_state.sql` **aplicada ao Lovable Cloud oficial e registrada** na tabela de migrations. A função `public.claim_shopee_shipping_arrangement` rejeita reivindicação inicial Adão quando `orders.operational_status` não for `todo/preparing` ou `orders.status='cancelado'`, sem modificar o comportamento anterior das demais contas. Permissões verificadas: somente `service_role` executa; `anon` e `authenticated` não. Claims únicos existentes não foram apagados nem reabertos.

**Homologação:** testes Node 22 do Hub e testes Core/Postgres passaram na PR #581; verificação TypeScript geral permanece com erro preexistente do módulo Saúde, fora do escopo. **Não houve publicação da PR #581 no Cloud Run nesta etapa**: a revisão Adão ainda precisa ser construída e publicada na tag `adao-teste` mantendo Viviane em 100% do tráfego principal. A flag existente `SHOPEE_ADAO_AUTO_SHIP_ENABLED=true` só produz comportamento novo depois do deploy.

**Critério de prova futura:** para novo pedido real `READY_TO_SHIP`, conferir código de tentativa no Core, confirmação da Shopee de `ship_order`, transição do estado e PDF; se houver `preflight_not_eligible`/outro código, tratar a necessidade específica da modalidade Shopee, sem acionar `ship_order` manualmente para simular automação. Registro de documento/etiqueta não comprova organização, postagem ou coleta.

---

## 17. F11 — EVIDÊNCIA DE RECUSA SHOPEE E CORREÇÃO DE `ship_order` SEM PACOTE (11/11/2026)

**Dois casos Live:** usuário mostrou no Seller Center Adão os pedidos PED-00417 / `26111137FS6GRM` e PED-00418 / `2611123948MENG`, ambos `READY_TO_SHIP`, com ação "Organizar Envio". O Core comprovou pedido e separação `todo`, nenhum PDF ainda, e tentativa `ship_order` em cada pedido registrada como `uncertain` / `outcome_source=transport_uncertain` (12h56 e 13h26 BRT, respectivamente). Esses registros NÃO comprovam organização de envio, nem autorizam repetição automática.

**Diagnóstico da primeira tentativa:** Cloud Run Logging, attempt_id `56bda5e6-e72b-49b7-902d-2ffc0997a17a`, mostrou `fetch_invoked`, `headers_received` HTTP 200 e `body_read` categoria `shopee_error` com **`logistics.ship_order_not_need_pacakge_number`**. A Shopee recebeu a solicitação, mas rejeitou o campo `package_number` no POST, pois este pedido não o exigia. Não confundir HTTP 200 de transporte com sucesso da API. A primeira tentativa do PED-00418 também está `uncertain`, mas seu erro exato não foi plenamente exibido na mesma captura e não deve ser presumido idêntico.

**Correção no GitHub:** PR #587, merge `3d8dd907a52eadc064cc56254f2c0e7fafda91b3`. O preflight passou a solicitar `split_up` ao get_order_detail. No executor automático Adão, `split_up===false` omite `package_number` **somente no corpo assinado do ship_order**; `split_up===true` mantém o campo, e ausência de comprovação explícita recusa o writer sem claim. Mesmo quando omitido na API, a identificação `package_number` real continua obrigatória e preservada no fingerprint/claim único no Core. O formato tradicional de chamada para as demais contas e legado permanece inalterado. Suíte Node 22 Hub e testes Core/Postgres aprovados; lint TypeScript global já falhava em código de Saúde não alterado.

**Pendente:** publicar nova imagem do Hub na tag isolada `adao-teste` sem afetar Viviane; comprovar `ship_order` com pedido futuro elegível **sem claim prévio**. Não apagar, desbloquear ou reexecutar os dois claims `uncertain`. Operador pode manter o Seller Center como contingência para os pedidos já abertos. Etiqueta obtida, despacho/entrega e organização do envio são eventos distintos.

---

## 18. F11 — RECONCILIAÇÃO DOS DOIS ENVIOS REJEITADOS (11/11/2026)

**Evidência real confirmada pelo operador:** Seller Center Adão e Painel Central mostram PED-00417 (`26111137FS6GRM`) e PED-00418 (`2611123948MENG`) em `READY_TO_SHIP`, separação `todo`, etiqueta pendente. Logs Cloud Run de ambas as tentativas originais `ship_order` registram `body_read`, `shopee_error` e **`logistics.ship_order_not_need_pacakge_number`**. Portanto não foi apenas timeout: a Shopee respondeu à operação e rejeitou o campo `package_number`. Ambos permanecem `uncertain` na tabela canônica por decisão defensiva do writer, impedindo repetições cegas. PR #587 corrige serialização futura quando `split_up=false`, mas **não** libera automaticamente tentativas já registradas.

**Preparação dirigida:** PR #595 propõe migração **desligada por padrão**, `20261111180000_f11_adao_rejected_shipping_recovery.sql`, que preserva integralmente os dois registros antigos, utiliza sequência 1/2 para no máximo uma nova tentativa por identidade exata (conta+pedido+pacote), mantém verificação de pedido operacionalmente aberto e assinatura/idempotência, e só admite uma segunda sequência para os **dois IDs originais confirmados** quando autorização individual separada estiver ativada e consumida atomicamente. Não reabre outras tentativas incertas, nem afeta Viviane. A autorização inicia `enabled=false`; no momento da proposição nenhuma consulta ou publicação faz novo POST à Shopee.

**Condições pendentes antes de permitir recuperação:** executar testes de regressão e validação SQL, verificar que a revisão Adão possui o preflight com `split_up` explícito fornecido pela Shopee, inspecionar elegibilidade atual `READY_TO_SHIP`, aplicar migração com controle de versão e só então ativar deliberadamente cada recuperação. O primeiro resultado incerto e o segundo resultado devem permanecer rastreáveis de forma independente. Caso a Shopee indique `PROCESSED`, `SHIPPED` ou outro estado, não organizar novamente. Se o cliente estiver prestes a perder prazo, o Seller Center permanece contingência operacional.

**Critério de sucesso:** nova resposta Shopee `error:""` efetivamente registrada como `succeeded`, mudança de status e geração/vínculo da etiqueta, sem intervenção manual; não confundir sucesso HTTP isolado, PDF ou postagem física com organização comprovada. Atualizar Mapa após a comprovação.

---

## 19. F11 — ORGANIZAÇÃO COMPROVADA E PREPARAÇÃO AUTOMÁTICA DE ETIQUETAS (11/11/2026)

**Comprovação da organização:** PED-00417 (Shopee `26111137FS6GRM`) e PED-00418 (`2611123948MENG`) tiveram segunda tentativa de `ship_order` emitida e confirmada pela Shopee: `attempt_sequence=2`, `state=succeeded`, `outcome_source=api_success`, respectivamente 15h01 e 15h06 BRT. Os primeiros claims `uncertain` permaneceram imutáveis; as autorizações individuais foram consumidas. Raw Shopee posteriormente `PROCESSED`; prints do Seller confirmaram que ambos passaram a exibir opção de imprimir etiqueta. **Este é o primeiro resultado real comprovado de organização automática pelo Hub.** Isso não é prova de postagem/coleta.

**Evolução do documento oficial:** consultas ao Core em 11/11/2026 às 15h29 BRT identificaram também `create_shipping_document` em ambos, com `state=succeeded`, em 15h21 (PED-00417) e 15h26 (PED-00418). Não há PDF em `order_documents` no momento da consulta: documento **preparado** na Shopee, mas ainda não baixado/vinculado. Não classificar os botões do Painel `Imprimir Etiqueta + Composição` como homologados para esses dois pedidos antes do PDF.

**Melhoria em código:** PR #599 mergeada na `main` (`252ebe9716bfbefa22ba4af4f43ce519d65c9dd6`), para fazer o runner Adão priorizar PDFs de pedidos `PROCESSED` recentes depois do corte operacional, mantendo no máximo uma tentativa de sincronização de etiqueta por ciclo, rotação justa, fallback e diagnósticos sanitarizados sem dados de compradores. Reader de pedidos compartilha a lista `label_ready_candidates` somente quando `onlyIntakeEligibleOrders=true`. Testes Hub Node22 e Core/Postgres aprovados; TypeScript global segue com erro independente de Saúde. **Esta melhoria exige novo build e deploy na revisão isolada Adão para entrar em produção**; não afirmar que foi publicada. O fluxo antigo segue fazendo preparação de documentos via Core claim.

**Estado da frente:** recebimento/registro, separação, envio automático e preparação de documentos comprovados nos dois pedidos. PDF oficial e impressão integrada ainda aguardam confirmação em uso real. Próxima ação: consultar tarefas oficiais `READY`, baixar/vincular PDFs; comparar etiqueta original da Shopee com impressão `Etiqueta + Composição` da tela Operações, sem duplicar documento ou alterar logística/estoque.
