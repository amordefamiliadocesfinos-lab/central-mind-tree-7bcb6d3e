# MINI MAPA — F4-GW | ROTA OPENAPI UNIVERSAL — FECHAMENTO TÉCNICO

**Projeto:** Painel Central — Amor de Família / SHOPEE-OAUTH-MULTICONTAS-01  
**Data:** 18/11/2026 | **Autoridade:** Camada Mestre  
**Escopo:** um único acréscimo documental no Gateway, sem ativação, implantação ou mudanças nas rotas existentes.

## 1. Objetivo congelado

Preparar em arquivo **local, isolado e validável** o delta mínimo da API Config publicada, para reconhecer:
`GET /shopee/live/oauth/universal/start`.

Nenhuma conta nova, nenhum endpoint por vendedor, nenhuma modificação de callback, tokens, grant, Scheduler, Cloud Run, integração Shopee ou Gateway produtivo.

## 2. Mini mapa de execução e evidências

| ID | Trabalho | Evidência / entrega | Status |
|---|---|---|---|
| GW-01 | Identificar o Gateway efetivamente em uso | Cloud Shell do proprietário: `integration-hub-oauth` ACTIVE, config `oauth-celivio-20261116-v1` | **Concluído** |
| GW-02 | Inventariar rotas atuais | Viviane, Adão, Celivio e callback presentes; universal ausente no documento ACTIVE | **Concluído** |
| GW-03 | Implementar preparador fail-closed | `prepare-universal-gateway-route.py` e exportador `export-active-shopee-gateway-candidate.py`; PR #933 | **Concluído** |
| GW-04 | Testar preservação e isolamento | CI da PR #933 (incluindo execução `44319285807`) passou em fixture; falhas por rota duplicada, backend inadequado, config trocada | **Concluído — sintético** |
| GW-05 | Gerar delta usando config publicada no Cloud Shell | `candidato-v2`, fonte SHA256 `8c3b07efabe782fc45c169b20269bfe5604a71d73adb61e5f7db51e430d41849`; candidato SHA256 `86bb7c0556ae9f18a0b92dc9babf05297e1364af50436f6a5cb7b5dcbd115d2a` | **Concluído — local** |
| GW-06 | Conferir diff | Terminal apresentou só um bloco novo de 13 linhas: path, GET, operação universal, resumo e retornos 302/400/409/503; script confirmou demais dados preservados | **Concluído — evidência de saída** |
| GW-07 | Publicação e homologação de Gateway real | Nenhuma API Config foi criada nem publicada; sem testes de roteamento HTTP real | **Fora deste fechamento; próxima etapa controlada** |

## 3. Resultado esperado e observado

**Esperado:** clonar o contrato de backend de uma rota GET existente para uma nova rota GET universal, com `operationId` distinto e descrição multicontas, preservando integralmente a configuração publicada.

**Observado:** fonte lida diretamente da config anexada ao Gateway; versão candidata local V2 gerada com hashes distintos, no diretório privado do Cloud Shell do proprietário:
`/home/deividijacobus/shopee-oauth-f4-9jpQrP2F/candidato-v2/`.

**Caveat:** a saída filtrada de `diff` e o resultado do preparador suportam delta mínimo, mas **não comprovam validação do Google API Gateway sobre essa candidata**, nem funcionamento de backend autenticado / `x-google-backend`, nem HTTP real.

## 4. Critérios de fechamento

- [x] Uma rota universal preparada.
- [x] Quatro rotas atuais preservadas por comparação do preparador.
- [x] Callback e configuração de origem sem mutação.
- [x] Descrição independente de Adão.
- [x] Testes automatizados concluídos.
- [x] Evidência real da geração local e hashes documentados.
- [x] Nenhuma publicação ou ativação.
- [ ] Validação end-to-end de produção e aprovação de Gateway: **não fazem parte deste mini mapa**.

**Decisão:** **F4-GW PREPARAÇÃO DOCUMENTAL ENCERRADA.** Não equivale a implantação, homologação funcional ou autorização produtiva.

## 5. Handoff para a próxima frente

**F4-CAND — Candidata integrada, gate de pré-implantação** (nova frente, não reabre F4-GW):

1. Verificar base encadeada de PRs `#922 → #924 → #928 → #929 → #930 → #931 → #932 → #933`, com reconciliação de `#911`. Todas permaneceram draft, sem merge, na consulta.
2. Executar regressões Node/Deno/PostgreSQL descartável no commit integrado, sem segredos produtivos.
3. Conferir mapeamento de rotas, audience, envs requeridas e flags `SHOPEE_OAUTH_UNIVERSAL_START_ENABLED=false`, `SHOPEE_OAUTH_UNIVERSAL_CALLBACK_ENABLED=false`.
4. Definir prova de rollback e janela de candidata Cloud Run, preservando `integration-hub-00167-hm8` como produção 100%, `integration-hub-00166-tvl` como rollback e Scheduler Adão PAUSED **somente conforme último output verificado**.
5. Qualquer deploy de candidata, aplicação de migrations, ativação de flags, novo API Config ou mudança de tráfego exige autorização separada. Não aplicar alterações produtivas neste mini mapa.

**Fontes:** PR #933, run GitHub Actions `44319285807`, respostas do Cloud Shell de 18/11/2026, PR #931 e relatório F4 integrado. Não imprimir o YAML completo, segredos, tickets ou tokens.
