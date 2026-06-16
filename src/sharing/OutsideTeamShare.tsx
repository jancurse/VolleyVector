import { useState } from "react";
import type { JSX } from "react";

import type { Capability } from "../supabase/rows";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { FIELD_LABEL, MUTED, PANEL_TITLE } from "../ui/styles";
import { CAPABILITY_OPTIONS } from "./access";

// Granting access to someone outside the sharer's teams, owner-only (the manager is owner-gated). Two
// paths, neither of which enumerates accounts or reveals an email:
//   * a single-use grant link the owner sends through any channel; the first signed-in user to open it
//     claims the grant on their own account;
//   * an exact email address the server grants to the one matching account, if any. The reply is the
//     same whether or not an account matched, so it is never an account-existence oracle.
type OutsideTeamShareProps = {
  entityNoun: "board" | "note";
  onCreateLink: (capability: Capability) => Promise<{ url: string | null; error: string | null }>;
  onGrantByEmail: (email: string, capability: Capability) => Promise<{ error: string | null }>;
};

export function OutsideTeamShare({ entityNoun, onCreateLink, onGrantByEmail }: OutsideTeamShareProps): JSX.Element {
  const [capability, setCapability] = useState<Capability>("editor");
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState("Copy");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const createLink = async () => {
    setBusy(true);
    setError(null);
    setLink(null);
    setCopyLabel("Copy");

    const { url, error: failure } = await onCreateLink(capability);

    setBusy(false);
    if (failure) setError(failure);
    else setLink(url);
  };

  const copyLink = async () => {
    if (!link) return;

    try {
      await navigator.clipboard.writeText(link);
      setCopyLabel("Copied");
      window.setTimeout(() => setCopyLabel("Copy"), 1500);
    } catch {
      // The clipboard call can reject (no permission or an insecure context); leave the label as is.
    }
  };

  const grantByEmail = async () => {
    const address = email.trim();

    if (!address) return;

    setBusy(true);
    setError(null);
    setMessage(null);

    const { error: failure } = await onGrantByEmail(address, capability);

    setBusy(false);
    if (failure) {
      setError(failure);

      return;
    }

    setEmail("");
    // The same reply whether or not an account matched, so the email is not an existence oracle.
    setMessage(`If an account with that email exists, it now has access to this ${entityNoun}.`);
  };

  return (
    <section className="flex flex-col gap-4 border-t border-border pt-4">
      <div className="flex flex-col gap-1">
        <span className={PANEL_TITLE}>Share outside your teams</span>
        <p className="m-0 text-sm text-text-dim">
          For someone who isn’t on your teams. Neither way reveals their email.
        </p>
      </div>

      <div className="w-36">
        <Field label="Access level">
          <Select
            ariaLabel="Capability for outside sharing"
            value={capability}
            options={CAPABILITY_OPTIONS}
            onValueChange={(value) => setCapability(value as Capability)}
          />
        </Field>
      </div>

      <Field label="By email">
        <div className="flex gap-2">
          <Input
            type="email"
            value={email}
            placeholder="name@example.com"
            aria-label="Email to share with"
            onChange={(event) => setEmail(event.target.value)}
          />
          <Button onClick={() => void grantByEmail()} disabled={busy || email.trim() === ""}>
            Share
          </Button>
        </div>
      </Field>
      {message && <p className={MUTED}>{message}</p>}

      <div className="flex flex-col gap-2">
        <span className={FIELD_LABEL}>By link</span>
        {link ? (
          <div className="flex items-center gap-2">
            <Input readOnly value={link} aria-label="Grant link" onFocus={(event) => event.target.select()} />
            <Button variant="ghost" onClick={() => void copyLink()}>
              {copyLabel}
            </Button>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => void createLink()} disabled={busy}>
            {busy ? "Working…" : "Create grant link"}
          </Button>
        )}
        <span className={MUTED}>A single-use link the first signed-in person to open it can claim.</span>
      </div>

      {error && <p className="m-0 text-sm text-danger">{error}</p>}
    </section>
  );
}
