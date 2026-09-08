import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validatePublicContentOrigin } from '../../scripts/validate-public-content-origin.mjs';

const mainWorkflow = readFileSync('.github/workflows/ci.yml', 'utf8');

function namedStep(workflow, name) {
  const lines = workflow.split(/\r?\n/);
  const marker = `- name: ${name}`;
  const start = lines.findIndex((line) => line.trim() === marker);
  assert.notEqual(start, -1, `missing workflow step: ${name}`);
  const indent = lines[start].match(/^\s*/)[0].length;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    const currentIndent = lines[index].match(/^\s*/)[0].length;
    if (trimmed.startsWith('- name: ') && currentIndent === indent) {
      end = index;
      break;
    }
    if (trimmed && currentIndent < indent) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

test('production workflow wires the repository public-content origin before verification/build', () => {
  assert.match(
    mainWorkflow,
    /^    env:\n      VITE_PUBLIC_CONTENT_ORIGIN: \$\{\{ vars\.VITE_PUBLIC_CONTENT_ORIGIN \}\}$/m,
  );

  const validation = namedStep(mainWorkflow, 'Validate Storefront public content origin');
  assert.match(validation, /deploy_required/);
  assert.match(validation, /force_deploy/);
  assert.match(validation, /node scripts\/validate-public-content-origin\.mjs/);

  assert.ok(
    mainWorkflow.indexOf('- name: Validate Storefront public content origin') <
      mainWorkflow.indexOf('- name: Full local-first verification'),
    'production origin validation must happen before pnpm verify builds Storefront',
  );
});

test('public-content origin validator accepts only HTTPS root origins', () => {
  assert.equal(
    validatePublicContentOrigin('https://cdn.example.com'),
    'https://cdn.example.com',
  );
  assert.equal(
    validatePublicContentOrigin('https://cdn.example.com/'),
    'https://cdn.example.com',
  );

  for (const value of [
    undefined,
    '',
    '   ',
    'not-a-url',
    'http://cdn.example.com',
    'https://cdn.example.com/public',
    'https://cdn.example.com/?v=1',
    'https://cdn.example.com/#current',
    'https://user:password@cdn.example.com',
  ]) {
    assert.throws(() => validatePublicContentOrigin(value));
  }
});
