# CCH E3-B — adaptador somente leitura de sessões M3/M4/F21

A PR entrega adaptador puro e hook de leitura para o futuro painel consultivo E3, sem conectar ainda a uma publicação automática ou nova fila.

## Fontes
- `health_program_versions` do programa/atleta autenticado;
- `health_session_templates` das versões selecionadas;
- `health_workout_sessions` concluídas, `record_status=active`, inclusive apenas versões do programa;
- `health_workout_sets` com `status=completed` e `set_type=working`.

O cliente Supabase existente aplica RLS do Lovable Cloud por atleta; **nenhuma tabela, RPC, usuário ou política nova**. Nunca misturar sessões anuladas/voided ou provenientes de outro programa. Mapeamento de código só quando a origem `session_template_id` tem a mesma versão da sessão.

## Limites
- Contagens incompletas na ausência de séries; um treino concluído não comprova recuperação nem técnica.
- Para desempenho comparável exigir todas as séries de trabalho observadas com unidade, carga, reps e RIR presentes. Essa é convenção de cobertura de dados, não sinal clínico.
- Limite de segurança de paginação: 300 sessões, 10.000 séries; `sourceTruncated` deve obrigatoriamente ser mostrado como limitação na UI futura.
- Se erro de RLS/rede, mostrar erro e não usar fallback sintético.
- Não publicar, criar ou alterar prescrição; só leitura. E3-C poderá expor prévia no Programa existente sob autorização já dada.

**Governança:** CCH v5.4 e V1.0 FROZEN intactos; E2 homologação remota ainda parcial, E3 desenvolvimento destravado por solicitação do proprietário em 19/11/2026, F23 não aberta.

## Continuidade E3/E4 — segurança do escopo de leitura (23/11/2026)

**Achado:** o hook `useHealthE3ReadOnly` armazenava apenas `data/loading/error`, sem identidade da consulta concluída. Ao trocar atleta/programa, a renderização inicial podia expor observações da consulta anterior; duas respostas concorrentes também podiam terminar fora de ordem e substituir a mais recente. A RLS protege a origem de cada `SELECT`, mas não impede reaproveitamento indevido de estado React já obtido.

**Correção:** snapshot vinculado a `JSON.stringify([athleteId,programId])`, visão `viewE3ReadSnapshot` que mascara dados/erros de outro escopo no próprio render, limpeza antes do carregamento e geração monotônica `requestGeneration` para rejeitar respostas antigas, inclusive após mudança de escopo e desmontagem. Consultas continuam com filtros de atleta, programa, versão e F21; falha de rede/RLS continua sem fallback sintético. Nenhum registro de atleta é atualizado.

**Validação:** testes unitários de troca de atleta, troca de programa e pares de IDs potencialmente ambíguos; TypeScript, lint e build pela CI `health-cch-e3-observation.yml`. O mecanismo de geração é revisão estática + compilação: não constitui homologação visual da tela em sessão autenticada. A homologação visual permanece adiada pelo proprietário.

## Continuidade E3/E4 — proveniência do template e integralidade do histórico

**Achado:** o adaptador E3 podia sinalizar `exerciseDataComparable=true` ao receber séries numericamente completas, mesmo que `session_template_id` não estivesse vinculado à mesma versão M3 da sessão. Podia também apresentar contagens de séries como completas quando uma resposta Supabase estava truncada (`sourceTruncated`). Isso não constitui evidência verificável de exposição comparável.

**Correção fail-closed:** somente um template M3 vinculado à mesma versão da sessão e ausência de truncamento permitem assinalar comparabilidade. Se `sourceTruncated=true`, a contagem de séries por sessão vira `null` (não zero) e nenhuma sessão é classificada como comparável; a UI já sinaliza truncamento e o E3 reduz qualidade para `limited`. Template de origem desconhecida preserva a contagem local observada quando a leitura está completa, mas não certifica comparação.

**Evidências:** testes sintéticos de origem ausente/divergente, página incompleta e fonte íntegra; compilação TypeScript, lint e build em CI. **Nenhuma mudança** de banco, RLS, perfil ou histórico do atleta, sessões, incrementos de carga, publicação F22 ou prescrição automática. A homologação visual foi postergada pelo proprietário e permanece separada do resultado do CI.

## Continuidade E3/E4 — paginação determinística M3/M4/F21 (23/11/2026)

**Achado:** o hook consultivo aplicava `limit(301)` para sessões e `limit(1000)` para séries. Uma resposta de 1000 linhas do PostgREST podia ser limite padrão do servidor, não cobertura integral; sem uma varredura paginada, histórico e atribuição das séries podiam parecer completos indevidamente. O documento E3-B já previa teto de 300 sessões/10.000 séries, que não estava integralmente implementado.

**Correção de leitura exclusivamente SELECT:** `readE3BoundedPages` usa `range(start,end)` com páginas de até 400, ordenação determinística por identificador (e, para sessões, `started_at` decrescente mais `id`), e consulta de **uma linha sentinela além do limite** para distinguir histórico completo de truncado. O hook pagina versões M3 (máx. 1.000), templates (máx. 3.000), sessões (máx. 300) e séries de trabalho (máx. 10.000 global, IDs de sessão em grupos de 25). Erros de RLS/rede ou resposta inesperada abortam a leitura, sem usar dados parciais como completos. Se qualquer fonte exceder teto, `sourceTruncated=true`, desabilitando classificação de comparabilidade e retirando contagens incompletas; a UI já exibe limitação.

**Limites honestos:** o teto global de 10.000 séries é **limite de segurança**, não quantidade ideal de treinamento. Se excedido, não existe declaração de cobertura integral; versões excedentes bloqueiam a leitura para evitar resultados com escopo parcial. A ordenação estável evita saltos por empate de horário em um conjunto de dados estático, mas leituras concorrentes a escritas podem mudar os resultados entre páginas; a prova de consistência transacional real permanece fase posterior. Nenhum cronograma, progressão, incremento ou classificação de atleta é inferido daqui.

**Verificação:** testes unitários das bordas de páginas, limite exato, sentinela de excesso, erro de RLS/rede e rejeição de resposta fora de contrato; TypeScript, lint e build na CI E3-B. Nenhuma alteração de banco, migração, RLS, dados dos atletas, gate F22 ou ativação E5. Homologação visual continua adiada.
