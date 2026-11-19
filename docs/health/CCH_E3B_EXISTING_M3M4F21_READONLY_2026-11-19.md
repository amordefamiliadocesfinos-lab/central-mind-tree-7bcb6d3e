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
