from pathlib import Path
import re


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"pattern not found in {path}: {old[:160]!r}")
    file.write_text(text.replace(old, new, 1))


admin = "apps/worker/src/routes/admin-message-articles.ts"
replace_once(
    admin,
    """type MessageArticleReference = {\n  articleId: string;\n  title: string;\n  backgroundMediaId?: string | null;\n  sortOrder: number;\n  enabled: boolean;\n};\n""",
    """type MessageArticleReference = {\n  articleId: string;\n  title: string;\n  backgroundMediaId: string | null;\n  sortOrder: number;\n  enabled: boolean;\n  isEnabled: boolean;\n};\n""",
)
replace_once(
    admin,
    """  return rows.map((row) => {\n    const reference: MessageArticleReference = {\n      articleId: row.article_id,\n      title: row.question,\n      sortOrder: row.sort_order,\n      enabled: row.is_enabled === 1,\n    };\n    if (row.background_media_id !== undefined) {\n      reference.backgroundMediaId = row.background_media_id;\n    }\n    return reference;\n  });\n""",
    """  return rows.map((row) => ({\n    articleId: row.article_id,\n    title: row.question,\n    backgroundMediaId: row.background_media_id ?? null,\n    sortOrder: row.sort_order,\n    enabled: row.is_enabled === 1,\n    isEnabled: row.is_enabled === 1,\n  }));\n""",
)

bootstrap = "apps/worker/src/publishing/storefront-bootstrap-snapshot.ts"
replace_once(
    bootstrap,
    "backgroundObjectKey?: string | null;",
    "backgroundObjectKey: string | null;",
)
replace_once(
    bootstrap,
    """    const article: MessageArticleMetadata = {\n      articleId: item.articleId,\n      title: item.title,\n      preview: item.preview,\n      sortOrder: item.sortOrder,\n    };\n    if (\n      typeof item.backgroundObjectKey === 'string' ||\n      item.backgroundObjectKey === null\n    ) {\n      article.backgroundObjectKey = item.backgroundObjectKey;\n    }\n    articles.push(article);\n""",
    """    articles.push({\n      articleId: item.articleId,\n      title: item.title,\n      preview: item.preview,\n      backgroundObjectKey:\n        typeof item.backgroundObjectKey === 'string' ? item.backgroundObjectKey : null,\n      sortOrder: item.sortOrder,\n    });\n""",
)

storefront = "apps/storefront/src/messages-articles.ts"
replace_once(
    storefront,
    "backgroundObjectKey?: string | null;",
    "backgroundObjectKey: string | null;",
)
replace_once(
    storefront,
    """  const article: MessageArticleMetadata = { articleId, title, preview, sortOrder };\n  if (\n    typeof value.backgroundObjectKey === 'string' ||\n    value.backgroundObjectKey === null\n  ) {\n    article.backgroundObjectKey = value.backgroundObjectKey;\n  }\n  return article;\n""",
    """  return {\n    articleId,\n    title,\n    preview,\n    backgroundObjectKey:\n      typeof value.backgroundObjectKey === 'string' ? value.backgroundObjectKey : null,\n    sortOrder,\n  };\n""",
)

article_test = Path("apps/worker/test/article-message-contract.test.mjs")
text = article_test.read_text()
text = re.sub(
    r"(?P<indent>\s*)enabled: (?P<value>true|false),\n(?P=indent)\}",
    lambda match: f"{match.group('indent')}enabled: {match.group('value')},\n{match.group('indent')}isEnabled: {match.group('value')},\n{match.group('indent')}}}",
    text,
)
article_test.write_text(text)

storefront_test = "apps/storefront/test/messages-articles.test.mjs"
replace_once(
    storefront_test,
    """    { articleId: 'article-a', title: 'Alpha', preview: 'First', sortOrder: 10 },\n""",
    """    {\n      articleId: 'article-a',\n      title: 'Alpha',\n      preview: 'First',\n      backgroundObjectKey: null,\n      sortOrder: 10,\n    },\n""",
)

bootstrap_test = Path("apps/worker/test/public-bootstrap-snapshot.test.mjs")
text = bootstrap_test.read_text()
text = text.replace(
    """      preview: 'Legacy preview',\n      sortOrder: 0,\n""",
    """      preview: 'Legacy preview',\n      backgroundObjectKey: null,\n      sortOrder: 0,\n""",
    1,
)
text = text.replace(
    """      preview: 'Fresh preview',\n      sortOrder: 0,\n""",
    """      preview: 'Fresh preview',\n      backgroundObjectKey: null,\n      sortOrder: 0,\n""",
    1,
)
bootstrap_test.write_text(text)
