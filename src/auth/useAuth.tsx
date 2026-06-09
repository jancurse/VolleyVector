import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { JSX, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "../supabase/client";

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
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

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
