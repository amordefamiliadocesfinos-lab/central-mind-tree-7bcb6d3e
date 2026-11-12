# Núcleo 2.0 — M5 | Homologação controlada de leitura e reavaliação

**Data:** 12/11/2026  
**Mapa soberano:** Núcleo 2.0 V1.0 — M5  
**Limite:** nenhuma revogação real da concessão produtiva; nenhum uso do construtor da Lovable.

## 1. Verificação real de acesso, sem mutação

Consultas SQL executadas no Core oficial em transações separadas `BEGIN; SET LOCAL ROLE authenticated; set_config('request.jwt.claim.sub', ... , true); SELECT ...; ROLLBACK;`, sempre com leitura e sem alterar concessões.

| Identidade simulada sob RLS | Capacidade visível | Frentes M3 | Evidências M4 | Dependências M3 |
|---|---:|---:|---:|---:|
| Autorizada com `nucleo_manage` | 1 | 7 | 42 | 0 |
| Sem concessão | 0 | 0 | 0 | 0 |

A identidade sem concessão não teve acesso ao acervo M3/M4. **Esse teste não equivale a revogar uma conta com sessão real aberta.** Nenhuma concessão administrativa foi revogada ou recriada.

## 2. Conferência da aplicação publicada

A leitura do contexto de uma aba autenticada já aberta em `/nucleo` mostrou o componente **Supervisão assistida — M5**, botão **Reavaliar**, a leitura de 7 frentes/42 evidências/0 dependências/0 alertas e o laboratório DEMO-M5 isolado. O conector de leitura de abas não opera cliques: por isso, **não foi alegada execução interativa do botão**.

## 3. Evidência visível de nova consulta

Foi acrescentado no componente M5 o texto **Última leitura autorizada** e um contador de consultas válidas da sessão. Esses valores somente são atualizados após:
- `auth.getUser()` com identidade identificada;
- `nucleo_manage` explicitamente ativo e não revogado, consultado sob RLS;
- leitura sem erro de frentes, evidências e dependências, abaixo dos respectivos limites;
- aceite da análise com dados novos (não os recebidos do componente pai).

Em mudança de autenticação, perda de visibilidade ou reinício de consulta, o timestamp anterior é ocultado. O botão **Reavaliar** dispara nova consulta read-only. Uma nova data/contagem só é exibida quando esse processo termina com sucesso. Isso permite ao operador confirmar visualmente que ocorreu outra leitura; não representa prova de atualização automática no GitHub.

## 4. Portão de encerramento

- CI deve aprovar testes de motor, cenários sintéticos, laboratório, proveniência, gatilhos de leitura e build.
- Após publicação, uma pessoa autorizada clica em **Reavaliar** e confere que o indicador de leitura válida foi atualizado, mantendo a quantidade de evidências realmente consultada.
- Um teste de revogação **durante sessão real** continua pendente de ambiente de ensaio com identidade própria e autorização apropriada, preservando a única concessão administrativa produtiva. RLS negativa em transação é evidência de controle de leitura, não de propagação de revogação na UI.
- A M5 permanece `em_validacao`, sem promoção automática do Kanban e sem modificação de permissões, dependências ou documentos.

**Estado deste marco:** testes RLS positivos e negativos executados; indicador de reavaliação implementado em código; homologação com clique no navegador não comprovada por esta execução.
