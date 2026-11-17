# Integração Shopee — revisão cirúrgica de autorização multilojas (Adão → Celivio → próximas contas)
Data: 2026-11-17
Natureza: investigação em fonte / proposta de correção, NÃO homologação operacional nem autorização de implantação.
Escopo: somente onboarding OAuth do aplicativo Painel Central (Partner ID 2047685). Não alterar mappings, intake, etiquetas, Scheduler, operações comerciais ou identidades das demais lojas.

## Evidência técnica verificada
Fonte histórica GitHub: `services/integration-hub/src/shopee-live-oauth.mjs` no commit `6a1a4b338b8a8204a9d16d38edd309a09aa5a3dd`.
Fonte atual: mesmo arquivo em main, com implementação Celivio derivada da arquitetura original.

**Correção do diagnóstico anterior:** o código histórico de Adão JÁ exigia:
- rota `/shopee/live/oauth/adao/start`;
- `state` com prefixo `adao.`, persistência no Core, cookie `__Host-pc_shopee_live_state` SameSite=Lax, HttpOnly, Secure, Max-Age=600;
- callback com leitura do cookie, consumo do estado, associação imutável à conta e validação de shop ID;
- flag `SHOPEE_LIVE_ADAO_OAUTH_ENABLED`.

O código Celivio atual usa o mesmo padrão com `/shopee/live/oauth/celivio/start`, `celivio.`, `SHOPEE_LIVE_CELIVIO_OAUTH_ENABLED`, conta Core `d26c7a30-aa4a-4441-8012-600d70453689` e shop ID de referência `1357031949`. Não há evidência de que simplesmente retirar o state reproduza o fluxo bem-sucedido de Adão. NÃO retirar essas proteções.

O callback atual depende do cookie emitido pelo início no domínio Gateway. Uma autorização iniciada diretamente no console desenvolvedor Open Platform não demonstrou produzir esse cookie, nem um state persistido. Se prosseguir diretamente pelo botão 'Autorizar' do painel Viviane, existe risco de falha por ausência de estado. Não anexar manualmente estado ou código em URL, não selecionar conta por query string e não usar tokens de uma conta na outra.

No teste de Celivio, URL inicial recebeu `utm_source=chatgpt.com` e foi rejeitada pela regra de zero parâmetros. Essa é uma fricção real de UX, mas não comprova falha OAuth. Resolver na experiência de navegação segura, sem aceitar parâmetros arbitrários de destino.

## Estado operacional conhecido da produção — checkpoint da sessão
Cloud Run `integration-hub-00166-tvl` 100%, habilitação Celivio ON, revisão de rollback `integration-hub-00165-4gz`, 26 tags preservadas. Gateway config `oauth-celivio-20261116-v1` ACTIVE, /health e /health/core HTTP 200. Scheduler `shopee-adao-intake-v1` PAUSED. **Esses são resultados fornecidos pelo operador; não foram reconsultados nesta revisão GitHub.**

## Correção do início de Celivio

A página intermediária emitia o cookie de sessão e criava o estado no Core, mas encaminhava o operador ao console genérico. A URL assinada de `auth_partner` ficava sem uso nesse caminho. O retorno observado com código e loja foi rejeitado antes da troca de tokens. A mensagem original agrupava ausência de código, identificação de loja e cookie. Os cabeçalhos da resposta inicial demonstram emissão do cookie. A chegada dele ao Hub no callback histórico permanece sem evidência.

Na revisão corrigida, iniciar em `/shopee/live/oauth/celivio/start` no host oficial do Gateway. O atalho existente com `?via=console` também retorna 302 diretamente para o consentimento assinado do aplicativo Painel Central. Finalizar como `netojacobus504` na mesma aba. O Hub deve receber o cookie e consumir o estado associado à conta Celivio. A validação autenticada e a persistência de tokens cifrados para a loja esperada `1357031949` na conta `d26c7a30-aa4a-4441-8012-600d70453689` são critérios da homologação. Caso o callback informe ausência de sessão, verificar apenas a presença do cabeçalho de cookie da navegação e se o retorno foi um GET de nível superior no mesmo host. Não copiar valores de cookies, códigos nem URLs de retorno para logs ou chamados.

A correção usa o estado e o callback compartilhados existentes. O cadastro governado de futuras lojas pode reutilizar esse início assinado com resolução de conta autorizada no servidor. As rotas e flags existentes permitem a homologação sem atualizar o Gateway nem cadastrar outro aplicativo. Em rollback, iniciar uma nova autorização na revisão restaurada. Estados consumidos continuam de uso único, e as conexões já persistidas no Core seguem no armazenamento existente. A troca de tráfego e o rollback de infraestrutura devem ser validados no gate operacional.

## Decisão de arquitetura (proposta, não congelada)
Objetivo: **um aplicativo Open Platform existente, N autorizações de lojas, tokens isolados e operação de consentimento simples**.
Preservar fluxo seguro server-initiated antes da concessão da Shopee. Criar interface ou ação de onboarding ligada à conta Core autenticada, que dispare start pelo backend sem exposição de rota técnica nem parâmetros de seleção de destino fornecidos pelo navegador.
Não prometer que o botão 'Autorizar' da página desenvolvedora poderá ser usado diretamente: primeiro comprovar exatamente o caminho efetivo de Adão em registros de callback/gateway/estado. Não basta o relato de que o painel Viviane foi usado.

## Execução em gates
1. **Forense mínima sem repetição de auditoria**: localizar evidência do início de Adão em 23/10/2026 (rota recebida, horário, cookie/state criado, callback sem segredos) e confrontar com sessão Celivio. Redigir passo a passo do operador confirmado, diferenciando entrada no console Viviane, Seller Adão e início pelo Gateway. Sem logs contendo códigos/token.
2. **Correção UX reversível**: adicionar botão/ação 'Conectar loja Shopee' no Painel Central, identificado pelo canal/conta Core autenticada; resolver destino no servidor em allowlist; gerar e persistir state; redirecionar ao consentimento da Open Platform. Evitar um novo caminho hardcoded no frontend para cada loja; manutenção de compatibilidade temporária das rotas Adão/Celivio.
3. **Testes**: vinculação Celivio correta; callback sem state rejeitado; state de Adão em Celivio rejeitado; troca de shop_id rejeitada; estado expirado/reutilizado rejeitado; query pública de destino rejeitada; idempotência, rollback, coexistência de Viviane e Adão.
4. **Deploy isolado**: PR revisado, testes locais/CI, revisão Cloud Run com 0%, comparação de envs/secrets/flags/imagem, teste proxy apenas leitura. Só promover com autorização separada do responsável.
5. **Homologação Celivio**: consentimento no Seller correto; token e shop_info confirmam `1357031949`; conexão persistida na conta `d26c7a30-aa4a-4441-8012-600d70453689`; nenhuma alteração em outras lojas. NÃO ativar pedidos, mappings ou logística.
6. **Padrão para novas contas**: metadados da conta e validação no Core, sem novos aplicativos ou novos endpoints públicos por loja; cadastro/credenciamento com governança e limite de contas.

## Bloqueios e proibições
- Sem comprovar o ponto de entrada histórico de Adão, **não afirmar que o painel Viviane sozinho inicia um callback compatível**.
- Não remover cookie/state, verificação de shop ID, proteção contra replay, segregação de tokens.
- Não registrar Shop ID de Celivio como homologado apenas por URL pública; exigida confirmação na API autenticada.
- Não alterar implantação produtiva nem Scheduler em decorrência deste documento.
- A existência de um arquivo de planejamento ou PR não significa que o novo fluxo já está implementado.
