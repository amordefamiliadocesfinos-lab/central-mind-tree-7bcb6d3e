# Núcleo 2.0 — M2: inventário inicial de referências governadas (11/11/2026)

**Projeto:** PAINEL CENTRAL — AMOR DE FAMÍLIA  
**Escopo:** fontes já reconhecidas nas diretrizes e rastreadas no Google Drive, **somente metadados**.  
**Mapa:** NÚCLEO 2.0 V1.0, M2; dependência técnica: PR #611, migration `20261111210000`.

## 1. Fontes verificadas e cadastradas

As três referências iniciais foram conferidas por metadata do Google Drive conectado e inseridas na tabela `public.nucleo_source_references` do Core oficial. **IDs, ACL detalhada e conteúdos não são publicados neste documento**.

| Referência | MIME | Classe de acesso | Autoridade | Estado |
|---|---|---|---|---|
| RASTREAMENTO DOCUMENTAL DO GOOGLE DRIVE — V1.0 | Google Doc | privado | historico | validado_metadados |
| DIRETRIZ MESTRA DE COMPILAÇÃO E UNIFICAÇÃO DOCUMENTAL — V1.0 | Google Doc | privado | nao_classificado | validado_metadados |
| BASE DE CONHECIMENTOS V1.2 — PROVISÓRIA RESTRITA | Pasta Drive | privado | pendente_homologacao | validado_metadados |

`validado_metadados` confirma apenas que os metadados da fonte foram obtidos; **não significa homologação, integridade dos bytes, revisão semântica ou autorização de publicação**. O Google Drive exibiu `shared=false` e permissão de proprietário nas três origens consultadas, sem nova alteração de ACL.

Não se presumiu checksum de arquivo onde Google não forneceu hash aplicável; `source_checksum_sha256` ficou nulo em todas as referências. O ZIP privado V1.2 permanece identificado como uma única base lógica, não como 29 documentos independentes.

## 2. Ação no Core oficial

- Inserção transacional metadata-only com `ON CONFLICT (provider,provider_file_id) DO NOTHING`, sem sobrescrever dados existentes.
- Readback: **3 referências**, todas com `content_imported=false`; 0 documents, 0 revisions, 0 batches.
- `nucleo_manage`: **0 concessões**. `provision_users` ativa: **1**, preservada.
- `nucleo_source_references` com RLS ativada e 2 policies (SELECT/INSERT apenas se `nucleo_manage` ativo).
- Consulta de segurança real do Core, em transação com `SET LOCAL ROLE authenticated` e claim de identidade sintética sem concessão: **0 referências visíveis**; transação encerrada por `ROLLBACK`. Este teste não substitui E2E com sessão real autorizada.
- Não foram introduzidos dados de clientes, arquivos binários, tokens ou textos completos no banco, nos commits ou na UI.
- Nenhum arquivo do Drive foi movido, excluído, compartilhado ou renomeado.

## 3. Evidência e fronteira de autoridade

- PR #611: implementação M2 (tabela, frontend restrito na Biblioteca, CI PostgreSQL 17).
- GitHub Actions run #43100448213: **SUCCESS** para testes RLS e build completo.
- Fonte documental de controle: `DIRETRIZ MESTRA DE COMPILAÇÃO E UNIFICAÇÃO DOCUMENTAL V1.0`; classificação sem promoção automática.
- Base V1.2: **privada/provisória, publicação e visões granulares não homologadas**. O inventário aqui não concede acesso a especialistas.
- Os 82 registros locais legados permanecem fora do banco M1; a UI local atual não foi substituída.

## 4. Próximos portões do mapa

1. Testar **visibilidade positiva em sessão real com capacidade `nucleo_manage` explicitamente outorgada**, após decisão de identidade/grant e auditoria. Não conceder capacidade automaticamente.
2. Homologar visualmente o catálogo, mantendo o editor local e a fronteira de permissões do Drive.
3. Crescer o inventário mediante classificação individual e necessidade fundamentada; não carregar os 917 conteúdos indiscriminadamente.
4. Não avançar a integração para publicação/autoridade dos documentos enquanto a Base V1.2 não receber decisão formal.

**Estado:** M2 catalogação inicial **concluída**; M2 homologação funcional positiva **pendente**. M1 sem importação documental.
