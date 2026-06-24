import { useState } from "react";
import type { JSX } from "react";

import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { FIELD_LABEL } from "../ui/styles";
import { requestAccess } from "./requestAccess";

// The sign-up body of the shared auth surface when no valid invite is present. VolleyVector is
// invite-only, so this leads with the one thing a visitor can do without an account: build a board. The
// board builder is the primary action. Below a divider, the invite path explains how to get real access
// and collects an email (required) and an optional message, submitting interest through the
// request-access function and confirming on success without promising contact that may never come.

export function RequestAccessForm({ onTry }: { onTry: () => void }): JSX.Element {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);

    const { error: failure } = await requestAccess(email, message);

    setBusy(false);

    if (failure) {
      setError(failure);

      return;
    }

    setDone(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Button onClick={onTry}>Try it</Button>
        <p className="m-0 text-sm text-text-dim">No account, nothing saved.</p>
      </div>

      <div className="flex flex-col gap-4 border-t border-border pt-4">
        <p className={FIELD_LABEL}>Want an account?</p>
        {done ? (
          <p className="m-0 text-sm leading-relaxed text-text-dim">
            Thanks. Your request is in. If it’s a fit, we’ll send you an invite by email.
          </p>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
            className="flex flex-col gap-4"
          >
            <p className="m-0 text-sm leading-relaxed text-text-dim">
              Ask a coach or admin for an invite link, or leave your email and we’ll send an invite if a spot opens up.
            </p>
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </Field>
            <div className="flex flex-col gap-2">
              <span className={FIELD_LABEL}>Message (optional)</span>
              <Textarea
                compact
                aria-label="Message (optional)"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Anything we should know?"
              />
            </div>
            {error && <p className="m-0 text-sm text-danger">{error}</p>}
            <Button type="submit" variant="ghost" disabled={busy || email.trim() === ""}>
              {busy ? "Sending…" : "Request access"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
