import type { AppBindings } from '../types';

export type AdminAuthBindings = {
  adminPassword: string;
  sessionSecret: string;
};

function readBinding(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function getAdminAuthBindings(bindings: AppBindings): AdminAuthBindings | null {
  const adminPassword = readBinding(bindings.ADMIN_PASSWORD);
  const sessionSecret = readBinding(bindings.SESSION_SECRET);

  if (adminPassword === null || sessionSecret === null) {
    return null;
  }

  return { adminPassword, sessionSecret };
}
