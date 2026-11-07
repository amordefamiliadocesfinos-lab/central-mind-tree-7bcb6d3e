# M1 Acceptance Criteria — Identidade, Perfil e Objetivos

Data: 07/11/2026

## Escopo

M1 transforma a fundação M0 em um perfil de atleta utilizável, sem antecipar domínios futuros.

Incluído:
- perfil básico estável;
- objetivo principal;
- fase atual;
- local principal de treino;
- equipamento declarado/contextual;
- preferências de sessão;
- consentimentos versionados e append-only.

Excluído:
- peso, medidas e fotos (Body/Evolução);
- catálogo universal de equipamentos (M2);
- prescrição/execução de treino (M3/M4);
- Motor CCH completo (M5+);
- Nutrição funcional;
- AI Coach.

## Critérios

| ID | Critério |
|---|---|
| M1-AC-01 | Migration oficial gerada pelo Supabase CLI e versionada |
| M1-AC-02 | 7 superfícies M1 com RLS habilitada |
| M1-AC-03 | grants mínimos; anon sem acesso |
| M1-AC-04 | consentimentos append-only para clientes autenticados |
| M1-AC-05 | meta/fase/local preservam integridade por athlete_id |
| M1-AC-06 | uma meta primária ativa por atleta |
| M1-AC-07 | uma fase ativa por atleta |
| M1-AC-08 | um local primário ativo por atleta |
| M1-AC-09 | Perfil funcional lê e grava via Supabase/RLS |
| M1-AC-10 | nenhum valor pessoal é criado automaticamente |
| M1-AC-11 | mobile 320–430px sem overflow/campos cortados |
| M1-AC-12 | controles principais >=44px |
| M1-AC-13 | lint M1 + build PASS |
| M1-AC-14 | testes sintéticos não persistem dados |
| M1-AC-15 | migration ledger e rollback presentes |

## Regra de autoridade

- Body é soberano para peso, medidas e fotos.
- M2 será soberano para catálogo universal de equipamentos.
- M1 registra apenas contexto/equipamento declarado pelo atleta.
- Consentimento é evento histórico; não é sobrescrito.
