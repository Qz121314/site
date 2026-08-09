import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installPublicContentFetchFallback } from './public-content-transport';
import { installStorefrontTheme } from './theme-runtime';
import '@site/storefront-ui/styles.css';
import './styles.css';
import './hero-carousel.css';
import './theme-runtime.css';
import './media-runtime.css';
import './storefront-resilience.css';
import './storefront-pages.css';

installPublicContentFetchFallback();
void installStorefrontTheme();

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
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
