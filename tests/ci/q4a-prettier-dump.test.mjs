import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as prettier from 'prettier';

const targets = [
  'apps/storefront/src/public-content-transport.ts',
  'apps/storefront/test/public-content-transport.test.mjs',
];

function desiredSource(path, source) {
  if (path !== 'apps/storefront/test/public-content-transport.test.mjs') return source;

  const workerUrlDeclaration =
    "const WORKER_BOOTSTRAP_URL = `${APP_ORIGIN}/api/public/storefront/bootstrap`;";
  const withDeclaration = source.replace(
    "const POINTER_VERSION = 'content-20260908-abcdef';",
    "const POINTER_VERSION = 'content-20260908-abcdef';\n" + workerUrlDeclaration,
  );
  return withDeclaration.replaceAll("'/api/public/storefront/bootstrap'", 'WORKER_BOOTSTRAP_URL');
}

test('emit exact Q4A Prettier output for repair', async () => {
  for (const path of targets) {
    const source = await readFile(path, 'utf8');
    const formatted = await prettier.format(desiredSource(path, source), { filepath: path });
    const encoded = Buffer.from(formatted, 'utf8').toString('base64');
    const chunkSize = 2_000;

    for (let offset = 0, index = 0; offset < encoded.length; offset += chunkSize, index += 1) {
      console.log(`Q4A_FMT ${path} ${String(index).padStart(3, '0')} ${encoded.slice(offset, offset + chunkSize)}`);
    }
  }
});
