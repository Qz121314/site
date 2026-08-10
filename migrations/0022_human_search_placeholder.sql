PRAGMA foreign_keys = ON;

UPDATE site_settings
SET storefront_copy_json = json_set(
  storefront_copy_json,
  '$.browse.searchPlaceholder',
  'Search'
)
WHERE json_valid(storefront_copy_json)
  AND json_extract(storefront_copy_json, '$.browse.searchPlaceholder') = 'Search sections, products, or tags';

UPDATE site_settings
SET storefront_copy_json = json_set(
  storefront_copy_json,
  '$.section.searchPlaceholder',
  'Search'
)
WHERE json_valid(storefront_copy_json)
  AND json_extract(storefront_copy_json, '$.section.searchPlaceholder') = 'Name, type or tag';
