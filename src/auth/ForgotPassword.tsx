import { useState } from "react";
import type { JSX } from "react";

import { requestPasswordReset } from "../supabase/passwordReset";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { BrandLockup } from "../shell/BrandMark";
import { cx, MUTED, PANEL } from "../ui/styles";

const BACKGROUND =
  "flex min-h-[100dvh] flex-col items-center justify-center px-6 [background:radial-gradient(135%_90%_at_50%_-10%,var(--bg-glow),transparent_55%),var(--bg)]";

// The password-reset request screen, shown in place of the sign-in form from the login gate. It takes an
// email and asks the server to send a reset link, then shows one neutral confirmation regardless of
// outcome: the request side never reveals whether an account exists for the address (see requestPasswordReset).
export function ForgotPassword({ onBack }: { onBack: () => void }): JSX.Element {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setBusy(true);
    await requestPasswordReset(email.trim());
    setSent(true);
  };

  const backButton = (
    <button
      type="button"
      onClick={onBack}
      className={cx(MUTED, "m-0 cursor-pointer border-0 bg-transparent text-sm underline")}
    >
      Back to sign in
    </button>
  );

  if (sent) {
    return (
      <div className={BACKGROUND}>
        <div className={cx(PANEL, "w-full max-w-[24rem] gap-5")}>
          <div>
            <BrandLockup />
            <h1 className="m-0 mt-3 font-display text-[1.9rem] font-bold tracking-[-0.025em]">Check your email</h1>
            <p className={cx(MUTED, "mt-2")}>
              If an account exists for {email.trim()}, we’ve sent a link to reset its password.
            </p>
          </div>
          {backButton}
        </div>
      </div>
    );
  }

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
          <h1 className="m-0 mt-3 font-display text-[1.9rem] font-bold tracking-[-0.025em]">Reset password</h1>
          <p className={cx(MUTED, "mt-2")}>Enter your email and we’ll send you a link to choose a new password.</p>
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

        <Button type="submit" disabled={busy || email.trim() === ""}>
          {busy ? "Sending…" : "Send reset link"}
        </Button>

        {backButton}
      </form>
    </div>
  );
}
