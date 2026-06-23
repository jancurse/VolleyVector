import { useState } from "react";
import type { JSX } from "react";

import { useAuth } from "./useAuth";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { TermsConsentLabel } from "../legal/TermsConsentLabel";
import { recordTermsAcceptance } from "../legal/acceptTerms";
import { BrandLockup } from "../shell/BrandMark";
import { cx, MUTED, PANEL } from "../ui/styles";

const BACKGROUND =
  "flex min-h-[100dvh] flex-col items-center justify-center px-6 [background:radial-gradient(135%_90%_at_50%_-10%,var(--bg-glow),transparent_55%),var(--bg)]";

const MIN_LENGTH = 8;

// Finishes an email invite. The invite link signs the recipient in as a freshly created account that has
// no password yet, so this collects one and sets it through `updateUser`. The account's email is shown so
// the recipient sees exactly which account they are setting up — an invite for one address never silently
// completes as another — and a sign-out escape lets them back out if it is not the account they expected.
export function SetPassword({ email, onDone }: { email: string; onDone: () => void }): JSX.Element {
  const { updatePassword, signOut } = useAuth();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);
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

    await recordTermsAcceptance();
    onDone();
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
          <h1 className="m-0 mt-3 font-display text-[1.9rem] font-bold tracking-[-0.025em]">Set a password</h1>
          <p className={cx(MUTED, "mt-2")}>Choose a password for {email} to finish setting up your account.</p>
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

        <Checkbox checked={accepted} onCheckedChange={setAccepted} ariaLabel="I agree to the Terms & Privacy">
          <TermsConsentLabel />
        </Checkbox>

        {error && <p className="m-0 text-sm text-danger">{error}</p>}

        <Button type="submit" disabled={busy || password === "" || confirm === "" || !accepted}>
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
