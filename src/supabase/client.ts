import { createClient } from "@supabase/supabase-js";

// The single browser Supabase client. It carries only the public URL and publishable key (safe to ship
// in the bundle); every access rule is enforced server-side by row-level security, never by this client.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY — see .env.");
}

export const supabase = createClient(url, key);
