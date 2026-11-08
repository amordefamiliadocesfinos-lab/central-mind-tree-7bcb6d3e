# MAPA SOBERANO DO CCH / SAÚDE NO PAINEL CENTRAL

**Documento:** Governança Mestre CCH / Saúde  
**Versão:** v3.4 — FROZEN  
**Data:** 08/11/2026  
**Status:** VIGENTE · FROZEN  
**Substitui:** v3.3  
**Baseline funcional pós-M9:** `main@de481b4593efece84081df2845ced1b98c086661`  
**Base reconciliada do congelamento:** `main@6af9d88e2cb432aa9ab0ef543e1ac03c8667995a`  
**Vigência da v3 FROZEN:** merge autorizado da PR #490, commit `c8fe59530e058eb10d44aa2c357e3c4850beeba4`  
**Vigência da v3.1 FROZEN:** merge autorizado da PR #495  
**Vigência da v3.2 FROZEN:** merge autorizado da mudança que adia TESTES MT para pré-Gate B  
**Objetivo:** preservar o escopo aprovado do CCH, manter TESTES MT adiado para pré-Gate B e permitir o avanço arquitetural/implementacional da F13 sem declarar F11/F12 integralmente homologadas.

---

## 1. IDENTIDADE CANÔNICA

### Produção

- Produto: **PAINEL CENTRAL**
- Módulo: **CCH / Saúde**
- Lovable Project ID: `1720a410-34cd-4410-995c-8c92c7edf16b`
- GitHub: `amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e`
- Branch canônica: `main`
- Supabase produção: `xkskyutmtlhivvpfxkjg`
- URL: `https://central-mind-tree.lovable.app`

### Testes oficiais

- Lovable: **PAINEL CENTRAL — TESTES MT**
- Lovable Project ID: `864ced4a-32ea-4aad-8491-181eba297291`
- Supabase documentado: `enfekhgcsbzovxtqdlwh`

### Não canônicos / sandbox

- `gufyjtdgsdmowubdtdvo`
- `fmbarvtlfuvirwqpuydx`
- repositórios históricos `central-mind-tree` e `central-mind-tree-bc2f05ee`

Nunca usar ambiente não canônico como fonte oficial.

---

## 2. HIERARQUIA DAS FONTES

Quando houver conflito:

1. identidade canônica;
2. Git/GitHub `main`, commits, PRs e migrations;
3. banco canônico e histórico de migrations;
4. este Mapa Soberano vigente + arquiteturas/ADRs versionados;
5. TESTES MT;
6. preview, logs, screenshots e evidências visuais;
7. memória de chat ou suposição.

Fonte inferior nunca corrige silenciosamente fonte superior.

---

## 3. ESTADO REAL CONGELADO — M0→M9

| Fase | Nome | Planejado | Implementado | Testado | Integrado | Banco produção | Deploy | Homologado |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| M0 | Foundation | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| M1 | Profile & Goals | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| M2 | Catalogs | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| M3 | Program CCH | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| M4 | Live Workout | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| M5 | Nutrition Foundation | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| M6 | Nutrition State | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| M7 | Nutrition Decision | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| M8 | Body Evolution | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| M9 | Sleep/Recovery + Exams/Biomarkers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**M0→M9 constituem a fundação funcional homologada do CCH.**

Nenhuma dessas fases deve ser reaberta como nova arquitetura sem uma necessidade objetiva, versionada e aprovada.

---

## 4. FECHAMENTO M9

### Arquitetura

- PR documental: **#487**
- merge documental: `ae85e22fd5acd116e6cbbb7c9a5ce21af8075a2c`
- arquitetura M9A/M9B, decisões v1, desenho técnico, segurança, testes e UI versionados.

### Implementação

- PR implementação: **#488**
- merge em `main`: `de481b4593efece84081df2845ced1b98c086661`

Migrations M9:

1. `20261108001646_health_m9_sleep_recovery_foundation`
2. `20261108001648_health_m9_sleep_recovery_rpcs`
3. `20261108001650_health_m9_clinical_foundation`
4. `20261108001652_health_m9_clinical_rpcs`
5. `20261108001653_health_m9_security`
6. `20261108001655_health_m9_integrity`
7. `20261108003645_health_m9_performance_indexes`

### Validação

- TESTES MT: PASS
- RLS/cross-athlete: PASS
- PostgreSQL descartável: PASS
- lint Health: PASS
- build completo: PASS
- pós-DDL: sem pendência M9 de índice líder/RLS/grant anônimo.

### Produção

- Gate A: ✅
- Gate B: ✅
- Gate C: ✅
- deployment: `456e72a1-a6b7-4046-88e3-f634b2065cf2`

Rotas homologadas:

- `/saude/recuperacao`
- `/saude/exames`

Homologação visual confirmou shell Health com 7 módulos, telas M9 publicadas, estados vazios sem inventar valores e nenhuma falha fatal visível.

**Resultado:** M9 encerrada e homologada em produção.

---

## 4A. ESTADO F10 — DASHBOARD INTEGRADO

Implementação:
- arquitetura e contrato: ✅
- PR de implementação #494: ✅ mergeada
- merge commit: `0852b8204d8fbb8085fee8aaa7073dd64d8d727e`
- CI F10: ✅
- regressão M9: ✅
- Gate B: não aplicável
- Gate C: ✅
- deployment: `90fe869a-d427-4294-8a82-3ec728204350`

Homologação visual:
- desktop produção autenticada: ✅
- mobile layout no preview Lovable: ✅
- mobile diretamente na URL de produção: ⏳ pendente

**A pendência mobile de produção não é convertida em PASS por inferência.**

Em 08/11/2026 o usuário autorizou explicitamente desbloquear a F11. Essa autorização cria uma exceção governada **somente para abertura arquitetural/documental da F11**.

A exceção:
- não declara a F10 100% homologada;
- não elimina a pendência visual mobile de produção;
- não autoriza implementação F11;
- não autoriza banco F11;
- não autoriza deploy F11;
- não altera a ordem macro F10 → F11 → F12 → F13.

---

## 5. ESCOPO DO PROJETO — CONGELADO

O CCH continua sendo **um módulo integrado ao PAINEL CENTRAL**, não um produto paralelo.

### Dentro do escopo soberano

O escopo macro aprovado após M9 contém **somente** estas quatro frentes, nesta ordem:

1. **Dashboard Integrado**
2. **Motor Integrado CCH**
3. **Jornada real completa**
4. **Evolução contínua por dados reais**

Também permanecem dentro do escopo:
- manutenção corretiva M0→M9;
- segurança, performance, acessibilidade e responsividade;
- melhoria de UX sem mudar autoridade de domínio;
- correções de integridade sem reescrever histórico;
- documentação e observabilidade necessárias ao funcionamento dessas frentes.

### Fora do escopo sem alteração formal deste Mapa

Não iniciar silenciosamente:
- novo aplicativo Health separado do PAINEL CENTRAL;
- novas macrofases paralelas;
- novo especialista/domínio de saúde não previsto;
- motor diagnóstico;
- prescrição médica automática;
- alteração automática de medicamentos;
- alteração automática de dieta/treino fora de contrato versionado;
- score clínico ou score composto governando decisões sem arquitetura aprovada;
- uso de IA como autoridade final em decisão crítica;
- integração externa que passe a ser nova fonte soberana sem contrato;
- compartilhamento público de documentos/fotos Health;
- duplicação de fonte de verdade já existente.

Qualquer expansão desse nível exige **nova versão do Mapa Soberano** e autorização explícita.

---

## 6. SEQUÊNCIA CONGELADA DAS PRÓXIMAS FRENTES

### F10 — Dashboard Integrado

**Próxima frente oficial.**

Missão:
consolidar leitura e estado dos especialistas existentes em `/saude/hoje`.

Primeira versão deve ser principalmente **leitura e síntese**, não um novo motor de decisão.

Pode consolidar:
- treino;
- alimentação;
- evolução corporal;
- sono/recuperação;
- exames/biomarcadores;
- cobertura/confiança;
- pendências relevantes;
- estado atual por domínio.

Não pode:
- criar diagnóstico;
- inferir causalidade como fato;
- alterar treino/dieta;
- inventar score global;
- ocultar insuficiência de dados.

Antes de código:
- arquitetura versionada;
- contrato de leitura;
- origem de cada indicador;
- empty/unknown states;
- critérios de aceitação mobile;
- segurança e performance.

### F11 — Motor Integrado CCH

**Arquitetura documental desbloqueada por autorização explícita do usuário em 08/11/2026.**

Exceção v3.1:
- a arquitetura F11 pode ser aberta mesmo com a prova visual mobile diretamente em produção da F10 ainda pendente;
- a F10 permanece tecnicamente implantada, com desktop produção PASS e mobile preview PASS;
- nenhuma implementação F11 é autorizada por esta exceção;
- antes de implementar F11 será obrigatório contrato arquitetural versionado, revisão documental e Gate A específico;
- a pendência visual F10 continuará registrada até sua prova real em produção.

Missão:
orquestrar decisões integradas **determinísticas, explicáveis, versionadas e pausáveis**.

Obrigatório preservar:
- data sufficiency;
- `DECISION_PAUSED`;
- reason codes;
- versão do algoritmo;
- separação fato → estado → decisão → ação;
- nenhuma decisão clínica automática.

### F12 — Jornada real completa

**Arquitetura e implementação desbloqueadas por autorização explícita do usuário em 08/11/2026.**

Missão:
provar ponta a ponta a experiência longitudinal real:
perfil → dados → estados → planejamento → execução → revisão → decisão explicável.

Regra v3.3:
- F12 pode avançar em arquitetura, branch, implementação, CI e Gate A sem aguardar TESTES MT/Gate B/Gate C da F11;
- F12 não pode declarar homologação real da jornada enquanto dependências upstream necessárias não estiverem operacionais;
- se a F12 não introduzir DDL próprio, Gate B da F12 pode ser não aplicável;
- Gate C da F12 permanece condicionado à compatibilidade operacional com a F11 publicada;
- nenhum deploy F12 deve expor UI que dependa de tabelas/RPCs F11 ausentes em produção;
- a pendência TESTES MT da F11 continua real e obrigatória antes do Gate B da F11.

Nenhuma fixture deve substituir a homologação real.

### F13 — Evolução contínua por dados reais

**Arquitetura e implementação desbloqueadas por autorização explícita do usuário em 08/11/2026.**

Missão:
usar histórico real para replanejamento longitudinal, metas, comparações e aprendizado operacional do CCH.

Regra v3.4:
- F13 pode avançar em arquitetura, branch, implementação, CI e Gate A sem aguardar homologação operacional completa de F11/F12;
- F13 não pode declarar aprendizado longitudinal validado sem dados reais suficientes;
- F13 não pode autoalterar treino, dieta, metas ou decisões especialistas;
- qualquer replanejamento automático futuro exige contrato decisório próprio, versionado e aprovado;
- F13 deve preferir comparação longitudinal e candidatos de revisão, não prescrição automática;
- Gate B/C continuam separados e dependem dos artefatos realmente introduzidos pela F13.

Não autoriza auto-otimização sem contrato de decisão explícito.

---

## 7. REGRA DE NÃO EXPANSÃO

Durante F10→F13:

- não inventar F14;
- não abrir frente paralela sem fechar a anterior;
- não transformar achado em escopo automaticamente;
- achado novo entra primeiro como **candidato/documentação**;
- candidato só vira escopo mediante alteração versionada deste Mapa;
- melhoria local não pode mudar autoridade de domínio;
- “seria interessante” não equivale a requisito aprovado.

**O Mapa governa o trabalho; o trabalho não amplia o Mapa por conveniência.**

---

## 8. MÉTODO OFICIAL — IMUTÁVEL NESTE CONGELAMENTO

Toda evolução CCH:

1. confirmar identidade canônica;
2. ler `main` e registrar SHA base;
3. arquitetura/contrato antes de implementação quando a frente for nova;
4. branch específica a partir da `main` vigente;
5. implementar somente na branch;
6. migration versionada antes do banco;
7. RLS/cross-athlete/segurança em ambiente descartável/CI;
8. CI;
9. PR Draft;
10. Gate A para merge;
11. TESTES MT real antes de qualquer Gate B que altere banco de produção;
12. Gate B para banco produção;
13. pós-check produção;
14. Gate C para deploy;
15. homologação real;
16. documentação de fechamento;
17. só então liberar a próxima frente, salvo exceção explícita versionada neste Mapa.

### Política v3.2 — TESTES MT adiado, não removido

Por autorização explícita do usuário em 08/11/2026:

- TESTES MT deixa de ser bloqueador da implementação em branch;
- TESTES MT deixa de ser pré-requisito do Gate A/merge;
- CI descartável, segurança, regressões e revisão do diff continuam obrigatórios antes do Gate A;
- TESTES MT continua obrigatório antes do Gate B de produção quando houver migration/DDL;
- nenhum banco de produção pode ser usado como substituto de TESTES MT;
- a ausência de TESTES MT deve permanecer registrada como pendência real, nunca como PASS inferido;
- fronts podem continuar sendo desenvolvidas sem esperar credencial do ambiente TESTES MT, desde que não atravessem Gate B sem esse teste.

### Exceção específica v3.1

A autorização explícita de 08/11/2026 permitiu abrir a arquitetura documental F11 antes da prova visual mobile final da F10 em produção.

### Ajuste específico v3.2

A autorização explícita posterior de 08/11/2026 determina que a ausência de TESTES MT **não deve travar a implementação nem o Gate A**.

Esse ajuste:
- não remove TESTES MT;
- não libera banco de produção;
- não libera deploy;
- não altera as invariantes de segurança;
- não transforma CI descartável em homologação de ambiente real.

### Ajuste específico v3.3

A autorização explícita posterior de 08/11/2026 determina que a pendência operacional da F11 **não deve paralisar o desenvolvimento da F12**.

Permitido antes do fechamento operacional F11:
- arquitetura F12;
- implementação F12 em branch;
- CI/regressões;
- Gate A/merge F12.

Não permitido por esta exceção:
- declarar F11 homologada;
- declarar F12 homologada ponta a ponta;
- usar produção como ambiente de teste;
- atravessar Gate B F11 sem TESTES MT;
- atravessar Gate C F12 se a UI depender de backend F11 ainda ausente em produção.

### Ajuste específico v3.4

A autorização explícita posterior de 08/11/2026 determina que pendências operacionais de F11/F12 **não devem paralisar o desenvolvimento da F13**.

Permitido:
- arquitetura F13;
- implementação F13 em branch;
- CI/regressões;
- Gate A/merge F13.

Não permitido:
- declarar F13 homologada longitudinalmente sem dados reais;
- auto-otimizar ou autoalterar treino/dieta/meta;
- inferir causalidade entre domínios;
- usar produção como ambiente de teste;
- eliminar gates pendentes de F11/F12;
- inventar F14.

### Proibido

- Lovable Builder/agent como autor do CCH;
- SQL de produção sem migration versionada;
- reescrever migration já aplicada;
- force push/reset destrutivo;
- duplicar fonte de verdade;
- inferir “homologado” a partir de merge/deploy;
- avançar fase com gate anterior aberto;
- usar memória de chat como única transferência operacional.

---

## 9. GATES

### Gate A — Merge
Qualquer PR Health/CCH entrando em `main` exige autorização explícita.

TESTES MT não é pré-requisito do Gate A na v3.2. Antes do merge continuam obrigatórios:
- arquitetura/contrato aplicável;
- CI descartável;
- regressões pertinentes;
- revisão de segurança;
- diff reconciliado com `main`.

### Gate B — Banco
Qualquer DDL/migration em produção exige:
- migration em `main`;
- PASS real no TESTES MT;
- ausência confirmada no histórico;
- autorização explícita.

### Gate C — Deploy
Publicação exige autorização explícita após merge e banco.

### Gate D — Destrutivo
DROP, reset, force push, perda de histórico/dado ou remoção física sensível exigem autorização específica.

---

## 10. PRINCÍPIOS INVARIANTES

- `unknown != zero`;
- planejamento != execução;
- fato != observação != inferência != decisão != ação;
- histórico não é reescrito silenciosamente;
- correção por supersession/void quando aplicável;
- decisão exige suficiência;
- `DECISION_PAUSED` é resultado válido;
- algoritmos/parameter sets são versionados;
- IA auxilia; regras determinísticas governam decisões críticas;
- especialista não invade domínio vizinho;
- associação != causalidade;
- wearable != verdade clínica;
- documento extraído != fato clínico confirmado;
- biomarcador != diagnóstico;
- dado corporal != recomendação nutricional sem contrato;
- estado de sono != decisão de treino sem contrato;
- nenhum valor ausente é preenchido apenas para completar interface.

---

## 11. ROTAS HEALTH CONGELADAS NA FUNDAÇÃO M0→M9

Rotas principais existentes:

- `/saude/hoje`
- `/saude/treino`
- `/saude/alimentacao`
- `/saude/evolucao`
- `/saude/recuperacao`
- `/saude/exames`
- `/saude/perfil`

`/academia` permanece separado conforme arquitetura vigente.

A próxima frente deve evoluir **`/saude/hoje`** para Dashboard Integrado; não criar rota paralela concorrente para a mesma função sem justificativa arquitetural.

---

## 12. CONTROLE DE MUDANÇA DO MAPA

Este documento é **FROZEN**.

Para alterar escopo macro, sequência ou autoridade:

1. declarar a necessidade;
2. criar proposta documental versionada;
3. demonstrar impacto sobre fases existentes;
4. manter o estado atual como baseline;
5. abrir PR específica;
6. obter Gate A explícito;
7. somente após merge a alteração passa a ser soberana.

Uma conversa, ideia, experimento ou implementação isolada **não altera este Mapa**.

---

## 13. PRÓXIMA AÇÃO AUTORIZÁVEL

Após esta v3.1 FROZEN tornar-se vigente:

**abrir somente a arquitetura documental do Motor Integrado CCH (F11).**

A F10 mantém a pendência residual de prova visual mobile diretamente em produção.

Não iniciar implementação F11 até:
- existir arquitetura F11 versionada e revisada;
- contrato de suficiência integrada estar definido;
- `DECISION_PAUSED` e reason codes estarem definidos;
- fronteiras de autoridade entre especialistas estarem definidas;
- Gate A documental F11 ser explicitamente autorizado.

F12 e F13 permanecem bloqueados.

---

## 14. DIRETRIZ FINAL

**M0→M9 estão encerrados como fundação homologada do CCH.**

**O escopo futuro está congelado em F10→F13, nessa ordem.**

**Nenhuma expansão silenciosa é permitida.**

**A F11 está desbloqueada exclusivamente na camada arquitetural/documental.**

**Implementação F11, F12 e F13 permanecem bloqueadas até seus gates próprios.**
