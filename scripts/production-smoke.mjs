const baseUrl = process.env.BASE_URL?.replace(/\/$/, '');
const expectedVersionId = process.env.EXPECTED_WORKER_VERSION_ID?.trim();

if (!baseUrl || !expectedVersionId) {
  throw new Error('BASE_URL and EXPECTED_WORKER_VERSION_ID are required for production smoke');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchRequired(path, init) {
  const response = await fetch(`${baseUrl}${path}`, { ...init, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return response;
}

let health;
for (const delayMs of [0, 1_000, 2_000, 4_000]) {
  if (delayMs) await sleep(delayMs);
  try {
    const response = await fetchRequired('/api/health');
    const value = await response.json();
    if (
      value.ok === true &&
      value.environment === 'production' &&
      value.publicLanguage === 'en' &&
      value.workerVersionId === expectedVersionId
    ) {
      health = value;
      break;
    }
  } catch (error) {
    console.log(`Health propagation check failed: ${error.message}`);
  }
}

if (!health) throw new Error(`Worker version ${expectedVersionId} did not become healthy within bounded retries`);
console.log(`Worker version confirmed: ${health.workerVersionId}`);

const shellResponse = await fetchRequired('/');
const shell = await shellResponse.text();
if (!shell.includes('<div id="root">') || !shell.includes('class="boot-shell"')) {
  throw new Error('Storefront app shell contract is missing');
}
console.log('Storefront app shell confirmed.');

const currentResponse = await fetchRequired('/public/current.json');
const current = await currentResponse.json();
if (current.schemaVersion !== 1 && current.schemaVersion !== 2) {
  throw new Error(`Unsupported current publication schemaVersion: ${current.schemaVersion}`);
}
console.log(`Current publication pointer confirmed (schemaVersion=${current.schemaVersion}).`);
