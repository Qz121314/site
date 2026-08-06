const modules = [
  ['服务频道', '配置公开用户端的一级服务入口'],
  ['分类与标签', '维护可组合筛选的内容结构'],
  ['门店与展示项目', '编辑门店、线上服务和双语内容'],
  ['媒体资源', '上传、引用检查和延迟垃圾回收'],
  ['发布中心', '生成 R2 快照、查看版本并执行回滚'],
  ['权限与审计', '管理员、角色、操作日志和回收站'],
] as const;

export function App() {
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="admin-brand">
          <span>SC</span>
          <div>
            <strong>服务平台</strong>
            <small>管理后台</small>
          </div>
        </div>
        <nav>
          {['仪表盘', '内容管理', '门店管理', '媒体资源', '发布中心', '系统设置'].map(
            (item, index) => (
              <button className={index === 0 ? 'is-active' : undefined} key={item} type="button">
                {item}
              </button>
            ),
          )}
        </nav>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <p>阶段 0 · 工程初始化</p>
            <h1>平台管理后台</h1>
          </div>
          <span className="environment-badge">LOCAL / PREVIEW</span>
        </header>

        <section className="status-grid">
          <article>
            <span>应用边界</span>
            <strong>3</strong>
            <small>Storefront / Admin / Worker</small>
          </article>
          <article>
            <span>公开语言</span>
            <strong>2</strong>
            <small>English / Español</small>
          </article>
          <article>
            <span>当前版本</span>
            <strong>0.1</strong>
            <small>工程骨架</small>
          </article>
        </section>

        <section className="module-section">
          <div className="section-title">
            <div>
              <p>开发基线</p>
              <h2>首个业务闭环模块</h2>
            </div>
            <button type="button">查看开发计划</button>
          </div>
          <div className="module-grid">
            {modules.map(([title, description], index) => (
              <article key={title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
