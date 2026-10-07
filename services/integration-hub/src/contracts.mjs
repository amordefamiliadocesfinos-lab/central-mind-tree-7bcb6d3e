export const HUB_SERVICE_NAME = 'painel-central-integration-hub';
export const HUB_VERSION = '0.1.0';

export const CONNECTOR_CAPABILITIES = Object.freeze([
  'authorize',
  'refresh',
  'health',
  'pull',
  'push',
  'webhook',
  'normalize',
]);

const capabilitySet = new Set(CONNECTOR_CAPABILITIES);

function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

export function defineConnectorDescriptor(input) {
  const provider = requiredText(input?.provider, 'provider');
  const environment = requiredText(input?.environment, 'environment');
  const capabilities = [...new Set(input?.capabilities ?? [])];

  for (const capability of capabilities) {
    if (!capabilitySet.has(capability)) {
      throw new TypeError(`unsupported connector capability: ${capability}`);
    }
  }

  return Object.freeze({
    provider,
    environment,
    capabilities: Object.freeze(capabilities),
  });
}
