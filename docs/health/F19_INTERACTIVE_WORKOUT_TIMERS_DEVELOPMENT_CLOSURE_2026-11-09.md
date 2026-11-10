# F19 — CRONÔMETRO INTERATIVO DE TREINO E DESCANSO — DEVELOPMENT CLOSURE

**Data:** 09/11/2026
**Status:** IMPLEMENTADA EM GIT · GATE B/C PENDENTES
**Base:** `main@11acdad59e9a674c0d1e24c378473d8dae85072a`

## Arquitetura

- Mapa v4.6 FROZEN
- PR #552 — arquitetura F19 v1
- `F19_TIMER_AUTHORITY_AMENDMENT_V1_1.md`

## Implementação

- PR #555
- merge: `11acdad59e9a674c0d1e24c378473d8dae85072a`

## Migration

`supabase/migrations/20261110005023_health_f19_interactive_workout_timers.sql`

Nome gerado oficialmente com Supabase CLI 3.1.0.

A migration está somente em Git.
Não foi aplicada em produção por esta frente.

## Entregas

### Cronômetro da sessão
- tempo ativo;
- pausar;
- retomar;
- pausa excluída da duração ativa.

### Execução
- cronômetro factual por série;
- `work_seconds` persistido na série;
- tempo acumulado do exercício durante a sessão.

### Descanso
- inicia automaticamente após concluir a série;
- meta vem de `planned_rest_seconds`;
- conta para cima;
- continua após a meta;
- mostra tempo extra;
- alerta visual;
- vibração quando suportada;
- beep local quando permitido;
- encerra somente por ação do usuário;
- `rest_seconds` recebe o tempo factual.

### Fluxo rápido
- Iniciar série;
- Concluir série;
- Voltar ao exercício;
- Mais uma série quando a faixa permite;
- Próximo exercício;
- Encerrar descanso.

A digitação é opcional.

### Factualidade
- carga desconhecida permanece NULL;
- reps desconhecidas permanecem NULL;
- RIR desconhecido permanece NULL;
- prescrição não é copiada como execução.

### Persistência
- intervalos vivem no banco;
- reload não zera cronômetros;
- retorno/foco da aba reconcilia estado;
- sem localStorage.

## Segurança

- RLS na tabela de timers;
- SELECT autenticado condicionado a leitura do atleta;
- sem INSERT/UPDATE/DELETE direto do cliente;
- RPCs mutacionais com timestamps do servidor;
- SECURITY DEFINER intencional e restrito;
- `SET search_path=''`;
- auth.uid obrigatório;
- health_can_write_athlete obrigatório;
- PUBLIC/anon revogados;
- helper de trigger não exposto.

## Estado

- arquitetura: ✅
- implementação Git: ✅
- migration versionada: ✅
- auditoria estática de autoridade: ✅
- testes: ⏳ adiados
- Gate B: ⛔ não executado
- Gate C/deploy: ⛔ não executado
- homologação real: ⏳ pendente
