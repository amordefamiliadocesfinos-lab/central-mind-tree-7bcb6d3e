# M4 Acceptance Criteria — Live Workout

Data: 07/11/2026

## Escopo

M4 registra fatos reais de execução sem reescrever o plano publicado da M3.

Incluído:
- sessão ao vivo;
- snapshot da prescrição planejada;
- exercícios executados;
- séries executadas;
- carga, unidade, reps, RIR e descanso;
- adicionar/pular/substituir exercício;
- atualização de série;
- eventos append-only;
- idempotência por client_event_id;
- conclusão da sessão e atualização da fila CCH.

Excluído:
- recomendação dinâmica “qual treino agora?”;
- recovery engine;
- progressão automática;
- Safety Gate clínico;
- Decision Ledger completo;
- análise biomecânica;
- AI Coach.

## Critérios

| ID | Critério |
|---|---|
| M4-AC-01 | migration oficial via Supabase CLI |
| M4-AC-02 | 4 tabelas de execução com RLS |
| M4-AC-03 | eventos append-only para authenticated |
| M4-AC-04 | RPCs SECURITY INVOKER |
| M4-AC-05 | anon/public sem EXECUTE |
| M4-AC-06 | uma sessão aberta por atleta |
| M4-AC-07 | uma sessão aberta por queue entry |
| M4-AC-08 | idempotência de sessão/série/evento |
| M4-AC-09 | snapshot planejado preservado na execução |
| M4-AC-10 | fila aceita in_progress e conclui separadamente |
| M4-AC-11 | /saude/treino é execução ao vivo |
| M4-AC-12 | /saude/treino/programa preserva M3 |
| M4-AC-13 | mobile 320–430px |
| M4-AC-14 | controles principais >=44px |
| M4-AC-15 | lint + build PASS |
| M4-AC-16 | ledger + rollback presentes |

## Autoridade

- M3 = planejado.
- M4 = executado.
- M5+ = interpretação e decisão adaptativa.
- Executado nunca reescreve retroativamente a versão publicada do programa.
