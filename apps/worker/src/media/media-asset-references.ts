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

export function mediaAssetReferenceCountJoinsSql(alias = 'ma'): string {
  return `
    LEFT JOIN (
      SELECT logo_asset_id AS media_asset_id, COUNT(*) AS reference_count
      FROM site_settings WHERE logo_asset_id IS NOT NULL GROUP BY logo_asset_id
    ) logo_refs ON logo_refs.media_asset_id = ${alias}.id
    LEFT JOIN (
      SELECT pwa_icon_asset_id AS media_asset_id, COUNT(*) AS reference_count
      FROM site_settings WHERE pwa_icon_asset_id IS NOT NULL GROUP BY pwa_icon_asset_id
    ) pwa_icon_refs ON pwa_icon_refs.media_asset_id = ${alias}.id
    LEFT JOIN (
      SELECT media_asset_id, COUNT(*) AS reference_count
      FROM site_hero_slides GROUP BY media_asset_id
    ) hero_refs ON hero_refs.media_asset_id = ${alias}.id
    LEFT JOIN (
      SELECT icon_asset_id AS media_asset_id, COUNT(*) AS reference_count
      FROM site_bottom_navigation WHERE icon_asset_id IS NOT NULL GROUP BY icon_asset_id
    ) bottom_nav_refs ON bottom_nav_refs.media_asset_id = ${alias}.id
    LEFT JOIN (
      SELECT icon_asset_id AS media_asset_id, COUNT(*) AS reference_count
      FROM sections WHERE icon_asset_id IS NOT NULL GROUP BY icon_asset_id
    ) section_icon_refs ON section_icon_refs.media_asset_id = ${alias}.id
    LEFT JOIN (
      SELECT browse_background_asset_id AS media_asset_id, COUNT(*) AS reference_count
      FROM sections WHERE browse_background_asset_id IS NOT NULL GROUP BY browse_background_asset_id
    ) section_background_refs ON section_background_refs.media_asset_id = ${alias}.id
    LEFT JOIN (
      SELECT background_media_id AS media_asset_id, COUNT(*) AS reference_count
      FROM message_article_references
      WHERE background_media_id IS NOT NULL GROUP BY background_media_id
    ) message_article_refs ON message_article_refs.media_asset_id = ${alias}.id
    LEFT JOIN (
      SELECT background_media_id AS media_asset_id, COUNT(*) AS reference_count
      FROM message_cta_cards
      WHERE background_media_id IS NOT NULL GROUP BY background_media_id
    ) message_cta_refs ON message_cta_refs.media_asset_id = ${alias}.id
    LEFT JOIN (
      SELECT cover_asset_id AS media_asset_id, COUNT(*) AS reference_count
      FROM products WHERE cover_asset_id IS NOT NULL GROUP BY cover_asset_id
    ) product_cover_refs ON product_cover_refs.media_asset_id = ${alias}.id
    LEFT JOIN (
      SELECT media_asset_id, COUNT(*) AS reference_count
      FROM product_media GROUP BY media_asset_id
    ) product_gallery_refs ON product_gallery_refs.media_asset_id = ${alias}.id`;
}

export function mediaAssetReferenceCountColumnsSql(): string {
  return `
    COALESCE(logo_refs.reference_count, 0) AS logo_count,
    COALESCE(pwa_icon_refs.reference_count, 0) AS pwa_icon_count,
    COALESCE(hero_refs.reference_count, 0) AS hero_count,
    COALESCE(bottom_nav_refs.reference_count, 0) AS bottom_nav_icon_count,
    COALESCE(section_icon_refs.reference_count, 0) AS section_icon_count,
    COALESCE(section_background_refs.reference_count, 0) AS section_background_count,
    COALESCE(message_article_refs.reference_count, 0) AS message_article_background_count,
    COALESCE(message_cta_refs.reference_count, 0) AS message_cta_background_count,
    COALESCE(product_cover_refs.reference_count, 0) AS product_cover_count,
    COALESCE(product_gallery_refs.reference_count, 0) AS product_gallery_count`;
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
