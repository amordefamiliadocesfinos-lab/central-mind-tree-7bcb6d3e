# Jornada SKU V1.3 — Gate G04 | Implantação controlada do Core e Hub

**Projeto:** Painel Central — Amor de Família  
**Situação:** PREPARAÇÃO CONCLUÍDA / **NÃO AUTORIZA EXECUTAR**  
**PR técnica:** #1134, em draft. **Issue física paralela:** #1138.  
**Autoridade:** Plano Mestre V1.3 (Core/Hub primeiro, contas Shopee por último).  
**Ambiente oficial:** Lovable Cloud do projeto `1720a410-34cd-4410-995c-8c92c7edf16b`; Integration Hub em Cloud Run, separado do deploy Lovable.  
**Nota:** os projetos do conector Supabase não devem substituir o Lovable Cloud oficial.

## 1. Evidências já obtidas em 25/11/2026

- Conferência **SELECT na base oficial** com `E05_PRE_MIGRATION_READONLY_CORE.sql`: 168 mappings distribuídos por 4 contas, 0 pares duplicados, 0 chaves oficiais divergentes, 24 exceções físicas, 0 tabelas/rotinas novas implantadas. Resultado `pre_migration_snapshot_matches=true`.
- Revisão da PR `d8f17f50e5454d0c660456e1745d9ca49c1eaedf` passou na CI isolada: workflow G03 `45708092249` e workflow Hub/Docker/TypeScript `45708092270`.
- A branch estava **18 commits atrás** da main consultada (SHA `6837f29128da3c2d67884eacd85017124a9d7e9e`), apesar da PR não apontar conflitos naquele momento. **Reconciliar com main e refazer CI na revisão final antes do merge.**
- Matriz consultiva: 168 mappings, 42 Seller SKUs pretendidos, 24 exceções físicas e 144 sem aquela ressalva. A projeção JSON e a conciliação por export são ferramentas de trabalho; não são novas matrizes soberanas.

## 2. Ordem obrigatória de execução futura

### G04.1 — Preparação de engenharia (sem produção)

1. Comparar a branch com a `main` atual; resolver conflitos sem desfazer outros módulos (Saúde, Núcleo, CRM, Logística). Reexecutar workflow G03 descartável, suíte Hub/Docker, TypeScript e regressões afetadas.
2. Revisar a migração `20261125210000_marketplace_seller_sku_registry_v13.sql`, papéis reais e RLS. Nenhuma criação de produtos físicos, mapping, estoque ou pedido é permitida por essa migração.
3. Reexecutar `E05_PRE_MIGRATION_READONLY_CORE.sql` no Core oficial antes de qualquer instalação. Resultado deve ser o esperado, e eventuais diferenças impedem implantação automática.
4. Confirmar previamente a política de publicação automática do Lovable/GitHub e do Cloud Run; **não pressupor que merge não realiza deploy**.

### G04.2 — Autorizações independentes

**Ainda necessárias:** autorização de merge da PR, autorização de aplicação da migração no Lovable Cloud, autorização de deploy do Core Bridge, autorização de deploy do Hub e autorização de popular o cadastro comercial.

A aprovação anterior G03 cobriu **desenvolvimento de código e testes descartáveis**, não estas operações produtivas. A atualização de Seller SKU na Shopee, a operação do importador e a alteração física Amendoim exigem decisões/gates distintos.

### G04.3 — Migração Core (somente após gate produtivo)

1. Obter checkpoint/backup e verificar se o método de migração do Lovable Cloud aplica arquivo SQL com transação e como se faz rollback sem perder histórico.
2. Aplicar a migração revisada uma única vez, pelo fluxo autorizado do **Lovable Cloud oficial**; registrar revisão, horário, executor e resultado.
3. Executar `E05_POST_MIGRATION_READONLY_CORE.sql`. Esperado: tabelas presentes; RLS ativado; políticas admin; revogações; funções de escrita e leitura com papéis corretos; inicialmente **0 estados comerciais e 0 eventos**, se a etapa de população ainda não tiver começado.
4. Testar consulta administrativa autenticada e bloqueio de usuário não administrador em ambiente controlado. **Não escrever para testar em produção antes da etapa autorizada de cadastro**.

### G04.4 — Serviços consultivos (gates de deploy separados)

1. Deploy/revisão do **Core Bridge** com HMAC e ação exata `shopee.seller_sku_registry.read`, somente após schema confirmado.
2. Deploy/revisão do **Integration Hub**, que adiciona `POST /internal/shopee/live/sku-registry/preview`, com IAM e sem body/query. **Flag `SHOPEE_SKU_REGISTRY_PREVIEW_ENABLED` permanece OFF**.
3. Em contraprova futura, somente com autorização, habilitar **uma identidade Item/Model definida** na infraestrutura; verificar `written:0` e diferença canônico/observado. Desabilitar após consulta, se for teste temporário.
4. Nenhuma rota de importação, processamento, expedição, estoque ou OAuth recebe nova autorização por esta publicação.

### G04.5 — População auditada do registro comercial (gate distinto)

- Fonte dos 168 mapping IDs: `sku-v13-168-models-core-projection.json`.
- Registrar 144 ofertas com status inicial `PLANEJADO` e 24 ressalvas físicas com `BLOQUEADO_LOCAL` **somente após autorização específica** e decisão sobre o processo de escrita.
- A RPC `public.record_marketplace_seller_sku_state` exige sessão administrativa ativa, UUID único de evento, `expected_revision`, canonical_sku e fonte da decisão. Não conceder permissão de INSERT/UPDATE direto para povoamento mais rápido.
- Iniciar com `observation_kind=UNKNOWN` para evitar confundir fotos/exportações históricas com observação atual. Após uma prova externa datada e vinculada ao Model, registrar `BLANK` ou `VALUE` com evidência e data.
- Não carimbar `PUBLICADO_CONFERIDO` por causa da intenção do Core; só após conferência do valor persistido na Shopee.
- Para os 24 fisicamente excepcionais, a decisão sobre produto/componente antecede qualquer liberação para publicação. Ver issue #1138.
- Se a gravação de uma oferta falhar: registrar o erro, **não** reprocessar sem checar `revision` e idempotência; demais ofertas independentes podem prosseguir sem esse Model.

### G04.6 — Shopee por último

Somente depois do Core e Hub estarem preparados e da reconciliação do cadastro: baixar exportação **recente** de cada conta, gerar delta em colunas de Seller SKU sem mudar Item/Model, preço, estoque, logística ou imagem; publicar primeiro L01 Celivio Brigadeiro, conferir reexportação e então expandir lotes. Preservar códigos VIV com regra temporal. Não usar planilha consultiva antiga diretamente para upload.

## 3. Rollback e contenção

- **Antes de migração:** manter PR em draft / não mergeada; nada precisa ser revertido em produção.
- **Falha durante migração transacional:** seguir rollback do mecanismo de migração oficial após confirmar a semântica transacional. Não executar scripts DROP genéricos.
- **Migração já aplicada e com dados:** não remover tabelas/eventos. Desativar caminhos de consulta/uso, registrar incidente e preparar migração corretiva auditável, aprovada separadamente.
- **Hub consulta falhando:** manter preview OFF e operação manual Seller Center como antes. Não ativar intake/commit para contornar erro.
- **Erro em um mapping:** não usar Seller SKU para trocar automaticamente Item/Model ou componente físico.

## 4. Critérios de saída do G04 (para registrar na Camada Mestre)

- Base revisada sem conflitos, CI verde no SHA final e revisão de segurança concluída.
- Identidade oficial e contagem 168/42/24 rastreáveis.
- Governança de deploy e rollback confirmada.
- Autorizações separadas registradas; só declarar 'implantado' após verificação real do ambiente e publicação.
- Contas Shopee e automação dos pedidos mantidas como etapas posteriores.

**Checkpoint:** documentação e pré-verificação de produção por SELECT realizadas. Implantação no banco, merge e deploy continuam NÃO EXECUTADOS.
