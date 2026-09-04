import { readFileSync } from 'node:fs';
import { format } from 'prettier';
import test from 'node:test';

const files = [
  'test/chat-attachment-icon-contract.test.mjs',
  'test/mobile-chat-composer-keyboard-clearance.test.mjs',
  'test/storefront-functional-icon-contract.test.mjs',
];

const prettierOptions = {
  parser: 'babel',
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 90,
  semi: true,
};

test('debug exact prettier output', async () => {
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const formatted = await format(source, prettierOptions);
    if (source === formatted) continue;
    console.log(`PRETTIER_BEGIN:${file}`);
    console.log(formatted);
    console.log(`PRETTIER_END:${file}`);
  }
  throw new Error('format debug output emitted');
});
