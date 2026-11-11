# Núcleo 2.0 — M4 | Contrato de evidência técnica vinculada

**Data:** 11/11/2026  
**Mapa soberano:** Núcleo 2.0 V1.0 — M4 integração GitHub/Supabase ao acompanhamento da M3.  
**Escopo:** primeira ligação governada **por snapshots conferidos**, sem inferir progresso, mudar estados ou introduzir credenciais.

## Evidência ≠ conclusão

A M3 continua autoridade sobre estado, responsável, próxima ação e critérios de aceite. A M4 insere um histórico adicional associado a cada frente, com metadados identificáveis da fonte:
- GitHub: PR, commit, execução de testes;
- Supabase: versão de migration no histórico oficial `supabase_migrations.schema_migrations`.

A evidência tem `observed_state` (`observado`, `verificado`, `divergente`, `nao_verificado`), `checked_at`, identificação, título, nota, metadata mínima e data de registro. **Verificado** significa conferência naquela data/hora, não monitoramento contínuo. Status de PR/CI não determina automaticamente status da frente. Nunca gerar porcentagem.

## Contrato técnico

Migration `20261111234500_nucleo_m4_technical_evidence.sql` cria `public.nucleo_development_evidence`:
- FK `workstream_id` com `ON DELETE RESTRICT`;
- Origem GitHub limitada ao repositório oficial e URL nesse repositório; Supabase somente `migration`, sem URL externa;
- Trilha append-only com trigger que bloqueia UPDATE/DELETE, inclusive em caminhos administrativos;
- RLS `nucleo_manage` ativa, sem nova capacidade, sem acesso anônimo e sem permissão DELETE/UPDATE ao navegador;
- Registro `observado` pelo cliente; o cliente autenticado e o papel service_role **não podem se autodeclarar** `verificado`. A verificação exige reconciliação externa via executor técnico privilegiado, deixando snapshot preservado;
- Não aceitar `percent_complete` ou `progress_percentage` no snapshot.

Interface M4 aparece **dentro da ficha M3**, não cria página paralela nem acessa diretamente GitHub/Supabase pela sessão do navegador. As consultas são submetidas à RLS do Core; links externos são restritos ao repositório oficial. Preservar os 82 documentos locais, as 3 referências privadas da M2 e os estados/autoridades M1–M3.

## Origem e primeiro conjunto de evidências verificáveis

Antes de inserir qualquer snapshot `verificado`, confrontar a origem diretamente:
- GitHub PR #608: contrato M1 e migrations aplicadas;
- GitHub PR #611: catálogo M2;
- GitHub PR #614: Central Visual M3;
- GitHub PR #619: correção M3 após uso real;
- CI dos respectivos PRs: registrar apenas execuções realmente com `success`;
- Supabase `schema_migrations`: versões `20261111193600`, `20261111193601`, `20261111210000`, `20261111222000`, `20261111232500`.

**Não afirmar verificação de um registro somente por constar nesta lista.** Inserção de evidência depende de comparação do ID no GitHub e da versão no banco. Não promover status M4/M3 automaticamente.

## Homologação
1. CI isolado Postgres 17: teste de autenticação, revogação, origem, links, eventos imutáveis e autoverificação negada.
2. Build completo e revisão do diff.
3. Verificar pré-condições do Core e aplicar migration aditiva em transação com versionamento, apenas após aprovação CI.
4. Ler de volta permissões, triggers e contagem inicial igual a zero.
5. Registrar primeira leva de evidências apenas após consulta real das fontes, sem conteúdo privado.
6. Confirmar interface autenticada na ficha; não supor E2E a partir do build.

M4 inicia com **snapshots auditados**, não uma sincronização agendada/autônoma do GitHub. Qualquer coleta recorrente com credenciais e webhook demanda subetapa posterior dentro da M4 e validação de segurança própria.

## Implantação aditiva — evidência efetivamente registrada em 11/11/2026

- Migration `20261111234500_nucleo_m4_technical_evidence.sql` instalada no Core PostgreSQL 17.6 e registrada no histórico `supabase_migrations.schema_migrations`.
- RLS ativa, 2 policies, 2 triggers de proteção (autoria e bloqueio UPDATE/DELETE); `authenticated` e `service_role` somente SELECT/INSERT, sem permissão anônima.
- Snapshot inicial com **12 evidências**, todas confrontadas previamente com as origens: 4 PRs integradas (#608, #611, #614, #619), 3 execuções CI aprovadas (43094643388, 43103257248, 43108556183) e 5 migrations efetivamente presentes no Core (20261111193600, 20261111193601, 20261111210000, 20261111222000, 20261111232500).
- Referências ligadas a NUC-M1/M2/M3; estado do Kanban **não foi alterado**. NUC-M4 continua `planejado` no registro anterior até revisão específica dos critérios; não deduzir conclusão pelo catálogo.
- Pós-inserção: 12 evidências, 7 frentes, 11 eventos de acompanhamento, 3 referências Drive, zero documentos M1 importados, uma capacidade nucleo_manage ativa, preservada.
- Teste transacional no Core: identidade administrativa autorizada visualiza 12; identidade sem grant visualiza 0. As transações de teste foram revertidas.
- Registros originados por execução técnica administrativa `recorded_by_auth_uid=NULL`; não atribuir falsamente a escrita a uma sessão do navegador. A proveniência da conferência está anotada individualmente.
- [GitHub Actions #43112091483](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/actions/runs/43112091483): PostgreSQL 17 e build completo aprovados.

**Fronteira:** a versão M4 implantada registra e exibe snapshots auditáveis. Não realiza sincronização em tempo real, webhook ou polling GitHub. E2E visual autenticado do novo componente permanece pendente.
