import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { JSX, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "../supabase/client";
import { devAccounts } from "./devAccounts";

// Authentication is the app's front door: an unauthenticated visitor reaches only this gate (and, from
// Stage 2, a share link). Sign-in is invite-only email + password; there is no public sign-up surface.
export type AuthValue = {
  session: Session | null;
  user: User | null;
  /** True until the first session lookup resolves, so the app can hold its gate rather than flash. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  /** Set a password on the current user, used to finish an invite that leaves the account without one. */
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

async function signIn(email: string, password: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  return { error: error?.message ?? null };
}

async function updatePassword(password: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.updateUser({ password });

  return { error: error?.message ?? null };
}

async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      let { data } = await supabase.auth.getSession();

      // In dev, auto-login as the default account (the first dev account) so the dev server (and
      // Playwright, which starts from empty storage) never stalls on the gate. Signing out drops back to
      // the gate, where the other dev accounts are offered as switch-account buttons. Empty in production.
      const [defaultAccount] = devAccounts();

      if (!data.session && defaultAccount) {
        await signIn(defaultAccount.email, defaultAccount.password);
        ({ data } = await supabase.auth.getSession());
      }

      setSession(data.session);
      setLoading(false);
    }

    init();

    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));

    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ session, user: session?.user ?? null, loading, signIn, updatePassword, signOut }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);

  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");

  return ctx;
}
