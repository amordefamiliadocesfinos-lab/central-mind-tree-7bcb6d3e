# M2 Acceptance Criteria — Catálogos

Data: 07/11/2026

## Escopo

M2 cria catálogos globais e versionáveis para Treino e a fundação do catálogo nutricional.

### Treino
- grupos musculares;
- equipamentos;
- exercícios;
- exercício × músculo;
- exercício × equipamento;
- equivalências provisórias.

### Nutrição inicial
- fontes nutricionais;
- alimentos com proveniência/versionamento;
- sem macros aproximados inventados.

## Critérios

| ID | Critério |
|---|---|
| M2-AC-01 | migrations oficiais geradas pelo Supabase CLI |
| M2-AC-02 | catálogos globais com RLS habilitada |
| M2-AC-03 | authenticated somente SELECT; anon sem acesso |
| M2-AC-04 | catálogo de treino com seeds iniciais |
| M2-AC-05 | Exercise×Muscle categórico, sem falsa precisão numérica |
| M2-AC-06 | Exercise×Equipment normalizado |
| M2-AC-07 | equivalências marcadas como provisórias |
| M2-AC-08 | declared equipment ligado ao catálogo por FK opcional |
| M2-AC-09 | fontes TBCA/USDA registradas com proveniência |
| M2-AC-10 | nenhum alimento/macro criado sem importação rastreável |
| M2-AC-11 | Biblioteca funcional lê catálogos via Supabase |
| M2-AC-12 | busca por exercício/músculo/equipamento |
| M2-AC-13 | Nutrição mostra fontes e estado de importação |
| M2-AC-14 | mobile 320–430px |
| M2-AC-15 | lint M2 + build PASS |
| M2-AC-16 | ledgers e rollbacks presentes |

## Regras de autoridade

- M2 é soberana para catálogo global de músculos, exercícios e equipamentos.
- `health_declared_equipment` continua sendo contexto do atleta e pode apontar para o catálogo.
- Equivalência de catálogo não é decisão do Motor CCH.
- Nutrição só recebe valores quando source_id/source_food_key/versionamento são rastreáveis.
