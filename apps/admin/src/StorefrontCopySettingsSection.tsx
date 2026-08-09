import type { StorefrontCopy } from './storefront-copy-settings';

type CopyGroupKey = Exclude<keyof StorefrontCopy, 'navigation'>;

type CopyField = {
  key: string;
  label: string;
};

type CopyGroup = {
  key: CopyGroupKey;
  label: string;
  hint: string;
  fields: CopyField[];
};

const COPY_GROUPS: CopyGroup[] = [
  {
    key: 'home',
    label: 'Home',
    hint: '首页分区、热门与最新内容标题。',
    fields: [
      { key: 'sectionsKicker', label: '分区辅助标题' },
      { key: 'sectionsTitle', label: '分区标题' },
      { key: 'viewAll', label: '展开按钮' },
      { key: 'showLess', label: '收起按钮' },
      { key: 'emptySections', label: '空状态' },
      { key: 'featuredKicker', label: '热门辅助标题' },
      { key: 'featuredTitle', label: '热门标题' },
      { key: 'latestKicker', label: '最新辅助标题' },
      { key: 'latestTitle', label: '最新标题' },
    ],
  },
  {
    key: 'browse',
    label: 'Browse',
    hint: 'Browse 页面标题、搜索框与内容分组。',
    fields: [
      { key: 'kicker', label: '辅助标题' },
      { key: 'title', label: '页面标题' },
      { key: 'searchPlaceholder', label: '搜索提示' },
      { key: 'sectionsTitle', label: '分区标题' },
      { key: 'productsTitle', label: '产品标题' },
      { key: 'noResults', label: '无结果提示' },
    ],
  },
  {
    key: 'section',
    label: 'Section',
    hint: '分区页面的返回、筛选与结果文案。',
    fields: [
      { key: 'backLabel', label: '返回 Browse' },
      { key: 'kicker', label: '辅助标题' },
      { key: 'searchLabel', label: '搜索字段' },
      { key: 'searchPlaceholder', label: '搜索提示' },
      { key: 'typeLabel', label: '类型字段' },
      { key: 'allTypes', label: '全部类型' },
      { key: 'clearFilters', label: '清除筛选' },
      { key: 'emptyResults', label: '无结果提示' },
      { key: 'resultSingular', label: '单数结果' },
      { key: 'resultPlural', label: '复数结果' },
      { key: 'loading', label: '加载提示' },
    ],
  },
  {
    key: 'product',
    label: 'Product',
    hint: '产品卡片模式、详情信息和 CTA 辅助文案。',
    fields: [
      { key: 'onlineLabel', label: 'Online 标签' },
      { key: 'offlineLabel', label: 'In-person 标签' },
      { key: 'onlineKicker', label: 'Online 详情辅助标题' },
      { key: 'offlineKicker', label: 'In-person 详情辅助标题' },
      { key: 'typeLabel', label: '类型字段' },
      { key: 'aboutTitle', label: '正文标题' },
      { key: 'contactKicker', label: 'CTA 辅助标题' },
      { key: 'contactHint', label: 'CTA 说明' },
      { key: 'mediaUnavailable', label: '媒体不可用' },
      { key: 'imageUnavailable', label: '图片不可用' },
      { key: 'noMedia', label: '无媒体' },
      { key: 'loading', label: '加载提示' },
    ],
  },
  {
    key: 'faq',
    label: 'FAQ',
    hint: 'FAQ 页面与数据状态文案。',
    fields: [
      { key: 'kicker', label: '辅助标题' },
      { key: 'title', label: '页面标题' },
      { key: 'loading', label: '加载提示' },
      { key: 'unavailable', label: '不可用提示' },
      { key: 'retry', label: '重试按钮' },
      { key: 'empty', label: '空状态' },
    ],
  },
  {
    key: 'messages',
    label: 'Messages',
    hint: '会话列表与聊天界面的基础用户文案；客服业务规则不在这里配置。',
    fields: [
      { key: 'kicker', label: '辅助标题' },
      { key: 'title', label: '页面标题' },
      { key: 'emptyTitle', label: '空状态标题' },
      { key: 'emptyDescription', label: '空状态说明' },
      { key: 'supportName', label: '默认客服名称' },
      { key: 'noActiveConversation', label: '无有效会话' },
      { key: 'unavailableTitle', label: '会话不可用标题' },
      { key: 'unavailableDescription', label: '会话不可用说明' },
      { key: 'backLabel', label: '返回按钮辅助文案' },
      { key: 'inputPlaceholder', label: '输入框提示' },
      { key: 'productLabel', label: '产品上下文标签' },
      { key: 'waitingStatus', label: '等待状态' },
      { key: 'activeStatus', label: '服务中状态' },
      { key: 'closedStatus', label: '结束状态' },
      { key: 'waitingPreview', label: '等待时会话预览' },
    ],
  },
];

export function StorefrontCopySettingsSection({
  value,
  busy,
  onChange,
}: {
  value: StorefrontCopy;
  busy: boolean;
  onChange: (value: StorefrontCopy) => void;
}) {
  function updateField(groupKey: CopyGroupKey, fieldKey: string, fieldValue: string) {
    onChange({
      ...value,
      [groupKey]: {
        ...value[groupKey],
        [fieldKey]: fieldValue,
      },
    } as StorefrontCopy);
  }

  return (
    <section className="admin-settings-section" aria-labelledby="settings-copy-title">
      <h2 id="settings-copy-title">前端文案</h2>
      <p className="admin-settings-section-description">
        用户前端为英文。底部导航名称在“底部导航”中管理；这里维护其余站点/业务文案。
      </p>
      <div className="admin-storefront-copy-groups">
        {COPY_GROUPS.map((group) => (
          <details className="admin-storefront-copy-group" key={group.key}>
            <summary>
              <strong>{group.label}</strong>
              <span>{group.hint}</span>
            </summary>
            <div className="admin-settings-row admin-storefront-copy-grid">
              {group.fields.map((field) => (
                <label className="field-group" key={field.key}>
                  <span>{field.label}</span>
                  <input
                    type="text"
                    lang="en"
                    maxLength={240}
                    value={(value[group.key] as unknown as Record<string, string>)[field.key] ?? ''}
                    disabled={busy}
                    onChange={(event) => updateField(group.key, field.key, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
