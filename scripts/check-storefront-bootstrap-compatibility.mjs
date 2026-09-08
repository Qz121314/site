import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PROTOCOL_CONFIG_URL = new URL(
  '../apps/worker/src/publishing/storefront-bootstrap-protocol.json',
  import.meta.url,
);
const POINTER_KEY = 'public/current.json';
const POINTER_VERSION_PATTERN = /^[A-Za-z0-9-]{12,180}$/u;

export function loadBootstrapProtocolConfig() {
  return validateBootstrapProtocolConfig(
    JSON.parse(readFileSync(PROTOCOL_CONFIG_URL, 'utf8')),
  );
}

export function validateBootstrapProtocolConfig(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Storefront bootstrap protocol config must be an object.');
  }
  const currentSchemaVersion = value.currentSchemaVersion;
  const minReadableSchemaVersion = value.minReadableSchemaVersion;
  if (
    !Number.isInteger(currentSchemaVersion) ||
    currentSchemaVersion < 1 ||
    !Number.isInteger(minReadableSchemaVersion) ||
    minReadableSchemaVersion < 1 ||
    minReadableSchemaVersion > currentSchemaVersion
  ) {
    throw new Error('Storefront bootstrap protocol schema range is invalid.');
  }
  if (currentSchemaVersion - minReadableSchemaVersion > 1) {
    throw new Error('Storefront bootstrap compatibility window must remain bounded to N/N-1.');
  }
  if (
    !Array.isArray(value.capabilities) ||
    value.capabilities.some(
      (capability) => typeof capability !== 'string' || capability.length === 0,
    )
  ) {
    throw new Error('Storefront bootstrap protocol capabilities are invalid.');
  }
  return {
    currentSchemaVersion,
    minReadableSchemaVersion,
    capabilities: [...new Set(value.capabilities)],
  };
}

export function parsePublishedPointer(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    value.schemaVersion !== 2 ||
    typeof value.contentVersion !== 'string' ||
    !POINTER_VERSION_PATTERN.test(value.contentVersion)
  ) {
    throw new Error('Production public/current.json is missing or invalid.');
  }
  return { contentVersion: value.contentVersion };
}

export function bootstrapObjectKey(pointer) {
  return `public/bootstrap/${pointer.contentVersion}/bootstrap.json`;
}

export function parsePublishedBootstrap(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !Number.isInteger(value.schemaVersion) ||
    value.schemaVersion < 1
  ) {
    throw new Error('Production Storefront bootstrap artifact is missing or invalid.');
  }
  if (
    value.protocol !== undefined &&
    (!value.protocol ||
      typeof value.protocol !== 'object' ||
      Array.isArray(value.protocol) ||
      value.protocol.schemaVersion !== value.schemaVersion)
  ) {
    throw new Error('Production Storefront bootstrap protocol metadata is inconsistent.');
  }
  return { schemaVersion: value.schemaVersion };
}

export function assertPublishedBootstrapCompatible(protocol, bootstrap) {
  if (
    bootstrap.schemaVersion < protocol.minReadableSchemaVersion ||
    bootstrap.schemaVersion > protocol.currentSchemaVersion
  ) {
    throw new Error(
      `Production bootstrap schema ${bootstrap.schemaVersion} is incompatible with runtime readable range ${protocol.minReadableSchemaVersion}..${protocol.currentSchemaVersion}. Publish a compatible snapshot before deploying this Worker runtime.`,
    );
  }
  return {
    schemaVersion: bootstrap.schemaVersion,
    readableRange: `${protocol.minReadableSchemaVersion}..${protocol.currentSchemaVersion}`,
  };
}

function pnpmExecutable() {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}

export function readRemoteR2Json(bucketName, key, exec = execFileSync) {
  const body = exec(
    pnpmExecutable(),
    [
      'exec',
      'wrangler',
      'r2',
      'object',
      'get',
      `${bucketName}/${key}`,
      '--remote',
      '--pipe',
    ],
    {
      encoding: 'utf8',
      env: process.env,
      stdio: ['ignore', 'pipe', 'inherit'],
    },
  );
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`Production R2 object ${key} did not contain valid JSON.`);
  }
}

export function runPublishedBootstrapCompatibilityCheck({
  bucketName,
  readRemoteJson = readRemoteR2Json,
} = {}) {
  if (!bucketName) throw new Error('R2_BUCKET_NAME is required for bootstrap compatibility check.');
  const protocol = loadBootstrapProtocolConfig();
  const pointer = parsePublishedPointer(readRemoteJson(bucketName, POINTER_KEY));
  const bootstrap = parsePublishedBootstrap(
    readRemoteJson(bucketName, bootstrapObjectKey(pointer)),
  );
  return assertPublishedBootstrapCompatible(protocol, bootstrap);
}

const entrypoint = process.argv[1]
  ? pathToFileURL(fileURLToPath(pathToFileURL(process.argv[1]))).href
  : '';
if (entrypoint === import.meta.url) {
  try {
    const result = runPublishedBootstrapCompatibilityCheck({
      bucketName: process.env.R2_BUCKET_NAME,
    });
    console.log(
      `STOREFRONT_BOOTSTRAP_COMPATIBILITY=pass schema=${result.schemaVersion} readable=${result.readableRange}`,
    );
  } catch (error) {
    console.error(
      `STOREFRONT_BOOTSTRAP_COMPATIBILITY=blocked ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
