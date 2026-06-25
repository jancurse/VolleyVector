import { useState } from "react";
import type { JSX } from "react";

import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Field } from "../ui/Field";
import { Textarea } from "../ui/Textarea";
import { ToggleGroup } from "../ui/ToggleGroup";
import { FIELD_LABEL } from "../ui/styles";
import type { FeedbackType } from "./feedback";
import { sendFeedback } from "./feedback";

// The in-app feedback form, opened from the account menu. A signed-in user reports a bug or requests a
// feature: a type toggle and a message, submitted through the submit-feedback function, which attaches
// their identity server-side. No email field, since the reporter is signed in. Mirrors RequestAccessForm
// in a modal.

const TYPE_OPTIONS = [
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature request" },
];

export function FeedbackDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): JSX.Element {
  const [type, setType] = useState<FeedbackType>("bug");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Closing clears the transient state, so the next report opens on a clean slate.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setType("bug");
      setMessage("");
      setBusy(false);
      setError(null);
      setDone(false);
    }

    onOpenChange(next);
  };

  const submit = async () => {
    setError(null);
    setBusy(true);

    const { error: failure } = await sendFeedback(type, message);

    setBusy(false);

    if (failure) {
      setError(failure);

      return;
    }

    setDone(true);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} title="Report a problem">
      {done ? (
        <>
          <p className="m-0 text-sm leading-relaxed text-text-dim">Thanks. Your report is in.</p>
          <Button className="self-start" variant="ghost" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
        </>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="flex flex-col gap-4"
        >
          <Field label="Type">
            <div>
              <ToggleGroup
                ariaLabel="Report type"
                value={type}
                onValueChange={(next) => setType(next === "feature" ? "feature" : "bug")}
                items={TYPE_OPTIONS}
              />
            </div>
          </Field>
          <div className="flex flex-col gap-2">
            <span className={FIELD_LABEL}>Message</span>
            <Textarea
              compact
              aria-label="Message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="What happened, or what would you like to see?"
            />
          </div>
          {error && <p className="m-0 text-sm text-danger">{error}</p>}
          <Button className="self-start" type="submit" disabled={busy || message.trim() === ""}>
            {busy ? "Sending…" : "Send report"}
          </Button>
        </form>
      )}
    </Dialog>
  );
}
