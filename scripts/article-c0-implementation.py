from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"pattern not found in {path}: {old[:140]!r}")
    file.write_text(text.replace(old, new, 1))


publisher = "apps/worker/src/publishing/modular-publisher.ts"
replace_once(
    publisher,
    """type MessageArticleRow = {\n  article_id: string;\n  question: string;\n  answer: string;\n  sort_order: number;\n};\n""",
    """type MessageArticleRow = {\n  article_id: string;\n  question: string;\n  answer: string;\n  background_object_key: string | null;\n  sort_order: number;\n};\n""",
)
replace_once(
    publisher,
    """        `SELECT mar.article_id, f.question, f.answer, mar.sort_order\n         FROM message_article_references mar\n         JOIN faqs f ON f.id = mar.article_id\n         WHERE mar.is_enabled = 1 AND f.deleted_at IS NULL\n         ORDER BY mar.sort_order ASC, mar.article_id ASC`,\n""",
    """        `SELECT\n           mar.article_id,\n           f.question,\n           f.answer,\n           background.object_key AS background_object_key,\n           mar.sort_order\n         FROM message_article_references mar\n         JOIN faqs f ON f.id = mar.article_id\n         LEFT JOIN media_assets background\n           ON background.id = mar.background_media_id\n          AND background.status = 'ready'\n          AND background.deleted_at IS NULL\n         WHERE mar.is_enabled = 1 AND f.deleted_at IS NULL\n         ORDER BY mar.sort_order ASC, mar.article_id ASC`,\n""",
)
replace_once(
    publisher,
    """    preview: markdownPreview(article.answer),\n    sortOrder: article.sort_order,\n""",
    """    preview: markdownPreview(article.answer),\n    backgroundObjectKey: article.background_object_key,\n    sortOrder: article.sort_order,\n""",
)
replace_once(
    publisher,
    """      stateModel: { articles, faqs, messageArticles },\n      mediaKeys: [],\n""",
    """      stateModel: { articles, faqs, messageArticles },\n      mediaKeys: uniqueStrings(\n        source.messageArticles.map((article) => article.background_object_key),\n      ),\n""",
)

assets = "apps/worker/src/assets/asset-library.ts"
replace_once(
    assets,
    """  product_cover_count: number;\n  product_gallery_count: number;\n};\n""",
    """  product_cover_count: number;\n  product_gallery_count: number;\n  message_article_background_count: number;\n};\n""",
)
replace_once(
    assets,
    """export function countReferences(references: AssetReferenceCounts): number {\n  return (\n    references.logo +\n    references.hero +\n    references.sectionIcon +\n    references.productCover +\n    references.productGallery\n  );\n}\n""",
    """export function countReferences(references: AssetReferenceCounts): number {\n  return (\n    references.logo +\n    references.hero +\n    references.sectionIcon +\n    references.productCover +\n    references.productGallery\n  );\n}\n\nfunction countRowReferences(row: MediaAssetReferenceRow | null): number {\n  return (\n    countReferences(toReferenceCounts(row)) + (row?.message_article_background_count ?? 0)\n  );\n}\n""",
)
for old, new in [
    ("countReferences(toReferenceCounts(row))", "countRowReferences(row)"),
]:
    text = Path(assets).read_text()
    if old not in text:
        raise SystemExit(f"pattern not found in {assets}: {old!r}")
    Path(assets).write_text(text.replace(old, new))
replace_once(
    assets,
    """         (SELECT COUNT(*) FROM product_media pm WHERE pm.media_asset_id = ma.id)\n           AS product_gallery_count\n       FROM media_assets ma\n""",
    """         (SELECT COUNT(*) FROM product_media pm WHERE pm.media_asset_id = ma.id)\n           AS product_gallery_count,\n         (\n           SELECT COUNT(*)\n           FROM message_article_references mar\n           WHERE mar.background_media_id = ma.id\n         ) AS message_article_background_count\n       FROM media_assets ma\n""",
)
replace_once(
    assets,
    """         AND NOT EXISTS (\n           SELECT 1 FROM product_media pm WHERE pm.media_asset_id = media_assets.id\n         )`,\n""",
    """         AND NOT EXISTS (\n           SELECT 1 FROM product_media pm WHERE pm.media_asset_id = media_assets.id\n         )\n         AND NOT EXISTS (\n           SELECT 1\n           FROM message_article_references mar\n           WHERE mar.background_media_id = media_assets.id\n         )`,\n""",
)
