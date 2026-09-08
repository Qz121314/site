import protocolConfig from './storefront-bootstrap-protocol.json' with { type: 'json' };

export type StorefrontBootstrapProtocolDescriptor = {
  schemaVersion: number;
  minReadableSchemaVersion: number;
  capabilities: string[];
};

function assertProtocolConfig(): void {
  const current = protocolConfig.currentSchemaVersion;
  const minimum = protocolConfig.minReadableSchemaVersion;
  if (!Number.isInteger(current) || !Number.isInteger(minimum) || current < 1) {
    throw new Error('Storefront bootstrap protocol versions must be positive integers.');
  }
  if (minimum < 1 || minimum > current) {
    throw new Error('Storefront bootstrap minimum readable schema is invalid.');
  }
  if (current - minimum > 1) {
    throw new Error('Storefront bootstrap compatibility window must remain bounded to N/N-1.');
  }
  if (
    !Array.isArray(protocolConfig.capabilities) ||
    protocolConfig.capabilities.some(
      (capability) => typeof capability !== 'string' || capability.length === 0,
    )
  ) {
    throw new Error('Storefront bootstrap protocol capabilities are invalid.');
  }
}

assertProtocolConfig();

export const STOREFRONT_BOOTSTRAP_SCHEMA_CURRENT = protocolConfig.currentSchemaVersion;
export const STOREFRONT_BOOTSTRAP_SCHEMA_MIN_READABLE =
  protocolConfig.minReadableSchemaVersion;
export const STOREFRONT_BOOTSTRAP_CAPABILITIES = Object.freeze([
  ...protocolConfig.capabilities,
]);

export function isReadableStorefrontBootstrapSchema(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= STOREFRONT_BOOTSTRAP_SCHEMA_MIN_READABLE &&
    value <= STOREFRONT_BOOTSTRAP_SCHEMA_CURRENT
  );
}

export function storefrontBootstrapProtocolDescriptor(): StorefrontBootstrapProtocolDescriptor {
  return {
    schemaVersion: STOREFRONT_BOOTSTRAP_SCHEMA_CURRENT,
    minReadableSchemaVersion: STOREFRONT_BOOTSTRAP_SCHEMA_MIN_READABLE,
    capabilities: [...STOREFRONT_BOOTSTRAP_CAPABILITIES],
  };
}

export function sanitizeStorefrontBootstrapCapabilities(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter((item): item is string => typeof item === 'string' && item.length > 0),
    ),
  ];
}
