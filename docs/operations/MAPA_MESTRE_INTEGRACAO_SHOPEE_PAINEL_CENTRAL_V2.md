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
