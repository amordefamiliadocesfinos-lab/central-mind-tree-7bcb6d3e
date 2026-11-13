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

## 17. Reconciliação de governança NUC — matriz de aceites individuais e escopo A/B (12/11/2026)

**Natureza:** confrontação factual da `main` GitHub e do Core, sem modificar o mapa soberano. Este checkpoint atualiza a auditoria oficial existente; não equivale a aceite formal da Camada Mestre, não promove estado e não reabre auditorias técnicas já concluídas.

| Frente | Evidências M4 no Core | Entrega técnica comprovada | Portão formal/funcional ainda aberto |
|---|---:|---|---|
| NUC-M0 | 2 | Snapshot de **uma** origem local, 82 páginas, 8 áreas, SHA-256 preservado; exportador somente localStorage do navegador corrente | Delimitação de outras origens e decisão de alcance do inventário; não afirmar inventário global |
| NUC-M1 | 7 | Schema/RLS/imutabilidade, migrations e testes CI; zero documentos importados | Acesso positivo a documento só após fonte elegível e decisão explícita de importação; migração documental não autorizada |
| NUC-M2 | 4 | Três fontes Drive privadas com metadata-only, RLS positivo/negativo controlado; PR #696 adicionou reconsulta, contador e falha segura com CI e build aprovados | Homologação visual do botão Atualizar referências na Biblioteca publicada e da autorização correspondente; não abrir conteúdo privado ou promover autoridade |
| NUC-M3 | 9 | Árvore/Kanban, histórico M3, ensaio SQL UPDATE→readback→evento→rollback; PR #693 confirma gravação e auditoria antes de mensagem de sucesso, com CI aprovada | Teste funcional real Salvar→Atualizar→histórico **adiado expressamente pelo proprietário**; nenhuma dependência fictícia |
| NUC-M4 | 20 | Treze PRs e sete CI vinculadas, imutabilidade e reconciliação controlada; parecer técnico restrito favorável | Aceite formal da Camada Mestre do limite snapshots/read-only/atribuição humana; não presumir integração bidirecional |
| NUC-M5 | 7 | Supervisão read-only determinística, laboratório sintético, print autenticado com 49 evidências; testes RLS positivos/negativos e seis cenários de revogação em PostgreSQL isolado | Revogação E2E em navegador com conta de ensaio **adiada expressamente pelo proprietário**; não declarar homologação desse caso |

**Reconciliação independente de integridade:** 7 frentes (NUC e M0–M5), **49 evidências e 49 identidades técnicas distintas**, 3 referências Drive privadas, 0 documentos importados, 0 dependências declaradas, 1 `nucleo_manage` ativo e 0 frentes concluídas. A consulta ao Core antes do ajuste de governança mostrou 23 eventos. Duas atualizações estritamente factuais no Core (nota e próxima ação de NUC; próxima ação M3 explicitando adiamento) geraram dois eventos auditáveis adicionais, com **25 eventos após o readback**, sem alterar `status`, `evidence_state`, políticas, grants, evidências, Drive ou documentos. A autoria de atualização administrativa técnica não deve ser confundida com aprovação humana formal.

### Decisão A versus B — encaminhamento, sem presunção

- **Entrega A — implantação técnica e governança restrita:** infraestrutura, catálogo metadata-only, acompanhamento visual, snapshots técnicos, supervisão read-only e preservação do legado; não requer importar as 82 páginas. O proprietário/Camada Mestre deverá confirmar expressamente se esse é o escopo de aceite que deseja encerrar, e avaliar os portões funcionais ainda abertos.
- **Entrega B — migração documental integral:** depende de autorização própria para preparar staging, inventariar as origens adicionais, comparar 82/82 com conteúdo/tags/flags/hash, versionar edições e aprovar mudança de leitura. **Não autorizada, não iniciada e não implícita na entrega A.**

**Próxima ação única de governança:** submeter a matriz acima à Camada Mestre para decisão sobre escopo de aceite técnico A e pendências individualizadas, mantendo M0–M5 em validação até pronunciamento humano. Não repetir CI consolidada, não exigir M5 E2E adiado para continuar outras frentes, não transformar decisão de adiar M3 em homologação, não iniciar migração B por inferência.

## 18. Encaminhamento decisório para Camada Mestre — escopo A e aceites individuais (12/11/2026)

**Tipo de registro:** parecer consolidado para deliberação, não homologação automática. O comando de continuidade do proprietário autoriza **preparar e encaminhar** a decisão baseada na matriz comprovada; não deve ser interpretado como aprovação tácita de importação documental, alteração de `status` ou dispensa de testes adiados. Referências: seções 1–17 desta auditoria e parecer M4 existente.

### Proposta objetiva para decisão

**Recomendação técnica do especialista: adotar A como delimitação da entrega de implantação inicial do Núcleo 2.0**, sujeita à ratificação pela Camada Mestre e aos aceites funcionais individualizados. A significa governança e acompanhamento já instalados **sem transferência de leitura ou importação** das 82 páginas. B, a migração documental integral, permanece uma frente condicionada de autorização própria (C-01 a C-05), e não deve ser presumida como pré-requisito técnico ou produto entregue em A.

**Não é decisão final:** a Camada Mestre ainda deve deliberar se A corresponde ao compromisso de implantação do mapa soberano. Se o mapa exigir B para o encerramento total, registrar a divergência de escopo e conservar o estado em validação; não reclassificar B unilateralmente como posterior.

### Matriz de decisão pronta para aceite humano

| Frente | Julgamento técnico consolidado | Decisão ainda necessária | Posição recomendada no Core |
|---|---|---|---|
| M0 | Integridade e origem local única de 82 páginas comprovadas, mas alcance global não demonstrado | Aceitar preservação **limitada à origem identificada** ou exigir inventário adicional para encerrar M0 | Manter `em_validacao` até definição do limite |
| M1 | Schema/RLS/imutabilidade instalados; 0 documentos importados | Aceitar M1 como **infraestrutura sem importação**, ou condicionar aceite funcional à etapa documental B | Manter `em_validacao`; não importar |
| M2 | 3 fontes metadata-only, controle RLS e PR #696 aprovada em CI; UI pós-merge não homologada | Aceitar implementação técnica e manter teste de catálogo publicado separado | Manter `em_validacao`; sem promoção de autoridade |
| M3 | Árvore/Kanban/histórico e PR #693 verificados; teste real de Salvar expressamente adiado | Registrar adiamento como pendência funcional explícita; não tratá-lo como teste aprovado | Manter `em_validacao` |
| M4 | **Parecer favorável** à entrega restrita de snapshots, descoberta read-only e reconciliação humana; 20 provas próprias | Camada Mestre aceitar formalmente **a fronteira técnica restrita**, sem alegar sincronização ao vivo | Manter `em_validacao` até aceite expresso |
| M5 | Supervisão determinística, 7 provas, leitura visual 49/49 e teste RLS isolado; E2E revogação adiado | Registrar aceite técnico restrito separadamente do teste de revogação E2E ainda não realizado | Manter `em_validacao` |

### Condições mínimas da deliberação

1. Declarar expressamente **A ou B** como critério de encerramento da implantação inicial; caso A seja escolhido, declarar B fora dessa entrega, mas preservado como trabalho condicionado e não cancelado.
2. Para cada frente, registrar decisão humana **aceita / aceita com ressalvas / não aceita / postergada**, nome da autoridade, data, escopo e evidências; não deduzir a aprovação de commits ou automações.
3. Reconhecer separadamente as postergações solicitadas pelo proprietário: **M3 Salvar em navegador** e **M5 revogação E2E**; ambas permanecem rastreáveis e não podem ser renomeadas como concluídas.
4. Não criar documento no M1 nem alterar a origem das páginas locais; preservar a única concessão ativa `nucleo_manage`, as três referências privadas e a inalterabilidade de evidências M4.
5. Somente após decisão expressa usar a auditoria M3 para eventual promoção individual de status; o evento de mudança precisa indicar a autoridade real, sem atribuir assinatura humana a `actor_auth_uid=null`.

**Readback anterior à deliberação:** 7 registros de frente, 49 evidências = 49 identidades distintas, 25 eventos, 3 referências privadas, 0 documentos, 0 dependências explícitas, 1 concessão administrativa ativa; NUC `em_andamento`, M0–M5 `em_validacao`. O registro da proposta neste GitHub **não modifica esses dados**.

**Encaminhamento:** Camada Mestre deve deliberar sobre a recomendação A, especialmente o aceite formal restrito de M4 e as ressalvas das demais frentes. Até lá, o resultado deste especialista é **pacote decisório pronto**, e não implantação encerrada.

## 19. Deliberação formal da Camada Mestre — Entrega A aceita com ressalvas (12/11/2026)

**Estado decisório vigente (substitui as recomendações ainda abertas da seção 18 quanto à escolha A/B e aceite humano):** a Camada Mestre publicou sua deliberação formal no comentário [PR #699, comentário #6837285096](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/699#issuecomment-6837285096), após a PR #699 ter sido integrada no commit `14284cca4b12a6fbda312a04d22d40718c2be8d7`. Autoridade da decisão: **Camada Mestre — Painel Central**; data indicada no ato: **12/11/2026**. Esta seção é transcrição estruturada do alcance da decisão, e **não** representa nova aprovação pelo especialista nem assinatura presumida de outro usuário.

### Decisão A/B

- **Entrega A — implantação técnica e governança restrita: ACEITA COM RESSALVAS**, limitada às implementações comprovadas. O aceite não homologa todos os fluxos reais nem conclui integralmente o Núcleo 2.0.
- **Entrega B — migração documental integral: PENDENTE, PRESERVADA e NÃO AUTORIZADA por esta deliberação**. Continua dentro do Mapa Mestre V1.0 para etapa futura, sem início de importação, substituição, exclusão ou troca definitiva da leitura das 82 páginas.

### Decisões individuais vinculantes para governança

| Frente | Decisão expressa da Camada Mestre | Ressalva / gate preservado |
|---|---|---|
| NUC-M0 | **Aceita com ressalvas** | A preservação comprovada cobre somente uma origem local: 82 páginas, 8 áreas e SHA verificado; patrimônio global não inventariado |
| NUC-M1 | **Aceita com ressalvas** | Infraestrutura/schema/RLS/imutabilidade reconhecidos, sem importação e sem prova de leitura positiva de documento inexistente |
| NUC-M2 | **Aceita com ressalvas** | Catálogo com 3 referências privadas metadata-only; interação visual de **Atualizar referências** ainda não homologada |
| NUC-M3 | **Implementação aceita com ressalvas; homologação funcional postergada** | Teste real **editar → Salvar → Atualizar → Histórico** não realizado; não convertê-lo em teste aprovado |
| NUC-M4 | **Aceite técnico restrito aprovado** | Apenas snapshots, descoberta read-only e atribuição/reconciliação humana; sem sincronização bidirecional, deploy ou migrations automáticas |
| NUC-M5 | **Implementação técnica aceita com ressalvas; E2E de revogação postergado** | Supervisão somente leitura e 49 evidências visualizadas; revogação em sessão real de conta de ensaio não homologada |

### Efeitos operacionais e limites

1. **Distinguir aceite técnico de `status` operacional.** O aceite humano nesta seção não transforma automaticamente as fichas M0–M5 de `em_validacao` em `concluido`. NUC permanece `em_andamento` até procedimento próprio, com atribuição verdadeira de autoridade, observação e readback.
2. **Preservar integralmente o patrimônio**: conteúdo, versões, tags, flags, hashes, `localStorage`, demais origens locais e 82 páginas originais. Não sobrescrever nem migrar dados por inferência.
3. **Sem alterações de banco nesta incorporação:** nenhuma migration, RLS, grant, usuário, fonte Drive, conteúdo M1, evento, dependência, evidência ou `status` será alterado; a decisão é registrada **neste documento GitHub**, conforme ordem da Camada Mestre.
4. **Continuar frentes independentes** sem exigir as homologações M3/M5 expressamente postergadas como condição de desenvolvimento. A M2 mantém validação visual ainda aberta. Repetir testes consolidados apenas por novo achado ou risco concreto.
5. **Entrega B exige portão posterior específico**, com inventário das origens elegíveis, staging, reconciliação integral 82/82 (IDs, conteúdo, tags, datas, flags e checksums), reversibilidade e homologação de mudança de leitura. Nenhuma dessas ações foi aprovada no comentário.
6. A decisão formal **corrige o estado decisório** descrito nos itens 8, 17 e 18, que são históricos e continuam preservados. A partir deste checkpoint, não se deve voltar a tratar o aceite restrito da M4 ou a escolha da Entrega A como ainda aguardando deliberação.

**Resultado:** Entrega A tecnicamente aceita com ressalvas; M0–M5 individualmente avaliadas; entrega B preservada e pendente; implementação e desenvolvimento do Núcleo seguem abertos. Fonte de autoridade: comentário formal #6837285096, não CI, merge, agente automatizado ou alteração silenciosa no Supabase.

## 20. Ativação do Mapa Mestre V1.2 — Conhecimento operacional, especialistas e experiência visual (12/11/2026)

**Nova autoridade de escopo:** `MAPA_MESTRE_NUCLEO_2_0_V1_2_CONHECIMENTO_OPERACIONAL_VISUAL_CONGELADO_2026-11-12`, transmitido pela Camada Mestre com o `COMANDO_ESPECIALISTA_NUCLEO_2_0_EVOLUCAO_V1_2_MODULOS_METODOS_UX_2026-11-12`. V1.2 herda integralmente V1.0 e V1.1, acrescenta as Fichas Vivas FM-01–FM-10, especialista funcional persistente, manuais operacionais e CA-13–CA-22, sem criar Núcleo paralelo/M6. O arquivo original da determinação continua fonte externa; este registro incorpora o alcance **na auditoria canônica existente**, sem substituí-lo ou inventar outra autoridade.

**Três entregas distintas:** A = base técnica **aceita com ressalvas** conforme comentário da Camada Mestre na PR #699; A+ = acompanhamento do Painel inteiro e entendimento operacional real por humano/IA, **ainda não entregue**; B = migração documental integral **não autorizada**, permanece pendente no mapa. Manter os testes de Salvar M3 e revogação E2E M5 adiados, sem reinterpretá-los como aprovados.

### Confronto V1.2 versus estado aplicado

| Exigência | Linha de base conferida | Lacuna/ação segura |
|---|---|---|
| Visão de todos os módulos (CA-01/02/11/22) | O Core oficial tinha somente 7 registros: NUC e M0–M5, 49 evidências internas | Inventariar módulos reais com grau de cobertura, sem inventar frentes ou status; cadastro parametrizável e vínculos persistentes ainda não entregues |
| Conhecimento operacional e especialista (CA-13/14/17) | Rotas CRM/Financeiro/Operações/Captura/Rotina/Saúde/Digital/Assistente identificáveis em `src/App.tsx`; componentes CRM identificáveis no GitHub | Piloto CRM com ficha progressiva e ações verificadas por código; método/ecossistema vigente e transferência formal ainda requerem fonte e classificação |
| Interface em três níveis (CA-19/20) | M3 possui árvore, Kanban e ficha de frente focada nas sete macrofrentes NUC | Incorporar à mesma Central uma visão de módulos e a operação/prova CRM; validar acessibilidade, responsividade e teste real, **não presumir homologação por build** |
| Escrita estruturada, readback e histórico (CA-03/04/21) | M3 possui tabela e gatilhos auditáveis, PR #693 adicionou readback; UI de inventário externo ainda não persistida | Modelo relacional mínimo do conhecimento e vínculos de especialistas a desenvolver com RLS/testes, sem modificar grants transversais |
| Documentos e evidências (CA-05/06/07/08/09/18) | 3 referências privadas metadata-only, 0 documentos importados, 49 evidências técnicas únicas | Ligar manual/ações às fontes por URL/commit e grau de prova; não copiar originais Drive nem promover vigência de arquivos |
| Acompanhamento integral e compreensão por operador (CA-10/15/16) | Nenhum ensaio comprovou as duas jornadas A+ sobre módulos externos ao Núcleo | Validar gestor encontra CRM→frente→prova e operador encontra tarefa→controle→confirmação; ensaio humano e IA autorizada ainda pendentes |

### Inventário inicial investigado (não equivale ao cadastro canônico no Core)

- **CRM** — `/contatos`, `/contatos/inbox`, `/contatos/tarefas` sustentados por `src/App.tsx`, `src/pages/Contatos.tsx`, `src/pages/ContatosInbox.tsx`; controles `Registrar resultado`, `Confirmar resultado`, `Adiar atendimento` sustentados por `src/components/crm/AttendanceActionBar.tsx` e fila `CrmFocusQueue.tsx`. *Implementação observada no código*, não prova E2E da versão publicada.
- **Financeiro, Operações, Captura Central, Rotina, Saúde/CCH, Digital e Assistente** — rotas conferidas no roteador. Fichas ainda são **inventário de presença por rota**, com finalidade detalhada, especialista, método, fluxo e status **não verificados** neste ciclo.
- **Shopee** — incluída como escopo mínimo da investigação V1.2; nenhuma rota própria foi confirmada no primeiro levantamento; **não** afirmar inexistência da integração.
- **Especialista CRM** — papel funcional declarado no trabalho herdado; identidade persistente, autoridade de método vigente, ecossistema e checkpoint específico ainda **não reconciliados documentalmente**. Não registrar nomes pessoais nem marcar método histórico como vigente por inferência.

### Primeiro corte de código A+ — piloto vertical parcial CRM

A PR associada a este checkpoint adiciona `src/lib/nucleo/operationalKnowledgeV12.ts` (inventário tipado e proveniência) e `src/components/nucleo/NucleoOperationalAtlas.tsx` (Visão Geral → Módulo → Operação/Prova, busca por módulos/ações, rótulos reais do CRM, pré-condições, efeitos, confirmações e limites). Montado **no componente M3 já existente**, sem substituir a árvore/Kanban e sem tocar no leitor das oito áreas do Núcleo. Os rótulos e a jornada são apresentados como conhecimento extraído do **código**; não são homologação de uso real nem autorização para IA executar ações.

**Limites explícitos:** este corte de UI é inicialmente **read-only e com catálogo de fontes versionado no código**, não há módulo CRM criado no Core, frente externa vinculada no banco, CRUD completo de ficha viva, timeline própria por módulo, método vigente verificado ou importação de documentação. Assim, os gates CA-01–CA-22 não podem ser declarados atendidos integralmente. A evolução subsequente deverá implementar persistência mínima e vínculo a frente real depois de classificar fontes e contratos de especialista, sem supor progressos.

**Integridade pré-execução:** Core com 7 registros de frentes NUC, 49 evidências, 25 eventos, 3 referências privadas, 0 documentos, 0 dependências e 1 `nucleo_manage` ativo. Nenhuma alteração de banco ou grant foi necessária neste primeiro corte. A Entrega A conserva integralmente seu aceite com ressalvas e a Entrega B permanece não autorizada.

**Próximo ciclo estrito:** (1) checar build/CI e qualidade do piloto; (2) confrontar método/ecossistema CRM com arquivos vigentes e fontes verificáveis; (3) projetar mínima persistência relacional e readback para fichas e vínculos sem duplicar documentos; (4) realizar piloto real de gestor e operador; (5) expandir incrementos apenas após provas e correções de UX.

## 21. Primeiro vínculo persistido de módulo externo — CRM / CRM-UX02 (12/11/2026)

**Escopo:** incremento do ciclo V1.2/Entrega A+ sobre as tabelas M3/M4 já implantadas, sem migração nova ou criação de Núcleo paralelo. Este checkpoint **não altera** a aceitação restrita da Entrega A e não homologa a entrega A+ integral.

**Fonte de verdade técnica consultada:** `src/App.tsx` comprova `/contatos`, `/contatos/inbox` e `/contatos/tarefas`; `src/pages/Contatos.tsx` e `src/pages/ContatosInbox.tsx` são fontes da experiência CRM; `src/components/crm/AttendanceActionBar.tsx` sustenta os controles `Registrar resultado`, `Confirmar resultado`, `Adiar atendimento` e semântica de confirmação/erro. A documentação `docs/crm/CRM_UX_02_MAPA_EXECUCAO_A31_B31A.md` identifica uma frente real UX02 e registra historicamente oito incrementos mergeados, com UAT ainda pendente no checkpoint de 16/10/2026. Não se presume que todas as informações históricas continuem vigentes; o método/ecossistema funcional do especialista CRM permanece a reconciliar.

**Core M3 — gravação governada:** criação da ficha-módulo `CRM` com escopo **de inventário e governança em andamento**, não declaração do estado integral do CRM; criação da frente real `CRM-UX02` como filha de `CRM`, `em_validacao`, `evidence_state=relatada`, com referência à fonte CRM UX 02, aceite de UAT pendente e especialista como **papel funcional declarado, vigência ainda a conferir**. O gatilho nativo criou dois eventos históricos `criado`, sem reescrever nenhuma das sete fichas NUC originais. A hierarquia M3 foi validada por FK/trigger. A escolha dos códigos utiliza a norma de IDs estáveis já existente.

**Core M4 — proveniência GitHub append-only:** conferidos os PRs `#296` (merge `5a74ad60a821e1df4d58be191c2b2b67be8b73f1`) e `#297` (merge `900685c991a182790cef249c1be042df7bb92719`), vinculados à frente `CRM-UX02` como duas evidências `github/pull_request` verificadas. As notas e snapshots registram explicitamente `uat_verified=false`: merge não comprova publicação nem operação real. Guardas impediram duplicação de chaves, violação de baseline e alteração documental.

**Readback após as duas transações:** **9 frentes/registros M3** (NUC e M0–M5, CRM e CRM-UX02), **27 eventos históricos**, **51 evidências técnicas M4** (49 herdadas + 2 do CRM), **zero documentos** e **uma concessão `nucleo_manage` ativa**. A Entrega B não foi iniciada, e nenhum conteúdo do CRM, dos contatos, do Google Drive ou dos 82 documentos foi copiado.

**Navegação M3/V1.2:** a PR do segundo incremento de código recebe a coleção real `nucleo_development_workstreams` e exibe na ficha CRM suas frentes persistidas. O botão `Abrir frente na Central` seleciona o registro M3 existente pelo ID, com ficha de próxima ação, estado e evidências M4; não cria uma segunda estrutura de workstreams. O catálogo de telas/ações continua em `src/lib/nucleo/operationalKnowledgeV12.ts` com escopo parcial e grau de prova explícito.

**Gates ainda abertos (CA-01 a CA-22):** campo de especialista com método/versão validada, catálogo canônico editável/relacional, ampliação factual para os demais módulos e frentes, ensaio real humano e IA autorizada, testes de acessibilidade desktop/mobile e verificação de publicação. A PR, CI e readback do Core NÃO substituem a demonstração das duas jornadas. M3 Salvar em navegador e M5 revogação E2E continuam adiados por decisão anterior do proprietário.

## 22. V1.2 A+ — cobertura Core e provas por frente no piloto CRM (12/11/2026)

**Situação:** continuidade autorizada no Mapa Mestre V1.2, dentro de M3/M4 existentes. Não criar outra macrofrente, não promover documentos ou métodos históricos a vigentes e não afirmar que a Entrega A+ esteja homologada.

**Causa observada:** o Atlas operacional na `main` ainda exibia a afirmação estática "Nenhum módulo ou frente externa foi criado no Core", embora os registros `CRM` e `CRM-UX02` tivessem sido efetivamente criados e relidos no Core (checkpoint anterior). Além disso, a ficha CRM permitia abrir a frente, mas não consultar diretamente suas duas provas técnicas M4 sem mudar de contexto.

**Ação de código isolada:** a PR desta seção altera somente `src/components/nucleo/NucleoOperationalAtlas.tsx`: substitui a afirmação incorreta por contagem derivada da coleção M3 autorizada, distingue ficha cadastrada no Core de entrada de inventário de rotas e oferece `Ver provas GitHub/Supabase` por frente CRM, reutilizando `NucleoTechnicalEvidence` e RLS já implementados. Acrescenta vínculo para `docs/crm/CRM_UX_02_MAPA_EXECUCAO_A31_B31A.md` com aviso explícito de que é um **checkpoint histórico de 16/10/2026**, não uma homologação recente nem versão normativa vigente.

**Prova antes desta PR:** `CRM` e `CRM-UX02` persistidos na árvore M3; PRs #296 e #297 verificadas como mergeadas e registradas na M4 (duas evidências imutáveis). Total de nove registros M3, 51 evidências e 27 eventos; zero documentos importados, três referências privadas e um grant `nucleo_manage` ativo, preservando legado NUC M0–M5. Esses números são baseline da última conferência e devem ser rechecados antes de qualquer afirmação sobre o estado posterior.

**Limites e portões:** mudança é somente leitura e não introduz nova tabela, migration, permissão ou ligação fictícia. CI comprova compilação/contratos existentes, **não** publicação, navegação de gestor ou compreensão por operador. As duas jornadas do piloto, a legitimidade e versão do método CRM, o cadastro parametrizável de ficha viva FM-01–FM-10, a expansão factual para outras áreas e os ensaios CA-15/16/20/21/22 permanecem abertos. Testes M3 e M5 adiados não foram executados. A Entrega B segue não autorizada.

**Próxima ação:** reconciliar documentos de especialista/método do CRM com fonte e autoridade, elaborar extensão relacional mínima de fichas operacionais sujeita a RLS/testes e avançar cobertura por módulos com a mesma proveniência; validar a interface no ambiente publicado e por operador independente, sem inferir aceite A+.

## 23. V1.2 A+ — Atlas dinâmico parametrizado pelos módulos do Core M3 (12/11/2026)

**Situação:** incremento autorizado pelo mapa soberano V1.2, desdobramento da M3, **não** M6. A PR desta seção corrige o limite de catálogo estático observado no piloto CRM, preservando seu manual parcial.

**Causa:** `NucleoOperationalAtlas` ainda enumerava os módulos somente pela lista `MODULES_V12`. Mesmo uma nova ficha de módulo registrada corretamente pela UI/SQL M3 não apareceria no atlas sem uma mudança no código, contrariando o caráter parametrizável dos critérios CA-01/11/22.

**Ação:** o Atlas passa a combinar os módulos de `nucleo_development_workstreams` lidos sob a concessão/RLS já existente com o catálogo metadata-only de rotas verificadas no GitHub. Para cadastro no Core, usa código, título, descrição e especialista **declarado**, sem inferir rota, domínio, método, prova de deploy ou homologação de uso. Mantém entradas de rotas ainda não cadastradas claramente identificadas como tal; um módulo que entrar no Core passa a ser selecionável sem alterar o código. Frentes filhas e provas M4 passam a ser acessíveis pelo mesmo caminho de módulo, sem base concorrente. O manual operacional de ações continua detalhado somente no CRM, com estado parcial indicado.

**Automação de testes:** `.github/workflows/nucleo-m3-development.yml` passou a vigiar explicitamente `NucleoOperationalAtlas.tsx` e `operationalKnowledgeV12.ts`, acionando os gates M3 PostgreSQL/TypeScript/build para futuras mudanças do piloto. **CI e merge não equivalem à navegação homologada**.

**Limites:** sem migration, usuários novos, grants, alterações de documento, importação da Entrega B ou operação sobre CRM. Não foi homologada a compreensão por operador externo, a acessibilidade em mobile/teclado, nem a versão/autoridade do método do especialista CRM. O status A+ permanece **em desenvolvimento** até demonstrar as duas jornadas com fonte e readback; a Entrega A conserva aceite técnico restrito com ressalvas; M3 Salvar e M5 E2E seguem adiados.

## 24. V1.2 A+ — Ficha Viva FM-01–FM-10 versionada (12/11/2026)

**Escopo executado:** incremento vertical aditivo de M1/M3, sobre cadastro M3 existente, preparado em PR deste checkpoint. Propõe `nucleo_module_knowledge_revisions` com FK ao módulo, seção FM-01..FM-10, versão por seção, descrição operacional, origem referenciada, nível de prova, estado de autoridade e autoria/timestamp. Histórico append-only, com `UNIQUE(module_id,section_code,version_no)`, RLS `nucleo_manage` e sem atribuição automática de homologação. Browser só pode inserir `rascunho/declarado`; revisão `homologado` exige uma decisão externa autorizada e não está implementada como ação de UI.

**UI existente ampliada:** Atlas dinâmico inclui a ficha versionada dos módulos cadastrados, com seletor FM, leitura da revisão mais recente, histórico preservado, formulário de nova versão, referência original, validação de comprimento e readback por ID antes de declarar a escrita confirmada. Não há cópia do conteúdo de Drive, tampouco modificação de páginas locais; cada módulo mantém ID estável M3 e especialistas/métodos continuam sujeitos à autoridade vigente.

**Prova automatizada:** migration aditiva `20261112200000_nucleo_v12_ficha_viva_revisoes.sql`, script `scripts/nucleo-v12-ficha-viva.test.sql` e workflow M3 ampliado para execução em PostgreSQL 17 isolado e build frontend. O teste cobre criação de duas revisões distintas, impedir repetição de versão, hierarquia somente módulo, escrita falsamente homologada, acesso negado, imutabilidade e revogação. A aprovação da CI, quando ocorrer, comprova laboratório e código, não demonstra uma alteração já aplicada no Core oficial nem o uso real do operador.

**Gate de implantação:** a alteração de schema exige aplicação por **migrador governado oficial com registro de versão** e readback em produção; não registrar como aplicada nem afirmar que a UI funciona com tabela inexistente. A conexão Supabase com permissão de migrar não estava disponível para esta sessão; não compensar com DDL manual não versionado pelo conector administrativo. O frontend deverá informar indisponibilidade enquanto schema ainda não estiver efetivamente aplicado.

**Preservação:** a base de referência continua 9 registros de frentes/módulos, 51 evidências, 27 eventos, 3 referências privadas, 0 documentos importados e uma concessão administrativa vigente (última conferência). Sem nova concessão, sem interferência em outros domínios, sem migração documental B. O piloto CRM de gestão/evidência já instalado permanece aproveitado.

**Pendente:** aplicar migration sob portão competente; conferir RLS real + leitura da ficha, criar primeira revisão rascunho FM-01 no CRM por fluxo autorizado sem fabricar autoridade, comparar a revisão ao original, ensaio UX/teclado/mobile e demais CA-13 a CA-22. O mapa integral V1.2 segue em execução, A+ não homologada.

## 25. V1.2 — Ficha Viva aplicada ao PostgreSQL oficial Lovable Cloud (13/11/2026)

**Correção de ambiente e estado:** o banco oficial é **Lovable Cloud / PostgreSQL via Supabase**, projeto Lovable `1720a410-34cd-4410-995c-8c92c7edf16b`. O conector Supabase externo não possuía autorização para atuar nesse projeto, mas o acesso administrativo de banco do **Lovable Cloud** estava disponível. Portanto, o gate de aplicação deixado em aberto na seção 24 foi cumprido pelo canal correto, **sem utilizar o construtor visual da Lovable**. A limitação relatada naquela seção era operacionalmente incorreta para esta infraestrutura.

**Migration efetivamente aplicada:** `supabase/migrations/20261112200000_nucleo_v12_ficha_viva_revisoes.sql`, exatamente a versão já aprovada em PostgreSQL 17 isolado na PR #708 e integrada na `main`. Executada no PostgreSQL oficial por chamada SQL transacional com preflight do estado conhecido, inclusão de versão no ledger `supabase_migrations.schema_migrations` e verificação de existência/ausência de dados iniciais. Registro: `version=20261112200000`, `name=nucleo_v12_ficha_viva_revisoes`, `created_by=chatgpt_git_direct`. **Não** houve cópia de documentos ou criação artificial de revisões no CRM.

**Readback direto no Core:** tabela `public.nucleo_module_knowledge_revisions` existente, **1** versão registrada no ledger, RLS habilitada com **2 políticas**, **2 triggers** de proteção ativos, **0 revisões**. Base anterior preservada: **9** registros M3, **51** evidências M4, **27** eventos históricos, **3** referências privadas, **0 documentos importados** e **1** concessão `nucleo_manage` ativa. Consulta autorizada sob contexto sintético de usuário sem capacidade confirmou catálogo de revisões vazio, sem revelar dados.

**Limite do aceite:** implantação de schema e contrato técnico concluída. Ainda **não** equivale à homologação visual do botão de Ficha Viva, à criação de uma primeira revisão autorizada, a aceite humano de conteúdo normativo, nem a homologação completa A+. A UI permanece disponível sob abertura explícita e só pode registrar `rascunho/declarado`; M3 Salvar original e M5 revogação E2E continuam adiados. A Entrega B segue sem autorização.

**Próximo trabalho dentro de M0–M5:** validar leitura e gravação de uma revisão rascunho FM no CRM em sessão autenticada, preservando fonte e autoria; reconciliar método do especialista antes de qualquer promoção a homologado, e ampliar módulos a partir de evidência. Não registrar documentação inexistente como vigente.

## 26. V1.2 — ajuste visual de hierarquia NUC versus módulos (13/11/2026)

**Achado de uso real:** a captura autenticada da página `/nucleo` mostrou "10 entradas" ao lado de "1 módulo externo cadastrado", embora o inventário inicial tivesse nove módulos de trabalho. A causa no código era a combinação da ficha `NUC` (governança) com o catálogo de módulos operacionais, exibindo o próprio Núcleo como se fosse mais um módulo acompanhado. Também havia textos excessivamente pequenos nos cartões, prejudicando leitura da visão geral em desktop.

**Correção delimitada à interface M3/V1.2:** `NucleoOperationalAtlas.tsx` passa a excluir o código `NUC` do catálogo de módulos operacionais, mantendo-o visível numa seção separada **Núcleo — ambiente de governança** com contagem real de suas frentes e ação para abrir a ficha original M3. O catálogo operacional conserva as nove entradas iniciais e acrescenta somente módulos externos cadastrados que ainda não estejam no catálogo, sem duplicar, inferir progresso ou ocultar frentes. O CSS Tailwind amplia tipografia, altura e espaçamento dos cartões e mensagens principais; não troca o design system.

**Validação esperada:** nove entradas no catálogo inicial com CRM como único módulo externo efetivamente cadastrado, uma seção distinta para NUC e sua árvore, navegação por botões existentes e preservação dos estados de prova e dos registros M3. A screenshot é evidência visual de renderização anterior, não homologação do clique após esta PR. Nenhuma alteração de banco, grants, documentos, métodos, modelos de especialista ou migração B. Testes M3 Salvar e M5 revogação E2E permanecem postergados.
