# M3 Acceptance Criteria — Programa / CCH

Data: 07/11/2026

## Escopo

M3 cria a camada estrutural de programação do CCH antes da execução ao vivo.

Incluído:
- programa por atleta;
- versões de programa;
- prioridades musculares por versão;
- templates de sessão;
- exercícios prescritos por template;
- fila CCH contínua;
- RPC atômico para criação de rascunho;
- RPC atômico para publicação + ativação + seed da fila.

Excluído:
- séries executadas;
- carga/repetições reais;
- recuperação;
- recomendação “qual treino agora?”;
- progressão automática;
- substituição automática;
- Decision Ledger completo;
- AI Coach.

## Critérios

| ID | Critério |
|---|---|
| M3-AC-01 | migration principal via Supabase CLI |
| M3-AC-02 | migration RPC via Supabase CLI |
| M3-AC-03 | RLS em todas as tabelas M3 |
| M3-AC-04 | grants mínimos por operação |
| M3-AC-05 | referências atleta/programa/versão coerentes por FK |
| M3-AC-06 | uma posição por fila/atleta |
| M3-AC-07 | uma sequência por template e exercício |
| M3-AC-08 | current_version somente aceita versão publicada |
| M3-AC-09 | child rows editáveis somente enquanto versão draft |
| M3-AC-10 | RPCs SECURITY INVOKER |
| M3-AC-11 | anon/public sem EXECUTE nos RPCs |
| M3-AC-12 | authenticated executa RPCs sob RLS |
| M3-AC-13 | /saude/treino funcional |
| M3-AC-14 | mobile 320–430px |
| M3-AC-15 | lint + build PASS |
| M3-AC-16 | ledgers + rollbacks presentes |

## Autoridade

- M3 é soberana para estrutura planejada do programa.
- M4 será soberana para execução real.
- M5 será soberana para decisão dinâmica/recomendação.
- A fila M3 é estrutural; não interpreta recuperação nem prioridade dinâmica.
