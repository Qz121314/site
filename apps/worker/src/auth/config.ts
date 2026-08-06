import type { AppBindings } from '../types';

export type AdminAuthSecrets = {
  adminPassword: string;
  sessionSecret: string;
};

export function getAdminAuthSecrets(bindings: AppBindings): AdminAuthSecrets | null {
  const adminPassword = bindings.ADMIN_PASSWORD;
  const sessionSecret = bindings.SESSION_SECRET;

  if (
    typeof adminPassword !== 'string' ||
    adminPassword.length < 12 ||
    typeof sessionSecret !== 'string' ||
    sessionSecret.length < 32
  ) {
    return null;
  }

  return { adminPassword, sessionSecret };
}
