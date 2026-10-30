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


---

## CHECKPOINT DE TRANSFERÊNCIA — 30/10/2026 (Mappings Shopee 1 → Mappings Shopee 2)

**Origem:** Especialista Mappings Shopee — Catálogo Operacional 1.  
**Sucessor:** Especialista Mappings Shopee — Catálogo Operacional 2.  
**Natureza:** registro de continuidade, sem homologação nem autorização de escrita; preserva as decisões anteriores deste arquivo.

**Método e linhagem:** o Método Mestre do Laboratório de Mappings V1.0 segue referência metodológica congelada (modo original somente leitura). O Ecossistema Mappings Shopee V2.0 (29/10) e Refinamento Prático V2.1 (30/10, quatro portões) são **PROPOSTAS**, não substituem automaticamente a V1.0 ou diretrizes soberanas. Originais e matrizes permanecem nas fontes do projeto/Biblioteca.

**Último estado — Adão, Biscoito e Chocolate Diehl:**
- **48/48 pares Item ID + Model ID distintos conferidos**, sendo **24 Biscoito (BA1/BA2/BA3) + 24 Chocolate Diehl (CB1/CB2/CB3)**. Fontes de evidência: PREFLIGHT_MAPPINGS_48_ADAO_2026-10-30.xlsx; AUDITORIA_48_MAPPINGS_ADAO_SEM_CODEX_2026-10-30.xlsx; RECONCILIACAO_BISCOITO_DIEHL_ADAO_48_MODELOS_2026-10-30.csv e Matriz Única Shopee comercial V9. Pré-flight: 48 pares únicos e seis cadastros físicos distintos ativos na fotografia.
- **Mappings nesta frente: 0/48 persistidos** na última auditoria. **Ensaio BEGIN/ROLLBACK não realizado** nessa auditoria; **COMMIT dos 48 não autorizado/não realizado**. A conferência de identidades não constitui implantação nem homologação de mappings.
- **Contrato de apresentação:** [PR #400](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/400), merge SHA b82b92493f198e52024fcd33209128c586c1752d, propagou commercial_presentation_id e a proteção BA3/CB3. [PR #401](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/401), merge SHA 44c8416ffb245cf18d95233e4439cb36a98a772d, corrigiu erro SQL 42601 na migration supabase/migrations/20261030170000_shopee_commercial_presentation_contract.sql. A auditoria especializada **relata** migration aplicada e validada no Lovable Cloud; a presente edição documental não refez consulta independente ao banco. Esses PRs não implantaram os 48 mappings.
- **Físico/histórico:** BA1/BA2 exigem conferir separação em pacotes fechados, não só multiplicação por 22 biscoitos; BA3 usa caixas originais lacradas. CB1/CB2 exigem distinguir consumo em gramas de embalagem M400/M1000; CB3 requer preservação da unidade física E20 lacrada. Riscos de reinterpretação de Biscoito histórico e Chocolate 500 g → 400 g exigem evidência temporal antes de bloqueio numérico ou writer. Não inferir pares históricos ausentes.
- **Runtime:** Cloud Run com código recente, proteção histórica específica e preview IAM dos 48 **não comprovados** neste checkpoint. Referências técnicas adicionais: [PR #397](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/397) (guarda Porto Gel legado), [#398](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/398) (diagnóstico IAM 70 identidades) e [#399](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/399) (teto de payload); merge não prova deploy.

**Aprendizado reutilizável:** verificar identidade externa datada, decisão comercial e todos os componentes físicos; proteger semântica histórica antes de resolvedor/writer; evitar pre-flight e documentação redundantes; ensaiar ROLLBACK na tabela oficial apenas quando autorizado; confirmar persistência com consulta independente; distinguir código/CI, migration, deploy, preview e pedido real.

**Próxima ação única — Mappings Shopee 2:** retomar as 48 linhas já conferidas e **resolver com Produto Mestre/Operações os bloqueios de embalagem/identidade física e a evidência histórica, sem refazer o inventário ou gravar mappings**. Depois, sob aprovações específicas: ensaio transacional; guarda histórica; COMMIT controlado; validação autenticada no Hub implantado. Integração Shopee 7 responde pelo runtime; Comercial pelas ofertas; Operações pela verdade física.

**Estado:** checkpoint para transferência sujeito à revisão e merge documental; não promover propostas a método vigente. Preservar fontes originais, matrizes e histórico do chat Mappings Shopee 1. REGISTRAR ≠ DECIDIR.
