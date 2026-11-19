# NÚCLEO 2.0 — PILOTO F3 | CANAL DE PROPOSTA AC-01 POR AGENTE

**Status:** implementação proposta em GitHub, não implantação homologada no Cloud.  
**Escopo:** mapa V1.1 do Especialista Núcleo `NUC`, um registro append-only `proposta`.  
**Autoridade:** Mapa Continuidade Canônica V1.1 e Mapa Mestre Núcleo 2.0 V1.3.

## Solução implementada em código

- Edge Function `nucleo-ac01-agent-proposal` aceita somente `POST` com corpo JSON exatamente `{"module_id":"636768e6-e782-4c7d-8132-e7381621be12","request_id":"<UUID V4 reutilizável>"}`.
- JWT de uma identidade Supabase Auth própria (usuário ou agente delegado **quando houver identidade aprovada**), validado por `auth.getUser(token)` e verificação de `nucleo_manage` ativa e não revogada, via cliente com **ANON KEY + JWT do chamador**.
- `verify_jwt=true` na configuração da função. Não usa `service_role`, SQL administrativo, credencial compartilhada, nem novo schema/grant/policy.
- A função fixa no servidor o tipo `mapa`, papel `Especialista Núcleo 2.0`, título e localizador do mapa V1.1 na `main`. Nenhum corpo documental/nota livre é aceito na API desta fase.
- Reusa `nucleo_specialist_contributions` com trigger do banco que impõe `auth.uid()`, `authority_state=proposta`, versão 1 e RLS. Criação não altera FM, M3, M4, AC-02, mandato, publicação ou vigência.
- Reconsulta por `request_id` **antes** do INSERT e **depois** do INSERT, inclusive em retorno ambíguo; repetições da mesma identidade/payload retornam o registro existente. Se leitura/estado incerto, exige reconciliação, **não** reenvio.
- Proteção adicional contra segunda referência igual sob outro `request_id` por **pré-consulta**. Isso reduz duplicatas de uso sequencial; **não garante ausência de corrida entre duas requisições concorrentes com request_ids diferentes**. A unicidade transacional dependeria de portão separado de schema/constraint ou controle serializado e não será prometida nesta fase.

## Estados de resposta

- `201 confirmado_por_readback`: inserção conferida no Core sob o mesmo JWT/RLS.
- `200 confirmado_existente`: reenvio idempotente de um request_id cujo conteúdo, papel e autoria correspondem.
- `200 confirmado_apos_reconciliacao`: inserção retornou erro, mas readback completo comprovou o registro.
- `400/405/413`: corpo/método/volume não autorizado.
- `401/403`: sem sessão real ou sem concessão ativa.
- `409`: colisão de request_id, referência já existente ou readback divergente.
- `503`: leitura/serviço indeterminado. **Não repetir escrita antes de reconciliar**.

## Limites não resolvidos pela PR

1. Não cria identidade Supabase Auth para chats; nenhum chat herda o login do proprietário. O agente que operar a função precisa de ferramenta/conector que transmita uma identidade própria autorizada, **sem expor o JWT à conversa**.
2. Não cria delegação ou concede `nucleo_manage`; isso permanece conforme governança existente, mesmo que futuras permissões de contribuição por especialidade sejam mais restritas.
3. Não comprova deploy da Edge Function nem disponibilização imediata no aplicativo.
4. Não é pacote AC-02 do NUC e não altera a guarda que o exclui do exportador de módulos operacionais.
5. Não habilita escrita geral de métodos/ecossistemas, nem cadastro N:N de especialistas. A expansão depende de prova material, consentimento e contratos próprios.

## Provas/portões antes do primeiro registro real

1. CI passa nos testes sintéticos de payload, autenticação, autorização, replay, duplicidade e readback.
2. Revisão de segurança e integração do endpoint em ambiente correto, **sem publicar automaticamente pela PR**.
3. Teste real de sessão permitida e negada, revogação, identidade de gravação e RLS; assegurar uma única tentativa.
4. Após registro, readback por `request_id` de ID, autoria, tipo `mapa`, fonte GitHub, `authority_state=proposta` e `version_no=1`.
5. Se a sessão autorizada existente da UI puder produzir o mesmo resultado mais cedo, priorizar seu formulário AC-01, sem tornar Work obrigatório para leituras.

**Próxima ação:** completar revisão/CI e decidir implantação separada. A PR não muda registros produtivos.
