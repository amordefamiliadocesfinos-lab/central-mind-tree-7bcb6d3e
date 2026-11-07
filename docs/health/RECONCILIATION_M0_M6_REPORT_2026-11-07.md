# RECONCILIAÇÃO CCH / HEALTH M0→M6 — RELATÓRIO FINAL

**Data:** 07/11/2026  
**Branch:** `reconcile/health-m0-m6-main-20261107`  
**Base canônica:** `main@34ea5066565cfc3ee68c53bfa944b30d4f43e0e0`  
**Repo:** `amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e`

## 1. Ambientes soberanos

- Lovable produção: `1720a410-34cd-4410-995c-8c92c7edf16b`
- Supabase produção: `xkskyutmtlhivvpfxkjg`
- Lovable testes: `864ced4a-32ea-4aad-8491-181eba297291`
- Supabase testes: `enfekhgcsbzovxtqdlwh`
- Não canônicos: `gufyjtdgsdmowubdtdvo`, `fmbarvtlfuvirwqpuydx`

## 2. R1 — Auditoria M0→M4

O Supabase canônico de produção foi usado somente em leitura.

As migrations M0→M4 das branches Health foram aplicadas do zero no ambiente oficial de testes e comparadas com o schema Health existente em produção.

### Fingerprints estruturais

- tabelas Health: **27 produção / 27 testes**
- diferenças de tabelas: **0**
- comparação inclui colunas, tipos, defaults, constraints, índices, RLS, policies e triggers
- funções Health: **13 produção / 13 testes**
- diferenças de funções: **0**
- bucket + policies de storage Health: **5 / 5**
- diferenças de storage: **0**
- grants Health para authenticated/anon: **39 / 39**
- diferenças de grants: **0**

**Conclusão R1:** o M0→M4 presente no banco canônico é semanticamente idêntico ao M0→M4 preservado nas migrations das branches. Essas migrations podem voltar ao histórico Git sem reaplicação em produção.

## 3. R2/R3/R4 — Reconciliação Git

Foi criada uma branch nova a partir do `main` canônico, sem merge bruto das branches antigas:

`reconcile/health-m0-m6-main-20261107`

Foram recuperados por conteúdo:

- migrations M0→M6;
- módulo `src/modules/health/`;
- documentação e rollbacks Health;
- Mapa Soberano do CCH.

Arquivos compartilhados foram reconciliados por delta mínimo sobre o `main` atual:

- `src/App.tsx`: rota `/saude/*`;
- `src/components/GlobalFooterBar.tsx`: entrada Saúde;
- `src/lib/crm/crmGlobalNavigation.ts`: estado ativo em subrotas.

O arquivo `src/integrations/supabase/types.ts` **não foi substituído** pela versão antiga das branches. O `main` já contém tipagem M0→M4; M5/M6 usam uma fronteira local tipada até a geração canônica futura.

## 4. R5 — Ambiente oficial de testes

M0→M4 foram reconstruídos do zero no `PAINEL CENTRAL — TESTES MT`.

M5/M6/lifecycle foram então aplicados sobre essa base.

### Regressão M5/M6

PASS:

- criação/publicação de plano nutricional;
- metas nutricionais;
- criação/publicação de receita;
- snapshot congelado: 200 g = 260 kcal / 5,4 g proteína;
- consumo de 100 g = 130 kcal / 2,7 g proteína;
- idempotência por `client_event_id`;
- diário parcial preserva valor observado sem julgar meta;
- conclusão explícita transforma estado em suficiente quando os dados são conhecidos;
- janela de 7 dias trata dias ausentes como não observados, não zero;
- lifecycle de dia concluído bloqueia mutação silenciosa;
- cross-athlete bloqueado no refresh M6;
- RLS e RPCs mantêm isolamento por atleta.

Produção `xks...` permaneceu somente leitura durante toda a reconciliação.

## 5. R6 — Mobile / integração de interface

Auditoria estática das telas:

- `HealthShell.tsx`
- `HealthProfilePage.tsx`
- `HealthLibraryPage.tsx`
- `HealthProgramPage.tsx`
- `HealthWorkoutPage.tsx`
- `HealthNutritionPage.tsx`

Resultado:

- nenhum width rígido `w-[Npx]` encontrado;
- breakpoints responsivos presentes;
- telas operacionais usam alvos de toque `min-h-11/12` e equivalentes;
- módulo integrado ao shell/rota do Painel, sem segunda aplicação.

## 6. R7 — CI

GitHub Actions run final:

`42409811637`

- `npm ci`: **PASS**
- lint restrito ao domínio Health: **PASS**
- `npm run build` do PAINEL CENTRAL completo: **PASS**
- build Vite: **15,65 s**

### Baseline de lint global

O primeiro CI executou `npm run lint` no repositório inteiro e encontrou 1.104 problemas (986 erros, 118 warnings), distribuídos por código legado e Edge Functions fora do Health.

Isso foi registrado como dívida técnica preexistente do repositório. O escopo Health foi isolado e validado estritamente.

## 7. Governança

Método vigente:

- Git/GitHub first;
- não usar Lovable Builder/agent para construir o CCH;
- banco oficial de testes antes de produção;
- migrations versionadas antes de DDL;
- PR antes de merge;
- gates explícitos para merge, banco e deploy.

## 8. Gates ainda fechados

### Gate A — Merge em main
**NÃO EXECUTADO.**

### Gate B — DDL no Supabase canônico xks...
**NÃO EXECUTADO.**

M0→M4 já existem em produção e não devem ser reaplicados. Após eventual merge, somente migrations ainda ausentes poderão ser consideradas.

### Gate C — Publicação/deploy
**NÃO EXECUTADO.**

## 9. Resultado

R1→R7: **PASS / CONCLUÍDOS**.

A branch reconciliada está pronta para PR Draft contra `main`.

Próximo passo permitido pelo Mapa Soberano:

1. abrir/revisar PR;
2. obter autorização explícita para Gate A;
3. somente após merge, confirmar migration history em produção;
4. obter autorização explícita para Gate B;
5. aplicar apenas migrations ausentes;
6. pós-check;
7. obter autorização explícita para Gate C;
8. publicar e homologar;
9. liberar M7 somente depois da homologação.
