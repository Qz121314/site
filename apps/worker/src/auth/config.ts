import type { AppBindings } from '../types';

export type AdminAuthBindings = {
  adminPassword: string;
  sessionSecret: string;
};

function readBinding(value: unknown, minimumLength: number): string | null {
  if (typeof value !== 'string' || value.trim().length < minimumLength) {
    return null;
  }

  return value;
}

export function getAdminAuthBindings(bindings: AppBindings): AdminAuthBindings | null {
  const adminPassword = readBinding(bindings.ADMIN_PASSWORD, 12);
  const sessionSecret = readBinding(bindings.SESSION_SECRET, 32);

  if (adminPassword === null || sessionSecret === null) {
    return null;
  }

  return { adminPassword, sessionSecret };
}
