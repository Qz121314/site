import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import './site-settings.css';
import './sections.css';
import './operating-admin.css';
import './asset-library.css';
import './faq-management.css';
import './category-management.css';
import './conversion-pool.css';
import './product-management.css';
import './product-local-images.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('缺少 #root 元素。');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
