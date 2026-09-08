import { pathToFileURL } from 'node:url';

const VARIABLE_NAME = 'VITE_PUBLIC_CONTENT_ORIGIN';

export function validatePublicContentOrigin(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    throw new Error(`${VARIABLE_NAME} must be configured for a production deploy.`);
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${VARIABLE_NAME} must be a valid URL.`);
  }

  if (url.protocol !== 'https:') {
    throw new Error(`${VARIABLE_NAME} must use HTTPS.`);
  }
  if (url.username || url.password) {
    throw new Error(`${VARIABLE_NAME} must not include username or password.`);
  }
  if (url.search || url.hash) {
    throw new Error(`${VARIABLE_NAME} must not include a query string or hash.`);
  }
  if (url.pathname !== '/') {
    throw new Error(`${VARIABLE_NAME} must be an origin without a non-root path.`);
  }

  return url.origin;
}

export function validateConfiguredPublicContentOrigin(env = process.env) {
  return validatePublicContentOrigin(env[VARIABLE_NAME]);
}

function isDirectExecution() {
  return Boolean(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href);
}

if (isDirectExecution()) {
  try {
    const origin = validateConfiguredPublicContentOrigin();
    console.log(`Validated ${VARIABLE_NAME}: ${origin}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
