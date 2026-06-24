import { useState } from "react";
import type { JSX, ReactNode } from "react";

import { useAuth } from "./useAuth";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { BrandLockup } from "../shell/BrandMark";
import { cx, MUTED, PANEL } from "../ui/styles";

const BACKGROUND =
  "flex min-h-[100dvh] flex-col items-center justify-center px-6 [background:radial-gradient(135%_90%_at_50%_-10%,var(--bg-glow),transparent_55%),var(--bg)]";

const MIN_LENGTH = 8;

// The shared password-setting screen behind both setting a password (an email invite leaves the account
// without one) and recovering it (a reset link). It collects a password and confirmation, sets it through
// `updateUser`, and offers a sign-out escape naming the account so a wrong-account link can be backed out
// of. Callers supply the copy and what happens once the password is saved, plus any extra control before
// the submit (e.g. the signup Terms checkbox) with the matching submit gate.
export function NewPasswordForm({
  title,
  description,
  email,
  onDone,
  submitDisabled = false,
  children,
}: {
  title: string;
  description: string;
  email: string;
  onDone: () => void | Promise<void>;
  submitDisabled?: boolean;
  children?: ReactNode;
}): JSX.Element {
  const { updatePassword, signOut } = useAuth();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);

      return;
    }

    if (password !== confirm) {
      setError("The passwords do not match.");

      return;
    }

    setError(null);
    setBusy(true);

    const { error: failure } = await updatePassword(password);

    if (failure) {
      setError(failure);
      setBusy(false);

      return;
    }

    await onDone();
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
          <h1 className="m-0 mt-3 font-display text-[1.9rem] font-bold tracking-[-0.025em]">{title}</h1>
          <p className={cx(MUTED, "mt-2")}>{description}</p>
        </div>

        <Field label="Password">
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            autoFocus
            required
          />
        </Field>

        <Field label="Confirm password">
          <Input
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="new-password"
            required
          />
        </Field>

        {children}

        {error && <p className="m-0 text-sm text-danger">{error}</p>}

        <Button type="submit" disabled={busy || password === "" || confirm === "" || submitDisabled}>
          {busy ? "Saving…" : "Save password"}
        </Button>

        <button
          type="button"
          onClick={() => void signOut()}
          className={cx(MUTED, "m-0 cursor-pointer border-0 bg-transparent text-sm underline")}
        >
          Not {email}? Sign out
        </button>
      </form>
    </div>
  );
}
