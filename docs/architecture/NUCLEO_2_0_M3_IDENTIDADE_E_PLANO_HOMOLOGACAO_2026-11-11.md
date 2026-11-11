# Núcleo 2.0 — M3 | Identidade elegível e portão de homologação funcional

**Data:** 11/11/2026  
**Autoridade:** Camada Mestre e Mapa Mestre Núcleo 2.0 V1.0.  
**Estado:** identidade elegível identificada; **capacidade `nucleo_manage` NÃO concedida**; E2E positivo pendente.

## Verificações diretas no Core (consultas não destrutivas)

- Existe **exatamente uma** conta ativa com papel textual `Administrador`.
- A conta é vinculada ao Supabase Auth, possui e-mail confirmado, autenticação já utilizada e não consta como excluída ou bloqueada na consulta.
- Há uma capacidade ativa `provision_users` para essa conta. Isto é **elegibilidade operacional**, não autorização implícita para o Núcleo.
- A identidade autenticada candidata termina em `...d801ca8c`, somente como marcador de conferência; o UUID inteiro, o e-mail e dados privados não são publicados neste arquivo.
- `nucleo_manage`: **zero concessões** no Core. Nenhuma outra conta foi indicada nominalmente como autorizada a receber essa capacidade.

## Evidência RLS no Core, antes da concessão

Teste transacional `SET LOCAL ROLE authenticated` com claim da identidade administrativa real, sem outorgar capacidade:
- `nucleo_development_workstreams`: 0 linhas visíveis, apesar de haver sete registros.
- `nucleo_development_events`: 0 linhas visíveis, apesar de haver oito eventos.
- `nucleo_source_references`: 0 linhas visíveis, apesar de haver três referências.
- Transação encerrada com `ROLLBACK`.

Isso comprova a negativa RLS sob claim simulada na sessão do banco. **Não** comprova navegação E2E, nem permite equiparar o campo `role` a `nucleo_manage`.

## Procedimento positivo — após autorização individual expressa

1. Confirmar a identidade exata para a concessão: a conta administrativa candidata ou outra identidade nominalmente indicada pela Camada Mestre.
2. Antes do grant, conferir que a conta continua ativa, vinculada ao Auth, que `nucleo_manage` não está ativo, e preservar o estado original da tabela `app_admin_capabilities`.
3. Executar outorga individual auditável pela autoridade legítima, com `granted_by_auth_user_id` fiel ao executor humano autorizado, nunca atribuir a si próprio a autoria fictícia. Não usar papel textual como substituto da capacidade.
4. Abrir `/nucleo` com a sessão **real** do operador autorizado; alternar para Desenvolvimento, confirmar as sete entradas e seus oito eventos; conferir três referências na Biblioteca.
5. Testar edição reversível de um campo de acompanhamento ou registro isolado, confirmar o evento auditado, e reverter por nova atualização (sem apagar histórico). Não modificar títulos, códigos estáveis ou classificações documentais.
6. Revogar a capacidade pelo ator legítimo, preservando o registro histórico de revogação; confirmar que a mesma sessão deixa de consultar catálogo/frentes e que a RLS retorna zero linhas. **Nunca** excluir logs e não alterar as permissões de outros módulos.
7. Registrar evidências do navegador, consultas SQL e diferenças observadas. Só depois classificar a homologação funcional como concluída.

**Não executar outorga nem simular o teste positivo como realizado antes da autorização individual.**

## Situação de patrimônio documental

- M3: sete registros da árvore e oito eventos auditáveis, sem exclusões.
- M2: três referências Drive, privadas/provisórias.
- M1: zero documentos, revisões ou lotes importados; as 82 páginas do backup local seguem preservadas.
- M4 e M5 permanecem planejadas; M3 não infere provas de CI/PR ou progresso percentual.

**Conclusão:** a conta administrativa candidata foi identificada, sua aptidão de autenticação foi checada e a RLS negativa validada no Core. A concessão de `nucleo_manage` e homologação positiva da interface são portões posteriores, vinculados a uma identidade expressamente aprovada.
