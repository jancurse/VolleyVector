import { useState } from "react";
import type { JSX } from "react";

import { useAuth } from "./useAuth";
import { devAccounts } from "./devAccounts";
import { requestPasswordReset } from "../supabase/passwordReset";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { cx, FIELD_LABEL, MUTED } from "../ui/styles";

// The sign-in body of the shared auth surface: just the form, so the surface owns the brand, the
// Sign in / Sign up switch, and the card around it. On success the auth listener swaps the screen for
// the app, so the form only has to surface an error when the credentials are rejected. One shared
// busy/error covers both the typed sign-in and the dev quick-sign-in, so the two never race or leave a
// stale error.

export function LoginForm(): JSX.Element {
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The password-reset request, shown in place of the sign-in form. It asks the server to mail a reset
  // link, then shows one neutral confirmation whatever the outcome, so the request never reveals whether
  // an account exists for the address (see requestPasswordReset).
  const [forgot, setForgot] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const accounts = devAccounts();

  const runSignIn = async (account: { email: string; password: string }) => {
    setError(null);
    setBusy(true);

    const { error: failure } = await signIn(account.email, account.password);

    if (failure) {
      setError(failure);
      setBusy(false);
    }
  };

  const backToSignIn = (
    <button
      type="button"
      onClick={() => {
        setForgot(false);
        setResetSent(false);
      }}
      className={cx(MUTED, "m-0 cursor-pointer self-start border-0 bg-transparent text-sm underline")}
    >
      Back to sign in
    </button>
  );

  if (forgot) {
    if (resetSent) {
      return (
        <div className="flex flex-col gap-5">
          <p className={cx(MUTED, "not-italic")}>
            If an account exists for {email.trim()}, we’ve sent a link to reset its password.
          </p>
          {backToSignIn}
        </div>
      );
    }

    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setResetBusy(true);
          void requestPasswordReset(email.trim()).then(() => setResetSent(true));
        }}
        className="flex flex-col gap-5"
      >
        <p className={cx(MUTED, "not-italic")}>Enter your email and we’ll send you a link to choose a new password.</p>
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            autoFocus
            required
          />
        </Field>
        <Button type="submit" disabled={resetBusy || email.trim() === ""}>
          {resetBusy ? "Sending…" : "Send reset link"}
        </Button>
        {backToSignIn}
      </form>
    );
  }

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void runSignIn({ email: email.trim(), password });
        }}
        className="flex flex-col gap-5"
      >
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            autoFocus
            required
          />
        </Field>

        <Field label="Password">
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>

        {error && <p className="m-0 text-sm text-danger">{error}</p>}

        <Button type="submit" disabled={busy || email === "" || password === ""}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>

        <button
          type="button"
          onClick={() => setForgot(true)}
          className={cx(MUTED, "m-0 cursor-pointer border-0 bg-transparent text-sm underline")}
        >
          Forgot password?
        </button>
      </form>

      {/* Dev-only quick sign-in: one button per configured dev account, so a developer can land on any
          seeded or personal account without typing. Rendered only when vite.config plumbed accounts
          through, so it never appears in production. Shares the form's busy state. */}
      {accounts.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <p className={FIELD_LABEL}>Dev sign-in</p>
          <div className="flex flex-wrap gap-2">
            {accounts.map((account) => (
              <Button
                key={account.email}
                variant="ghost"
                disabled={busy}
                onClick={() => void runSignIn(account)}
                data-testid={`dev-signin-${account.email}`}
              >
                {account.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
