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
- O Hub obtém o PDF somente de Shopee, valida tipo, tamanho máximo 4 MiB, assinatura PDF e SHA-256. A Edge Function Core verifica conta/pedido Shop-ID e emite URL temporária de upload privado; o Hub envia bytes diretamente ao bucket privado order-documents; o Core baixa de novo, confere tamanho/hash/assinatura e registra order_documents.shipping_label.
- Vinculação é determinística e deve ser única por storage_bucket/storage_path; migration da unicidade precisa ser aplicada no Lovable Cloud **antes de autorizar sync-once em produção**, mediante aprovação específica.
- O Painel já consulta order_documents na Central de Separação em tempo real; PR #272 prioriza shipping_label no botão IMPRIMIR. Nenhum endereço assinado ou credencial aparece no frontend; somente documento autorizado com URL temporária privada.
- O operador **não** recebe mensagem de sucesso sem documento persistido. A funcionalidade não cria tarefas de documento, organiza envio, emite NF-e ou finaliza separação.
- Enquanto não houver documento READY, mostrar indisponibilidade e manter trabalho manual normal no Seller Center. Fluxo de geração da tarefa, tratamento de formatos ZIP/ZPL e operação em massa ficam para uma etapa explicitamente autorizada.
- A sincronização periódica/por pedido ainda não é ativada nesta entrega piloto; requer validação do caminho privado e política de agendamento e idempotência apropriadas.

**Evidência técnica para revisão:** Guia de Logistics para Brasil (cópia de referência Shopee Open Platform) e FAQ integrado indicam download após READY e PDF binário, não URL do Seller Center. Não reutilizar links de sessão de navegador como fontes permanentes de etiqueta.
