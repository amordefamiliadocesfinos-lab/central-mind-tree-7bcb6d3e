# NÚCLEO 2.0 — REVISÃO MACRO DA ENTREGA A+ / CHECKPOINT 73
**Projeto:** Painel Central — Amor de Família  
**Data:** 16/11/2026  
**Autoridade:** Camada Mestre / Mapa Mestre Núcleo 2.0 V1.3 (referido nos contratos e no mapa UX).  
**Tipo:** diagnóstico documental e técnico de continuidade, **não homologação**, não decisão de alteração de escopo.

## 1. Fontes efetivamente confrontadas

- `docs/architecture/NUCLEO_2_0_AUDITORIA_FINAL_PENDENCIAS_PRIORIZADAS_2026-11-12.md`, principalmente seções **57–72**; o diagnóstico inicial M0–M5 é uma fotografia de **12/11**, não um readback atualizado de produção.
- Contratos versionados na `main`: `ac02-registry-contract.ts`, `ac02-assumption-export.ts`, `ac02-controlled-distribution.ts`, `ac02-package-manifest.ts`, `ac02-documentary-coverage.ts`, `ac02-continuity-summary.ts`, `ac02-assumption-guide.ts`, `ac02-knowledge-gaps.ts`, `ac02-handoff-ledger-contract.ts`.
- Endpoint existente `supabase/functions/nucleo-knowledge-read/index.ts` e documentação `AC02_REPASSE_ESPECIALISTA_UX_ENTREGA_A_PLUS_V1_0_2026-11-14.md`.
- Referência de responsabilidade visual `NUCLEO_2_0_MAPA_VISUAL_UX_V1_0_CONGELADO_2026-11-14.md`.
- PR #835 e teste `scripts/nucleo-ac02-pacote-enxuto-sem-perdas.test.cjs`, com CI de PR já aprovada. Nenhuma homologação de uso real é inferida dessas provas.

O documento **Mapa Mestre V1.3 soberano não foi aberto diretamente nesta revisão**: a preservação do escopo fundamenta-se nas referências expressas do histórico/auditoria/contratos em `main`. Divergências com o documento soberano exigiriam sua conferência própria, sem alterar o mapa nesta frente.

## 2. Classificação das frentes A+ — não confundir contrato implementado com entrega produtiva

| Frente/capacidade | Estado fundamentado | Próximo tratamento |
|---|---|---|
| Identidade global e Registro Mestre AC-02 (#806) | **Contrato suficientemente desenvolvido** na `main`; identidade decidida pela Camada Mestre, verificações de runtime separadas | **Congelar evolução documental incremental**; conferir somente mudanças reais nas fontes |
| Consulta protegida AC-02 no endpoint existente (#807/#813/#814) | **Código implementado** com opt-in, JWT/`getUser`/`nucleo_manage` e RLS conforme código | **Não homologado em sessão real**; testes 200/401/403 e deploy/revisão ficam para fase posterior |
| Pacote Oficial de Assunção exportável (#813/#814) | **Contrato suficientemente desenvolvido** como rascunho consultivo; não transfere acesso nem conteúdo privado | Não acrescentar seções por padrão; só corrigir perda objetiva ou lacuna comprovada |
| Seleção/revisão e preparação de distribuição (#815) | **Contrato implementado**, sem persistência/entrega | Manter; recebimento, aceite e envio real seguem pendentes |
| Resumo M3/M4, cobertura FM e checkpoint (#824/#825) | **Contratos suficientemente desenvolvidos**; distinguem referências e fatos reais | Não derivar novo “último checkpoint comprovado” sem fonte externa |
| Roteiro de assunção (#827) | **Contrato suficientemente desenvolvido** em seis passos consultivos | Manter sem criar outra trilha ou passo duplicado |
| Inventário G01–G08 e prontidão documental (#828/#832) | **Contratos suficientemente desenvolvidos**; os oito itens são estáveis, sem score | Evitar outra camada de checklist/status; apenas evidência original pode mudar a classificação |
| Consolidação do pacote (#835) | **Concluída em código e teste de regressão**; uma listagem detalhada G01–G08, com contagens e referência cruzada | Não reabrir sem teste que comprove duplicidade ou perda |
| Manifesto SHA-256 (#818) | **Contrato puro implementado e testado**; verifica correspondência de bytes, não origem | Vínculo com fonte autenticada permanece pendente |
| Histórico de repasses (#817/#819/#821/#822) | **Proposta técnica e testes descartáveis**, não funcionalidade no Cloud | **Adiado**: escritor, sessão ativa, RLS, evidências, deploy e homologação |
| Apresentação UX da assunção | **Contrato de repasse entregue ao responsável UX**; o Núcleo não desenvolve telas | Acompanhar integração pelo Especialista UX, sem reivindicar homologação visual |
| M0–M5/AC-01 no Núcleo existente | **Preservar arquitetura e histórico**; auditoria de 12/11 não equivale a atualização completa da produção | Não reiniciar nem alterar estado neste checkpoint; revisão operacional própria quando autorizada |

**Interpretação dos estados:** `suficientemente desenvolvido` significa que o contrato/código já cobre o requisito documental da fase consultiva. **Não** significa que um sucessor tenha acesso, que o pacote tenha sido enviado, que o Core esteja atualizado, que haja aprovação visual ou que exista teste produtivo positivo.

## 3. Melhorias documentais restantes — somente se houver evidência de ganho

1. **Correção pontual fundamentada:** divergência concreta entre código, mapa e fonte real, ou informação única comprovadamente omitida no pacote. Exigir evidência, teste de regressão e redução/neutralidade de redundância.
2. **Rastreio de mudança real de fonte:** quando um registro FM/M3/M4 mudar na autoridade original, atualizar sua referência e checkpoint em fluxo já existente, sem inventar nova camada AC-02.
3. **Repasse ao UX sob contrato atual:** fornecer ao Especialista UX o estado e as ressalvas presentes; não criar segundo arquivo mestre de requisitos visuais.
4. **Nota curta de fechamento macro:** este documento serve de apontador para seções 57–72, evitando copiar contratos e históricos extensos.

**Não recomendado agora:** nova nomenclatura de prontidão, mais scores/percentuais, outra ficha de continuidade, novos tipos redundantes G01–G08, nova Biblioteca, dados copiados de fontes privadas ou reformulação geral de M0–M5.

## 4. Pendências adiadas expressamente pelo proprietário

- **AC02-SESSION-01:** validação de sessão ativa/revogação e escritor exclusivo sem bypass JWT.
- **AC02-PROOF-01:** validação de fonte/proveniência das evidências de entrega, falha e retificação.
- **AC02-PACKAGE-01:** correspondência do manifesto ao documento efetivamente revisado e autenticado.
- **Banco/ledger:** propostas SQL em `docs/architecture/proposals`, **não aplicadas**; sem novas permissões, RLS ou mandatos.
- **Operação real:** leitura JWT autenticada, resultados 200/401/403, envio/recebimento/aceite pelo sucessor, integração visual e homologação humana.
- **Revisão de drift de tipos gerados pelo Lovable** notada na seção 59: investigar apenas na frente competente, sem reverter automaticamente.

Continuam **PENDENTES**, não excluídas do escopo. Nenhuma deve ser promovida apenas por CI ou pelo texto de um Pacote de Assunção.

## 5. Decisão operacional recomendada para a Camada Mestre

**Fechar como suficientemente desenvolvida a camada consultiva/documental AC-02 da Entrega A+, sem declarar homologação operacional.** Registrar um checkpoint único; evitar novas PRs de nomenclatura, listagens, formulários ou classificações sem falha comprovada. O próximo avanço, se houver, deve partir de uma necessidade real do UX ou de nova evidência nas fontes, não de mais fragmentação documental.

**Estado do checkpoint:** avaliação macro realizada na `main`. Nenhuma alteração de schema, código funcional, privilégio, deploy, informação em M3/M4, UI ou Fonte Viva é autorizada ou executada por este relatório. Entrega B continua fechada.


## 6. Encaminhamento do proprietário — pausa da expansão documental incremental (16/11/2026)

**Decisão operacional para esta frente:** encerrar a sequência de acréscimos documentais incrementais do AC-02. Os contratos consultivos existentes são considerados **suficientemente desenvolvidos para esta fase**, sem representar homologação, aprovação de conteúdo original ou assunção efetiva de um especialista.

**A partir deste checkpoint:** não criar novas versões de checklist, indicadores de prontidão, documentos de repasse redundantes, novas classificações G01–G08 ou seções do Pacote Oficial apenas por continuidade automática. Permanecem permitidas **correções pontuais comprovadas**, atualização de referências quando suas fontes originais mudarem e integração necessária com a frente UX existente, sempre com rastreabilidade e preservação de dados únicos.

**Pendências preservadas, sem bloqueio do restante do projeto:** AC02-SESSION-01, AC02-PROOF-01, AC02-PACKAGE-01, ledger/gateway produtivos, políticas, implantação, testes reais, apresentação visual, recebimento/aceite e homologação. Nenhuma das pendências é cancelada ou marcada como concluída. Sua retomada exige nova decisão de escopo apropriada, sem avanço implícito nesta pausa.

**Autoridade e limites:** esta é uma diretriz operacional do proprietário para a continuidade do trabalho do Especialista Núcleo, **não substitui eventual decisão formal da Camada Mestre**, os mapas soberanos nem as fontes originais. Não foi alterado qualquer contrato executável, código, banco, credencial, permissão, mandato, interface ou documento anterior. Mapa V1.3 preservado por referência; Entrega B continua fechada.


## 7. Readback dirigido da nova instância — 16/11/2026 (sem avanço de homologação)

**Proveniência:** consultas `SELECT` do PostgreSQL oficial pelo conector `Lovable.query_database`, projeto `1720a410-34cd-4410-995c-8c92c7edf16b`, após `get_database_status` retornar `enabled=true, stack=supabase`. Conector externo Supabase não lista esse projeto nem tem autorização para consultar migrations/Edge Functions nele. Não foi usado o construtor visual.

- **GitHub:** `main` observada em `a4460c3eacf64f2951f2c3170327c1bf55306c38`, merge da PR #839 (UX V2.7), posterior à PR #838 (`3c554d24af83dc495d600cae689d5c76df49322d`). PR #839 é da frente UX; não duplicar sua interface.
- **Projeto de aplicação:** `Lovable.get_project` retornou `is_published=true`, `status=ready` e `latest_commit_sha=a4460c3eacf64f2951f2c3170327c1bf55306c38`. Isso não prova revisão/deploy da Edge Function nem autenticação em sessão real.
- **Core M3/M4:** 22 registros `nucleo_development_workstreams`, incluindo 10 módulos `ASS,CAP,CRM,DIG,FIN,NUC,OPE,ROT,SAU,SHO`; 51 evidências M4 e 41 eventos históricos; 3 referências M2. CRM possui `CRM-UX02`; Shopee possui `SHO-F12` e quatro subfrentes. Demais módulos cadastrados não equivalem a fichas ou manuais completos.
- **Schema aplicado:** 15 versões com nome `nucleo_*` no ledger `supabase_migrations.schema_migrations`, até `20261114183600`, incluindo a Ficha Viva e as guardas AC-01. No recorte inspecionado, RLS ativa e `anon` sem SELECT nas tabelas `nucleo_module_knowledge_revisions`, `nucleo_specialist_contributions`, `nucleo_ac01_decision_acts`, `nucleo_ac01_authority_grants` e `nucleo_development_workstreams`. Grants de tabela e número de policies não substituem prova de enforcement por JWT real nem teste de revogação.
- **Conteúdo e governança em produção:** 0 revisões FM, 0 contribuições AC-01, 0 eventos de revisão AC-01, 0 atos decisórios, 0 publicações internas, 0 concessões AC-01 de autoridade e 0 mandatos certificados. A ausência desses registros **neste Core e instante** não demonstra inexistência de documentos, decisões ou especialistas em outras fontes.
- **CRM/FM:** `src/lib/nucleo/crmAuthoritySourcesV12.ts` já indexa as fontes originais do CRM e ressalvas de vigência; portanto não recriar inventário. Entretanto, FM-03/FM-08/FM-09 não possuem revisão persistida e não podem ser apresentadas como fontes originais já recuperadas ou métodos vigentes. A próxima intervenção deve ser confrontar fonte/autoridade reais antes de inserir uma versão declarada, sem fabricar titularidade.
- **AC-02 em runtime:** contrato `supabase/functions/nucleo-knowledge-read/index.ts` continua presente na `main` com JWT, `getUser`, `nucleo_manage`, consultas sob RLS e exportação opt-in consultiva. **Publicação da revisão específica da Edge Function, resultados 200/401/403 em sessão real, recebimento e aceite do pacote permanecem NÃO VERIFICADOS**. Tentativa de consultar o endpoint por acesso público genérico não produziu resposta verificável e não conta como teste negativo.
- **G01–G08:** recuperar exclusivamente de `supabase/functions/_shared/nucleo/ac02-knowledge-gaps.ts`, sem renumeração. G08 permanece fase adiada; G06/G07 exigem prova externa e não são supridas por pacote consultivo.

**Regra de conclusão:** esta seção registra observações de leitura e diferenças concretas em relação aos baselines históricos; nenhuma alteração de banco, front-end, função, concessão, aprovação, mandato, envio de pacote ou migração documental B foi realizada. Nenhuma homologação A+ foi promovida.

**Próxima ação única:** quando houver capacidade autenticada para verificar a revisão publicada de `nucleo-knowledge-read`, executar readback seguro de serviço + testes de autorização apropriados e confrontar FM-03/08/09 do CRM com suas fontes vigentes, sem criar camadas documentais paralelas ou replicar UX. Se esse acesso não estiver disponível, registrar impedimento e manter desenvolvimento independente autorizado.


## 8. Prova dirigida de endpoint e fontes CRM — 16/11/2026

**Edge Function / AC-02 (somente leitura, sem token):** a rota oficial `https://xkskyutmtlhivvpfxkjg.supabase.co/functions/v1/nucleo-knowledge-read` devolveu **HTTP 401** na consulta anônima. A contraprova no mesmo domínio com rota inexistente `/functions/v1/nucleo-probe-inexistente-20261116` devolveu **HTTP 404**. Conclusão restrita: a rota oficial é reconhecida e protegida pelo gateway. **Não** comprova hash/revisão ativa, comportamento do handler, resposta POST 200/401/403 por perfil, assinatura, nem autorização ou autenticação de especialista. Não foi efetuado deploy nem escrita.

**FM-03 — fronteiras CRM:** original `BASE_FINAL/70_FONTES_E_EVIDENCIAS/07_CRM_E_COMERCIAL_HISTORICO/DOCUMENTO_05_03_ARQUITETURA_OPERACIONAL_CRM_V1_0.txt` relido diretamente no ZIP `BASE_DE_CONHECIMENTOS_FINAL_WINDOWS_ATUALIZADA_2026-10-22_V3_ALFAJOR_60G.zip`, SHA-256 dos bytes do membro ZIP `d24c5bdcc9d905e464d654f360d038b05eac6d84c6e80c9ab465533b2ef0c840`. O documento separa Processo, Bibliotecas 01–08, Matriz 09.01, Resultados 09.02, Próximas Ações 09.03, Transições 09.04, Prioridade 09.05 e implementação técnica. Aponta conflito de status documental dos dicionários; não corrigir cabeçalho por inferência. Isso é evidência de fronteira documental, **não** uma revisão FM-03 gravada.

**FM-08 — método/ecossistema do especialista:** os ZIPs inspecionados comprovam arquitetura comercial e Estado CRM em data histórica, **não** certificam mandato atual, método e ecossistema próprios do Especialista CRM como dois vínculos vigentes. `src/lib/nucleo/crmAuthoritySourcesV12.ts` já indexa originais e ressalvas; manter G02 pendente de fonte competente, sem cadastrar método por analogia à arquitetura 05.03.

**FM-09 — evolução e último checkpoint:** original `BASE_FINAL/04_PAINEL_CENTRAL/02_ESTADOS_VIGENTES/PCL-MST-ESTADO-CRM-V1.0.txt` relido no mesmo ZIP, SHA-256 dos bytes do membro `cb4802d5d7085d3eeaa6161d5b3098a8a7e7820159e8431ebc9835c0a99d5c57`; é marco de **03/10/2026**, não último estado técnico. Também relidos no `ATENDIMENTO CRM ETAPAS.zip`: `DOCUMENTO_09.01_MATRIZ_OPERACIONAL_MESTRE_DO_CRM_v1.1_HOMOLOGADA.txt` (SHA-256 `03a7852c7501bfc4010346c356721c38343295e6ae9c3cbe1f4d0ad38e23e81f`) e Documento Mestre do Processo Comercial V1.0 (SHA-256 `d6e1222281ad05d8c7c2e10e0f3b31151ab4bedd7f3a7b057942070faddbdc57`). Os hashes provam apenas a leitura dos bytes dos membros dos arquivos fornecidos, não autoridade/vigência externa.

**Confronto com Core:** `CRM` e sua frente filha `CRM-UX02` existem no M3. O texto atual de `CRM.next_action` ainda diz «Vincular uma frente documentalmente comprovada»; portanto a próxima ação registrada está **parcialmente desatualizada**, já que CRM-UX02 está vinculado. O restante da orientação exige reconciliação de método/ecossistema. Não foi reescrita via SQL administrativo porque a alteração de governança requer o writer autorizado com autoria/auditoria e readback; não transferir autoridade por conveniência. O Core continha **0** revisões FM na consulta de 16/11, sem inserção artificial.

**Portão remanescente:** confirmar revisão de função pela superfície administrativa apropriada e testar sessão JWT efetiva somente quando houver acesso autorizado; corrigir a próxima ação CRM pelo fluxo governado; criar revisões FM-03/08/09 somente com conteúdo, fontes e autoria efetivamente autorizados. UAT, recepção/aceite de sucessor e Entrega B seguem separados. **Nenhuma mudança de código funcional, banco, privilégio, deploy ou homologação nesta investigação.**
