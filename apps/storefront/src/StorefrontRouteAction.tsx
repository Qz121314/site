import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const StorefrontRouteActionHostContext = createContext<HTMLElement | null>(null);

export function StorefrontRouteActionHostProvider({
  children,
  host,
}: {
  children: ReactNode;
  host: HTMLElement | null;
}) {
  return (
    <StorefrontRouteActionHostContext.Provider value={host}>
      {children}
    </StorefrontRouteActionHostContext.Provider>
  );
}

export function StorefrontRouteAction({ children }: { children: ReactNode }) {
  const host = useContext(StorefrontRouteActionHostContext);
  return host ? createPortal(children, host) : null;
}
