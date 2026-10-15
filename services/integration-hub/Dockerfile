FROM node:22-alpine

ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /workspace/services/integration-hub

COPY services/integration-hub/package.json ./package.json
COPY services/integration-hub/src ./src
COPY supabase/functions/_shared/shopee-protocol.mjs /workspace/supabase/functions/_shared/shopee-protocol.mjs

RUN node -e "Promise.all([import('file:///workspace/services/integration-hub/src/connectors/shopee-protocol.mjs'), import('file:///workspace/services/integration-hub/src/shopee-live-oauth.mjs'), import('file:///workspace/services/integration-hub/src/shopee-live-orders.mjs'), import('file:///workspace/services/integration-hub/src/shopee-live-label.mjs')])"

EXPOSE 8080

CMD ["node", "src/server.mjs"]
