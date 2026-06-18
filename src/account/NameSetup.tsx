import { useState } from "react";
import type { JSX } from "react";

import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { BrandLockup } from "../shell/BrandMark";
import { cx, MUTED, PANEL } from "../ui/styles";

const BACKGROUND =
  "flex min-h-[100dvh] flex-col items-center justify-center px-6 [background:radial-gradient(135%_90%_at_50%_-10%,var(--bg-glow),transparent_55%),var(--bg)]";

// The first-login gate: shown after sign-in while a user has no display name, blocking the app until
// they set one. The app swaps this for the shell as soon as the name saves.
export function NameSetup({ onSave }: { onSave: (name: string) => Promise<{ error: string | null }> }): JSX.Element {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (name.trim() === "") return;

    setError(null);
    setBusy(true);

    const { error: failure } = await onSave(name);

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
          <h1 className="m-0 mt-3 font-display text-[1.9rem] font-bold tracking-[-0.025em]">What’s your name?</h1>
        </div>

        <p className={MUTED}>Your teammates will see this on the boards and notes you share.</p>

        <Field label="Name">
          <Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" autoFocus />
        </Field>

        {error && <p className="m-0 text-sm text-danger">{error}</p>}

        <Button type="submit" disabled={busy || name.trim() === ""}>
          {busy ? "Saving…" : "Continue"}
        </Button>
      </form>
    </div>
  );
}
