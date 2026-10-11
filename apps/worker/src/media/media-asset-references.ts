export type MediaAssetReferenceCounts = {
  logo_count: number;
  pwa_icon_count: number;
  hero_count: number;
  bottom_nav_icon_count: number;
  section_icon_count: number;
  section_background_count: number;
  message_article_background_count: number;
  message_cta_background_count: number;
  product_cover_count: number;
  product_gallery_count: number;
};

export function mediaAssetReferenceCountsSql(alias = 'ma'): string {
  return `
    (SELECT COUNT(*) FROM site_settings ss WHERE ss.logo_asset_id = ${alias}.id) AS logo_count,
    (SELECT COUNT(*) FROM site_settings ss WHERE ss.pwa_icon_asset_id = ${alias}.id) AS pwa_icon_count,
    (SELECT COUNT(*) FROM site_hero_slides hs WHERE hs.media_asset_id = ${alias}.id) AS hero_count,
    (SELECT COUNT(*) FROM site_bottom_navigation nav WHERE nav.icon_asset_id = ${alias}.id) AS bottom_nav_icon_count,
    (SELECT COUNT(*) FROM sections s WHERE s.icon_asset_id = ${alias}.id) AS section_icon_count,
    (SELECT COUNT(*) FROM sections s WHERE s.browse_background_asset_id = ${alias}.id) AS section_background_count,
    (SELECT COUNT(*) FROM message_article_references refs WHERE refs.background_media_id = ${alias}.id) AS message_article_background_count,
    (SELECT COUNT(*) FROM message_cta_cards cards WHERE cards.background_media_id = ${alias}.id) AS message_cta_background_count,
    (SELECT COUNT(*) FROM products p WHERE p.cover_asset_id = ${alias}.id) AS product_cover_count,
    (SELECT COUNT(*) FROM product_media pm WHERE pm.media_asset_id = ${alias}.id) AS product_gallery_count`;
}

export function mediaAssetUnreferencedSql(alias = 'media_assets'): string {
  return `NOT EXISTS (SELECT 1 FROM site_settings ss WHERE ss.logo_asset_id = ${alias}.id)
    AND NOT EXISTS (SELECT 1 FROM site_settings ss WHERE ss.pwa_icon_asset_id = ${alias}.id)
    AND NOT EXISTS (SELECT 1 FROM site_hero_slides hs WHERE hs.media_asset_id = ${alias}.id)
    AND NOT EXISTS (SELECT 1 FROM site_bottom_navigation nav WHERE nav.icon_asset_id = ${alias}.id)
    AND NOT EXISTS (SELECT 1 FROM sections s WHERE s.icon_asset_id = ${alias}.id)
    AND NOT EXISTS (SELECT 1 FROM sections s WHERE s.browse_background_asset_id = ${alias}.id)
    AND NOT EXISTS (SELECT 1 FROM message_article_references refs WHERE refs.background_media_id = ${alias}.id)
    AND NOT EXISTS (SELECT 1 FROM message_cta_cards cards WHERE cards.background_media_id = ${alias}.id)
    AND NOT EXISTS (SELECT 1 FROM products p WHERE p.cover_asset_id = ${alias}.id)
    AND NOT EXISTS (SELECT 1 FROM product_media pm WHERE pm.media_asset_id = ${alias}.id)`;
}

export function countMediaAssetReferences(references: MediaAssetReferenceCounts): number {
  return Object.values(references).reduce((total, count) => total + count, 0);
}
