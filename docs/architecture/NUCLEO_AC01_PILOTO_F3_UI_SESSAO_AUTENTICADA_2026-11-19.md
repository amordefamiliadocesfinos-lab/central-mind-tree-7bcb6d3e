# Núcleo F3 — Correção de usabilidade autenticada do gateway AC-01

**Origem:** relatório Work do proprietário: conta pessoal autenticada no Painel, zero registros equivalentes ao mapa V1.1, ficha NUC disponível sem formulário AC-01/controle de gateway.  
**Diretriz:** Mapa de Continuidade Canônica V1.1; soberania Mapa Mestre Núcleo 2.0 V1.3.  
**Escopo técnico:** disponibilizar **um único controle de registro** na ficha M3 de governança NUC, reaproveitando gateway já implantado em `nucleo-ac01-agent-proposal`.

## Implementado

- Componente `NucleoAc01PilotRegistration` aparece exclusivamente quando a ficha selecionada no M3 é `NUC`. O acesso já existente “Abrir ficha de governança” conduz à mesma ficha.
- Usa `supabase.auth.getUser()` do Painel autenticado e verifica a concessão ativa `nucleo_manage` antes de habilitar a ação.
- Pré-consulta a origem no AC-01, confirmando ausência de registro equivalente. Ação exige confirmação explícita do proprietário.
- Persiste um UUID de requisição por identidade e NUC em `localStorage` **antes** do envio. Sem armazenamento local seguro, não envia. Não guarda tokens nem conteúdo documental.
- Invoca a Edge Function **já existente** com apenas `module_id` e `request_id`; o cliente Supabase transfere automaticamente a sessão autenticada sob o contrato vigente.
- Confirma autoria, tipo, referência, versão e estado por readback independente no Core. Se estado/retorno for ambíguo, trava a repetição e permite reconciliação sem novo UUID.
- Se registro já existir, só exibe seu ID/estado e evita inserir novamente.
- Não cria segundo writer, segundo fluxo AC-01, alterações de schema, concessões, métodos, frentes ou aprovações.

## Limites reais

- **Código/CI/merge não comprovam deploy da interface**, sessão humana disponível, permissão efetiva, gravação AC-01 nem publicação/homologação.
- O cliente conectado e autorizado ainda precisa exercer a jornada na aplicação publicada e confirmar a existência de uma contribuição no Core.
- A proteção local impede repetição inconsciente na mesma conta/navegador; concorrência em vários clientes com `request_id` diferente exige garantia transacional adicional antes de escala.
- Esta fase serve só ao piloto documental do mapa V1.1 em NUC. Não representa o cadastro multiespecialista N:N planejado.

## Contraprova pós-publicação

1. Abrir `/nucleo` com sessão de gestor e acessar a ficha M3 `NUC`.
2. Verificar que o bloco de registro do Mapa V1.1 aparece e identifica a referência.
3. Pré-consulta e concessão ativa devem habilitar somente o botão de proposta.
4. Autorizar conscientemente a única gravação; verificar sucesso do gateway e readback do Core com ID, UID, `proposta`, versão 1 e fonte GitHub.
5. Recarregar e confirmar que não permite duplicar a referência.
6. Se o fluxo não estiver publicado, registrar como **pendência de deploy/UAT**, não como falha de autorização ou como gravação concluída.
