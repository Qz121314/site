import type { AdminIdentity } from '../../../packages/shared/src/domain';

export type AdminSession = AdminIdentity & {
  sessionId: string;
  expiresAt: number;
  lastSeenAt: number;
};

export type AppVariables = {
  requestId: string;
  adminSession: AdminSession;
};

export type AppEnvironment = {
  Bindings: Env;
  Variables: AppVariables;
};
