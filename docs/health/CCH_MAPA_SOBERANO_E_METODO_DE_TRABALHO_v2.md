# MAPA SOBERANO DO CCH / SAÚDE NO PAINEL CENTRAL

**Documento:** Governança Mestre CCH / Saúde  
**Versão:** v2.0  
**Data:** 07/11/2026  
**Status:** VIGENTE  
**Substitui:** v1.0  
**Objetivo:** manter o CCH como módulo do PAINEL CENTRAL canônico, com Git/GitHub first, banco canônico único, testes oficiais, gates explícitos e nenhuma autoria via Lovable Builder.

---

## 1. IDENTIDADE CANÔNICA

### Produção

- Produto: **PAINEL CENTRAL**
- Lovable Project ID: `1720a410-34cd-4410-995c-8c92c7edf16b`
- GitHub: `amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e`
- Branch canônica: `main`
- HEAD vigente ao emitir v2: `97f108f5dd7ab311403a403b48dfcf93851f8f47`
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
- duplicar domínio ou fonte de verdade.

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
| M8 | Body Evolution | ✅ banco + código + deploy; homologação visual final pendente |

### Frontend Health publicado

Rotas principais:
- `/saude/hoje`
- `/saude/treino`
- `/saude/alimentacao`
- `/saude/evolucao`
- `/saude/perfil`

O CCH está integrado ao mesmo shell/footer do PAINEL CENTRAL.

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

### Pendência M8

**Homologação visual final:**

Abrir em sessão autenticada:
`https://central-mind-tree.lovable.app/saude/evolucao`

Confirmar:
- tela Evolução corporal;
- formulário de medidas;
- estados 7/14/28;
- protocolo fotográfico;
- histórico;
- ausência de erro fatal.

Upload real de foto é uma homologação adicional opcional e deve usar imagem real do usuário, nunca fixture artificial.

---

## 8. PRÓXIMA FASE OFICIAL

A sequência soberana vigente é:

1. ✅ Reconciliação M0→M6
2. ✅ M7 — Nutrition Decision
3. 🟡 M8 — Body Evolution — implantada; fechar prova visual
4. ⛔ **M9 — Sono / Recuperação / Biomarcadores**
5. ⛔ Dashboard Integrado
6. ⛔ Motor Integrado CCH
7. ⛔ Jornada real completa
8. ⛔ Evolução contínua por dados reais

**M9 não começa enquanto a prova visual final da M8 estiver pendente.**

---

## 9. ESCOPO PREVISTO M9

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

Somente após fechar M8 visual:

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

**Este Mapa v2 é o guardrail operacional vigente do CCH.**

Próxima ação permitida:

**fechar a homologação visual de M8 em `/saude/evolucao`.**

Somente depois disso:

**iniciar M9 — Sono / Recuperação / Biomarcadores.**
