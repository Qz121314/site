import { createContext, useContext, type ReactNode } from 'react';
import { FALLBACK_STOREFRONT_COPY, type StorefrontCopy } from './storefront-copy';

const StorefrontCopyContext = createContext<StorefrontCopy>(FALLBACK_STOREFRONT_COPY);

export function StorefrontCopyProvider({
  value,
  children,
}: {
  value: StorefrontCopy;
  children: ReactNode;
}) {
  return <StorefrontCopyContext.Provider value={value}>{children}</StorefrontCopyContext.Provider>;
}

export function useStorefrontCopy(): StorefrontCopy {
  return useContext(StorefrontCopyContext);
}
