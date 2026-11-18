# SHOPEE-OAUTH-MULTICONTAS-01 — PREPARAÇÃO DA HOMOLOGAÇÃO TÉCNICA F4

**Data:** 18/11/2026  
**Classificação:** preflight somente leitura, sem autorização de implantação/merge.  
**Referência de validação sintética:** PR #931, run `44313755944`, três jobs `success` observados.  
**Referência de candidato operacional Celivio:** revisão `integration-hub-oauth-celivio-73b264c9`, 0% de tráfego conforme repasse; **não revalidado no GCP nesta preparação**.

## 1. Estado das PRs observado no GitHub nesta execução

| PR | Especialidade | Base | Situação observada |
|---|---|---|---|
| #911 | Correção OAuth Celivio | main | aberta, draft, não mergeada, commit `73b264c9` |
| #922 | F3-A autorização | main | aberta, draft, não mergeada |
| #924 | F3-B handoff | branch #922 | aberta, draft, não mergeada |
| #928 | F3-C callback | branch #924 | aberta, draft, não mergeada |
| #929 | F3-D refresh | branch #928 | aberta, draft, não mergeada |
| #930 | Reconciliação #911 | branch #929 | aberta, draft, não mergeada |
| #931 | F4 integrada | branch #930 | aberta, draft, não mergeada (testes sintéticos aprovados) |

**Regra:** não interpretar o CI da PR #931 como prova de que a #911 esteja incorporada na base final ou implantada. A PR #930 reproduz seus comportamentos relevantes e testes, mas a cadeia deve ser revisada na preparação de merge.

## 2. Fatos de código inspecionados

- O Integration Hub registra o início `/shopee/live/oauth/universal/start` antes do handler legado, sob flag default-off.
- O Gateway deve expor **uma rota GET adicional**, com backend e credenciais coerentes, sem retirar `/shopee/live/oauth/start`, `/adao/start`, `/celivio/start` e `/callback`.
- O script preexistente `prepare-celivio-gateway-route.py` só prepara a rota Celivio e **não** serve como prova de rota universal publicada.
- A Edge Function de emissão depende de `PAINEL_PUBLIC_ORIGIN` e `SHOPEE_OAUTH_HANDOFF_START_URL`; a última valida que host é `integration-hub-oauth-bh4c23q1.ue.gateway.dev` e que path é o início universal.
- A resposta da Edge Function contém `handoff_url` com ticket transitório. Tratar URL/ticket como material temporário sensível: nunca imprimir, registrar logs, enviar para documento/chat ou compartilhar.
- As flags `SHOPEE_OAUTH_UNIVERSAL_START_ENABLED` e `SHOPEE_OAUTH_UNIVERSAL_CALLBACK_ENABLED` são independentes e default-off. Não acionar uma sem garantir o retorno correspondente.
- O Core guarda grants, aprovações de Shop ID e states universais segregados. As migrations só foram testadas em PostgreSQL descartável; não comprovam ambiente de produção.

## 3. Scripts entregues

`services/integration-hub/scripts/shopee-universal-f4-readonly-preflight.sh` — consulta o GCP via `gcloud` em modo somente leitura para mostrar tráfego Cloud Run, revisões de referência, listagem de Gateway e estado do Scheduler. Não exibe variáveis/secrets/tokens nem altera recursos.

`services/integration-hub/scripts/check-shopee-universal-published-openapi.py` — examina uma **cópia comprovadamente obtida da configuração OpenAPI publicada** para encontrar as cinco rotas, sem rede ou alterações. A fonte do documento deve ser registrada à parte, com identidade da API config e revisão; um template local não prova publicação.

`services/integration-hub/scripts/test-shopee-universal-published-openapi.py` — testes offline do verificador. O script de preflight só verifica existência/status e rotas; não valida autenticação real ou secrets.

**Execução manual autorizável, somente leitura:** no Cloud Shell autenticado e com diretório do repositório apontando à branch:
```bash
bash services/integration-hub/scripts/shopee-universal-f4-readonly-preflight.sh
```
Para OpenAPI publicado exportado por procedimento autorizado, após confirmar sua procedência:
```bash
python3 services/integration-hub/scripts/check-shopee-universal-published-openapi.py --published-openapi /caminho/para/openapi-publicado.yaml
```
**Não exportar credenciais, chaves, JWT ou tokens.** Não adicionar esse arquivo de configuração real ao repositório nem ao chat se contiver dados sensíveis.

## 4. Resultado F4 e pendências observacionais

| Gate | Evidência nesta execução | Estado |
|---|---|---|
| CI do fluxo integrado | Run #44313755944 = três jobs success | APROVADO — testes sintéticos |
| Sequência de PRs | Metadados do GitHub consultados, todas drafts | DOCUMENTADO; merge não autorizado |
| Gateway publicado | Não disponível no browser autenticado presente nem consultado via gcloud | NÃO COMPROVADO |
| Baseline Cloud Run / revisão Celivio | Informação de repasse anterior, não consulta atual de GCP | REVALIDAÇÃO PENDENTE |
| Scheduler Adão | Repasse anterior indicou PAUSED; não consultado hoje | REVALIDAÇÃO PENDENTE |
| Flags e segredos do candidato | Não consultados no GCP | PENDENTE |
| Permissões / migrations reais | Não aplicadas; somente PostgreSQL descartável testado | PENDENTE |
| Conexão OAuth real Celivio | Consentimento, `get_shop_info` e tokens cifrados não comprovados | PENDENTE |

## 5. Preflight de janela (gate operacional, não executado)

1. Obter leitura autenticada do Gateway publicado e do Cloud Run, registrar IDs de configuração/revisões e tráfego.
2. Confirmar que o rollback e as 27 tags existentes permanecem intactos, e Scheduler Adão PAUSED; **não presumir** valores do repasse anterior.
3. Comparar versões e diferenças relevantes entre #911 e #930, resolver o empilhamento de PRs sem merge/desdobramento automático.
4. Conferir implantação de migrations, grants por operador, aprovações de loja e política de emissão/revogação sem abrir acesso excessivo.
5. Preparar nova candidata com flags default-off, validar health e não regressão; evitar copiar segredos em logs.
6. Somente com autorização explícita, homologar OAuth real de Celivio e quarta conta futura, verificar `get_shop_info` e armazenamento cifrado, promover com rollback ensaiado.

## 6. Decisão

**Preflight documental e instrumentos de leitura preparados.** O Gateway publicado e demais recursos do GCP **não foram acessados nem validados** neste chat. O estado da arquitetura universal permanece **NÃO HOMOLOGADO em produção**. Nenhum deploy, merge, autorização de loja, ativação de flags ou Scheduler foi executado.
