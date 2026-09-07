# Article Center Admin compatibility

Article Center is the operator-facing name for reusable Markdown content in Admin.

Current compatibility boundary is intentionally frozen:

```text
Admin UI concept        Article / 文章
Internal Admin view     faq
Admin hash              #faq
Admin transport         /api/admin/faqs
Worker/D1 storage       faqs
Legacy DB title field   question
Publish module          faq
```

C1 changes only the Admin information architecture, CRUD management workspace, and Markdown editing experience. It does not introduce `/api/admin/articles`, an `articles` D1 table, a new migration, or a new publish module.

The editor keeps Markdown as the editable source and uses the shared `MarkdownContent` renderer for client-side preview. Search, status filtering, and alternate sorting are client-side operations and do not add Article Center backend requests.

Storefront compatibility routes remain `/faq/`, `/faq/:id`, and `/articles/:articleId/`. Messages Article references, background media, bootstrap metadata, and unread identity are outside C1.
