import { spawnSync } from "node:child_process";

const ids = {
  channel: "audit-guard-channel",
  conversionGroup: "audit-guard-conversion-group",
  emptyConversionGroup: "audit-guard-empty-conversion-group",
  conversionResource: "audit-guard-conversion-resource",
  product: "audit-guard-product",
  image: "audit-guard-image",
  adPool: "audit-guard-ad-pool",
  emptyAdPool: "audit-guard-empty-ad-pool",
  advertisement: "audit-guard-advertisement",
};

function execute(sql, expectFailure = null) {
  const result = spawnSync(
    "pnpm",
    ["exec", "wrangler", "d1", "execute", "DB", "--local", `--command=${sql}`],
    { encoding: "utf8" },
  );
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;

  if (expectFailure) {
    if (result.status === 0 || !output.includes(expectFailure)) {
      throw new Error(`Expected D1 failure containing ${JSON.stringify(expectFailure)}.\n${output}`);
    }
    return;
  }

  if (result.status !== 0) {
    throw new Error(`D1 integrity verification command failed.\n${output}`);
  }
}

const cleanup = `
  UPDATE channels SET hero_ad_pool_id = NULL WHERE id = '${ids.channel}';
  DELETE FROM products WHERE id = '${ids.product}';
  DELETE FROM conversion_groups WHERE id IN ('${ids.conversionGroup}', '${ids.emptyConversionGroup}');
  DELETE FROM ad_pools WHERE id IN ('${ids.adPool}', '${ids.emptyAdPool}');
  DELETE FROM image_assets WHERE id = '${ids.image}';
  DELETE FROM channels WHERE id = '${ids.channel}';
`;

execute(cleanup);

try {
  execute(`
    INSERT INTO channels (id, name, slug, status)
    VALUES ('${ids.channel}', 'Audit Guard Channel', 'audit-guard-channel', 'published');

    INSERT INTO conversion_groups (id, channel_id, name, status)
    VALUES
      ('${ids.conversionGroup}', '${ids.channel}', 'Audit Guard Conversion', 'enabled'),
      ('${ids.emptyConversionGroup}', '${ids.channel}', 'Audit Guard Empty Conversion', 'enabled');

    INSERT INTO conversion_resources (id, group_id, type, value, status)
    VALUES ('${ids.conversionResource}', '${ids.conversionGroup}', 'sms', '+12025550123', 'enabled');

    INSERT INTO products (
      id, channel_id, conversion_group_id, title, slug, body_source, body_html, status
    ) VALUES (
      '${ids.product}', '${ids.channel}', '${ids.conversionGroup}',
      'Audit Guard Product', 'audit-guard-product', '', '', 'published'
    );

    INSERT INTO image_assets (
      id, object_key, original_name, mime_type, width, height, size_bytes
    ) VALUES (
      '${ids.image}', 'audit/guard.webp', 'guard.webp', 'image/webp', 1, 1, 1
    );

    INSERT INTO ad_pools (id, channel_id, name, status)
    VALUES
      ('${ids.adPool}', '${ids.channel}', 'Audit Guard Hero', 'enabled'),
      ('${ids.emptyAdPool}', '${ids.channel}', 'Audit Guard Empty Hero', 'enabled');

    INSERT INTO advertisements (
      id, pool_id, image_asset_id, target_url, open_mode, status
    ) VALUES (
      '${ids.advertisement}', '${ids.adPool}', '${ids.image}',
      'https://example.com/', 'same', 'enabled'
    );
  `);

  execute(
    `UPDATE products SET conversion_group_id = '${ids.emptyConversionGroup}' WHERE id = '${ids.product}'`,
    "published product requires an available conversion group",
  );
  execute(
    `UPDATE conversion_groups SET status = 'disabled' WHERE id = '${ids.conversionGroup}'`,
    "conversion group is used by published products",
  );
  execute(
    `UPDATE conversion_resources SET status = 'disabled' WHERE id = '${ids.conversionResource}'`,
    "published product conversion group requires an enabled resource",
  );
  execute(
    `DELETE FROM conversion_resources WHERE id = '${ids.conversionResource}'`,
    "published product conversion group requires an enabled resource",
  );

  execute(
    `UPDATE channels SET hero_ad_pool_id = '${ids.emptyAdPool}' WHERE id = '${ids.channel}'`,
    "hero ad pool must be enabled and contain an enabled ad",
  );
  execute(`UPDATE channels SET hero_ad_pool_id = '${ids.adPool}' WHERE id = '${ids.channel}'`);
  execute(
    `UPDATE ad_pools SET status = 'disabled' WHERE id = '${ids.adPool}'`,
    "bound hero ad pool cannot be disabled",
  );
  execute(
    `UPDATE advertisements SET status = 'disabled' WHERE id = '${ids.advertisement}'`,
    "bound hero ad pool requires an enabled advertisement",
  );
  execute(
    `DELETE FROM advertisements WHERE id = '${ids.advertisement}'`,
    "bound hero ad pool requires an enabled advertisement",
  );
} finally {
  execute(cleanup);
}

console.log("Pool availability integrity guards verified.");
