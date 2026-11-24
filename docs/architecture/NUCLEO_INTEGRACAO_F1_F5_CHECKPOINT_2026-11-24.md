# Núcleo 2.0 — integração F1–F5 e checkpoint · 24/11/2026

Base oficial herdada: `main` em `5b56d64b7b009649ac331182a12932661213ae1e` (#1068). Branch isolada `feat/nucleo-integracao-f1-f5-20261124`. Nenhuma mudança nos módulos externos. Este registro é checkpoint de engenharia, não mapa soberano.

Fonte principal: as **476 linhas integrais** de `MAPA_MESTRE_NUCLEO_2_0_V1_3_AC01_CONHECIMENTO_ESPECIALISTAS_CONGELADO_2026-11-14.txt`, fornecidas pelo proprietário, lidas integralmente e copiadas byte a byte para este diretório. SHA-256 `0da8ec8d44b4ad3ae0009f02d46433a29dff85877a9c923f5843955e2aa08c4f`. `.gitattributes` impede conversão de EOL desse original. `MAPA_MESTRE_NUCLEO_V13_SHA256.txt` registra a integridade. A matriz `NUCLEO_CA01_CA29_ATENDIMENTO_2026-11-24.md` preserva os 29 critérios literalmente; nenhum recebe homologação por inferência.

## Capacidades implementadas

| Bloqueio | Delta concreto | Estado e limite |
|---|---|---|
| B01/F2 | Candidata aditiva de especialidades, instâncias, identidade Auth, assignments N:N e referências a registros originais | Desenvolvida; 3 instâncias no NUC e uma especialidade NUC+CRM testadas em banco descartável. Sem cadastro ou backfill produtivo. Especialidades podem existir sem vínculo; a leitura candidata exige contexto explícito de módulo. |
| B02/F1 | Grants de leitura separados, módulo/frente explícitos, prazo limitado, revogação, autoria/origem da concessão e revogação, RLS em tabelas e RPC invoker | Desenvolvida/testada em PostgreSQL descartável. Nenhuma exigência de `nucleo_manage` global para o próprio contexto. Raw M3/FM/AC-01 permanecem protegidos. Nenhum executor G2 foi promovido. |
| B03/F3–F5 | Referências por FK a AC-01, FM, M4 e evento/checkpoint M3; consulta opcional por módulo/especialidade na ficha existente | Desenvolvida; sem duplicar writer AC-01, documento ou histórico. O contexto traz método geral/local e metadados revisados; não certifica vigência, decisão ou sucessão. M5 continua usando as mesmas fontes, sem nova base de alertas. |
| B04 | 22 referências reais, em 10 módulos, verificadas em blobs Git com commit e SHA-256; preparação de payloads para o escritor AC-01 vigente | Preparado, sem gravação. Request UUID v8 determinístico por módulo/caminho/hash; repetição conserva identidade. Papel ausente permanece `null` e pendência explícita. CCH V6.0 é o índice de continuidade; V5.4 e outras fontes históricas preservadas. |
| B05 | Diff textual local AC-01 em duas versões da mesma linhagem, UTF-8 até 200 KB/600 linhas; LCS com inclusões/remoções, SHA-256 e bloqueio por checksum divergente | Desenvolvido e testado com arquivos sintéticos no Chrome. Requer seleção autorizada; nada é enviado a rede, logs ou storage pelo comparador. Sem hashes dos dois registros, a correspondência de origem é expressamente não comprovada. Fontes inacessíveis permanecem comparadas apenas por metadados. |
| B06 | Entrada de vínculos na ficha M3 existente; preparação de referências na cobertura transversal; comparação no painel AC-01 existente | Integrável sem candidata aplicada: consulta opcional informa indisponibilidade/negação de forma segura. Prova visual local desktop/mobile, não uso produtivo do proprietário. |

## Contratos e fronteiras F1–F5

- `nucleo_identity_assignments_read(module_id uuid)`: somente vínculos visíveis sob a identidade JWT corrente e concessões válidas. Retorno vazio não certifica inexistência de trabalho.
- `nucleo_identity_context_read(assignment_id uuid)`: contrato `nucleo_identity_context_v1`; retorna identidade/contexto, referências geral/local, prazo e IDs de registros originais. `SECURITY INVOKER`, `search_path=''`, sem definer/service_role, sem conteúdo bruto de documentos. O parâmetro usa `$1`, evitando resolução ambígua com colunas.
- `isIdentityContext`: confere contrato, identidade, módulo, assignment, prazo, tipo e cardinalidade de referências. A UI descarta resposta de outra sessão/contexto, limpa estado em troca de identidade e remove o resultado ao expirar. Revogação é revalidada em cada consulta; nenhuma tela pode recolher informação já vista legitimamente.
- Referências AC-01 preservam ID, linhagem, autoria e estado dos originais. A associação é explicitamente revisada, não inferida pelo nome. FM de módulo não é projetado implicitamente em concessão limitada a uma frente. Evidência/checkpoint exige o mesmo contexto exato.
- A candidata não fornece writer de grants, publicação ou decisão. Objetos de associação/curadoria dependem de autoridade competente e escritor separado; o usuário `authenticated` não possui INSERT/UPDATE/DELETE. Sucessor sem assignment/grant não herda acesso.
- AC-02 consultivo existente e contrato legado #1068 permanecem compatíveis. O novo contexto não transforma metadados aprovados para leitura em método homologado. Decisões, aprendizados e erros/acertos continuam nos registros originais e só entram como referências revisadas; não existe inventário integral automaticamente inferido.

## Contraprovas e alcance

Comando único, após `npm ci`:

```sh
node scripts/nucleo-final-counterproof.cjs --native-db
```

Para a parte de banco, definir `PGHOST=127.0.0.1`, `PGDATABASE=nucleo_identity_disposable`, `PGPORT`, `PGUSER` e senha **do banco descartável**. O executor recusa host não loopback ou outro nome de banco. O workflow `nucleo-integrated-completion.yml` provisiona PostgreSQL 17 descartável e executa o mesmo comando. Sem `--native-db`, executa contratos/regressões, TypeScript e build; não afirma prova de banco.

Testes SQL aplicam as migrations reais M1/M2/M3/M4/FM/AC-01 antes da candidata, usando apenas o bootstrap Auth sintético já existente no projeto. Cobrem isolamento, ausência de capacidade global, acesso negado/anon, vínculo N:N, método local separado, revogação/expiração, preservação do legado e origem, referência cruzada rejeitada, histórico imutável e duplicidade. PostgreSQL WASM local é prova descartável complementar; concorrência exige PostgreSQL nativo no CI, em duas transações. Nenhum teste usa o Core oficial.

Prova visual local: Chrome, desktop 1366 px e mobile 390 px; comparação de dois arquivos sintéticos mostrou 2 linhas incluídas e 1 removida; mensagem de origem não comprovada permaneceu visível. Lote CRM preparado com confirmação visual de cópia, sem INSERT. Teclado Tab transferiu foco ao próximo controle. Mobile `scrollWidth=375` com `innerWidth=390`, sem overflow horizontal. Texto secundário `rgb(100,116,139)` sobre branco: contraste 4,76:1. Não constitui auditoria WCAG global, prova autenticada do aplicativo publicado, UAT do gestor ou homologação de CA-20. Capturas locais em `.identity-lab/comparacao-desktop.jpg` e `.identity-lab/comparacao-mobile.jpg`, dados somente sintéticos; não fazem parte do acervo Core.

## Implantação candidata e rollback

1. Revisar separadamente a candidata em `docs/architecture/proposals/nucleo_identity_read_candidate.sql`; ela está **fora de `supabase/migrations`** e contém trava `nucleo.identity_candidate_disposable=on`. Nenhum comando existente de deploy a aplica. Implantação futura deve gerar artefato próprio após decisão específica, não remover a trava por conveniência.
2. Antes de qualquer implantação autorizada: confrontar catálogo/RLS/default grants atuais, FK/constraints e volume; selecionar piloto NUC, ator individual, vínculos comprovados, referências curadas, escopo/prazo e ato competente. Não fazer match por nome, não importar histórico. Rever papéis privilegiados existentes e qualquer privilégio default herdado.
3. Aplicar somente o artefato expressamente aprovado, dentro de transação e com backup/readback. Provar JWT individual real no gateway/PostgREST, leitura própria sem capacidade global, negativas de outro módulo/frente/usuário, revogação/expiração e writer AC-01 existente. Somente depois habilitar concessão real do piloto.
4. Rollback funcional: retirar a entrada opcional da UI e revogar EXECUTE dos dois RPCs e USAGE/SELECT do schema candidato dos papéis clientes autorizados no ato. Fechar/revogar concessões com motivo/ator pelo executor competente. Preservar relações, origens e histórico para auditoria; **não executar DROP/CASCADE ou apagar documentos**. Reconsultar o app legado e as políticas originais. Rollback também exige o mesmo portão de produção; não foi executado no Core.

## Impedimentos externos exatos

1. Decisão específica para implantação de DDL/RLS/grants candidatos, incluindo executor competente, escopo e prazo do piloto; o comando atual autoriza preparação, não aplicação no Core. Evidência: candidata e negativas descartáveis; PR #1004 continua experimental, sem merge integral.
2. Sessão individual real autorizada no aplicativo/gateway e leitura atual do Core por contrato apropriado; não há conector Lovable/Supabase disponível nesta sessão. Evidência anterior de contagens em 24/11 é baseline fornecida, não nova consulta desta execução.
3. Responsáveis e autoridade documental dos módulos, elegibilidade/duplicidade das referências e ato de gravação pelo writer oficial. O lote não inventa frentes nem certifica autoria/mandato. Hash prova bytes, não titularidade ou vigência.
4. Fontes documentais/conteúdo remoto e autorização granular para formatos além de texto selecionado localmente. O diff não busca arquivos privados nem transforma localizador em permissão.
5. Decisão humana competente e executor distinto para publicação canônica; duas versões reais, readback vigente/histórico e avaliação do proprietário/operador independente para o aceite A+. F6/F7 e migração B permanecem fechados.

O original soberano foi recuperado; esse impedimento documental foi efetivamente removido. Ainda não há publicação/uso/homologação global comprovados. Engenharia desenvolvida/testada, integração Git, publicação servida, uso real e homologação devem continuar registrados separadamente. Resultados finais de CI e commit/PR ficam no checkpoint consolidado da issue #1037.
