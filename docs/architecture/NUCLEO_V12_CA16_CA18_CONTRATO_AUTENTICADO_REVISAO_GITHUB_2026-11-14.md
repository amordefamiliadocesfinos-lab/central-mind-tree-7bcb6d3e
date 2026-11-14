# Núcleo 2.0 — A+ V1.2 | CA-16 e CA-18 — contrato autenticado e revisão por PR

**Autoridade:** Mapa Mestre V1.2, critérios CA-16 e CA-18, sem M6; fechamento técnico PR #747 e evolução PR #748. Fonte original permanece preservada.

## CA-16 — leitura estruturada autenticada, nunca execução

A Edge Function `nucleo-knowledge-read` implementa `POST` com `{ "module_code": "CRM", "include_review": true }`. Responde com a identidade do módulo, as dez seções FM (versão efetivamente visível pelo Core, quando existente), as frentes M3 diretamente relacionadas e sugestões de revisão CA-18. Uma IA **que já possua sessão autenticada e autorização explícita** pode consultar este contrato; não há emissão ou delegação automática de tokens, agente novo ou permissão adicional.

**Controles:** `verify_jwt = true`; `auth.getUser(token)`; consulta do grant ativo e não revogado `nucleo_manage`; cliente Supabase com chave pública/anon e JWT do próprio solicitante, sob **RLS existente**, sem service role; módulos selecionados por código exato; consultas com limites e falha segura. Não são consultados dados pessoais de CRM, saúde ou pedidos, nem tabelas de atendimento. O texto FM, se registrado por um editor autorizado, é retornado ao mesmo perfil autorizado a lê-lo no Core: revisar conteúdo sensível antes de disponibilizá-lo a outro destinatário.

O endpoint é apenas leitura. Não gera resposta de LLM sozinho, não concede mandato a agentes e não homologa CA-16 sem teste real de agente autorizado e teste negativo de usuário sem grant.

## CA-18 — conferir PR na origem sem modificar manual

As evidências M4 atuais guardam o número/merge SHA, mas nenhuma das 32 PRs registradas no corte anterior tinha `merged_at`/lista de arquivos no snapshot. A função pode consultar a **API GitHub em tempo de requisição** para PRs verificadas em M4 e estritamente vinculadas às frentes do módulo, com repositório oficial exato, limite máximo de 8 PRs e 100 arquivos cada.

Somente quando a origem fornece data de merge e arquivo explícito correspondente ao `source_reference` da **última revisão FM** é produzida uma **sugestão**. Coincidência temporal e de caminho não prova mudança semântica do manual; exige revisão humana. Ausência de revisão FM, escopo superior ao limite, dados incompletos, arquivo não correspondente ou API privada/indisponível **não cria afirmação de que o manual está atualizado**. Nunca reescrever a revisão vigente, alterar estado M3/M4 ou registrar homologação automática.

Para repositório privado, GitHub pode exigir a configuração futura de `NUCLEO_GITHUB_READ_TOKEN` **somente leitura** na função. O token é opcional e jamais enviado ao frontend; se ausente e a origem negar acesso, resultado é indeterminado. Não criar ou solicitar privilégios adicionais automaticamente.

## Frontend e operação

Em M5 já autorizado por `nucleo_manage`, o painel existente oferece **Conferir PRs na origem autorizada**; consulta `supabase.functions.invoke` com a sessão ativa. Falhas exibem estado indeterminado, sem modificar FM. A cópia manual de JSON preexistente continua disponível, com aviso de autorização do destinatário. A função deverá ser publicada pelo procedimento de deployment autorizado; **merge de código/CI não comprova deploy**.

## Verificação e gates

- Testes determinísticos de caminho literal, status de PR, comparação de datas e fontes incompatíveis no workflow M5; gates M3/RLS existentes inalterados.
- Inspeção estática dos controles de Auth, grant, limites, `verify_jwt` e ausência de escritores/service role.
- Testes **pendentes de ambiente real**: function deploy + sessão autorizada, sem permissão/revogada, resposta parcial, API GitHub privada, e uso por agente autenticado.
- Sem migrations, alteração de grants/RLS, dados Core, prova histórica, biblioteca B, construtor Lovable ou avanço dos ensaios visuais adiados.

**Classificação:** CA-16 ganha endpoint de leitura autenticada no código; CA-18 ganha conferência de origem e sugestões fundamentadas, sem persistência de pendência. Ambos permanecem sujeitos a deploy e teste real, e CA-18 ainda requer fluxo de decisão/registro humano para encerrar o critério integral.
