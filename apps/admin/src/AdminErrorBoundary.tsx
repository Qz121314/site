import { Component, type ErrorInfo, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { Button } from './components/ui/button';

type AdminErrorBoundaryProps = {
  children: ReactNode;
};

type AdminErrorBoundaryState = {
  error: Error | null;
  incidentId: string | null;
};

function createIncidentId(): string {
  return `ADM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export class AdminErrorBoundary extends Component<
  AdminErrorBoundaryProps,
  AdminErrorBoundaryState
> {
  state: AdminErrorBoundaryState = { error: null, incidentId: null };

  static getDerivedStateFromError(error: Error): AdminErrorBoundaryState {
    return { error, incidentId: createIncidentId() };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ADMIN_RENDER_ERROR', {
      incidentId: this.state.incidentId,
      message: error.message,
      componentStack: info.componentStack,
    });
  }

  private retry = () => {
    this.setState({ error: null, incidentId: null });
  };

  private returnToSettings = () => {
    try {
      window.localStorage.setItem('site.admin.lastView', 'settings');
    } catch {
      // Navigation must remain recoverable when localStorage is unavailable.
    }
    window.location.hash = '#settings';
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="admin-crash-screen" role="alert">
        <section className="admin-crash-card">
          <div className="admin-crash-mark" aria-hidden="true">
            <CircleAlert size={24} strokeWidth={1.8} />
          </div>
          <div className="admin-crash-copy">
            <p>后台运行异常</p>
            <h1>当前界面没有正常完成渲染</h1>
            <span>
              业务数据不会因为这个界面异常自动修改。可以先重试；如果仍然失败，返回站点设置重新进入模块。
            </span>
            {this.state.incidentId ? <code>错误编号 {this.state.incidentId}</code> : null}
          </div>
          <div className="admin-crash-actions">
            <Button variant="secondary" onClick={this.retry}>
              重试后台
            </Button>
            <Button onClick={this.returnToSettings}>返回站点设置</Button>
          </div>
        </section>
      </main>
    );
  }
}
