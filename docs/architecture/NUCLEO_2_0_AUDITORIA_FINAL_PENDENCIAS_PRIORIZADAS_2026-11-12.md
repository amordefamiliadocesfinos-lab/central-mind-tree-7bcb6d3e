# Núcleo 2.0 — Auditoria final de pendências: obrigatórias, condicionais e posteriores

**Data:** 12/11/2026  
**Autoridade:** Camada Mestre; MAPA MESTRE NÚCLEO 2.0 V1.0 — ESCOPO CONGELADO.  
**Escopo desta auditoria:** Núcleo existente, macrofrentes NUC-M0 a NUC-M5. Sem alterar código funcional, status, migrations, permissões, páginas ou dados.  
**Base de evidências:** leitura do Core oficial em 12/11/2026, contratos e relatórios versionados na `main`, GitHub Actions/PRs já aprovados e capturas do sistema publicado fornecidas ao especialista.

## 1. Linha de base oficial e ressalvas

| Recurso | Estado confirmado no Core |
|---|---|
| Macro-registros M3 | 7 (NUC e NUC-M0…NUC-M5) |
| Estados | NUC `em_andamento`, M0…M5 `em_validacao`; nenhum `concluido` |
| Evidências técnicas M4 | 42, atribuídas a M0:2, M1:7, M2:4, M3:9, M4:20; **M5:0 evidências M4 vinculadas** |
| Eventos históricos M3 | 13 |
| Dependências M3 explícitas | 0 |
| Referências M2 | 3, todas privadas, só metadados, sem conteúdo importado |
| Autoridade das três referências | 1 histórica, 1 não classificada, 1 pendente de homologação |
| Documentos M1, revisões e lotes de importação | **0 / 0 / 0** |
| Concessões ativas `nucleo_manage` | 1, sem concessão automática |
| Snapshot M0 | 82 páginas e SHA-256 `83fc9795454568efdccfcf32746d684d5ff9890267273bfb1236012c49c09438` validados para **uma origem específica**, não para todos os navegadores ou a base documental geral |

Migrations do Núcleo registradas no Core em `supabase_migrations.schema_migrations`: `20261111193600`, `20261111193601`, `20261111210000`, `20261111222000`, `20261111232500`, `20261111234500`. RLS nas oito tabelas `nucleo_*` presente.

**Atenção de reconciliação:** a nota da ficha M3 ainda diz “homologação visual positiva pendente”, embora capturas posteriores da interface publicada comprovem árvore, Kanban, edição e evidências; trata-se de **registro documental desatualizado**, não de prova de falha. A ficha M5 ainda cita tarefas parcialmente executadas (Reavaliar e teste RLS isolado), necessitando atualização de evidência após o aceite final. Não atualizar fichas automaticamente por esta auditoria.

## 2. Definir o que significa “implantação concluída”

Duas modalidades de aceite distintas; não misturá-las:

**A — Encerramento da implantação técnica/governança do Núcleo V1.0:** M0 preserva origem e delimita o inventário; M1 instala banco/segurança sem importação; M2 oferece referências controladas; M3 opera árvore/Kanban/histórico; M4 fornece evidências técnicas rastreáveis; M5 apresenta supervisão determinística read-only. Acesso e fluxos mínimos homologados. **Pode ser encerrado sem importar as 82 páginas**, desde que o proprietário/Camada Mestre registre expressamente que *migração documental compartilhada e mudança da fonte de leitura ficam fora desta entrega*.

**B — Encerramento da implantação documental compartilhada integral:** além de A, exige decisão formal de importação, inventário reconciliado das origens, staging, verificação 82/82 por ID/corpo/tags/datas/flags/hashes, reversibilidade, nova política de edição/versionamento compartilhado, leitura centralizada e homologação de não perda. **Ainda não entregue nem autorizada**. Não declarar B completo só porque o schema M1 está vazio e aplicado.

Se a autoridade considerar B parte obrigatória do mapa V1.0, o fechamento geral permanece dependente de B. Esta auditoria **não modifica o escopo soberano**; apenas separa critérios e propõe uma decisão explícita.

## 3. Pendências obrigatórias para o encerramento técnico A

| ID | Frente | Critério objetivo remanescente | Evidência de aceite necessária |
|---|---|---|---|
| O-01 | M0 | Delimitar formalmente a abrangência do inventário: uma origem com 82 páginas vs outras origens locais/Drive/ZIPs. Preservar a cópia já validada e registrar fontes não verificadas como tais | Inventário de origem e declaração de alcance; não inventar ausência de outras origens |
| O-02 | M1/M2 | Homologar acesso **positivo** autenticado aos documentos/referências permitidos e **negativo** sem concessão, sem copiar conteúdo Drive ou criar novo grant automático. Conferir leitura, separação de perfis e ACL original | Evidência de navegação/consulta sob identidade permitida e teste de negação; RLS SQL já comprovada não substitui a interface |
| O-03 | M3 | Executar e registrar roteiro funcional mínimo real: selecionar frente, editar campo permitido, salvar, reler, conferir linha do tempo/auditoria e dependência somente quando explicitamente autorizada; não forçar criação de vínculo artificial | Log/capturas da navegação e comparação antes/depois, com uso de dados não sensíveis e sem alterar mapa indevidamente |
| O-04 | M4 | Deliberar aceite de entrega técnica **restrita a snapshots/CI, descoberta e reconciliação controlada**, com proveniência e ausência de escrita automática. Atualizar classificação da frente apenas após decisão humana | Parecer de fechamento assinado/registrado pela Camada Mestre, mencionando expressamente os limites |
| O-05 | M5 | Consolidar prova de Reavaliar no navegador (contador antes/depois já visto), rastreabilidade, laboratório sintético e revogação. Revogação SQL/RLS em PostgreSQL 17 isolado **aprovada 6/6**, e proteção de resposta assíncrona testada; falta E2E com conta de ensaio **se exigido pelo aceite de sessão real** | Relatório com distinção entre PostgreSQL isolado e sessão Supabase Auth; se E2E for obrigatório, usar identidade isolada, nunca revogar a única concessão produtiva |
| O-06 | NUC/governança | Atualizar notas/ações desatualizadas, conciliar evidências de PR/CI posteriores (M5 tem zero provas técnicas vinculadas na tabela M4), validar aceites individualizados e registrar evento de encerramento de cada frente | Lista de aceites com responsável, fontes e decisão por frente; somente então marcar `concluido` |

**Sequência enxuta:** O-02/O-03 podem compartilhar **uma sessão funcional autorizada**; O-04 usa fatos já comprovados, sem reexecutar toda CI; O-05 usa os testes já executados e um E2E apenas se a Camada Mestre exigir; O-01 não exige presumir exaustividade, mas sim reconhecer explicitamente a abrangência. O-06 é registro final, não uma nova frente de desenvolvimento.

## 4. Pendências condicionais — obrigatórias SOMENTE para encerramento integral B

| ID | Frente | Trabalho e condição |
|---|---|---|
| C-01 | M0/M1 | Autorizar expressamente a importação e definir patrimônio elegível. Nenhuma importação deve ocorrer com a base V1.2 ainda pendente de homologação e o acervo global sem reconciliação |
| C-02 | M1 | Pré-importação: staging e lote identificado, contagem 82/82 da origem local aprovada, origem/hash/checksum e correspondência integral de dados e marcadores; rollback lógico, sem remover `localStorage` |
| C-03 | M1/M3 | Implementar e homologar controle de edição/versionamento compartilhado antes de mudar a fonte oficial de leitura. O contrato M1 atual é **append-only**, sem UPDATE via cliente |
| C-04 | M1/M2 | Autorizar e validar mudança progressiva de leitura para documentos centrais, preservando original e permissões Drive; comprovar sem perda, duplicação, exposição ou promoção de autoridade |
| C-05 | M0/M2 | Classificação ampliada da base documental, reconciliação de versões e ACL por documento, não apenas pelo ZIP administrativo; especialmente a base V1.2 provisória |

**Portão de decisão obrigatório:** a Camada Mestre precisa definir se o compromisso final da implantação é A ou B. Sem essa decisão, não homologar “tudo concluído” e não antecipar importação.

## 5. Posteriores — NÃO bloquear A nem inventar implementação

| ID | Evolução posterior | Justificativa |
|---|---|---|
| P-01 | Sincronização GitHub/Supabase ao vivo, webhook, ingestão bidirecional | M4 aprovada como snapshots, revisão humana e fontes rastreáveis, sem sincronização contínua |
| P-02 | Cobertura exaustiva de todo histórico de GitHub e todas as migrations | Descoberta M4 é explicitamente limitada/paginada; não requisito de conclusão da versão atual |
| P-03 | IA generativa/agente autônomo que escreve no Core, cria PRs ou concede privilégios | M5 V1 é deliberadamente determinística e read-only; novos fluxos exigem contrato, aprovação e risco próprio |
| P-04 | Conceder `nucleo_manage` a outras pessoas por conveniência | Princípio de menor privilégio; não faz parte da implantação, e concessão automática é proibida |
| P-05 | Monitoramento instantâneo de revogações enquanto aba fica aberta sem interação | Modelo atual valida em Reavaliar/troca de autenticação/retorno de aba; funcionalidade extra deve ser contratada separadamente |
| P-06 | Importar toda a base V1.2, anexos privados, ZIPs e planilhas automaticamente | Fonte explicitamente `pendente_homologacao`; não promover autoridade ou replicar dados sem classificação |
| P-07 | Nova auditoria visual extensa de toda tela que já passou por homologação | Repetição sem novo achado não melhora aceite; usar provas e casos de regressão existentes |
| P-08 | Criar módulos paralelos, reconstruir Núcleo, alterar arquitetura M0–M5 | Fora do mapa congelado e contrário à preservação do sistema existente |

## 6. Plano de encerramento sem redundância

**Pacote A1 — Conciliação e testes funcionais mínimos:** O-01 + O-02 + O-03. Aprovador verifica que origem limitada está explicitada, ACL positiva/negativa e histórico persistem.

**Pacote A2 — Aceite técnico/governança:** O-04 + O-05. Juntar provas existentes (PRs, CI, capturas, ensaio RLS PostgreSQL 17) e executar só o teste E2E de conta de ensaio se formalmente exigido no contrato de aceite.

**Pacote A3 — Fechamento:** O-06, confrontar cada critério de aceite, evidência e status, registrar pendências posteriores e encaminhar à Camada Mestre; sem transição automática por conclusão de CI.

**Pacote B — Apenas se explicitamente definido no escopo final:** C-01…C-05, com autorização documental separada, rastreio 82/82, importação gradual e leitura central homologada.

## 7. Regras inegociáveis

- Proteger o snapshot das 82 páginas e eventuais outras origens; nunca confundir cópia íntegra de uma origem com inventário global.
- Não converter as 3 referências privadas Drive em documentos nem aprovar a Base V1.2 implicitamente.
- Não concluir frente por sucesso de CI; não alterar status/decisões sem humano.
- Não conceder nova capacidade nem revogar a concessão administrativa produtiva para fazer teste.
- Não trocar leitura do `localStorage` prematuramente; não deletar schema nem zerar histórico.
- Não usar construtor visual Lovable; código via GitHub, Core por mecanismos autorizados.

## 8. Parecer conclusivo

**Implantação técnica essencial: avançada e comprovada, porém pendente dos portões O-01…O-06 e de homologação formal.**  
**Implantação documental compartilhada: não concluída; nenhum lote/documento/revisão foi importado e a fonte atual não foi substituída.**  
**Grande risco de falso encerramento:** confundir instalação de tabelas e 42 evidências técnicas com migração de patrimônio e aprovação documental.  
**Grande risco de atraso artificial:** exigir IA autônoma, sincronização bidirecional ou repetir CI já homologada como condição da implantação técnica V1.0.

Documento de auditoria: não é autorização para promover estados ou importar conteúdo.


## 9. Reconciliação dirigida da M5 — Especialista Governança e Desenvolvimento 02 (12/11/2026)

**Natureza:** atualização de checkpoint na fonte já existente; não substitui o mapa soberano nem altera critérios de aceite. Fonte: consultas de leitura direta ao Core oficial (projeto Painel Central `1720a410-34cd-4410-995c-8c92c7edf16b`) e metadados de PRs do GitHub. A tentativa pelo conector Supabase isolado retornou falta de permissão; a conferência do Core foi feita pela conexão direta ao banco do projeto, **sem Lovable Builder**.

### Comparação da fonte operacional com o GitHub

- **Core lido neste checkpoint:** 7 frentes (`NUC` e `NUC-M0`…`NUC-M5`), 42 evidências técnicas, 13 eventos de histórico, 3 referências de origem e 0 documentos importados. `NUC-M5` continua `em_validacao`, com `evidence_state=comprovada` restrito à entrega técnica inicial. As 42 evidências existentes distribuem-se por M0=2, M1=7, M2=4, M3=9, M4=20 e **M5=0**.
- **PRs M5 mergeadas identificadas na fonte GitHub:** [#655](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/655) — supervisão read-only; [#659](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/659) — 18 cenários sintéticos; [#662](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/662) — laboratório visual; [#668](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/668) — proveniência e revalidação; [#672](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/672) — Reavaliar; [#674](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/674) — simulação de revogação e resposta tardia; [#677](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/677) — ensaio RLS PostgreSQL 17 isolado.
- **Lacuna O-06:** PR mergeada não insere prova automaticamente no registro M4. Necessária conciliação controlada dessas identidades canônicas com `nucleo_development_evidence`, sem duplicar (`source`, `repository`, `kind`, `external_key`) nem usar PR como prova de deploy, sessão Auth E2E ou homologação final. **Nenhuma inserção de evidência foi executada neste checkpoint**; registros append-only não devem ser preenchidos com proveniência/estado não conferidos.
- **Lacuna O-05:** a revogação RLS aprovada em PostgreSQL 17 isolado e os testes de respostas assíncronas não equivalem à revogação de concessão em sessão Supabase Auth + navegador. O teste funcional permanece limitado a uma identidade de ensaio autorizada; **não revogar o único grant `nucleo_manage` produtivo**.
- **Sem alterações produtivas:** nenhum grant, RLS, documento, página histórica, migration, status ou campo de aceite foi modificado por esta reconciliação. Nenhuma fase foi concluída automaticamente.

### Continuidade única

**Próximo trabalho delimitado:** executar a rotina M4 de atribuição/reconciliação já existente para os sete PRs da M5 com preflight de unicidade, prova de origem por PR e readback independente; não acrescentar automaticamente runs de CI sem verificar correspondência. Em seguida fazer uma sessão funcional autorizada de M1/M2/M3/M5, com `Reavaliar` e prova positiva/negativa, mantendo a revogação real E2E isolada como portão específico. Atualizar O-06 somente após comprovação de cada vínculo; manter `em_validacao` até aceite humano.

## 10. Execução da reconciliação M5 no Core — 12/11/2026 (checkpoint posterior à seção 9)

**O-06, parcela de atribuição técnica das PRs M5: EXECUTADA E CONFERIDA.** Este registro posterior substitui a indicação de ausência de inserção na fotografia histórica da seção 9; os números antigos permanecem como linha de base datada, não como situação vigente.

- **Autorização:** continuidade executiva expressa do proprietário para vinculação controlada das evidências M5; limitada a sete PRs mergeadas. Nenhuma concessão administrativa foi alterada.
- **Preflight real:** NUC-M5 existente e em_validacao, total de 42 evidências, zero registros previamente existentes para PRs #655, #659, #662, #668, #672, #674 e #677. Foram conferidos individualmente GitHub merged=true, base=main, títulos e respectivos merge_commit_sha.
- **Gravação:** transação administrativa atômica com guardas de baseline, pertencimento da frente e inexistência de IDs duplicados, na tabela append-only public.nucleo_development_evidence. Foram inseridas **7** provas source=github, kind=pull_request, observed_state=verificado, com URLs canônicas, SHAs de merge, instante de conferência e limite explícito de que PR mergeada não comprova deploy nem E2E.
- **Pós-verificação independente:** consulta confirmou **49 evidências totais**, **7 evidências NUC-M5**, sete chaves e SHAs correspondentes ao GitHub, zero duplicações para os sete IDs; **13 eventos** históricos, **3 referências** Drive, **0 documentos** importados e estado NUC-M5=em_validacao inalterado.
- **Patrimônio preservado:** sem alterações de RLS/grants, migrations, páginas, Drive, estados, eventos ou documentos; nenhuma conclusão automática. A tabela de evidências é append-only; não regravar os mesmos IDs por nova consulta.

**O-06 permanece parcialmente aberto** para conciliar notas de aceite e critérios de outras frentes e registrar a decisão humana final. **O-05 permanece aberto** para homologação funcional apropriada em sessão autenticada e eventual E2E de revogação de conta de ensaio, nunca com a única concessão produtiva. As sete PRs têm prova de merge e atribuição na M5; não há nova declaração de publicação do frontend ou uso real.

**Próxima ação única:** validar em navegador com sessão administrativa autorizada a visualização das sete novas provas na M5, Reavaliar, proveniência e comportamento de acesso permitido/negado; atualizar o checkpoint funcional somente com o que tiver observação direta. Não reexecutar a atribuição e não abrir importação documental.

## 11. M5 — validação técnica de acesso e limite de homologação visual (12/11/2026)

**Continuidade de O-05, sem conclusão prematura.** A sessão do Painel Central já aberta no navegador conectado foi inspecionada em modo **somente leitura**: página /nucleo, Central Visual e botão Reavaliar existentes; a tela ainda apresentava snapshot anterior de 42 evidências, com data da última leitura autorizada exibida na própria interface. Esse dado é consistente com um relatório que só será atualizado em nova requisição e **não comprova falha nem sucesso do clique**, pois a conexão de navegador disponível não permite controlar a aba.

**Contrato do código conferido em main:** src/components/nucleo/NucleoSupervisionPanel.tsx usa Reavaliar para incrementar reloadKey; cada reavaliação limpa o snapshot visível, exige auth.getUser, grant ativo nucleo_manage e três SELECTs RLS (frentes, evidências, dependências), falhando de modo fechado em erro/consulta parcial. Alterações de Auth e retorno da aba visível também invalidam solicitações antigas. Esta é inspeção de código, não prova de execução E2E.

**Ensaio SQL controlado, read-only, contra o Core real:** em DO transitório, com SET LOCAL ROLE authenticated e request.jwt.claim.sub configurado localmente (sem gravar JWT, usuário, senha ou concessionário em arquivo), a identidade não autorizada obteve 0 frentes e 0 evidências; a identidade que já possui grant ativo obteve **7 frentes e 49 evidências**. Assertions foram concluídas sem exceção e a leitura administrativa posterior confirmou 1 grant ativo, 7 frentes, 49 evidências, 0 dependências, 3 referências, 13 eventos e 0 documentos. **O teste simula o contexto de sessão no PostgreSQL; não é autenticação de navegador real nem revogação de concessão em produção.**

**Portão ainda não satisfeito:** acionar Reavaliar em navegador autenticado, observar mudança de 42 para 49 e verificar comportamento de sessão revogada em conta de ensaio isolada (nunca sobre o grant produtivo único). Não existe perfil de automação autenticado para o domínio do Painel Central, logo nenhuma interação de navegador nem revogação real foi realizada neste checkpoint. M5 permanece em_validacao; evidências M4 continuam append-only, sem novas inserções e sem mudanças em status ou ACL.

## 12. M5 — leitura visual autenticada atualizada no Painel Central (12/11/2026)

**Resultado observado em aba real /nucleo, leitura não interativa:** a Central Visual da sessão autenticada exibiu "Última leitura autorizada: 12/11/2026, 18:05:54", "consultas válidas nesta sessão: 11" e **"7 registros M3 · 49 evidências consultadas · 0 dependências explícitas · 0 alertas"**. O snapshot anterior observado em leitura dessa aba continha **42 evidências** e 10 consultas válidas. O novo total confere com a reconsulta independente do Core: M0=2, M1=7, M2=4, M3=9, M4=20, M5=7, total 49. Não há estados concluídos nem alteração automática do mapa.

**Escopo preciso da prova:** a atualização da tela para 49 evidências em uma sessão autenticada está visualmente confirmada. O navegador conectado permite **ler** a aba existente, mas não clicar; portanto não se atribui a nova consulta especificamente a um clique no botão Reavaliar nem se afirma E2E de clique. Não foi aberta uma sessão de automação externa: o perfil disponível não contém autenticação salva no domínio do Painel Central.

**Segurança preservada:** segunda leitura do Core identificou 1 concessão produtiva nucleo_manage, 13 eventos, 0 dependências e 0 documentos; a leitura visual mostrou 7 frentes e 0 alertas, sem concluir fase por ausência de alerta. O teste de revogação/reativação em **navegador real com conta de ensaio separada** permanece pendente, sem autorização para revogar ou reutilizar a única concessão produtiva.

**Estado de O-05:** leitura visual pós-atualização e concordância com Core verificadas; teste de interação direta Reavaliar e E2E de revogação não executados. Manter NUC-M5 em_validacao. Não repetir a inserção das sete PRs.

## 13. M5 — conferência do print de uso real e gate de revogação (12/11/2026)

**Evidência visual enviada pelo proprietário:** screenshot do Painel Central /nucleo, em sessão autenticada, mostra a supervisão assistida M5 com **última leitura autorizada em 12/11/2026 às 18:23:16**, **2 consultas válidas na sessão**, **7 frentes**, **49 evidências consultadas**, **0 dependências explícitas** e **0 alertas**. As colunas de estados mostram 1 frente em andamento, 6 em validação e 0 concluídas. O print foi analisado na conversa de homologação, sem ser publicado no GitHub para não copiar imagem da sessão nem dados de interface do proprietário. O resultado reforça a conferência visual da seção 12; a numeração do contador de sessão não é global e pode reiniciar em outra aba/reload.

**Gate de revogação em conta de ensaio:** leitura administrativa do Core neste checkpoint encontrou **3 usuários Auth**, **1 concessão ativa nucleo_manage** e **0 concessões nucleo_manage inativas/revogadas**. A existência de três usuários não significa que haja conta de ensaio autorizada e configurada. Não se deve selecionar uma dessas identidades por inferência, outorgar capacidade sem plano ou revogar a única concessão produtiva para simular perda de acesso.

**Cobertura existente, sem repetição de testes desnecessários:** PR #677 contém o ensaio PostgreSQL 17 isolado com seis cenários (concessão válida, identidade sem direito, revogação, terceiro usuário, restauração, impossibilidade de autoconcessão). O ensaio read-only contra o Core real descrito na seção 11 confirmou RLS positiva e negativa sem escrita. O código da tela invalida respostas antigas e exige uma consulta nova. Nenhuma dessas provas, isoladamente, substitui sessão Supabase Auth real + navegador sob identidade de ensaio separada.

**Estado operacional:** a atualização visual de 49 evidências está confirmada e documentada. **A homologação de revogação E2E permanece pendente por falta de identidade de ensaio isolada e sessão controlável**, sem defeito comprovado. Não houve criação de usuário, gravação ou revogação de grants, reatribuição de evidências, alteração de status, documentos, migrations ou páginas históricas. Manter NUC-M5 em_validacao até portão E2E apropriado e decisão humana.

## 14. Continuidade M1–M5 sem bloqueio por homologação de revogação (12/11/2026)

**Decisão expressa do proprietário:** deixar o teste E2E de revogação da M5 para fase posterior e continuar as frentes do Núcleo 2.0. A postergação **não significa homologação** do caso de revogação; manter sua pendência rastreada sem impedir verificação das demais frentes. Não revogar o grant produtivo único.

**Correção operacional no Core oficial executada:** fichas `NUC-M3`, `NUC-M4` e `NUC-M5` foram atualizadas somente em notas de evidência e próxima ação para retirar contagens antigas de 42 e descrições de validação visual ainda não feita. Captura real do proprietário confirma 7 frentes e 49 evidências na Central Visual. M3 mantém pendente o cenário edição–salvar–readback–histórico; M4 mantém o aceite técnico restrito pela Camada Mestre; M5 registra o adiamento do E2E de revogação. `status=em_validacao` e `evidence_state=comprovada` mantidos, sem marcar fases como concluídas.

**Avanço técnico em M1/M2:** ensaio read-only no Core sob `SET LOCAL ROLE authenticated` e identidade JWT simulada, sem criar usuário, conceder capacidade ou ler conteúdo dos arquivos Drive. Identidade **sem** `nucleo_manage`: 0 referências M2 e 0 documentos M1 visíveis. Identidade com concessão ativa: **3 referências M2** metadata-only e **0 documentos M1**, pois nenhuma importação está autorizada/realizada. Teste positivo de RLS para o catálogo M2 e negativo para acesso sem grant; **não** equivale à navegação real em conta de ensaio nem à homologação de leitura positiva de documento, impossível no estado atual de tabela M1 vazia.

**Correção operacional adicional:** fichas `NUC-M1` e `NUC-M2` receberam notas factuais e próxima ação coerentes com o ensaio. O Core gerou cinco eventos auditáveis `alterado` no total (3 M3/M4/M5 + 2 M1/M2), com autoria administrativa técnica não atribuída indevidamente a usuário. Readback após operações: **18 eventos**, **49 evidências**, **3 referências privadas**, **0 documentos**, **1 grant `nucleo_manage` ativo**. Nenhum status, migration, ACL, artefato local, fonte documental ou concessão produtiva foi modificado.

**Continuidade prioritária sem redundância:** (1) M0: delimitação formal das origens sem inferir que o snapshot de 82 páginas representa toda a base; (2) M3: cenário funcional de editar/salvar/reler com a auditoria nativa, sem criar dependência fictícia; (3) M4: aceite restrito pela autoridade, sem repetir CI ou antecipar sincronização; (4) O-06: decisão individualizada sobre estados só após critérios de aceite. Não iniciar implantação documental B sem autorização específica. **O-05 E2E adiado, não encerrado.**

## 15. Continuidade M0/M3 — delimitação da origem e teste transacional auditável (12/11/2026)

**M0 — escopo factual do patrimônio:** uma única origem local foi anteriormente verificada com **82 páginas, oito áreas e SHA-256 `83fc9795454568efdccfcf32746d684d5ff9890267273bfb1236012c49c09438`**. A implementação em `src/lib/nucleo/exportLegacyNucleo.ts` percorre exclusivamente as chaves `nucleo_*` do `localStorage` **do navegador atual**, mantém o texto bruto das páginas, exporta flags existentes e calcula checksum dos bytes da coleção; não lê automaticamente outros navegadores, outros perfis ou fontes Drive/ZIP. O script `scripts/nucleo-backup-smoke.cjs` tem três cenários sintéticos de preservação e falha fechada. Portanto **nenhum inventário global está homologado**, e nenhuma origem não verificada deve ser tratada como ausente. Sem nova exportação ou movimentação de documentos.

**M3 — ensaio controlado contra Core real:** um bloco aninhado de exceção no PostgreSQL atualizou temporariamente o campo editável `next_action` da frente `NUC-M3`, releu o valor, confirmou **um evento auditável `alterado` com `before_state` e `after_state` corretos**, forçou exceção de rollback e verificou dentro da mesma execução a restauração do valor e da contagem histórica. Teste concluído sem exceção final. **Não persistiu a alteração de ensaio nem o evento associado.** É prova da mecânica UPDATE→readback→trigger→rollback do banco; não é homologação de interação de usuário pelo botão Salvar em navegador.

**Fichas oficiais M0 e M3:** suas notas de evidência e próximas ações foram ajustadas somente para registrar os limites acima e o próximo teste funcional. A auditoria nativa M3 criou **2 eventos reais de alteração de fichas**, distintos do evento temporário revertido. Após readback, Core com **20 eventos**, **49 evidências**, **3 referências Drive privadas**, **0 documentos**, **0 dependências explícitas**, **1 concessão nucleo_manage ativa** e **zero frentes concluídas**; M0 e M3 seguem `em_validacao`.

**Fronteiras preservadas:** O-01 avançou na delimitação da origem, não comprovou inventário global; O-03 comprovou persistência/auditoria SQL com reversão, não homologou a interface. Não importar as 82 páginas, inventar dependências, marcar conclusão, publicar conteúdo privado, conceder capacidades nem antecipar validação E2E da M5, que o proprietário decidiu postergar.

## 16. M3 — correção funcional de confirmação de gravação (12/11/2026)

**Implementação concluída no código por PR #693** (merge na `main`, SHA `e81a18d873f7913d508314cc02b72878088b6fc7`). Em `src/components/nucleo/NucleoDevelopmentCenter.tsx`, a ação Salvar agora exige, após UPDATE condicionado ao `updated_at`, duas releituras sob o cliente/RLS já existentes: valor persistido da frente e último evento auditável `alterado` da frente. Só exibe sucesso quando os campos modificados aparecem na leitura do Core e no `after_state` da auditoria; caso contrário, informa resultado não confirmado, orienta atualizar e não declara sucesso prematuro. Nenhuma migration, grant, alteração de schema, documento ou histórico legado foi necessária.

**Validação técnica:** sete checks GitHub Actions aprovados no head da PR #693, abrangendo PostgreSQL 17, regras e build frontend; merge efetivado. O ensaio anterior de transação M3 com rollback comprovou o gatilho no Core. **Importante:** a PR e a CI não comprovam automaticamente publicação nem clique real na UI. O cenário positivo de seleção, edição, Salvar, Atualizar e histórico permanece na homologação funcional de O-03.

**Core oficial:** ficha `NUC-M3` atualizada para registrar a mudança de código e o gate de navegador ainda pendente, via trilha nativa. Readback: **22 eventos**, **49 evidências**, **3 referências**, **0 documentos**, **1 grant nucleo_manage ativo** e **0 frentes concluídas**. Não foram gravados dados sintéticos no Core. M0 segue delimitada à origem local de 82 páginas; M1/M2 seguem com fronteiras e ACL preservadas, e a revogação E2E da M5 continua adiada.
