import assert from 'node:assert/strict';
import test from 'node:test';
import {
  selectNextConversionTarget,
  validateConversionGroupInput,
  validateConversionTargetInput,
} from '../src/conversion-pool/conversion-pool.ts';

function targetRow({
  id,
  name,
  sortOrder,
  endpointUrl = null,
  connectionId = null,
  remoteGroupId = null,
}) {
  return {
    id,
    section_id: 'section-1',
    group_id: 'group-1',
    group_mode: connectionId ? 'customer_service' : 'link',
    name,
    endpoint_url: endpointUrl,
    customer_service_connection_id: connectionId,
    customer_service_connection_name: connectionId ? 'Support A' : null,
    remote_group_id: remoteGroupId,
    remote_group_name: remoteGroupId ? name : null,
    sort_order: sortOrder,
    is_enabled: 1,
    created_at: '2026-08-07T00:00:00.000Z',
    updated_at: '2026-08-07T00:00:00.000Z',
    deleted_at: null,
  };
}

function createRotationDb(targets) {
  let nextIndex = 0;
  const statements = [];

  return {
    statements,
    prepare(sql) {
      const statement = {
        sql,
        args: [],
        bind(...args) {
          this.args = args;
          return this;
        },
        async first() {
          statements.push({ sql: this.sql, args: this.args });
          if (this.sql.includes('INSERT INTO conversion_group_rotation')) {
            const selectedIndex = nextIndex;
            nextIndex += 1;
            return { selected_index: selectedIndex };
          }
          if (this.sql.includes('FROM conversion_targets t')) {
            const offset = this.args.at(-1);
            return targets[offset] ?? null;
          }
          throw new Error(`Unexpected SQL: ${this.sql}`);
        },
      };
      return statement;
    },
  };
}

const linkGroup = {
  id: 'group-1',
  sectionId: 'section-1',
  name: 'Links',
  mode: 'link',
  buttonLabel: 'Open',
  rotationStrategy: 'round_robin',
  sortOrder: 0,
  isEnabled: true,
  createdAt: '2026-08-07T00:00:00.000Z',
  updatedAt: '2026-08-07T00:00:00.000Z',
  deletedAt: null,
  targetCount: 3,
  activeTargetCount: 3,
  productCount: 1,
};

test('link target validation accepts HTTP(S) and strips customer-service fields', () => {
  const result = validateConversionTargetInput(
    {
      name: 'Primary',
      endpointUrl: 'https://example.com/path',
      customerServiceConnectionId: 'ignored',
      remoteGroupId: 'ignored',
      remoteGroupName: 'ignored',
      sortOrder: 10,
      isEnabled: true,
    },
    'link',
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.value, {
    name: 'Primary',
    endpointUrl: 'https://example.com/path',
    customerServiceConnectionId: null,
    remoteGroupId: null,
    remoteGroupName: null,
    sortOrder: 10,
    isEnabled: true,
  });
});

test('link target validation rejects non HTTP(S) protocols', () => {
  const result = validateConversionTargetInput(
    {
      name: 'Bad',
      endpointUrl: 'javascript:alert(1)',
      sortOrder: 0,
      isEnabled: true,
    },
    'link',
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.field, 'endpointUrl');
});

test('customer-service target requires a remote group and forbids manual URL', () => {
  const invalid = validateConversionTargetInput(
    {
      name: 'Sales',
      endpointUrl: 'https://should-not-be-saved.example',
      customerServiceConnectionId: 'connection-1',
      remoteGroupId: 'sales',
      remoteGroupName: 'Sales',
      sortOrder: 0,
      isEnabled: true,
    },
    'customer_service',
  );
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.field, 'endpointUrl');

  const valid = validateConversionTargetInput(
    {
      name: 'ignored local name',
      endpointUrl: null,
      customerServiceConnectionId: ' connection-1 ',
      remoteGroupId: ' sales ',
      remoteGroupName: ' Sales Team ',
      sortOrder: 20,
      isEnabled: true,
    },
    'customer_service',
  );
  assert.equal(valid.ok, true);
  if (!valid.ok) return;
  assert.equal(valid.value.name, 'Sales Team');
  assert.equal(valid.value.customerServiceConnectionId, 'connection-1');
  assert.equal(valid.value.remoteGroupId, 'sales');
});

test('conversion group validation keeps round-robin-compatible modes only', () => {
  const valid = validateConversionGroupInput({
    name: ' Main ',
    mode: 'customer_service',
    buttonLabel: ' Contact ',
    sortOrder: 0,
    isEnabled: true,
  });
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.value.name, 'Main');
    assert.equal(valid.value.buttonLabel, 'Contact');
  }

  const invalid = validateConversionGroupInput({
    name: 'Main',
    mode: 'random',
    buttonLabel: 'Contact',
    sortOrder: 0,
    isEnabled: true,
  });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.field, 'mode');
});

test('production selector rotates A → B → C → A', async () => {
  const db = createRotationDb([
    targetRow({ id: 'a', name: 'A', sortOrder: 10, endpointUrl: 'https://a.example/' }),
    targetRow({ id: 'b', name: 'B', sortOrder: 20, endpointUrl: 'https://b.example/' }),
    targetRow({ id: 'c', name: 'C', sortOrder: 30, endpointUrl: 'https://c.example/' }),
  ]);

  const selected = [];
  for (let index = 0; index < 4; index += 1) {
    selected.push(
      (await selectNextConversionTarget(db, linkGroup, `2026-08-07T00:00:0${index}.000Z`))
        ?.id,
    );
  }

  assert.deepEqual(selected, ['a', 'b', 'c', 'a']);
  const targetQueries = db.statements.filter((statement) =>
    statement.sql.includes('FROM conversion_targets t'),
  );
  assert.deepEqual(
    targetQueries.map((statement) => statement.args.at(-1)),
    [0, 1, 2, 0],
  );
  assert.ok(
    targetQueries.every((statement) =>
      statement.sql.includes('t.endpoint_url IS NOT NULL'),
    ),
  );
});

test('disabled or empty groups never consume the production cursor', async () => {
  const db = createRotationDb([]);

  assert.equal(
    await selectNextConversionTarget(
      db,
      { ...linkGroup, isEnabled: false },
      '2026-08-07T00:00:00.000Z',
    ),
    null,
  );
  assert.equal(
    await selectNextConversionTarget(
      db,
      { ...linkGroup, activeTargetCount: 0 },
      '2026-08-07T00:00:00.000Z',
    ),
    null,
  );
  assert.equal(db.statements.length, 0);
});

test('customer-service rotation only queries bound groups on enabled connections', async () => {
  const db = createRotationDb([
    targetRow({
      id: 'sales',
      name: 'Sales',
      sortOrder: 10,
      connectionId: 'connection-1',
      remoteGroupId: 'sales',
    }),
  ]);
  const group = { ...linkGroup, mode: 'customer_service', activeTargetCount: 1 };

  const selected = await selectNextConversionTarget(
    db,
    group,
    '2026-08-07T00:00:00.000Z',
  );
  assert.equal(selected?.bindingKind, 'customer_service');
  assert.equal(selected?.remoteGroupId, 'sales');

  const targetQuery = db.statements.find((statement) =>
    statement.sql.includes('FROM conversion_targets t'),
  );
  assert.ok(targetQuery?.sql.includes('t.customer_service_connection_id IS NOT NULL'));
  assert.ok(targetQuery?.sql.includes('EXISTS'));
  assert.ok(targetQuery?.sql.includes('c2.is_enabled = 1'));
});
