import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installAdminMutationObserver } from './admin-mutation-observer';
import './styles.css';
import './site-settings.css';
import './sections.css';
import './operating-admin.css';
import './asset-library.css';
import './faq-management.css';
import './category-management.css';
import './conversion-pool.css';
import './product-management.css';
import './product-tags.css';
import './product-local-images.css';
import './branding-media.css';
import './admin-polish.css';
import './admin-polish-2.css';
import './admin-density.css';
import './admin-no-scroll.css';
import './admin-centered-layout.css';
import './admin-section-workspace-nav.css';
import './admin-publish.css';
import './customer-service-connections.css';

installAdminMutationObserver();

const root = document.getElementById('root');
if (!root) {
  throw new Error('缺少 #root 元素。');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
