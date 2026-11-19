# Método de Implantação e Recuperação do OAuth Shopee — Caso Celivio/Neto

**Projeto:** PAINEL CENTRAL — AMOR DE FAMÍLIA  
**Versão:** V1.0 — 19/11/2026  
**Domínio:** Integração Shopee / Painel Central  
**Função documental:** Execução, Aprendizado e Evidência  
**Estado:** registro de caso aceito; método reutilizável em avaliação  
**Fonte superior:** Mapa Congelado Integração Shopee V2.0  
**Relação:** método de integração multiloja e documentos vigentes do Ecossistema Especialista  
**Substitui:** nenhum documento  
**Autoridade:** Camada Mestre; publicação documental autorizada, sem autorização operacional ou promoção de governança soberana  
**Missão:** C3 — conexão OAuth Live Celivio/Neto **homologada**; pedidos, etiquetas e automações **não homologados**.

> **ALERTA DE PRODUÇÃO COMPARTILHADA:** No checkpoint de 19/11/2026, a revisão Cloud Run `integration-hub-00279-rom` recebia 100% do tráfego e tinha somente OAuth Celivio habilitado; **13 flags operacionais estavam OFF**. Isso exige **reconciliação específica das funções de Adão/Viviane** antes de qualquer continuidade operacional. É uma fotografia histórica: **não presumir que esse estado continua atual sem nova leitura**. Este documento **não autoriza** reativação de flags, Scheduler, alteração de tráfego, mudança de Gateway ou escrita operacional.

---

## 1. Resultado, alcance e proveniência

Em 19/11/2026 ocorreu a primeira jornada OAuth Live **comprovada de ponta a ponta** da conta **Celivio = Neto = Neto Company**, identificada na Shopee como `netojacobus504`, associada ao canal Core `d26c7a30-aa4a-4441-8012-600d70453689`. A Shopee confirmou a autorização do app Painel Central; o Hub apresentou **“Shopee Live conectado”** após `get_shop_info`, renovação de token e releitura.

**Evidências independentes:**
1. **Capturas de navegador do operador:** conta `netojacobus504`, autorização concluída pela Shopee e mensagem de sucesso do Hub para o shop `1357031949`.
2. **Cloud Shell do operador:** configuração Gateway, revisões Cloud Run, flags, digest, distribuição de tráfego e respostas HTTP.
3. **Cloud Logging:** callback `/shopee/live/oauth/callback` registrado **HTTP 200**, às **2026-11-19T16:46:13.135065Z**, revisão `integration-hub-00279-rom`.
4. **Core/Lovable Cloud, consulta SQL somente leitura:** conexão `live`, `partner_id=2047685`, `shop_id=1357031949`, campos de access/refresh tokens cifrados **presentes**, `last_authenticated_at=2026-11-19T16:46:21.805Z`; estado consumido às `16:46:13.586Z`; dois Raw `/api/v2/shop/get_shop_info` às `16:46:16.356Z` e `16:46:20.821Z`.

**Conclusão estrita:** OAuth, identidade e persistência Live da conta foram homologados. Não há homologação de importação de pedidos, logística, impressão de etiquetas, fiscal, automações, mappings ou estabilidade futura de refresh. A causa exata dos **HTTP 409/400 históricos permanece desconhecida**. O sucesso posterior não transforma hipóteses retrospectivas em diagnóstico.

## 2. Fontes, hierarquia e fronteiras

- **Autoridade superior:** Mapa Congelado Integração Shopee V2.0; este registro não o altera.
- **Método vigente:** Ecossistema Especialista e integração multiloja; qualquer refinamento universal é **proposta**, não norma automaticamente aprovada.
- **Código oficial:** repositório `amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e`.
- **Projeto Cloud Run:** `painel-central-integration-hub`; região `southamerica-east1`; serviço `integration-hub`.
- **Gateway:** `integration-hub-oauth`; API config verificada `oauth-celivio-20261116-v1`; mesmo domínio de início e callback.
- **Core:** Lovable `1720a410-34cd-4410-995c-8c92c7edf16b`, Supabase vinculado.
- **Código diagnóstico:** [PR #951](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/951), commit `5356cfbbffdce2a6d7575346c2096f6231637fa3` — **PR ainda sujeita à própria governança de merge**.

Nunca confundir commit de PR, imagem construída, revisão com tag, revisão servindo 100% e estado atual do Core. Fontes documentais antigas são checkpoints, não prova do runtime vigente.

## 3. Reconstrução causal da implantação

| Fase | Procedimento executado | Evidência/efeito |
|---|---|---|
| Histórico anterior | Inspeção de callbacks da revisão `00166-tvl` e states Core | HTTP 409 e 400; um estado consumido, sem conexão Celivio. **Causa não conclusiva** |
| Recuperação de escopo | Fixação de C2/C3 OAuth legado Celivio, sem migrar para F12.3 ou OAuth universal F4 | Exclusão de dependências hipotéticas de outras frentes |
| Diagnóstico | PR #951: log Celivio-only de motivos enumerados em 400/409, sem code/state/cookie/token/IDs pessoais; testes | Commit exato `5356cfb...`; CI run `44427842712` bem-sucedida |
| Build isolado | Cloud Build `92ab3d19-6adc-4c94-a73b-a8feb3772078` | Imagem por digest `sha256:870d3e65a3b620d527b4c3a35f8b3c94a1ba15ad42dd63efb90f2ed950fd65c8` |
| Contraprova sem tráfego | Revisão `00277-nij` tag `celivio-diagnostico-pr951`, 0%, 14 flags OFF | Health autenticado 200; callback sintético retornou 409, reason sanitizado `celivio_disabled` |
| Gateway real | Leitura da config FULL e de tráfego | Rotas Celivio e callback já presentes; `x-google-backend` GLOBAL, `APPEND_PATH_TO_ADDRESS`, backend principal. **Não recriar Gateway** |
| Promoção bloqueada | Confirmação da revisão `00167-hm8` como referência anterior; promoção autorizada de `00277-nij` a 100% | `/start` 503 pelo Gateway; Cloud Logging ligou 503 à revisão `00277-nij` |
| Identidade | Inspeção somente leitura da configuração Celivio | Shop ID esperado `1357031949`; OAuth ainda OFF |
| Candidata autorizada | Deploy digest idêntico sem tráfego: revisão `00279-rom`, tag `celivio-oauth-c3-validacao` | 31 envs, 3 referências de segredos, Ready=True, só OAuth Celivio ON; 13 OFF |
| Promoção controlada | Revisão `00279-rom` promovida mediante autorização | 100% do tráfego no checkpoint; `00277-nij` preservada para contingência |
| Início OAuth | Uma chamada GET pelo Gateway com OAuth ON obteve 302 para Shopee | **Operação com efeito**: cria state/cookie, não é teste inerte; não reutilizar URL assinada |
| Erro do navegador | Página “Destino inválido — A rota não aceita seleção pública de destino” | Código rejeita query pública no start; URL sem query permitiu novo fluxo. **Origem do parâmetro desconhecida** |
| Consentimento | Operador confirmou conta Neto entre opções Neto/Viviane | Shopee exibiu `netojacobus504` e “Autorizado com Sucesso” |
| Homologação | Callback + consulta Core restrita | HTTP 200, state usado, 2 Raw, conexão Live e tokens cifrados presentes |

**Limites de interpretação:** a execução sintética não validou OAuth real; o 302 não provou persistência; o 200 sem consulta Core seria insuficiente; não correlacionar automaticamente o erro posterior de query com os 409/400 de dias anteriores.

## 4. Incidentes, causas comprovadas e desbloqueios

### F1. Desvio de escopo e propostas alternativas de validação
Durante a prioridade Celivio, houve desvio para F12.3/PR #947 e investigações do OAuth universal F4/Edge e outros módulos. Essas frentes não eram dependências comprovadas para conectar Neto. **Falha processual:** hipótese de arquitetura promovida a desvio executivo sem prova de inviabilidade do caminho original. **Portão anti-desvio proposto:** registrar bloqueio observável, contraprova, menor correção reversível, efeitos e autorização da Camada Mestre. Sem isso, manter missão principal; não mesclar frentes.

### F2. HTTP 409/400 históricos
A revisão `00166-tvl` registrou callback 409 seguido de 400; state consumido não comprovava troca de token. Não é possível atribuir retrospectivamente a causa a cookie, conta, expiração, retry ou validação de shop. **Desbloqueio:** PR #951 adicionou motivos fixos sanitizados; teste sintético validou a instrumentação e a tentativa real seguinte funcionou. **Em recorrência:** confrontar revisão, horário, status, evento e reason sem coletar URL assinada; nunca repetir consentimento às cegas.

### F3. Gateway, tag e hostname
O Gateway encaminhava ao serviço principal, não automaticamente à URL da tag 0%. O backend global foi confirmado por leitura FULL; a configuração Celivio já existia, apesar de um plano anterior ainda tratá-la como pendente. **Regra:** estado efetivo prevalece sobre checklist antigo. Cookie `__Host-pc_shopee_live_state` é host-only; iniciar pelo subdomínio da tag e retornar pelo Gateway causa risco de incompatibilidade. Preservar o mesmo hostname do início ao callback.

### F4. Ambiente compartilhado e regressão potencial
A revisão diagnóstica `00277-nij` tinha 14 flags OFF; a revisão `00279-rom` tinha 1 ON e **13 OFF** no checkpoint. Essa promoção substituiu a configuração anterior do runtime compartilhado, que possuía funcionalidades de Adão/Viviane habilitadas. **Risco aberto de alta prioridade:** reconciliar essas funcionalidades por inspeção da revisão e revisão de dependências; não equiparar “conexões armazenadas” a “serviços operantes”. **Não afirmar que as 13 flags continuam OFF atualmente sem nova consulta.** Este documento não aprova qualquer reativação, Scheduler ou atualização de tráfego.

### F5. GET de início gera estado e inicia expiração
No handler, `STATE_TTL_MS = 10 * 60 * 1000`; cookie com `Max-Age=600; HttpOnly; Secure; SameSite=Lax; Path=/`. A contagem começa ao iniciar o OAuth, não ao selecionar a conta; não determina o prazo de toda a conexão. **Falha de procedimento:** usar GET 302 como se fosse health-check inofensivo. **Correção documental obrigatória:** não incluir comando GET executável ao caminho `/shopee/live/oauth/celivio/start`; não monitorar nem repetir essa rota. Fazer inspeções estáticas, e uma única jornada humana autorizada. Não alterar o handler nem remover validações.

### F6. “Destino inválido”
O handler recusa qualquer query não vazia no start: `Object.keys(request?.query ?? {}).length` leva ao HTML 400. Na execução, o uso posterior do caminho puro, sem query, permitiu prosseguir. **Ainda desconhecido:** qual componente acrescentara o parâmetro na tentativa anterior. **Recorrência:** observar somente URL sanitizada e logs; parar em erro, não retirar a validação, não publicar parâmetros da barra do navegador.

### F7. Expiração, consentimento e navegador
Usar o mesmo contexto de navegador e o mesmo hostname Gateway durante toda a jornada. Se passar o prazo de 10 minutos, primeiro verificar Core para evitar duplicar uma autorização já concluída; depois, se necessário, realizar novo início, sem reaproveitar redirect, state ou cookie. A escolha por e-mail isolado não garante shop; a Shopee deve confirmar a identidade da loja `netojacobus504`.

### F8. Falso positivo de homologação
Prova aceitável combina consentimento Shopee, callback na revisão correta, leitura autenticada `get_shop_info` e conexão/Raw no Core. Tokens são verificados pela **presença de campos cifrados**, nunca por exibição do ciphertext. Dois snapshots Shop Info não significam pedidos importados nem garantia de refresh futuro.

## 5. Método reutilizável proposto: cinco verificações, três decisões

**Status: proposta para avaliação do método especializado, não uma nova norma soberana.**

| Gate | Pergunta | Evidência mínima | Critério de bloqueio |
|---|---|---|---|
| P1-A identidade e escopo | Qual conta, loja e jornada autorizadas? | conta Core, shop de referência, conta Shopee na tela, mapa vigente | identidade ambígua, rota alternativa não justificada |
| P1-B runtime efetivo | Qual config/revisão serve o tráfego? | Gateway ACTIVE, backend, domínio, tráfego, Ready, digest, flags | tag confundida com backend principal; divergência documental |
| P2-A diagnóstico isolado | Qual falha concreta exige mudança? | logs sem segredos, teste, CI, digest, revisão 0% | causa inventada; código não identificado |
| P2-B promoção segura | Qual efeito compartilhado e como reverter? | 14 flags, referências de segredos, serviço, Scheduler, autorização, revisão anterior | função inesperada ON/OFF; risco sem aceite |
| P3 prova e continuidade | Consentimento e persistência estão íntegros? | loja correta, callback, `get_shop_info`, state, conexão e Raw | apenas 302, captura ou status 200 isolado |

**Cadeia enxuta:** identificar → ler runtime → isolar diagnóstico → aprovar mudança → promover reversivelmente → iniciar uma única autorização → confirmar Core → registrar checkpoint e pendências. Proibir relatórios redundantes a cada comando; guardar somente evidência discriminante.

### Comandos reutilizáveis — APENAS leitura

Para conferir a distribuição de revisões (não inicia OAuth):

~~~bash
gcloud run services describe integration-hub \
  --project=painel-central-integration-hub \
  --region=southamerica-east1 \
  --format=json
~~~

Para buscar apenas metadados de callback, substituindo revisão conforme a inspeção atual:

~~~bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="integration-hub" AND httpRequest.status=200 AND httpRequest.requestUrl:"/shopee/live/oauth/callback"' \
  --project=painel-central-integration-hub \
  --limit=5 \
  --format='table(timestamp,resource.labels.revision_name,httpRequest.status)'
~~~

**NÃO EXECUTÁVEL — referência histórica de rota com efeito de estado:** `GET /shopee/live/oauth/celivio/start` no hostname oficial. Não transformar em curl, health-check, automação ou teste em loop: cria estado no Core e começa prazo de dez minutos. Callback e URLs assinadas não devem aparecer em logs publicados.

**Consulta de Core:** filtrar por `channel_account_id`, projetar somente `environment`, `shop_id`, `partner_id`, timestamps, presença booleana dos campos cifrados e endpoint de Raw. Nunca selecionar `access_token_ciphertext`, `refresh_token_ciphertext`, `state_hash`, `payload`, cookie, code ou assinatura.

## 6. Matriz de desbloqueio

| Sintoma | Investigação correta | Resposta mínima |
|---|---|---|
| Start 503 com OAuth OFF | flags + revisão no Cloud Logging | bloqueio esperado; não habilitar sem gate |
| Start 503 com OAuth ON | backend real, env por revisão, logs | parar; não mudar IAM por palpite |
| Start 302 | redirect emitido e state potencialmente criado | não repetir como health-check |
| “Destino inválido” | query inesperada no start | URL sem parâmetros, sem remover proteção |
| Callback 400 | reason sanitizado + estágio + state | não concluir causa por status |
| Callback 409 | reason, loja/estado, revisão, Core | prevenir retries cegos |
| Callback 502 | etapa Shopee de troca/leitura/refresh | análise dirigida; sem dados secretos |
| Callback 503 | flags ou persistência segundo estágio | distinguir bloqueio de falha Core |
| Callback 200 isolado | conferir Core + Raw | não homologar só por 200 |
| Conexão Live + shop correto + dois Raw | conferir timestamp e tokens presentes | homologar **apenas OAuth** |

## 7. Regras de segurança, reversão e continuidade

- **Pré-mudança:** registrar revisão 100%, digest, IAM, variáveis e funções de outras contas; comparar template vs revisão produtiva; definir reversão; exigir aprovação explícita.
- **Mudança:** candidata por digest e 0% antes da promoção; tags não equivalem a 0 invocações; não alterar Gateway se não for necessário; ativar exclusivamente o escopo autorizado.
- **Contraprova:** confirmar que o Gateway chegou à revisão, status esperado, loja e conexão no Core. Logs apenas sanitizados.
- **Reversão:** revisão `00277-nij` ficou como referência OFF no caso, `00167-hm8` como referência histórica de configuração anterior; **não reutilizar essas referências sem verificar estado atual**. Trocar tráfego não desfaz tokens ou estados persistidos.
- **Governança:** PR #951 tem fluxo de integração independente. Documentar sucesso da imagem em execução não equivale a declarar merge da PR.
- **Risco compartilhado pendente:** reconciliar especificamente Adão/Viviane em plano próprio antes de reativar funções. **Nenhuma autorização operacional decorre desta publicação.**

## 8. Pendências independentes e checkpoint

**Homologado:** autenticação Celivio, loja `1357031949`, `partner_id=2047685`, estado consumido, campos dos tokens armazenados, dois Raw `get_shop_info`, callback HTTP 200.

**Não homologado:** refresh continuado, pedidos e importação, mappings e composições, logística e etiquetas, impressão, expedição, fiscal, automação/Scheduler e reconciliação de funções compartilhadas de Adão/Viviane. Na última leitura da execução havia 13 flags OFF e Scheduler Adão PAUSED; ambos exigem **nova leitura** antes de qualquer plano operacional.

**Próxima missão separada, sem autorização de execução:** raio-X somente leitura do fluxo Adão CPF e compatibilidade multiloja para Celivio, com portões próprios de escrita, duplicidade e isolamento por conta.

## 9. Registro de conhecimento canônico

**Identificador proposto:** `SHOPEE-OAUTH-CELIVIO-NETO-CASE-2026-11-19-V1.0`  
**Natureza:** registro de aprendizado e evidência, sem substituir método vigente.  
**Localização GitHub:** `docs/operations/METODO_IMPLANTACAO_SHOPEE_CELIVIO_NETO_V1_0_2026-11-19.md`  
**Fonte superior:** Mapa Congelado Integração Shopee V2.0.  
**Regra de incorporação:** localizar a **base canônica vigente e seu índice** antes da inserção; acrescentar **uma referência**, preservando todos os artefatos e sem duplicar conteúdo. Versões históricas da base não devem ser atualizadas como canônicas sem reconciliação.

## 10. Rastreabilidade e proteção das fontes

- PR de diagnóstico: [#951](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/951), commit `5356cfbbffdce2a6d7575346c2096f6231637fa3`; Issue de execução [#949](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/issues/949).
- Plano anterior de Gateway: `docs/operations/CELIVIO_OAUTH_GATEWAY_ROTA_COMPARTILHADA_PLANO_EXECUCAO_2026-11-16.md`.
- Handler de referência: `services/integration-hub/src/shopee-live-oauth.mjs` no commit PR #951. Não alterado por esta documentação.
- **Cloud Shell e Cloud Logging:** saídas fornecidas pelo operador na jornada de 19/11/2026, incluindo revisão, flags, digest, HTTP 503/302/200.
- **Core:** SELECT somente leitura ao Supabase do projeto via conector Lovable; tabelas `shopee_oauth_states`, `shopee_oauth_connections`, `marketplace_raw_snapshots`.
- **Capturas:** telas de seleção e autorização Shopee + página final de sucesso do Hub, sem anexar URLs brutas.
- **Segurança editorial:** nenhum access/refresh token, ciphertext, state, código OAuth, cookie, segredo, assinatura ou URL de autorização assinada foi incluído neste documento.

**Parecer do caso:** C3 OAuth Celivio/Neto aprovado por prova. O método transferível é **identidade → runtime efetivo → diagnóstico sanitizado → promoção reversível → consentimento único → Core/Raw**, com portão anti-desvio. Não converter este registro em novo Mapa Soberano.
