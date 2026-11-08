> **HISTÓRICO:** esta v2 permanece preservada como baseline. Após merge autorizado da v3 FROZEN, a fonte soberana passa a ser `docs/health/CCH_MAPA_SOBERANO_E_METODO_DE_TRABALHO_v3_FROZEN.md`. Não ampliar escopo a partir desta v2.

# MAPA SOBERANO DO CCH / SAÚDE NO PAINEL CENTRAL

**Documento:** Governança Mestre CCH / Saúde  
**Versão:** v2.0  
**Data:** 07/11/2026  
**Status:** VIGENTE  
**Substitui:** v1.0  
**Vigência da v2:** merge autorizado da PR #486 em `main`, commit `4d6ebbeb71f39b9f3c39a07604e6e1f6a2fe54ae`  
**Objetivo:** manter o CCH como módulo do PAINEL CENTRAL canônico, com Git/GitHub first, banco canônico único, testes oficiais, gates explícitos e nenhuma autoria via Lovable Builder.

---

## 1. IDENTIDADE CANÔNICA

### Produção

- Produto: **PAINEL CENTRAL**
- Lovable Project ID: `1720a410-34cd-4410-995c-8c92c7edf16b`
- GitHub: `amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e`
- Branch canônica: `main`
- HEAD de referência na emissão inicial da v2: `97f108f5dd7ab311403a403b48dfcf93851f8f47`
- Merge que tornou a v2 vigente: `4d6ebbeb71f39b9f3c39a07604e6e1f6a2fe54ae`
- Supabase produção: `xkskyutmtlhivvpfxkjg`
- URL: `https://central-mind-tree.lovable.app`

### Testes oficiais

- Lovable: **PAINEL CENTRAL — TESTES MT**
- Lovable Project ID: `864ced4a-32ea-4aad-8491-181eba297291`
- Supabase: `enfekhgcsbzovxtqdlwh`

### Não canônicos / sandbox

- `gufyjtdgsdmowubdtdvo`
- `fmbarvtlfuvirwqpuydx`
- repositórios históricos `central-mind-tree` e `central-mind-tree-bc2f05ee`

Nunca usar não canônicos como fonte oficial.

---

## 2. HIERARQUIA DAS FONTES

Quando houver conflito:

1. identidade canônica;
2. Git/GitHub `main`, commits, PRs e migrations;
3. banco canônico e `schema_migrations`;
4. este Mapa Soberano vigente + arquiteturas/ADRs versionados;
5. TESTES MT;
6. preview, logs e screenshots;
7. memória de chat ou suposição.

Fonte inferior nunca corrige silenciosamente fonte superior.

---

## 3. MÉTODO OFICIAL

### Git first

Toda evolução Health/CCH:

1. confirmar projeto/repo/Supabase;
2. ler `main` e registrar SHA base;
3. criar branch específica;
4. implementar somente na branch;
5. versionar migrations antes de aplicá-las;
6. aplicar/testar primeiro no TESTES MT;
7. validar RLS, cross-athlete e segurança;
8. rodar CI;
9. abrir PR Draft;
10. Gate A para merge;
11. Gate B para banco canônico;
12. pós-check produção;
13. Gate C para deploy;
14. homologar produção real;
15. só então liberar a fase seguinte.

### Proibido

- Lovable Builder/agent para escrever CCH;
- SQL de produção sem migration versionada;
- reaplicar migration já aplicada;
- force push/reset destrutivo;
- reescrever migration aplicada;
- duplicar domínio ou fonte de verdade;
- avançar com `main` divergente da SHA base sem reconciliação;
- remover ou desativar infraestrutura Lovable necessária ao projeto sem evidência técnica de incompatibilidade.

### Permitido na Lovable

Somente:
- leitura/metadados;
- preview;
- publicação depois dos gates.

---

## 4. GATES

### Gate A — Merge

Qualquer PR Health/CCH entrando em `main` exige autorização explícita.

### Gate B — Banco

Qualquer DDL/migration em `xkskyutmtlhivvpfxkjg` exige:
- migration em `main`;
- PASS no TESTES MT;
- confirmação de ausência no histórico;
- autorização explícita.

### Gate C — Deploy

Publicação do PAINEL CENTRAL exige autorização explícita após merge e banco.

### Gate D — Destrutivo

Sempre exige autorização específica para DROP, reset, force push, perda ou reescrita de histórico/dados.

---

## 5. ESTADO REAL ATUAL — M0→M8

### Produção canônica

| Fase | Nome | Estado |
|---|---|---|
| M0 | Foundation | ✅ produção |
| M1 | Profile & Goals | ✅ produção |
| M2 | Catalogs | ✅ produção |
| M3 | Program CCH | ✅ produção |
| M4 | Live Workout | ✅ produção |
| M5 | Nutrition Foundation | ✅ produção |
| M6 | Nutrition State | ✅ produção |
| M7 | Nutrition Decision | ✅ produção |
| M8 | Body Evolution | ✅ banco + código + deploy + homologação visual final |

### Frontend Health publicado

Rotas principais:
- `/saude/hoje`
- `/saude/treino`
- `/saude/alimentacao`
- `/saude/evolucao`
- `/saude/perfil`

O CCH está integrado ao mesmo shell/footer do PAINEL CENTRAL.

### 5.1 Régua obrigatória de estado

Nenhuma fase pode ser resumida apenas como "pronta" ou "em produção". Para toda continuidade do CCH, registrar separadamente:

| Estado | Significado |
|---|---|
| Planejado | existe no mapa/arquitetura, sem afirmar existência técnica |
| Implementado | código/SQL existe em branch ou `main` |
| Testado | passou pelos testes definidos no ambiente oficial |
| Integrado | foi incorporado à `main` por merge autorizado |
| Banco produção | migrations aplicáveis foram confirmadas/aplicadas no Supabase canônico |
| Deploy | código integrado foi publicado no PAINEL CENTRAL canônico |
| Homologado | comportamento foi comprovado em sessão/uso real conforme critérios da fase |

Regras:

- um estado posterior não deve ser inferido automaticamente a partir de um anterior;
- `mergeable: true` não significa revisado, aprovado, integrado ou homologado;
- relatório de teste não prova deploy;
- migration no Git não prova aplicação no banco;
- deploy não prova funcionamento real;
- homologação deve registrar exatamente o que foi comprovado e o que permaneceu pendente.

Aplicação ao ponto atual do mapa:

- M0→M7: tratados como fases já integradas/implantadas conforme os respectivos registros de merge, migrations, pós-checks e homologações preservados;
- M8: implementada, testada, integrada à `main`, aplicada no banco canônico, publicada e **homologada visualmente em sessão autenticada**;
- M9: critério de entrada satisfeito; arquitetura e desenho técnico v1 concluídos na PR #487, ainda não integrados à `main`; implementação real não iniciada;
- fases posteriores: apenas previstas/reservadas até seus respectivos critérios de entrada serem satisfeitos.

---

## 6. RESUMO DAS FASES

### M0 — Foundation

Atleta, acesso, papéis, RLS, bucket privado Health e funções de autorização.

### M1 — Profile & Goals

Perfil longitudinal, altura, metas, fases, preferências e consentimentos.

### M2 — Catalogs

Exercícios, músculos, equipamentos, alimentos e fontes.

### M3 — Program CCH

Programas/versionamento, prioridades e RPCs de publicação.

### M4 — Live Workout

Sessões, exercícios, séries, eventos, idempotência e histórico append-only.

### M5 — Nutrition Foundation

Planos, metas, receitas versionadas, snapshots, diário alimentar e lifecycle.

### M6 — Nutrition State

Estado diário e rolling, cobertura, confiança, unknown != zero.

### M7 — Nutrition Decision

Decision Ledger, Data Sufficiency Contract, decisões explicáveis e `DECISION_PAUSED`.

M7 v1 não altera calorias automaticamente.

### M8 — Body Evolution

Avaliações corporais, medidas, tendência 7/14/28, fotos privadas, histórico, supersession/void e estado corporal.

M8 não interpreta foto como composição corporal e não usa somatotipo como driver de decisão.

---

## 7. ESTADO ESPECÍFICO M8

### Produção

Merge:
`97f108f5dd7ab311403a403b48dfcf93851f8f47`

Migrations aplicadas:
- `20261107220000_health_m8_body_foundation`
- `20261107220100_health_m8_body_rpcs`
- `20261107220200_health_m8_body_security`
- `20261107220300_health_m8_photo_registry`
- `20261107220400_health_m8_integrity`

Deploy:
`1b43a5f5-b758-4cee-bdf0-0067eb1977b1`

Pós-check:
- 5/5 tabelas M8 iguais ao TESTES MT;
- 5/5 RPCs iguais;
- grants iguais;
- RLS ativo;
- anon sem grants/EXECUTE;
- Storage `health-private` preservado.

### Perfil real

Para o perfil real do usuário em 07/11/2026:

- janelas 7/14/28 criadas;
- nenhum dado corporal artificial inserido;
- coverage = `unobserved`;
- confidence = `low`;
- peso/cintura/gordura/IMC permanecem desconhecidos.

Consentimentos:
- `private_media_storage = granted`;
- `media_analysis = granted`.

### Homologação visual M8 — CONCLUÍDA em 07/11/2026

Prova em sessão autenticada no PAINEL CENTRAL canônico:

`https://central-mind-tree.lovable.app/saude/evolucao`

Confirmado diretamente na rota publicada:

- título **Evolução corporal** carregado;
- formulário **Registrar avaliação** presente;
- campos de peso, cintura, gordura corporal, quadril, peito e pescoço presentes;
- métodos de peso/gordura e condição da pesagem presentes;
- bloco **Estado corporal** carregado;
- janelas **7 / 14 / 28 dias** carregadas;
- estado atual preserva `unknown != zero`: `unobserved · low`, sem inventar peso, cintura, tendência ou IMC;
- reason codes apresentados em linguagem compreensível;
- bloco **Protocolo de fotos** carregado;
- quatro ângulos do protocolo fotográfico presentes;
- indicação explícita de armazenamento privado das imagens;
- bloco **Histórico de avaliações** carregado;
- ausência de avaliação artificial;
- ausência de erro fatal visível na rota;
- conta autenticada confirmada no shell do PAINEL CENTRAL.

O upload de foto real permanece **opcional para homologação adicional**, não sendo requisito para encerrar M8. Nenhuma fixture, foto artificial ou medida corporal foi criada para produzir esta prova.

**Resultado:** M8 homologada visualmente. O bloqueio específico que impedia a abertura formal da M9 foi removido.
---

## 8. PRÓXIMA FASE OFICIAL

A sequência soberana vigente é:

1. ✅ Reconciliação M0→M6
2. ✅ M7 — Nutrition Decision
3. ✅ M8 — Body Evolution — implantada e homologada visualmente
4. 🟡 **M9 — Sono / Recuperação / Biomarcadores — aberta somente na camada documental; sem implementação**
5. ⛔ Dashboard Integrado
6. ⛔ Motor Integrado CCH
7. ⛔ Jornada real completa
8. ⛔ Evolução contínua por dados reais

**A condição de entrada vinculada à prova visual da M8 foi satisfeita em 07/11/2026. M9 foi formalmente aberta apenas na camada documental na branch `docs/health-m9-architecture-20261107`; código, migrations, banco e deploy continuam não iniciados e sujeitos aos gates aplicáveis.**

As etapas Dashboard Integrado, Motor Integrado CCH, Jornada real completa e Evolução contínua preservam a sequência aprovada no v1, mas permanecem **frentes reservadas, não escopo executável**. Antes de iniciar cada uma, deverá existir arquitetura/contrato versionado da fase e os gates aplicáveis; este mapa não antecipa nova autoridade nem decisão funcional.

---

## 9. ESCOPO PREVISTO M9

### Estado documental M9 — 07/11/2026

Arquiteturas candidatas abertas em branch própria:

- `docs/health/M9A_SLEEP_RECOVERY_ARCHITECTURE.md`;
- `docs/health/M9B_EXAMS_BIOMARKERS_ARCHITECTURE.md`;
- `docs/health/M9_OPENING_AND_ACCEPTANCE_2026-11-07.md`;
- `docs/health/M9_ARCHITECTURAL_DECISIONS_V1.md`;
- `docs/health/M9_TECHNICAL_DESIGN_V1.md`;
- `docs/health/M9_SECURITY_RLS_MATRIX_V1.md`;
- `docs/health/M9_TEST_PLAN_V1.md`;
- `docs/health/M9_MOBILE_UI_SPEC_V1.md`.

Estado:
- herança dos especialistas 04 e 05 concluída;
- fronteiras M9A/M9B documentadas;
- critérios de aceitação documentados;
- sete decisões arquiteturais v1 resolvidas e congeladas;
- desenho técnico v1 de schema/RPCs concluído;
- matriz RLS/grants/cross-athlete concluída;
- plano de testes TESTES MT concluído;
- especificação mobile concluída;
- rotas finais definidas: `/saude/recuperacao` e `/saude/exames`;
- nenhuma migration real criada;
- nenhum banco alterado;
- nenhum código funcional alterado;
- nenhum deploy realizado;
- nenhum dado real de Saúde inserido.

A documentação desta branch somente altera o Mapa Soberano vigente após merge autorizado pelo Gate A.



M9 deve respeitar especialistas e não misturar domínios.

### M9A — Sono / Recuperação

Fonte especializada:
`04 — SONO E RECUPERAÇÃO`

Objetos esperados:
- duração do sono;
- horário de dormir/acordar;
- despertares;
- qualidade subjetiva;
- recuperação percebida;
- fadiga;
- dor muscular;
- prontidão;
- fontes manuais/importadas;
- estado 7/14/28;
- coverage/confidence/reason codes.

### M9B — Exames / Biomarcadores

Fonte especializada:
`05 — SAÚDE — EXAMES E BIOMARCADORES`

Objetos esperados:
- exames;
- biomarcadores;
- unidade e faixa de referência do laboratório;
- data/coleta;
- fonte;
- histórico;
- flags estruturais sem diagnóstico automático;
- vínculo com documentos quando aplicável.

### Fronteira

M9 registra fatos e estados.

Não:
- diagnostica doença;
- substitui médico;
- altera dieta/treino automaticamente;
- mistura sono com biomarcadores em uma tabela genérica sem fonte/semântica.

---

## 10. ORDEM DE IMPLEMENTAÇÃO M9

Com M8 visual encerrada, a abertura formal de M9 deve seguir:

1. ler chats/documentos especialistas 04 e 05;
2. inventariar dados já existentes;
3. produzir arquitetura M9A/M9B;
4. branch a partir do `main` vigente;
5. migrations;
6. TESTES MT;
7. segurança/RLS/cross-athlete;
8. frontend mobile;
9. CI;
10. PR Draft;
11. Gate A;
12. Gate B;
13. pós-check;
14. Gate C;
15. homologação real.

---

## 11. PRINCÍPIOS CCH VIGENTES

- `unknown != zero`;
- planejamento != execução;
- planejado != implementado != testado != implantado != homologado em uso real;
- fato != observação != inferência != decisão != ação;
- histórico não é reescrito silenciosamente;
- correção por supersession quando necessário;
- decisão exige suficiência;
- `DECISION_PAUSED` é resultado válido;
- algoritmos e parameter sets são versionados;
- IA auxilia; regras determinísticas governam decisões críticas;
- especialista não invade outro domínio;
- nenhuma recomendação automática sem evidência suficiente;
- dado corporal não vira recomendação nutricional sem contrato explícito;
- saúde/biomarcador não vira diagnóstico automático.

---

## 12. CHECKLIST OPERACIONAL

```text
[ ] Projeto canônico confirmado
[ ] Repo/main confirmados
[ ] SHA base registrado
[ ] main sem divergência paralela não reconciliada desde a SHA base
[ ] TESTES MT confirmado
[ ] Produção confirmada
[ ] Branch criada do main
[ ] Escopo escrito
[ ] Sem Lovable Builder
[ ] Migration versionada antes do banco
[ ] Testes oficiais PASS
[ ] RLS/cross-athlete PASS
[ ] Advisors revisados
[ ] npm ci PASS
[ ] lint Health PASS
[ ] build completo PASS
[ ] mobile/touch PASS
[ ] diff restrito
[ ] PR Draft
[ ] Gate A autorizado
[ ] Gate B autorizado
[ ] pós-check produção
[ ] Gate C autorizado
[ ] homologação real
[ ] documentação atualizada
```

---

## 13. CONTINUIDADE ENTRE CHATS

Ao transferir trabalho, fornecer sempre:

1. este Mapa v2;
2. arquitetura da fase;
3. branch/PR;
4. SHA base;
5. migration history;
6. estado dos gates;
7. pendência exata.

Não usar memória solta como mecanismo de transferência.

---

## 14. DIRETRIZ FINAL

**Este Mapa v2 é o guardrail operacional vigente do CCH desde o merge autorizado da PR #486 em `main`.**

Próxima ação permitida:

**M8 está encerrada e homologada visualmente. M9 foi aberta na camada documental em branch própria.**

Próxima ação permitida, sem antecipar implementação:

**a revisão arquitetural, o desenho técnico e a revisão final documental da M9A/M9B foram concluídos na PR #487. A próxima decisão de governança é o Gate A documental da PR #487. A implementação real permanece bloqueada e deverá ocorrer em branch própria após incorporação autorizada desta documentação, com migrations geradas, TESTES MT primeiro, segurança e CI antes de qualquer produção.**
