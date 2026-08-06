import type { AppBindings } from '../types';

export type AdminAuthBindings = {
  adminPassword: string;
  sessionSecret: string;
};

function readNonEmptyBinding(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function getAdminAuthBindings(bindings: AppBindings): AdminAuthBindings | null {
  const adminPassword = readNonEmptyBinding(bindings.ADMIN_PASSWORD);
  const sessionSecret = readNonEmptyBinding(bindings.SESSION_SECRET);

  if (!adminPassword || !sessionSecret) {
    return null;
  }

  return { adminPassword, sessionSecret };
}
