# Integration Hub — F2 Google Cloud

Infraestrutura do serviço existente em `services/integration-hub`. O Core e o
backend Supabase continuam canônicos; esta F2 não implementa o Core Bridge.

| Recurso | Configuração |
| --- | --- |
| Project ID / Number | `painel-central-integration-hub` / `899273223001` |
| Região | `southamerica-east1` |
| VPC | `integration-hub-vpc` |
| Subnet / CIDR | `integration-hub-subnet` / `10.20.0.0/26` |
| Cloud Router | `integration-hub-router` |
| Cloud NAT | `integration-hub-nat` |
| Endereço regional IPv4 | `integration-hub-egress-ip` |
| IPv4 reservado | `34.151.213.190` (confirme pelo comando de inspeção) |
| Cloud Run | `integration-hub` |
| Runtime | `integration-hub-runtime@painel-central-integration-hub.iam.gserviceaccount.com` |
| Escala | mínimo `0`, máximo `3` no serviço e na revisão |
| Recursos por instância | `1` vCPU, `256Mi`, timeout `60s` |

Arquitetura: Cloud Run → **Direct VPC Egress** (`all-traffic`) → VPC →
Cloud NAT → um IPv4 estático. Não utiliza Serverless VPC Connector.
O serviço exige autenticação IAM; não há acesso `allUsers` ou
`allAuthenticatedUsers`. A identidade de runtime não precisa de roles de projeto,
secrets ou chaves JSON nesta fase.

## Inspeção antes de criar ou atualizar

Execute com uma conta Google autorizada e sempre com o projeto explícito.
Reutilize recursos existentes corretos. Se um recurso divergir, pare e reporte;
não substitua nem apague recursos. A VPC e a subnet foram reutilizadas nesta F2.

```sh
PROJECT=painel-central-integration-hub
REGION=southamerica-east1
gcloud auth list
gcloud projects describe "$PROJECT"
gcloud billing projects describe "$PROJECT"
gcloud services list --enabled --project="$PROJECT"
gcloud compute networks describe integration-hub-vpc --project="$PROJECT"
gcloud compute networks subnets describe integration-hub-subnet --region="$REGION" --project="$PROJECT"
gcloud compute addresses describe integration-hub-egress-ip --region="$REGION" --project="$PROJECT"
gcloud compute routers describe integration-hub-router --region="$REGION" --project="$PROJECT"
gcloud compute routers nats describe integration-hub-nat --router=integration-hub-router --region="$REGION" --project="$PROJECT"
gcloud run services describe integration-hub --region="$REGION" --project="$PROJECT"
gcloud run services get-iam-policy integration-hub --region="$REGION" --project="$PROJECT"
gcloud artifacts repositories list --project="$PROJECT"
```

O NAT deve apresentar `MANUAL_ONLY`, somente o endereço acima em `natIps`,
`LIST_OF_SUBNETWORKS` e somente a faixa primária da subnet acima.
Se ausentes, os comandos mínimos para Router, IP e NAT são:

```sh
gcloud compute routers create integration-hub-router --network=integration-hub-vpc --region="$REGION" --project="$PROJECT"
gcloud compute addresses create integration-hub-egress-ip --region="$REGION" --project="$PROJECT"
gcloud compute routers nats create integration-hub-nat --router=integration-hub-router --region="$REGION" --nat-custom-subnet-ip-ranges=integration-hub-subnet --nat-external-ip-pool=integration-hub-egress-ip --project="$PROJECT"
```

## Deploy e validação

Na raiz de um checkout limpo da `origin/main` atual, execute os testes do Hub e
implante apenas este diretório. Não envie `.env`, tokens ou secrets.
O deploy por source utiliza Cloud Build e Artifact Registry.

```sh
(cd services/integration-hub && npm test)
gcloud run deploy integration-hub \
  --source=services/integration-hub --project="$PROJECT" --region="$REGION" \
  --network=integration-hub-vpc --subnet=integration-hub-subnet --vpc-egress=all-traffic \
  --service-account=integration-hub-runtime@painel-central-integration-hub.iam.gserviceaccount.com \
  --no-allow-unauthenticated --invoker-iam-check \
  --min=0 --max=3 --min-instances=0 --max-instances=3 \
  --cpu=1 --memory=256Mi --timeout=60
gcloud run services describe integration-hub --region="$REGION" --project="$PROJECT" --format=yaml
gcloud compute addresses describe integration-hub-egress-ip --region="$REGION" --project="$PROJECT" --format='value(address)'
```

Confirme revisão `Ready=True`, 100% de tráfego na revisão limpa, identidade
dedicada, rede/subnet acima, egress `all-traffic`, mínimo zero e máximo três.
Para testar o serviço privado, em um terminal execute
`gcloud run services proxy integration-hub --region="$REGION" --project="$PROJECT" --port=8081`;
em outro, `curl --fail http://127.0.0.1:8081/health`. Resultado esperado: HTTP 200
com `status: ok`. Não publique o serviço para testar.

A prova de egress deve partir do processo **Cloud Run**, e não do Cloud Shell:
uma consulta HTTPS temporária a um identificador público de IPv4 deve observar
exatamente o IP obtido pelo comando acima. Remova a instrumentação e redeploye
o código original com a mesma rede; não deixe endpoint diagnóstico ou secrets.
Secret Manager está habilitado, mas nenhuma versão ou valor é necessário na F2.

Prova de egress em 2026-10-08: revisão temporária
`integration-hub-f2-egress-probe`, consulta HTTPS a `api4.ipify.org`, IP reservado
e observado `34.151.213.190`. Registro Cloud Logging `f2-egress-proof` em
`2026-10-08T21:10:47.256849Z`. A instrumentação não faz parte do código Git.
O código original foi restaurado e redeployado em `integration-hub-f2-clean`,
`Ready=True`, com 100% de tráfego. `GET /health`: HTTP 200 autenticado e HTTP 403
sem autenticação. `npm test`: quatro testes aprovados. URL do serviço:
`https://integration-hub-899273223001.southamerica-east1.run.app`.

Há cobrança de NAT, IPv4 reservado, builds e armazenamento de imagens mesmo
com mínimo zero no Cloud Run. Consulte o faturamento do projeto para os valores
efetivos; não crie IPs, regiões ou serviços adicionais.
