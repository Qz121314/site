PRAGMA foreign_keys = ON;

UPDATE site_settings
SET storefront_copy_json = json_set(
  storefront_copy_json,
  '$.section.backLabel',
  'Back'
)
WHERE json_valid(storefront_copy_json)
  AND json_extract(storefront_copy_json, '$.section.backLabel') = 'Browse';
