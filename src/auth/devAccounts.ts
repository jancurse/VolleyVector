// Dev-only quick sign-in accounts, plumbed onto import.meta.env by vite.config's loadDevCredentials
// (serve mode only, so production builds carry none). The first entry is the default the app auto-logs-in
// as; the full list backs the gate's switch-account buttons. Empty outside dev.
export type DevAccount = { label: string; email: string; password: string };

export function devAccounts(): DevAccount[] {
  if (!import.meta.env.DEV || !import.meta.env.VITE_DEV_ACCOUNTS) return [];

  try {
    const parsed: unknown = JSON.parse(import.meta.env.VITE_DEV_ACCOUNTS);

    return Array.isArray(parsed) ? (parsed as DevAccount[]) : [];
  } catch {
    return [];
  }
}
