# CCH — Continuidade entre ciclos (18/11/2026)

Diagnóstico Lovable Cloud: Deividi possui v1 publicada com dez entradas completed; última B2; dois registros de teste voided preservados.

O fim da fila é identificado pela versão publicada; se houver pendências/bloqueios, não é ciclo concluído. A preparação explícita via RPC SECURITY INVOKER cria v2 em draft, copia prioridades e prescrições existentes como ponto de partida sem gerar fila nem sessão. A RLS por atleta e auth.uid permanecem soberanas; a RPC é idempotente para drafts existentes, valida fila concluída e ausência de treino aberto.

No rascunho, usuário pode revisar séries, reps, RIR e descanso por exercício. Publicação continua pelo contrato M3 e gate F22, após revisão humana; não se presume progressão individual automaticamente. Histórico permanece imutável.

Gates antes de merge: TypeScript; teste PostgreSQL isolado para RLS, idempotência, condições negativas, preservação da v1, não escrita em filas/sessões, gate F22, regressão Rafaela; homologação da jornada. Não realizar escritas de teste em produção.