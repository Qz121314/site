import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MobileEdgeNavigation } from './MobileEdgeNavigation';
import { PwaInstallPrompt } from './PwaInstallPrompt';
import { installPublicContentFetchFallback } from './public-content-transport';
import { StorefrontPresentation } from './StorefrontPresentation';
import { StorefrontRoot } from './StorefrontRoot';
import { StorefrontRoutePreload } from './StorefrontRoutePreload';
import { installCachedStorefrontTheme } from './theme-runtime';
import { installStorefrontViewportRuntime } from './storefront-viewport-runtime';
import '@site/storefront-ui/styles.css';
import '@site/storefront-ui/loading.css';
import '@site/storefront-ui/no-agent.css';
import './styles.css';
import './theme-runtime.css';
import './media-runtime.css';
import './pwa.css';
import './app-shell.css';
import '@site/storefront-ui/home.css';
import './route-transition.css';
import '@site/storefront-ui/theme-contract.css';
import '@site/storefront-ui/primary-pages-theme-contract.css';
import '@site/storefront-ui/typography-contract.css';
import '@site/storefront-ui/art-direction-contract.css';
import '@site/storefront-ui/art-direction-primary-surfaces.css';
import '@site/storefront-ui/layout-contract.css';
import './app-chrome.css';
import './catalog-polish.css';
import './ui-accessibility.css';
import './loading-states.css';

installStorefrontViewportRuntime();
installPublicContentFetchFallback();
installCachedStorefrontTheme();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((error: unknown) => {
        console.warn('Service worker registration failed.', error);
      });
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const root = document.getElementById('root');
if (!root) {
  throw new Error('Missing #root element.');
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <StorefrontPresentation />
      <StorefrontRoutePreload />
      <MobileEdgeNavigation />
      <StorefrontRoot />
      <PwaInstallPrompt />
    </QueryClientProvider>
  </StrictMode>,
);
