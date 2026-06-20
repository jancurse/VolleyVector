/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  // Dev-only quick sign-in accounts (JSON: { label, email, password }[]), set in serve mode only. The
  // first entry is the auto-login default; the rest back the gate's switch buttons. Absent in production.
  readonly VITE_DEV_ACCOUNTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
