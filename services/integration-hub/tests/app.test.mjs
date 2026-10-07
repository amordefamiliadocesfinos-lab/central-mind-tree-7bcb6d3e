import test from 'node:test';
import assert from 'node:assert/strict';
import { routeRequest } from '../src/app.mjs';
import { defineConnectorDescriptor } from '../src/contracts.mjs';

test('GET /health exposes only minimal runtime metadata', () => {
  const response = routeRequest({ method: 'GET', path: '/health' });
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), {
    status: 'ok',
    service: 'painel-central-integration-hub',
    version: '0.1.0',
  });
});

test('health endpoint rejects unsupported methods', () => {
  const response = routeRequest({ method: 'POST', path: '/health' });
  assert.equal(response.status, 405);
  assert.deepEqual(JSON.parse(response.body), { error: 'method_not_allowed' });
});

test('unknown routes fail closed', () => {
  const response = routeRequest({ method: 'GET', path: '/unknown' });
  assert.equal(response.status, 404);
  assert.deepEqual(JSON.parse(response.body), { error: 'route_not_found' });
});

test('connector descriptor is provider-agnostic and capability constrained', () => {
  const descriptor = defineConnectorDescriptor({
    provider: 'example-provider',
    environment: 'sandbox',
    capabilities: ['health', 'pull', 'health'],
  });

  assert.deepEqual(descriptor, {
    provider: 'example-provider',
    environment: 'sandbox',
    capabilities: ['health', 'pull'],
  });

  assert.throws(
    () => defineConnectorDescriptor({ provider: 'x', environment: 'live', capabilities: ['database-admin'] }),
    /unsupported connector capability/,
  );
});
