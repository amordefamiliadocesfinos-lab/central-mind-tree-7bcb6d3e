# MAPA SOBERANO DO CCH / SAÚDE NO PAINEL CENTRAL

**Documento:** Governança Mestre CCH / Saúde  
**Versão:** v3.5 — FROZEN  
**Data:** 08/11/2026  
**Status:** VIGENTE · FROZEN  
**Substitui:** v3.4 FROZEN  
**Base reconciliada:** `main@734048b0b859b54ac644119700be6f7c24d2609c`  
**Objetivo:** refletir o estado real do CCH após a conclusão da camada de desenvolvimento F10→F13, mantendo ativação operacional/testes adiados sem alterar escopo, sequência ou autoridade.

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

### TESTES MT canônico

- Lovable Project ID: `864ced4a-32ea-4aad-8491-181eba297291`
- Supabase: `enfekhgcsbzovxtqdlwh`

### Não canônicos / sandbox

- `gufyjtdgsdmowubdtdvo`
- `fmbarvtlfuvirwqpuydx`
- repositórios históricos `central-mind-tree` e `central-mind-tree-bc2f05ee`

Nunca usar sandbox ou projeto histórico como fonte soberana nem como substituto silencioso do TESTES MT.

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

## 3. ESTADO M0→M9

M0→M9 permanecem a fundação homologada do CCH.

| Fase | Nome | Estado |
|---|---|---|
| M0 | Foundation | ✅ homologada |
| M1 | Profile & Goals | ✅ homologada |
| M2 | Catalogs | ✅ homologada |
| M3 | Program CCH | ✅ homologada |
| M4 | Live Workout | ✅ homologada |
| M5 | Nutrition Foundation | ✅ homologada |
| M6 | Nutrition State | ✅ homologada |
| M7 | Nutrition Decision | ✅ homologada |
| M8 | Body Evolution | ✅ homologada |
| M9 | Sleep/Recovery + Exams/Biomarkers | ✅ homologada |

Nenhuma dessas fases deve ser reaberta como nova arquitetura sem necessidade objetiva, versionada e aprovada.

---

## 4. ESCOPO MACRO CONGELADO

O escopo posterior a M9 contém somente:

1. **F10 — Dashboard Integrado**
2. **F11 — Motor Integrado CCH**
3. **F12 — Jornada real completa**
4. **F13 — Evolução contínua por dados reais**

Esse conjunto está **implementado em Git**.

Não existe F14 aprovada.

### Também permanecem dentro do escopo

- manutenção corretiva M0→M9;
- hardening F10→F13;
- segurança;
- performance;
- acessibilidade;
- responsividade;
- UX sem mudança de autoridade;
- observabilidade;
- documentação;
- correções de integridade;
- ativação futura dos gates já previstos.

### Fora do escopo sem nova versão formal

- novo aplicativo Health separado;
- nova macrofase;
- novo especialista/domínio;
- motor diagnóstico;
- prescrição médica automática;
- alteração automática de medicação;
- autoajuste de treino/dieta/meta;
- score clínico/global governando decisão sem contrato;
- IA como autoridade final crítica;
- integração externa como nova fonte soberana;
- compartilhamento público de dados/fotos Health;
- duplicação de fonte de verdade.

---

## 5. ESTADO REAL F10→F13

### F10 — Dashboard Integrado

- arquitetura: ✅
- implementação: ✅
- PR #494: ✅ mergeada
- merge: `0852b8204d8fbb8085fee8aaa7073dd64d8d727e`
- CI: ✅
- deploy anterior: ✅
- desktop produção: ✅
- mobile preview: ✅
- prova visual mobile diretamente em produção: ⏳ pendente

F10 é leitura/síntese.

Não cria score global, não preenche ausência, não altera especialistas.

### F11 — Motor Integrado CCH

- arquitetura: ✅
- implementação: ✅
- PR #502: ✅ mergeada
- merge: `a91442207bb1ef983dc0aa5fedd352206baae158`
- CI descartável: ✅
- TESTES MT: ⏳ adiado
- Gate B: ⛔
- Gate C/deploy dependente: ⛔
- homologação operacional: ⏳

F11 preserva:

- suficiência;
- decisão pausada;
- reason codes;
- algoritmo versionado;
- ledger auditável;
- separação fato → estado → decisão → ação;
- nenhuma decisão clínica automática;
- nenhuma alteração automática de treino/dieta.

### F12 — Jornada real completa

- arquitetura: ✅
- PR #504: ✅ mergeada
- implementação: ✅
- PR #505: ✅ mergeada
- merge implementação: `739630bac2a08bcfe321e76b40dc187d05e4000f`
- CI: ✅
- homologação ponta a ponta real: ⏳ adiada

F12 organiza a experiência longitudinal existente.

Não se torna source of truth de especialista.

Quando F11 não está operacional no ambiente, a jornada deve indicar o bloqueio explicitamente em vez de inventar decisão.

### F13 — Evolução contínua por dados reais

- arquitetura: ✅
- PR #508: ✅ mergeada
- implementação: ✅
- PR #509: ✅ mergeada
- merge implementação: `121d27a380f684168ad749bbdfe4475340597181`
- CI/regressões: ✅
- infraestrutura TESTES MT: ✅
- PR #510: ✅ mergeada
- checkpoint TESTES MT: ✅
- PR #511: ✅ mergeada
- TESTES MT real: ⏳ adiado
- Gate B: ⛔
- Gate C: ⛔
- homologação longitudinal real: ⏳

F13 v1:

- compara 28 dias atuais × 28 dias anteriores;
- usa treino, alimentação, evolução corporal e recuperação;
- usa meta/fase como contexto;
- usa F11 como contexto;
- persiste snapshot e outcome humano;
- preserva idempotência/supersession;
- não cria score global;
- não infere causalidade;
- não faz auto-replanning;
- não altera treino, dieta ou meta.

---

## 6. ESTADO CONSOLIDADO

| Frente | Arquitetura | Código | CI | TESTES MT | Banco produção | Deploy/Homologação |
|---|---:|---:|---:|---:|---:|---:|
| F10 | ✅ | ✅ | ✅ | n/a | ✅ anterior | ⚠️ mobile prod. pendente |
| F11 | ✅ | ✅ | ✅ | ⏳ | ⛔ | ⛔ |
| F12 | ✅ | ✅ | ✅ | dependente | n/a próprio | ⏳ |
| F13 | ✅ | ✅ | ✅ | ⏳ | ⛔ | ⛔ |

**Interpretação soberana:** desenvolvimento F10→F13 concluído; ativação operacional incompleta e deliberadamente adiada.

---

## 7. POLÍTICA DE TESTES ADIADOS

Por decisão explícita do usuário em 08/11/2026:

- TESTES MT não será executado agora;
- isso não invalida desenvolvimento já integrado;
- isso não converte teste não realizado em PASS;
- isso não autoriza banco produção;
- isso não autoriza deploy dependente de schema ausente;
- isso não autoriza homologação por inferência.

Enquanto os testes estiverem adiados:

### Permitido

- documentação;
- auditoria estática;
- hardening;
- manutenção corretiva;
- segurança/performance;
- UX que preserve contratos;
- preparação de backlog de ativação.

### Bloqueado

- Gate B de F11/F13;
- migration de produção correspondente;
- Gate C dependente desses backends;
- homologação real F12/F13;
- criação de F14.

---

## 8. MÉTODO OFICIAL

Para nova mudança dentro do escopo:

1. confirmar identidade canônica;
2. ler `main` e registrar SHA base;
3. confirmar se é manutenção/hardening ou mudança arquitetural;
4. branch específica a partir da `main`;
5. implementação apenas na branch;
6. migration versionada quando houver DDL;
7. CI/validação proporcional à mudança;
8. PR;
9. Gate A quando aplicável;
10. TESTES MT antes de Gate B quando houver migration/DDL;
11. Gate B explícito;
12. pós-check;
13. Gate C explícito;
14. homologação real;
15. fechamento documental.

Testes podem ser deliberadamente adiados, mas gates de produção não podem ser atravessados fingindo que foram executados.

---

## 9. GATES

### Gate A — Git/merge

Pode ocorrer quando a mudança está reconciliada, revisada e dentro do escopo.

### Gate B — Banco produção

Obrigatório para DDL/migration de produção.

Exige:

- migration em `main`;
- TESTES MT PASS real;
- ausência/estado correto no migration history;
- autorização explícita.

### Gate C — Deploy

Exige dependências operacionais satisfeitas e autorização explícita.

### Gate D — Destrutivo

DROP, reset, force push, perda de histórico/dado ou remoção sensível exigem autorização específica.

---

## 10. PRINCÍPIOS INVARIANTES

- `unknown != zero`;
- planejamento != execução;
- fato != observação != inferência != decisão != ação;
- histórico não é reescrito silenciosamente;
- correção por supersession/void quando aplicável;
- decisão exige suficiência;
- estado pausado é resultado válido;
- algoritmos são versionados;
- IA auxilia, não governa decisão crítica;
- especialista não invade domínio vizinho;
- associação != causalidade;
- wearable != verdade clínica;
- documento extraído != fato clínico confirmado;
- biomarcador != diagnóstico;
- dado corporal != recomendação nutricional sem contrato;
- estado de sono != decisão de treino sem contrato;
- nenhum valor ausente é preenchido para completar interface.

---

## 11. ROTAS HEALTH

Rotas principais vigentes:

- `/saude/hoje`
- `/saude/treino`
- `/saude/treino/programa`
- `/saude/alimentacao`
- `/saude/evolucao`
- `/saude/recuperacao`
- `/saude/exames`
- `/saude/revisao`
- `/saude/perfil`
- `/saude/biblioteca`

`/academia` permanece separado conforme arquitetura vigente.

A existência da rota `/saude/revisao` em Git não significa que o backend F13 esteja liberado em produção antes dos gates.

---

## 12. BACKLOG DE ATIVAÇÃO

O backlog de ativação está congelado em:

`docs/health/CCH_OPERATIONAL_ACTIVATION_BACKLOG_2026-11-08.md`

Ele é um backlog de operação, **não uma nova fase**.

A retomada futura deve começar pelos gates pendentes já documentados, e não por arquitetura nova.

---

## 13. REGRA DE NÃO EXPANSÃO

- não inventar F14;
- não abrir nova macrofase por conveniência;
- achado novo entra primeiro como candidato;
- candidato não vira escopo sem alteração formal do mapa;
- melhoria local não pode mudar autoridade;
- “seria interessante” não equivale a requisito aprovado.

---

## 14. CONTROLE DE MUDANÇA

Este documento é **FROZEN**.

Para alterar escopo, sequência ou autoridade:

1. declarar necessidade;
2. criar proposta versionada;
3. demonstrar impacto;
4. manter baseline;
5. abrir PR específica;
6. obter autorização;
7. somente após merge a alteração se torna soberana.

Atualização de estado real sem expansão de escopo também deve ser versionada para evitar contradição documental.

---

## 15. PRÓXIMA AÇÃO PERMITIDA

Enquanto o usuário mantiver testes/ativação adiados:

**não existe próxima macrofase.**

São permitidos apenas:

- manutenção;
- hardening;
- correções;
- documentação;
- melhoria de UX dentro dos contratos;
- preparação operacional futura.

Quando o usuário decidir retomar ativação, usar o backlog congelado e os gates existentes.

---

## 16. DIRETRIZ FINAL

**M0→M9 permanecem homologados.**

**F10→F13 estão implementados em Git.**

**A ativação operacional de F11/F12/F13 permanece incompleta e deliberadamente adiada.**

**Nenhum PASS operacional pode ser inferido.**

**F14 não existe.**

**O escopo continua congelado.**
