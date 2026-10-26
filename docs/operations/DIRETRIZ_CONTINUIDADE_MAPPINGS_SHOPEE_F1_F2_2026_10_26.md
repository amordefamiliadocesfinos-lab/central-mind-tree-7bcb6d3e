# PAINEL CENTRAL — Mappings Shopee — Continuidade F1/F2 sob reformulação comercial

**Data:** 2026-10-26  
**Estado:** proposta operacional aprovada pelo responsável do projeto; registro de continuidade para revisão e integração ao repositório canônico.  
**Escopo:** Especialista Mappings Shopee 1, interfaces com Arquitetura Comercial Shopee, Integração Shopee e Operações.

## Decisão

As frentes **F1 — Reconhecimento e Vinculação Oficial** e **F2 — Conversão Física e Validação** passam a ser tratadas como uma **função contínua**, não como campanha para homologar todos os mappings atualmente existentes.

1. **Mapping legado não é verdade presumida.** Parte dos registros foi criada para validar o processo. Preservar como patrimônio técnico e evidência; conferir antes do uso operacional.
2. **Anúncio atual não é oferta comercial futura congelada.** O especialista Arquitetura Comercial está reformulando anúncios; decisões comerciais aprovadas e anúncios efetivamente publicados orientarão a reconciliação.
3. **A identidade observada na Shopee é fato externo datado, não aprovação comercial.** Item ID/Model ID são evidência de identificação do anúncio/variação no momento da consulta.
4. **O cadastro físico interno é o vínculo operacional**, sujeito à validação em uso e às regras de Operações. Não usar anúncio, título, SH-code ou mapping experimental como substituto da composição física.
5. **Prioridade atual soberana:** pedido real → Painel → separação/etiqueta → finalização física → baixa única e correta do estoque. Não atrasar esse ciclo para completar catálogo geral.

## O que permanece pronto e reaproveitável

- Reconhecimento exato por `channel_account_id + external_item_id + external_model_id`, com fallback legado controlado e bloqueio em ambiguidade.
- Composição de um ou mais componentes físicos; preview sem escrita; Core Bridge; testes automatizados e diagnóstico privado autenticado.
- Piloto Porto Gel Viviane 1/2/3/4 kg: mappings persistidos, composições verificadas, teste autenticado no runtime relatado com `selected=4, recognized=4, blocked=0, written=0`. **Isso homologa o reconhecimento e a projeção técnica, não a entrada de pedido real.**
- Porto Gel 5 kg: **pendente** devido à retirada comercial-alvo ainda não reconciliada com o estado publicado; não criar mapping ou composição por suposição.
- Glucodry 1/2/4 kg: IDs observados e mappings legados identificados; controle físico em gramas sem variantes; **não promover automaticamente esses mappings a operacionais** antes da confirmação de seu contrato físico e necessidade de uso.

## Três classificações de acompanhamento (conceituais, NÃO campos implantados)

- **Experimental/histórico:** criado em desenvolvimento/validação; pode servir de referência, mas não implica aprovação operacional.
- **Operacional vigente:** identidade externa e composição física comprovadas para utilização no fluxo aplicável.
- **Em transição comercial:** anúncio ou variação sujeito a alteração, substituição ou retirada; preservar rastreabilidade histórica e validar novo vínculo antes do uso.

Não adicionar colunas, tabelas, flags ou filtros em produção apenas para representar essas classificações. Avaliar implementação somente mediante necessidade funcional observada, com os contratos e impacto nos leitores/escritores.

## Ciclo mínimo por mudança comercial

1. **Arquitetura Comercial:** comunica conta/anúncio afetado, decisão (manter/alterar/criar/retirar), oferta/apresentação aprovada e estado da publicação.
2. **Evidência externa:** verificar no dado Shopee atual Item ID, Model ID, variação e status da oferta; não inventar IDs nem deduzir identidade do título.
3. **Mappings:** confrontar com vínculo existente. Reutilizar, corrigir pontualmente, criar ou deixar pendente. Preservar histórico e impedir roteamento ambíguo.
4. **Operações:** envolver apenas quando houver dúvida física concreta sobre Produto Mestre, variante, quantidade ou evento de estoque.
5. **Validação:** preview autenticado sem escrita, teste de componentes e quantidade; só ativar escrita operacional através da Integração Shopee e dos gates vigentes.
6. **Uso e observação:** monitorar falhas reais e corrigir apenas o necessário.

## Contrato de repasse mínimo entre especialistas

- **Arquitetura Comercial → Mappings:** conta/loja, anúncio, mudança desejada, estrutura comercial aprovada, status de publicação e IDs efetivos quando já confirmados; indicação de apresentação física existente ou dúvida específica.
- **Mappings → Integração Shopee:** IDs oficiais escopados por conta, vínculo Produto/Variante/Componentes, status de validação e eventuais blockers. Integração responde por OAuth, Cloud Run, ciclo e criação de pedidos.
- **Mappings ↔ Operações:** somente validação física onde indispensável; Operações mantém soberania sobre separação e baixa de estoque.
- **Camada Mestre:** impactos sistêmicos, conflitos entre decisões e priorização transversal.

## Regras de segurança e preservação

- Pedido ≠ OP; criação do pedido ≠ baixa do estoque.
- Não apagar vínculos ou identidades necessários à interpretação de pedidos históricos.
- Não assumir que alterar anúncio preserva Item ID/Model ID.
- Não reaproveitar mapping de outra conta.
- Não converter decisão comercial ainda não publicada em mapping oficial ativo.
- Não refazer produtos, variantes, composições ou motores já existentes sem evidência funcional.
- **Marcos distintos:** código, PR/merge, migração, deploy, gates, preview e pedido real; um não substitui outro.

## Critério prático de prioridade

**Faixa A:** bloqueio concreto no ciclo de pedido real e separação. Resolver imediatamente e validar.  
**Faixa B:** anúncio cuja reformulação foi aprovada e publicada. Reconciliar identificação e composição, com preview.  
**Faixa C:** mapping legado ou catálogo ainda não reformulado, sem impacto operacional. Preservar e aguardar gatilho, sem campanha de migração em massa.

## Continuidade imediata

1. Não ampliar Glucodry por inércia; manter evidências e vínculos legados em observação.
2. Manter Porto Gel 5 kg pendente, sem inventar composição nem afirmar remoção efetiva.
3. Receber os primeiros repasses da Arquitetura Comercial conforme cada anúncio mudar.
4. Apoiar, quando necessário, a Integração Shopee no reconhecimento de pedidos reais e bloqueios específicos.
5. Rever este método após evidências de uso real; evitar auditorias repetidas e documentação paralela concorrente.

**Fontes de diretriz consultadas:** `DIRETRIZ_PRIORIDADE_CICLO_FUNCIONAL_SHOPEE_PAINEL_CENTRAL_2026-10-20_V1_0`; `ARQUITETURA_MESTRE_SHOPEE_PAINEL_CENTRAL_V1_0_CONGELADA`; `DIRETRIZ_GOVERNANCA_GITHUB_LOVABLE_SUPABASE_CODEX_PAINEL_CENTRAL_V1.0`. Este registro complementa as diretrizes, sem substituí-las.
