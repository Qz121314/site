export type AdminSession = {
  version: 1;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

export type AppBindings = Env &
  Record<string, unknown> & {
    ADMIN_PASSWORD?: string;
    SESSION_SECRET?: string;
  };

export type AppVariables = {
  requestId: string;
  adminSession: AdminSession;
};

export type AppEnvironment = {
  Bindings: AppBindings;
  Variables: AppVariables;
};
