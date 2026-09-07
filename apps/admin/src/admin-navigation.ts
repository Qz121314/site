import type { AdminSection } from './api';

export type DynamicViewKind = 'products' | 'categories' | 'tags' | 'conversion-pool';
export type CatalogResourceKind = Extract<
  DynamicViewKind,
  'products' | 'categories' | 'tags'
>;

export type CatalogWorkspaceContext = {
  sectionId: string;
  resource: CatalogResourceKind;
};

export type SettingsAdminView =
  | 'home'
  | 'navigation'
  | 'messages'
  | 'pwa'
  | 'system-general'
  | 'system-infrastructure'
  | 'system-advanced';

export type AdminView =
  | 'dashboard'
  | SettingsAdminView
  | 'theme'
  | 'assets'
  | 'customer-service'
  | 'faq'
  | 'sections'
  | `${DynamicViewKind}:${string}`;

export type AdminDomain =
  | 'dashboard'
  | 'catalog'
  | 'experience'
  | 'operations'
  | 'media'
  | 'integrations'
  | 'system';

export type AdminDomainDefinition = {
  id: AdminDomain;
  label: string;
  description: string;
};

export type AdminNavItem = {
  view: AdminView;
  label: string;
  group?: string;
};

export type AdminViewContext = {
  domain: AdminDomain;
  eyebrow: string;
  title: string;
  description: string;
};

export const ADMIN_VIEW_STORAGE_KEY = 'site.admin.lastView';

export const ADMIN_DOMAINS: readonly AdminDomainDefinition[] = [
  { id: 'dashboard', label: '仪表盘', description: '管理后台概览' },
  { id: 'catalog', label: '商品', description: '分区与商品目录' },
  { id: 'experience', label: '体验', description: '站点体验与主题' },
  { id: 'operations', label: '运营', description: '转化运营工具' },
  { id: 'media', label: '素材', description: '可复用素材与媒体资产' },
  { id: 'integrations', label: '集成', description: '外部服务连接' },
  { id: 'system', label: '系统', description: '站点身份与技术配置' },
];

export const SETTINGS_ADMIN_VIEWS = new Set<SettingsAdminView>([
  'home',
  'navigation',
  'messages',
  'pwa',
  'system-general',
  'system-infrastructure',
  'system-advanced',
]);

export const FIXED_ADMIN_VIEWS = new Set<AdminView>([
  'dashboard',
  ...SETTINGS_ADMIN_VIEWS,
  'theme',
  'assets',
  'customer-service',
  'faq',
  'sections',
]);

const LEGACY_ADMIN_VIEW_ALIASES: Readonly<Record<string, AdminView>> = {
  settings: 'system-general',
  system: 'system-general',
};

export function parseDynamicView(
  view: AdminView | string,
): { kind: DynamicViewKind; sectionId: string } | null {
  const separatorIndex = view.indexOf(':');
  if (separatorIndex < 0) return null;

  const kind = view.slice(0, separatorIndex);
  const sectionId = view.slice(separatorIndex + 1);
  if (
    (kind !== 'products' &&
      kind !== 'categories' &&
      kind !== 'tags' &&
      kind !== 'conversion-pool') ||
    !sectionId
  ) {
    return null;
  }

  return { kind, sectionId };
}

export function getCatalogWorkspaceContext(
  view: AdminView,
): CatalogWorkspaceContext | null {
  const dynamic = parseDynamicView(view);
  if (
    !dynamic ||
    (dynamic.kind !== 'products' &&
      dynamic.kind !== 'categories' &&
      dynamic.kind !== 'tags')
  ) {
    return null;
  }

  return { sectionId: dynamic.sectionId, resource: dynamic.kind };
}

export function catalogViewForResource(
  resource: CatalogResourceKind,
  sectionId: string,
): AdminView {
  return `${resource}:${sectionId}`;
}

export function parseAdminView(value: string | null): AdminView | null {
  if (!value) return null;
  let normalized = value.startsWith('#') ? value.slice(1) : value;
  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    return null;
  }

  const legacyAlias = LEGACY_ADMIN_VIEW_ALIASES[normalized];
  if (legacyAlias) return legacyAlias;
  if (FIXED_ADMIN_VIEWS.has(normalized as AdminView)) {
    return normalized as AdminView;
  }
  return parseDynamicView(normalized) ? (normalized as AdminView) : null;
}

export function readInitialAdminView(): AdminView {
  if (typeof window === 'undefined') return 'home';
  const fromHash = parseAdminView(window.location.hash);
  if (fromHash) return fromHash;

  try {
    const stored = parseAdminView(window.localStorage.getItem(ADMIN_VIEW_STORAGE_KEY));
    if (stored) return stored;
  } catch {
    // Storage may be unavailable in privacy-restricted contexts.
  }

  return 'home';
}

export function adminViewHash(view: AdminView): string {
  return `#${encodeURIComponent(view)}`;
}

export function rememberAdminView(view: AdminView): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ADMIN_VIEW_STORAGE_KEY, view);
  } catch {
    // Navigation remains usable even when localStorage is unavailable.
  }
}

export function writeAdminViewLocation(view: AdminView, mode: 'push' | 'replace'): void {
  if (typeof window === 'undefined') return;
  const hash = adminViewHash(view);
  rememberAdminView(view);
  if (window.location.hash === hash) return;
  const nextUrl = `${window.location.pathname}${window.location.search}${hash}`;
  if (mode === 'push') window.history.pushState(null, '', nextUrl);
  else window.history.replaceState(null, '', nextUrl);
}

export function getAdminDomainForView(view: AdminView): AdminDomain {
  if (view === 'dashboard') return 'dashboard';
  if (view === 'faq' || view === 'assets') return 'media';
  if (view === 'sections') return 'catalog';
  if (
    view === 'home' ||
    view === 'navigation' ||
    view === 'messages' ||
    view === 'theme' ||
    view === 'pwa'
  ) {
    return 'experience';
  }
  if (view === 'customer-service') return 'integrations';
  if (
    view === 'system-general' ||
    view === 'system-infrastructure' ||
    view === 'system-advanced'
  ) {
    return 'system';
  }

  const dynamic = parseDynamicView(view);
  return dynamic?.kind === 'conversion-pool' ? 'operations' : 'catalog';
}

export function getAdminDefaultViewForDomain(
  domain: AdminDomain,
  sections: AdminSection[],
): AdminView | null {
  switch (domain) {
    case 'dashboard':
      return 'dashboard';
    case 'catalog':
      return 'sections';
    case 'experience':
      return 'home';
    case 'operations':
      return sections[0] ? `conversion-pool:${sections[0].id}` : null;
    case 'media':
      return 'assets';
    case 'integrations':
      return 'customer-service';
    case 'system':
      return 'system-general';
  }
}

export function getAdminSecondaryItems(
  domain: AdminDomain,
  sections: AdminSection[],
): AdminNavItem[] {
  switch (domain) {
    case 'dashboard':
      return [{ view: 'dashboard', label: '概览' }];
    case 'catalog':
      return [
        { view: 'sections', label: '分区管理', group: '结构' },
        ...sections.map<AdminNavItem>((section, index) => ({
          view: `products:${section.id}`,
          label: section.name,
          ...(index === 0 ? { group: '分区' } : {}),
        })),
      ];
    case 'experience':
      return [
        { view: 'home', label: '首页' },
        { view: 'navigation', label: '导航' },
        { view: 'messages', label: 'Messages' },
        { view: 'theme', label: '主题' },
        { view: 'pwa', label: 'PWA' },
      ];
    case 'operations':
      return sections.map((section) => ({
        view: `conversion-pool:${section.id}`,
        label: '转化池',
        group: section.name,
      }));
    case 'media':
      return [
        { view: 'assets', label: '素材库' },
        { view: 'faq', label: 'FAQ 管理' },
      ];
    case 'integrations':
      return [{ view: 'customer-service', label: '客服管理' }];
    case 'system':
      return [
        { view: 'system-general', label: '常规' },
        { view: 'system-infrastructure', label: '基础设施' },
        { view: 'system-advanced', label: '高级' },
      ];
  }
}

export function getAdminViewContext(
  view: AdminView,
  sections: AdminSection[],
): AdminViewContext {
  const domain = getAdminDomainForView(view);
  const domainLabel =
    ADMIN_DOMAINS.find((item) => item.id === domain)?.label ?? '管理后台';

  const fixed: Partial<Record<AdminView, Omit<AdminViewContext, 'domain'>>> = {
    dashboard: {
      eyebrow: domainLabel,
      title: '管理后台',
      description: '从左侧业务域进入现有管理工作区。',
    },
    home: {
      eyebrow: `${domainLabel} / 首页`,
      title: '首页',
      description: '管理 Storefront 首页展示内容、Hero 与布局。',
    },
    navigation: {
      eyebrow: `${domainLabel} / 导航`,
      title: '导航',
      description: '管理 Storefront 主导航入口、图标与可见性。',
    },
    messages: {
      eyebrow: `${domainLabel} / Messages`,
      title: 'Messages',
      description: '管理 Messages 页面相关体验设置与入口上下文。',
    },
    theme: {
      eyebrow: `${domainLabel} / 主题`,
      title: '主题中心',
      description: '管理 Storefront 的视觉主题与运行时样式配置。',
    },
    pwa: {
      eyebrow: `${domainLabel} / PWA`,
      title: 'PWA',
      description: '管理应用图标与安装提示体验。',
    },
    assets: {
      eyebrow: `${domainLabel} / 素材`,
      title: '素材库管理',
      description: '管理上传素材、文件夹与存储清理。',
    },
    'customer-service': {
      eyebrow: `${domainLabel} / 客服`,
      title: '客服管理',
      description: '管理 Site 与 Customer Service 的连接配置。',
    },
    faq: {
      eyebrow: `${domainLabel} / FAQ`,
      title: 'FAQ 管理',
      description: '管理当前公开 FAQ Markdown 内容。',
    },
    sections: {
      eyebrow: `${domainLabel} / 分区`,
      title: '分区管理',
      description: '管理业务分区及其展示顺序。',
    },
    'system-general': {
      eyebrow: `${domainLabel} / 常规`,
      title: '常规',
      description: '管理站点名称、位置标签与品牌标识。',
    },
    'system-infrastructure': {
      eyebrow: `${domainLabel} / 基础设施`,
      title: '基础设施',
      description: '管理媒体域名与存储访问相关技术配置。',
    },
    'system-advanced': {
      eyebrow: `${domainLabel} / 高级`,
      title: '高级',
      description: '管理可选的高级站点集成参数。',
    },
  };
  const fixedContext = fixed[view];
  if (fixedContext) return { domain, ...fixedContext };

  const dynamic = parseDynamicView(view);
  if (!dynamic) {
    return {
      domain,
      eyebrow: domainLabel,
      title: '管理后台',
      description: '当前管理工作区。',
    };
  }

  const section = sections.find((item) => item.id === dynamic.sectionId);
  const sectionName = section?.name ?? '分区业务';
  const kindLabels: Record<DynamicViewKind, string> = {
    products: '商品管理',
    categories: '分类管理',
    tags: '标签管理',
    'conversion-pool': '转化池',
  };

  return {
    domain,
    eyebrow: `${domainLabel} / ${sectionName}`,
    title: kindLabels[dynamic.kind],
    description: `管理“${sectionName}”分区的${kindLabels[dynamic.kind]}。`,
  };
}
