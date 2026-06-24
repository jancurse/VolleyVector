import { useState } from "react";
import type { JSX } from "react";

import { NewPasswordForm } from "./NewPasswordForm";
import { Checkbox } from "../ui/Checkbox";
import { TermsConsentLabel } from "../legal/TermsConsentLabel";
import { recordTermsAcceptance } from "../legal/acceptTerms";

// Finishes an email invite. The invite link signs the recipient in as a freshly created account that has no
// password yet, so this collects one through the shared NewPasswordForm and sets it. Being a first-time
// signup it also takes Terms & Privacy consent: the checkbox gates the submit, and acceptance is recorded
// once the password is saved. The recovery screen (ResetPassword) reuses the same form without this step.
export function SetPassword({ email, onDone }: { email: string; onDone: () => void }): JSX.Element {
  const [accepted, setAccepted] = useState(false);

  return (
    <NewPasswordForm
      title="Set a password"
      description={`Choose a password for ${email} to finish setting up your account.`}
      email={email}
      submitDisabled={!accepted}
      onDone={async () => {
        await recordTermsAcceptance();
        onDone();
      }}
    >
      <Checkbox checked={accepted} onCheckedChange={setAccepted} ariaLabel="I agree to the Terms & Privacy">
        <TermsConsentLabel />
      </Checkbox>
    </NewPasswordForm>
  );
}
