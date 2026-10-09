# Shopee Live V1 — OAuth ingress + Core Bridge

This document records the minimum Hub extension required by Shopee Live V1.
It does not implement Shopee Live itself.

## Ingress decision

The existing `integration-hub` Cloud Run service remains private behind Google IAM.

Public OAuth traffic is exposed through **Google Cloud API Gateway**, with only
these two routes configured:

- `GET /shopee/live/oauth/start`
- `GET /shopee/live/oauth/callback`

API Gateway invokes the existing private Cloud Run backend using a dedicated
service account that has `roles/run.invoker` **only on this Cloud Run service**.

The Hub itself must not receive `allUsers`.

API Gateway does not currently provide a South America deployment region, so the
gateway is deployed in `us-east1`; the Cloud Run backend, VPC, NAT, Core Bridge,
secrets and outbound egress remain in `southamerica-east1`. Shopee API calls
continue to leave the Hub through the existing static IPv4 `34.151.213.190`.

The gateway definition is:

`services/integration-hub/infra/gcp/shopee-oauth-gateway.openapi.yaml`

The gateway hostname becomes the public OAuth base URL. The Shopee redirect URI
must use:

`https://<gateway-host>/shopee/live/oauth/callback`

The `start` route is intentionally narrow for Live V1: the application must
bind it to the single approved pilot account. It must not accept an arbitrary
`channel_account_id` from the public request. The callback is protected by the
one-use OAuth state contract below.

## GCP resources

Preferred resource names:

- API ID: `integration-hub-oauth`
- Gateway ID: `integration-hub-oauth`
- Gateway region: `us-east1`
- Backend auth service account:
  `integration-hub-oauth-gateway@painel-central-integration-hub.iam.gserviceaccount.com`

Required APIs:

- `apigateway.googleapis.com`
- `servicemanagement.googleapis.com`
- `servicecontrol.googleapis.com`

Create no service-account key.

The gateway service account receives only service-level Cloud Run invocation:

```sh
PROJECT=painel-central-integration-hub
RUN_REGION=southamerica-east1
GATEWAY_REGION=us-east1
GATEWAY_SA=integration-hub-oauth-gateway@$PROJECT.iam.gserviceaccount.com

gcloud services enable \
  apigateway.googleapis.com \
  servicemanagement.googleapis.com \
  servicecontrol.googleapis.com \
  --project="$PROJECT"

gcloud iam service-accounts create integration-hub-oauth-gateway \
  --project="$PROJECT" \
  --display-name="Integration Hub OAuth Gateway"

gcloud run services add-iam-policy-binding integration-hub \
  --region="$RUN_REGION" \
  --project="$PROJECT" \
  --member="serviceAccount:$GATEWAY_SA" \
  --role="roles/run.invoker"
```

Create a new immutable API config whenever the OpenAPI definition changes:

```sh
API_ID=integration-hub-oauth
CONFIG_ID="oauth-v1-$(git rev-parse --short HEAD)"

gcloud api-gateway apis describe "$API_ID" --project="$PROJECT" >/dev/null 2>&1 ||
gcloud api-gateway apis create "$API_ID" --project="$PROJECT"

gcloud api-gateway api-configs create "$CONFIG_ID" \
  --api="$API_ID" \
  --openapi-spec=services/integration-hub/infra/gcp/shopee-oauth-gateway.openapi.yaml \
  --backend-auth-service-account="$GATEWAY_SA" \
  --project="$PROJECT"

if gcloud api-gateway gateways describe integration-hub-oauth \
  --location="$GATEWAY_REGION" --project="$PROJECT" >/dev/null 2>&1; then
  gcloud api-gateway gateways update integration-hub-oauth \
    --api="$API_ID" \
    --api-config="$CONFIG_ID" \
    --location="$GATEWAY_REGION" \
    --project="$PROJECT"
else
  gcloud api-gateway gateways create integration-hub-oauth \
    --api="$API_ID" \
    --api-config="$CONFIG_ID" \
    --location="$GATEWAY_REGION" \
    --project="$PROJECT"
fi

gcloud api-gateway gateways describe integration-hub-oauth \
  --location="$GATEWAY_REGION" \
  --project="$PROJECT" \
  --format="value(defaultHostname)"
```

A gateway request to an undeployed Hub OAuth route can be used only to prove
that API Gateway authenticated to the private Cloud Run backend; the Shopee
specialist owns the route implementation.

## Core Bridge Shopee Live actions

Transport authentication remains HMAC-SHA256 `v1` using the existing
`INTEGRATION_HUB_CORE_BRIDGE_HMAC_SECRET` /
`CORE_BRIDGE_HMAC_SECRET` pair. The Hub still has no Supabase
`service_role`.

The Bridge pins `environment='live'`; callers cannot choose the environment.

### `shopee.oauth_state.create`

Request body before HMAC signing:

```json
{
  "action": "shopee.oauth_state.create",
  "channel_account_id": "<uuid>",
  "state_hash": "<64 lowercase hex>",
  "expires_at": "<ISO-8601, future, <= 15 minutes>"
}
```

Behavior:

- requires an active `channel_accounts` row;
- persists to existing `shopee_oauth_states`;
- environment is always `live`;
- duplicate `state_hash` is ignored idempotently.

### `shopee.oauth_state.consume`

```json
{
  "action": "shopee.oauth_state.consume",
  "state_hash": "<64 lowercase hex>"
}
```

Behavior:

- atomically sets `used_at` only when state is Live, unconsumed and unexpired;
- returns only the canonical `channel_account_id`;
- invalid/expired/already consumed state returns HTTP 409.

### `shopee.oauth_connection.upsert`

```json
{
  "action": "shopee.oauth_connection.upsert",
  "channel_account_id": "<uuid>",
  "partner_id": 123,
  "shop_id": 456,
  "main_account_id": null,
  "merchant_id": null,
  "access_token_ciphertext": "<encrypted token>",
  "refresh_token_ciphertext": "<encrypted token>",
  "access_token_expires_at": "<ISO-8601 or null>",
  "refresh_token_expires_at": "<ISO-8601 or null>",
  "authorization_expires_at": "<ISO-8601 or null>",
  "shop_name": "<string or null>",
  "region": "<string or null>",
  "shop_status": "<string or null>",
  "last_authenticated_at": "<ISO-8601>",
  "last_refreshed_at": "<ISO-8601 or null>"
}
```

Raw Shopee tokens are not accepted by contract. Encryption happens in the Hub
before the Bridge call. The Bridge upserts the existing
`shopee_oauth_connections` row with environment fixed to `live`.

### `shopee.raw_shop_snapshot.upsert`

```json
{
  "action": "shopee.raw_shop_snapshot.upsert",
  "channel_account_id": "<uuid>",
  "external_entity_id": "<numeric shop_id as string>",
  "request_id": "<Shopee request id or null>",
  "observed_at": "<ISO-8601>",
  "payload": {},
  "payload_hash": "<64 lowercase hex>"
}
```

The Bridge pins:

- source = `shopee_open_platform`
- environment = `live`
- external_entity_type = `shop`
- endpoint = `/api/v2/shop/get_shop_info`

Persistence reuses the existing Raw Snapshot idempotency index.

## Existing schema — no migration

The current canonical database already supports `environment='live'` in
`shopee_oauth_states` and `shopee_oauth_connections`, and the existing Raw
Snapshot uniqueness contract already covers source/environment/account/entity/
endpoint/hash. No F5 Hub migration is required.

## Security invariants

- Cloud Run `integration-hub` stays private.
- Only API Gateway receives public OAuth traffic.
- The gateway has no database credentials or Shopee secrets.
- The gateway service account has no project-wide role.
- Hub has no Supabase `service_role`.
- Core Bridge remains the only path to canonical persistence.
- HMAC v1 remains mandatory.
- No Pedido, Estoque, Financeiro, CRM, catalog, external Shopee write, queue or
  scheduler is introduced here.
