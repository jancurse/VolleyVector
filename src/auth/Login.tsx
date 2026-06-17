import { useState } from "react";
import type { JSX } from "react";

import { useAuth } from "./useAuth";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { BrandLockup } from "../shell/BrandMark";
import { cx, PANEL } from "../ui/styles";

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

  const submit = async () => {
    setError(null);
    setBusy(true);

    const { error: failure } = await signIn(email.trim(), password);

    if (failure) {
      setError(failure);
      setBusy(false);
    }
  };

  return (
    <div className={BACKGROUND}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
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
    </div>
  );
}
