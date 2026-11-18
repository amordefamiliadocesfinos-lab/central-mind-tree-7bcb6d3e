# Parecer soberano — destino canônico do CCH / Saúde

Auditoria somente leitura feita em 07/11/2026 ~19:40 UTC. Nada foi alterado.

## Achado crítico (comprovado, contradiz a premissa)

O banco de PRODUÇÃO `xkskyutmtlhivvpfxkjg` JÁ contém o schema Health M0→M4:
- 27 tabelas `health_*` em `public` (athletes, profiles, goals, catálogos, programs, cch_queue_entries, workout_* etc.).
- 7 migrations registradas em `supabase_migrations.schema_migrations`: 20261107144000 m0_foundation, 151317 m1_profile_goals, 153621 m2_catalogs, 153848 m2_declared_equipment_catalog_fk, 155747 m3_program_cch, 160110 m3_program_rpcs, 161317 m4_live_workout.
- M5 e M6 NÃO estão registradas em produção.

Ao mesmo tempo, o `main` canônico (`cf3693cc…`, 07/11 16:19 UTC) NÃO contém `src/modules/health` nem nenhum arquivo de migration Health. Ou seja: produção tem schema sem código rastreável no main — viola a regra "migration só após existir no repositório canônico". Origem/autor da aplicação não comprovados (fora das ferramentas disponíveis).

## 1. Identidade canônica
- Lovable Project ID: `1720a410-34cd-4410-995c-8c92c7edf16b` (workspace Amor de Familia).
- GitHub: `amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e`, branch `main`.
- HEAD: `main` no GitHub = `cf3693ccda9c0bea68c7c1c73be714a660f6cf4d` = HEAD do Lovable (sincronizados).
- Backend produção: `xkskyutmtlhivvpfxkjg` (confirmado em `supabase/config.toml`).
- URL: https://central-mind-tree.lovable.app
- Testes: projeto Lovable "PAINEL CENTRAL — TESTES MT", banco `enfekhgcsbzovxtqdlwh` (dado das instruções; não verificado nesta auditoria).

## 2. Repositórios
- Canônico único: `central-mind-tree-7bcb6d3e` / `main`.
- Históricos, não usar como origem: `central-mind-tree`, `central-mind-tree-bc2f05ee`.
- Bancos não canônicos: `gufyjtdgsdmowubdtdvo`, `fmbarvtlfuvirwqpuydx` — tratar só como sandbox.
- Fluxo: GitHub/Codex → PR para `main` → Lovable puxa `main` automaticamente. Nunca force-push; rebase/merge normal.

## 3. Health existente
- Código no main: inexistente (sem módulo, rotas, hooks, tipos, entrada no footer).
- Código nas branches (GitHub): m0 `bfcfb693`, m1 `8b55ba66`, m2 `80451cbf`, m3 `27627f5f`, m4 `01318218`, m5 `cf471b40`, m6 `b3b8212c` — empilhadas, nenhuma mergeada.
  Obs.: esses HEADs diferem dos SHAs validados antes (ex.: m4 validada em `ee4f8bfa`); conferir se os nomes de branch estão deslocados.
- Banco produção: M0→M4 aplicados (acima). Saúde não visível no Painel publicado (não há código).

## 4. Trabalho fora do canônico
- Incorporado ao main: nada.
- Reconciliar: as 7 branches feat/health-*.
- Migrations a reaproveitar: os 7 arquivos M0→M4 com os MESMOS timestamps já registrados em produção (precisam ser idênticos byte a byte ao que foi aplicado), mais M5 e M6 ainda não aplicadas.
- guf…/fmbar…: somente sandbox; nada lá conta como implantação.
- Risco de conflito: alto se alguém reaplicar M0→M4 (tabelas já existem) ou se os arquivos das branches divergirem do que rodou em produção.

## 5. Destino correto
- Módulo `src/modules/health/` (pages, hooks, components), rota `/saude/*` no roteador existente do Painel.
- Shell: shell interno com 5 itens + item "Saúde" no overflow do GlobalFooterBar (padrão já validado).
- Banco: tabelas `health_*` em `public` do backend produção; RLS por `health_athlete_access` + `auth.uid()`; papéis via `user_roles`/`has_role`.
- Integrações futuras via Rotina (sessões CCH como tarefas) e Hub, sem acoplamento direto.
- Mobile-first já validado (320–430px, alvos ≥44px).
- Rollout: feature flag/acesso restrito por atleta até homologação.

## 6. Sequência de reconciliação
1. Congelar: nenhuma nova migration/deploy Health em qualquer banco.
2. Inventariar SQL aplicado em produção (definições de tabelas/funções/policies, somente leitura) e comparar com os arquivos M0→M4 de cada branch.
3. Corrigir a pilha de branches (confirmar SHA final de cada uma) e consolidar em uma branch `reconcile/health-m0-m6-main` baseada em `main` atual, sem force-push.
4. Garantir que os arquivos M0→M4 reproduzam exatamente o que está em produção; M5/M6 como migrations novas.
5. Validar migrations em banco de teste/sandbox limpo (nunca produção): aplicar M0→M6 do zero + diff de schema contra produção para M0→M4.
6. CI: npm ci, lint, build, testes; visual mobile.
7. PR → `main` (gate). Lovable sincroniza; Saúde atrás de flag.
8. Aplicar SOMENTE M5/M6 em produção (gate), após confirmar Project Ref.
9. Publicar frontend (gate) e homologar com usuário real.
10. Sempre: toda mudança via PR no canônico; banco só com migration rastreada no main.

## 7. Gates (exigem autorização explícita)
- Merge em `main`.
- Qualquer DDL/migration em `xkskyutmtlhivvpfxkjg` (inclui M5/M6 e qualquer correção de M0→M4).
- Publicação/deploy de frontend ou Edge Functions.
- Qualquer DROP, reescrita de histórico, reset de branch ou remoção de registro de migration.

## MAPA SOBERANO PARA O CCH
```text
Lovable prod   1720a410-34cd-4410-995c-8c92c7edf16b
GitHub         amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e @ main (cf3693cc)
Backend prod   xkskyutmtlhivvpfxkjg  (Health M0-M4 JÁ aplicado; M5-M6 não)
URL            https://central-mind-tree.lovable.app
Testes         TESTES MT / enfekhgcsbzovxtqdlwh
Sandbox only   gufyjtdgsdmowubdtdvo, fmbarvtlfuvirwqpuydx
Não usar       central-mind-tree, central-mind-tree-bc2f05ee
Destino        src/modules/health + /saude/* + footer overflow + flag
Sequência      congelar -> comparar SQL prod x arquivos -> branch reconcile
               -> validar em sandbox -> CI -> [GATE merge] -> [GATE M5/M6]
               -> [GATE publicar] -> homologar
```

Ao aprovar, o próximo passo seria só o item 2 (comparação somente leitura do SQL de produção com os arquivos das branches).
