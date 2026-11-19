# CCH V8 — Proveniência real de equipamentos (frente 1)

A V7 armazenava incremento por exercício, mas não tinha como provar em qual máquina cada execução ocorreu. A V8 adiciona confirmação explícita de máquina a cada ocorrência de exercício numa sessão M4, antes de registrar qualquer série. Não altera históricos e não preenche identificações retroativamente.

Um RPC invoker valida atleta e sessão; a tabela tem RLS e somente INSERT/SELECT. A auditoria independente exige três sessões identificadas com a mesma máquina e unidade, cadastro do incremento correspondente, esforço compatível e ausência de queda comparável. Toda carga é candidata à revisão, jamais prescrita.

A confirmação está inicialmente na seção avançada do treino, não no cronômetro principal; integrar também ao fluxo principal é etapa pendente. A análise de volume e periodização V7 permanece existente, mas ainda não demonstra tolerância fisiológica. Isso exige trajetória de desempenho, recuperação e avaliação pelo atleta.

Testar SQL em ambiente isolado: RLS cruzado, impedimento após primeira série, máquina não confirmada e duas máquinas distintas. Sem treino real criado para teste.
