import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { storefrontQueryClient } from './storefront-query-client';

export function StorefrontQueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={storefrontQueryClient}>{children}</QueryClientProvider>
  );
}
