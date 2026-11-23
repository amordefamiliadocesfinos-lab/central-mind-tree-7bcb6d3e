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
