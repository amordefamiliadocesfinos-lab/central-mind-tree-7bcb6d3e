# CCH E2 — pré-contraprova somente leitura na interface oficial

**Autoridade:** mapa v5.4 FROZEN; mapa de evolução V1.0 FROZEN; E2; issue #973.

O Work confirmou que o Programa CCH oficial só possui versão publicada. O Lovable Cloud oficial apresentou em auditoria somente leitura 3 versões publicadas, zero drafts e 4 RPCs M3/E2/F22 como SECURITY INVOKER.

A interface agora explica explicitamente o bloqueio da homologação E2:
- programa `published`: somente leitura; nenhuma proposta editável ou criação de draft é inferida;
- `draft`: revisão consultiva disponível, mas progressão depende de qualidade de dados e origem de auditoria;
- ausência de dados de origem, carregamento ou erro: pendência explícita, sem alegação de progressão comprovada.

O helper é **puro**, sem endpoint novo, tabela, função PostgreSQL, alteração do programa, usuário fictício ou autorizações extras. O nível de experiência do praticante é preservado; a confiança dos dados é independente dele. Testes unitários cobrem todos os estados.

## Contraprova WORK autorizada
Abrir `/saude/treino/programa` em sessão autenticada, atualizar a página e registrar:
1. `Código servido` e `data-cch-build-commit` (ou unknown);
2. `E2 · Contraprova consultiva do programa` e `Estado: Publicado, somente leitura`;
3. versão `v2 · published` e perfil `Avançado`;
4. ausência de editores de rascunho e botões de publicação nessa versão;
5. nenhuma alteração real, nenhuma criação de draft.

O laboratório do GitHub Actions PR #974 já comprovou a jornada em PostgreSQL descartável e no React original com hooks sintéticos. O ambiente oficial Lovable Cloud ainda não possui staging remoto autenticado independente, e **não** se deve utilizar conta de produção como laboratório. E2 permanece aberta até haver prova apropriada; não abrir E3 nem F23.
