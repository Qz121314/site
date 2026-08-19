import type { ThemeInstallPrompt } from './theme-runtime';

export type PwaInstallRuntime = {
  appName: string;
  config: ThemeInstallPrompt;
};

type Listener = () => void;

let currentRuntime: PwaInstallRuntime | null = null;
const listeners = new Set<Listener>();

export function publishPwaInstallRuntime(runtime: PwaInstallRuntime): void {
  currentRuntime = runtime;
  for (const listener of listeners) listener();
}

export function subscribePwaInstallRuntime(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPwaInstallRuntime(): PwaInstallRuntime | null {
  return currentRuntime;
}
