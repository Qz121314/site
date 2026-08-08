import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AdminErrorBoundary } from './AdminErrorBoundary';
import { installAdminUnsavedStateObserver } from './admin-unsaved-state';
import './styles.css';
import './site-settings.css';
import './sections.css';
import './operating-admin.css';
import './asset-library.css';
import './media-picker.css';
import './media-folders.css';
import './category-management.css';
import './conversion-pool.css';
import './product-management.css';
import './product-tags.css';
import './product-local-images.css';
import './branding-media.css';
import './admin-foundation.css';
import './admin-scroll-ownership.css';
import './admin-section-workspace-nav.css';
import './admin-publish.css';
import './admin-unsaved.css';
import './customer-service-connections.css';
import './product-editor.css';
import './product-dependency-handoff.css';
import './admin-ui-system.css';
import './admin-sidebar.css';
import './theme-center.css';
import './faq-management.css';
import './markdown-media.css';
import './media-center.css';
import './media-upload-queue.css';
import './admin-error-boundary.css';
import './admin-dialog-service.css';

installAdminUnsavedStateObserver();

const root = document.getElementById('root');
if (!root) {
  throw new Error('缺少 #root 元素。');
}

createRoot(root).render(
  <StrictMode>
    <AdminErrorBoundary>
      <App />
    </AdminErrorBoundary>
  </StrictMode>,
);
