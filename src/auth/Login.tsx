import { useState } from "react";
import type { JSX } from "react";

import { useAuth } from "./useAuth";
import { devAccounts } from "./devAccounts";
import type { DevAccount } from "./devAccounts";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { BrandLockup } from "../shell/BrandMark";
import { cx, PANEL, PANEL_TITLE } from "../ui/styles";

const BACKGROUND =
  "flex min-h-[100dvh] flex-col items-center justify-center px-6 [background:radial-gradient(135%_90%_at_50%_-10%,var(--bg-glow),transparent_55%),var(--bg)]";

// The sign-in gate. On success the auth listener in AuthProvider swaps this screen for the app, so this
// component only has to surface an error when the credentials are rejected.
export function Login(): JSX.Element {
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const runSignIn = async (account: { email: string; password: string }) => {
    setError(null);
    setBusy(true);

    const { error: failure } = await signIn(account.email, account.password);

    if (failure) {
      setError(failure);
      setBusy(false);
    }
  };

  const accounts = devAccounts();

  return (
    <div className={cx(BACKGROUND, "gap-4")}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void runSignIn({ email: email.trim(), password });
        }}
        className={cx(PANEL, "w-full max-w-[24rem] gap-5")}
      >
        <div>
          <BrandLockup />
          <h1 className="m-0 mt-3 font-display text-[1.9rem] font-bold tracking-[-0.025em]">Sign in</h1>
        </div>

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
      </form>

      {accounts.length > 0 && <DevSignIn accounts={accounts} busy={busy} onPick={runSignIn} />}
    </div>
  );
}

// Dev-only quick sign-in: one button per configured dev account, so a developer can land on any seeded or
// personal account without typing credentials. Rendered only when vite.config plumbed accounts through, so
// it never appears in production.
function DevSignIn({
  accounts,
  busy,
  onPick,
}: {
  accounts: DevAccount[];
  busy: boolean;
  onPick: (account: DevAccount) => void | Promise<void>;
}): JSX.Element {
  return (
    <div className={cx(PANEL, "w-full max-w-[24rem] gap-3")}>
      <p className={PANEL_TITLE}>Dev sign-in</p>
      <div className="flex flex-wrap gap-2">
        {accounts.map((account) => (
          <Button
            key={account.email}
            variant="ghost"
            disabled={busy}
            onClick={() => void onPick(account)}
            data-testid={`dev-signin-${account.email}`}
          >
            {account.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
