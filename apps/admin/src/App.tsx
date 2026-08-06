type AdminSection = {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
};

const sections: readonly AdminSection[] = [];

const coreModules = [
  ['分区管理', '新增分区并设置名称、图标、排序和启用状态'],
  ['产品管理', '产品在所属分区菜单中录入和管理'],
  ['转化方式', '转化方式在所属分区菜单中录入并供产品复用'],
  ['媒体管理', '管理分区图标、产品封面和产品图片'],
  ['热门推荐', '选择热门产品并设置首页推荐顺序'],
  ['FAQ 管理', '录入公开前端使用的英文常见问题'],
] as const;

export function App() {
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="admin-brand">
          <span>SP</span>
          <div>
            <strong>业务展示模板</strong>
            <small>中文管理后台</small>
          </div>
        </div>

        <nav aria-label="后台导航">
          <button className="is-active" type="button">
            仪表盘
          </button>
          <button type="button">分区管理</button>

          {sections.map((section) => (
            <div className="dynamic-menu" key={section.id}>
              <button type="button">
                <span aria-hidden="true">{section.icon}</span>
                {section.name}
              </button>
              <div>
                <button type="button">产品管理</button>
                <button type="button">转化方式</button>
              </div>
            </div>
          ))}

          <button type="button">媒体管理</button>
          <button type="button">热门推荐</button>
          <button type="button">FAQ 管理</button>
          <button type="button">发布管理</button>
          <button type="button">系统设置</button>
          <button type="button">回收站</button>
          <button type="button">操作日志</button>
        </nav>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <p>当前阶段 · 后台数据录入核心</p>
            <h1>平台管理后台</h1>
          </div>
          <span className="environment-badge">PRODUCTION</span>
        </header>

        <section className="status-grid">
          <article>
            <span>已创建分区</span>
            <strong>{sections.length}</strong>
            <small>创建后自动生成业务菜单</small>
          </article>
          <article>
            <span>公开语言</span>
            <strong>1</strong>
            <small>English</small>
          </article>
          <article>
            <span>后台语言</span>
            <strong>中文</strong>
            <small>公开内容直接录入英文</small>
          </article>
        </section>

        <section className="module-section">
          <div className="section-title">
            <div>
              <p>数据驱动模板</p>
              <h2>后台第一批核心模块</h2>
            </div>
            <button type="button">新增分区</button>
          </div>

          <div className="module-grid">
            {coreModules.map(([title, description], index) => (
              <article key={title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        {sections.length === 0 ? (
          <section className="empty-admin-state">
            <strong>尚未创建分区</strong>
            <p>请先进入“分区管理”新增分区。创建成功后，左侧会自动生成该分区的产品管理和转化方式菜单。</p>
          </section>
        ) : null}
      </main>
    </div>
  );
}
