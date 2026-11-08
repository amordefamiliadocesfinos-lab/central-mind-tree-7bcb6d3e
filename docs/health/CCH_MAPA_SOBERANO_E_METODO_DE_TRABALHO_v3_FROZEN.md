# MAPA SOBERANO DO CCH / SAÚDE NO PAINEL CENTRAL

**Documento:** Governança Mestre CCH / Saúde  
**Versão:** v3.0 — FROZEN  
**Data:** 07/11/2026  
**Status:** VIGENTE · FROZEN  
**Substitui:** v2.0  
**Baseline funcional pós-M9:** `main@de481b4593efece84081df2845ced1b98c086661`  
**Base reconciliada do congelamento:** `main@6af9d88e2cb432aa9ab0ef543e1ac03c8667995a`  
**Vigência da v3 FROZEN:** merge autorizado da PR #490, commit `c8fe59530e058eb10d44aa2c357e3c4850beeba4`  
**Objetivo:** congelar o escopo aprovado do CCH, registrar M0→M9 no estado real de produção e impedir expansão silenciosa de produto, domínio ou autoridade.

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

Somente após o Dashboard Integrado estar implementado e homologado.

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

Somente após o Motor Integrado estar homologado.

Missão:
provar ponta a ponta a experiência longitudinal real:
perfil → dados → estados → planejamento → execução → revisão → decisão explicável.

Nenhuma fixture deve substituir a homologação real.

### F13 — Evolução contínua por dados reais

Somente após a Jornada real completa.

Missão:
usar histórico real para replanejamento longitudinal, metas, comparações e aprendizado operacional do CCH.

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
7. TESTES MT primeiro;
8. RLS/cross-athlete/segurança;
9. CI;
10. PR Draft;
11. Gate A para merge;
12. Gate B para banco produção;
13. pós-check produção;
14. Gate C para deploy;
15. homologação real;
16. documentação de fechamento;
17. só então liberar a próxima frente.

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

### Gate B — Banco
Qualquer DDL/migration em produção exige:
- migration em `main`;
- PASS no TESTES MT;
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

Após esta v3 FROZEN tornar-se vigente:

**abrir somente a arquitetura do Dashboard Integrado (F10).**

Não iniciar Motor Integrado, Jornada completa ou Evolução contínua antes dos respectivos critérios de entrada.

Não iniciar implementação do Dashboard até existir seu contrato arquitetural versionado e revisado.

---

## 14. DIRETRIZ FINAL

**M0→M9 estão encerrados como fundação homologada do CCH.**

**O escopo futuro está congelado em F10→F13, nessa ordem.**

**Nenhuma expansão silenciosa é permitida.**

**A próxima frente é exclusivamente o Dashboard Integrado.**
