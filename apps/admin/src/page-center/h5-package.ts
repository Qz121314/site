import { unzipSync, strFromU8 } from 'fflate';

export type ParsedH5Cta = {
  key: string;
  label: string;
  filePath: string;
  selector: string;
};
export type ParsedH5Package = {
  name: string;
  slug: string;
  files: Array<{ path: string; file: File; mimeType: string; byteSize: number }>;
  ctas: ParsedH5Cta[];
};

const MIME_TYPES: Record<string, string> = {
  html: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  mjs: 'text/javascript',
  json: 'application/json',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  woff: 'font/woff',
  woff2: 'font/woff2',
};

function normalizePath(path: string): string | null {
  const value = path.replaceAll('\\', '/');
  if (
    !value ||
    value.startsWith('/') ||
    value.split('/').some((part) => !part || part === '.' || part === '..')
  )
    return null;
  return value;
}

function cssSelector(element: Element): string {
  const marker = element.getAttribute('data-site-cta');
  if (marker) return `[data-site-cta="${CSS.escape(marker)}"]`;
  const parts: string[] = [];
  let current: Element | null = element;
  while (current && current.tagName.toLowerCase() !== 'html') {
    const tag = current.tagName.toLowerCase();
    const parent: Element | null = current.parentElement;
    const siblings = parent
      ? [...parent.children].filter((item) => item.tagName === current!.tagName)
      : [];
    const index = siblings.indexOf(current) + 1;
    parts.unshift(`${tag}:nth-of-type(${index})`);
    current = parent;
  }
  return parts.join(' > ');
}

function scanCtas(path: string, source: string): ParsedH5Cta[] {
  const document = new DOMParser().parseFromString(source, 'text/html');
  const candidates = [
    ...document.querySelectorAll(
      'a,button,[data-site-cta],[class*="cta"],[class*="CTA"]',
    ),
  ];
  return candidates.slice(0, 100).map((element, index) => ({
    key:
      element.getAttribute('data-site-cta')?.trim() ||
      `${path.replaceAll('/', '_')}-${index + 1}`,
    label:
      (
        element.getAttribute('aria-label') ||
        element.textContent ||
        element.getAttribute('title') ||
        'CTA'
      )
        .trim()
        .replace(/\s+/gu, ' ')
        .slice(0, 200) || 'CTA',
    filePath: path,
    selector: cssSelector(element),
  }));
}

export async function parseH5Package(file: File): Promise<ParsedH5Package> {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.html') || lowerName.endsWith('.htm')) {
    const source = await file.text();
    if (!source.trim()) throw new Error('HTML 文件不能为空。');
    const name = file.name.replace(/\.(?:html?|HTML?)$/u, '').slice(0, 120);
    const slug =
      name
        .replace(/[^a-z0-9]+/giu, '-')
        .replace(/^-+|-+$/gu, '')
        .toLowerCase()
        .slice(0, 48) || `page-${Date.now()}`;
    const htmlFile = new File([source], 'index.html', { type: 'text/html' });
    return {
      name,
      slug,
      files: [
        {
          path: 'index.html',
          file: htmlFile,
          mimeType: 'text/html',
          byteSize: htmlFile.size,
        },
      ],
      ctas: scanCtas('index.html', source),
    };
  }
  if (!lowerName.endsWith('.zip'))
    throw new Error('请上传 .html、.htm 或 .zip 格式的 H5 页面。');
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const names = Object.keys(entries).filter((name) => !name.endsWith('/'));
  if (!names.length || names.length > 300)
    throw new Error('页面包文件数量需在 1 到 300 个之间。');
  const normalized = names
    .map((name) => ({ original: name, path: normalizePath(name) }))
    .filter((item): item is { original: string; path: string } => item.path !== null);
  if (normalized.length !== names.length) throw new Error('页面包包含不安全的文件路径。');
  const indexEntry = normalized.find(
    (item) =>
      item.path.toLowerCase().endsWith('/index.html') ||
      item.path.toLowerCase() === 'index.html',
  );
  if (!indexEntry) throw new Error('页面包根目录必须包含 index.html。');
  const root =
    indexEntry.path.toLowerCase() === 'index.html'
      ? ''
      : indexEntry.path.slice(0, -'index.html'.length);
  const files = normalized.map(({ original, path }) => {
    const finalPath = root && path.startsWith(root) ? path.slice(root.length) : path;
    if (!finalPath || finalPath.includes('..')) throw new Error('页面包目录结构无效。');
    const bytes = entries[original];
    if (!bytes) throw new Error('页面包文件读取失败。');
    const ext = finalPath.split('.').pop()?.toLowerCase() ?? '';
    return {
      path: finalPath,
      file: new File([bytes], finalPath, {
        type: MIME_TYPES[ext] ?? 'application/octet-stream',
      }),
      mimeType: MIME_TYPES[ext] ?? 'application/octet-stream',
      byteSize: bytes.byteLength,
    };
  });
  const sourceBytes = entries[indexEntry.original];
  if (!sourceBytes) throw new Error('页面包入口文件读取失败。');
  const source = strFromU8(sourceBytes);
  const ctas = scanCtas('index.html', source);
  const baseName =
    file.name
      .replace(/\.zip$/iu, '')
      .replace(/[^a-z0-9]+/giu, '-')
      .replace(/^-+|-+$/gu, '')
      .toLowerCase()
      .slice(0, 48) || `page-${Date.now()}`;
  return {
    name: file.name.replace(/\.zip$/iu, '').slice(0, 120),
    slug: baseName,
    files,
    ctas,
  };
}
