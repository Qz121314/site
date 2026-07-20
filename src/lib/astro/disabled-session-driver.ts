import type { SessionDriver } from "astro";

const DISABLED_MESSAGE = "Astro Session API is disabled. Use the signed admin session cookie utilities instead.";

export default function disabledSessionDriver(): SessionDriver {
  return {
    async getItem() {
      return undefined;
    },
    async setItem() {
      throw new Error(DISABLED_MESSAGE);
    },
    async removeItem() {
      return undefined;
    },
  };
}
