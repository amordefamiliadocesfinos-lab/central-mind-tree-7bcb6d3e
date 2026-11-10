# CCH — DECISÃO DE GOVERNANÇA v4.6 — ABERTURA F19

**Data:** 09/11/2026
**Status:** APROVADA POR REQUISITO NOVO EXPLÍCITO DO USUÁRIO
**Base:** `main@b1971141802fbe56bb9522f54d3683e8bd659b26`

## Achado objetivo

O M4 já possui:
- sessão ao vivo;
- cronômetro visual simples baseado em `started_at`;
- status `active|paused`;
- campos de descanso por série;
- tipos de evento `session_paused`, `session_resumed` e `rest_recorded`.

Mas faltam:
- pausar/retomar de fato o cronômetro do treino;
- medir tempo ativo excluindo pausas;
- cronômetro persistente de execução;
- cronômetro persistente de descanso;
- aviso ao atingir o descanso prescrito;
- permitir descanso extra sem parar o contador;
- registrar o descanso real com um toque;
- avançar treino sem recarregar a página;
- fluxo de uso prioritariamente por cliques.

## Nova frente

### F19 — Cronômetro Interativo de Treino e Descanso

Missão:
transformar o M4 em um fluxo de execução guiada, com medição temporal factual e baixa fricção.

## Princípios

- o relógio da sessão mede tempo ativo e pode ser pausado;
- pausa não conta como tempo ativo;
- execução e descanso são intervalos factuais persistidos;
- descanso tem meta prescrita, mas continua contando após a meta;
- atingir a meta gera aviso visual e, quando suportado, vibração/som local;
- usuário encerra o descanso explicitamente com um toque;
- tempo real nunca é substituído pelo tempo prescrito;
- carga/repetições/RIR desconhecidos continuam desconhecidos;
- o modo rápido não inventa desempenho.

## Gates

- Gate A: autorizado.
- Gate B: necessário para migration F19; não autorizado automaticamente.
- Gate C: separado.
- testes permanecem adiados por autorização vigente.
