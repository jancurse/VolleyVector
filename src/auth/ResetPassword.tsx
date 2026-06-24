import type { JSX } from "react";

import { NewPasswordForm } from "./NewPasswordForm";

// The recovery landing. A reset link establishes a real session for the account, then fires a
// PASSWORD_RECOVERY event the auth gate turns into this screen. It collects a new password, sets it, and
// `onDone` clears the recovery flag so the user drops into the app, now signed in with the new password.
export function ResetPassword({ email, onDone }: { email: string; onDone: () => void }): JSX.Element {
  return (
    <NewPasswordForm
      title="Choose a new password"
      description={`Choose a new password for ${email}.`}
      email={email}
      onDone={onDone}
    />
  );
}
