# Núcleo 2.0 — Entrega A+ V1.2 — Implementação integrada CA-16 / CA-18 / CA-22

**Base soberana:** Mapa Mestre original V1.2 de 12/11/2026, CA-16, CA-18 e CA-22; relatório de fechamento #747. **Escopo:** M1–M5 existentes; sem M6 e sem novos estados de autoridade.

## Fontes preservadas e reaproveitadas

- `src/lib/nucleo/operationalKnowledgeV12.ts`: catálogo de módulos, rotas e ações CRM verificadas no código.
- `src/lib/nucleo/operationalDraftsV12.ts`: propostas locais FM-01–FM-10, sem registro nem homologação automática.
- `nucleo_module_knowledge_revisions`: único armazenamento de versões FM, append-only, consulta sob RLS.
- `nucleo_development_workstreams` (M3) e `nucleo_development_evidence` (M4): snapshots da supervisão M5, **já autorizados pelo gate de sessão, grant `nucleo_manage` ativo e RLS**.
- `src/lib/nucleo/operationalProvenanceV12.ts`: referências do catálogo, distinguidas de prova de execução.
- Documentos originais preservados na Biblioteca/ZIP. Nada é importado, reescrito ou promovido a vigente.

## Implementação realizada

**CA-22 — conhecimento parametrizado:** o console oferece a mesma estrutura de dez seções para qualquer módulo real do M3, com seleção dinâmica. Somente versões efetivamente registradas e permitidas no Core são exibidas como revisões. Ausências não são preenchidas com textos inventados, nem exigem criar uma nova tela por módulo. O catálogo inicial pode continuar usando propostas locais já presentes no código. A meta de operações genéricas continua condicionada à qualidade do conteúdo FM-05; nenhum botão operacional é gerado automaticamente.

**CA-16 — contrato de consulta estruturada:** um operador com acesso autorizado ao M5 pode **copiar explicitamente** um pacote JSON somente do módulo selecionado, composto por seções FM e fontes, estado declarado de frentes e contagem de provas técnicas. O pacote não inclui registros de clientes, tokens, credenciais, conteúdo de outras tabelas nem acessa provedor de IA. A ação é iniciada pelo usuário: o Núcleo NÃO autoriza o agente destinatário, não publica um endpoint de IA e não executa ações. Portanto a **consulta autenticada por agente** e seu teste de isolamento seguem pendentes, não se declara CA-16 homologado.

**CA-18 — sugestão de revisão documental:** o console verifica revisões FM existentes e registros M4 do tipo PR `verificado` associados às frentes da árvore do módulo. Só sugere revisão quando um snapshot de PR contém explicitamente `merged_at` posterior a `recorded_at` da revisão FM. O resultado é **candidato temporal**, não prova semântica de mudança UI/PR afetando aquela seção, não altera automaticamente manual nem grava estado. Se falta data ou revisão, a situação é **indeterminada** ou sem referência no Core. O mecanismo completo de vinculação semântica PR→componente→FM e eventual persistência de revisão pendente permanece condicionado, sem criar writers concorrentes.

**Segurança:** falha/consulta parcial FM (limite 300) bloqueia exportação e conclusões. O console é montado somente no M5 após autenticação, grant ativo e snapshot M3/M4 sob RLS. Mudança de sessão invalida o painel pai. Revogação E2E em navegador segue adiada. Nenhum novo grant/migration, nenhuma escrita Core ou operação externa.

## Critérios de aceite remanescentes sem expansão de escopo

- CA-16: agente autorizado usar o **mesmo contrato de dados** sob autenticação e RLS, sem copiar manualmente, com testes negativos e controle de permissões. Esta implementação entrega apenas a representação estruturada/exportação deliberada.
- CA-18: origem verificável do evento PR/UI e vínculo exato a módulos/seções para marcar pendência real, com deduplicação e autoria por procedimento existente; só foi entregue sugestão read-only de revisão.
- CA-22: cobertura genérica navegável entregue, mas riqueza do conteúdo depende de FM persistidas (0 no corte anterior) e homologação dos métodos. Módulos sem cadastro M3 não são acrescentados artificialmente.
- CA-15/19/20/21: ensaios visuais e uso real permanecem explicitamente adiados.
- Entrega B: não autorizada; preservar 82 páginas originais e demais documentos.

**Decisão:** fechar este incremento de engenharia após build/CI; não declarar os três CAs concluídos integralmente. Evitar refinamentos de cosmética e novas PRs sem lacuna de requisito concreta.
