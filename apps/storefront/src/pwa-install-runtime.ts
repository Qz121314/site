import type { ThemeInstallPrompt } from './theme-runtime';

export type PwaInstallRuntime = {
  appName: string;
  config: ThemeInstallPrompt;
};

type Listener = () => void;

export type PwaBeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

let currentRuntime: PwaInstallRuntime | null = null;
let currentInstallEvent: PwaBeforeInstallPromptEvent | null = null;
let installed = false;
let eventCaptureInstalled = false;
const listeners = new Set<Listener>();

export function publishPwaInstallRuntime(runtime: PwaInstallRuntime): void {
  currentRuntime = runtime;
  for (const listener of listeners) listener();
}

export function subscribePwaInstallRuntime(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function installPwaInstallEventCapture(): void {
  if (typeof window === 'undefined' || eventCaptureInstalled) return;
  eventCaptureInstalled = true;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    currentInstallEvent = event as PwaBeforeInstallPromptEvent;
    for (const listener of listeners) listener();
  });
  window.addEventListener('appinstalled', () => {
    currentInstallEvent = null;
    installed = true;
    for (const listener of listeners) listener();
  });
}

export function getPwaInstallEvent(): PwaBeforeInstallPromptEvent | null {
  return currentInstallEvent;
}

export async function requestPwaInstall(): Promise<'accepted' | 'dismissed' | null> {
  if (!currentInstallEvent) return null;
  const event = currentInstallEvent;
  try {
    await event.prompt();
    const choice = await event.userChoice;
    currentInstallEvent = null;
    if (choice.outcome === 'accepted') installed = true;
    for (const listener of listeners) listener();
    return choice.outcome;
  } catch {
    currentInstallEvent = null;
    for (const listener of listeners) listener();
    return null;
  }
}

export function isPwaInstalled(): boolean {
  return installed;
}

export function getPwaInstallRuntime(): PwaInstallRuntime | null {
  return currentRuntime;
}
