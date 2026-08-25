import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AdminErrorBoundary } from './AdminErrorBoundary';
import { installAdminUnsavedStateObserver } from './admin-unsaved-state';
import './admin.css';

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
