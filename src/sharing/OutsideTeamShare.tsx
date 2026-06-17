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
  const [capability, setCapability] = useState<Capability>("viewer");
  const [email, setEmail] = useState("");
  const [linkLabel, setLinkLabel] = useState("Copy share link");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Mint a fresh single-use link and copy it straight to the clipboard, matching the view-only link's
  // one-click copy. The link is still generated on the fly each time; only the way it's handed over is shared.
  const shareLink = async () => {
    setBusy(true);
    setError(null);

    const { url, error: failure } = await onCreateLink(capability);

    setBusy(false);
    if (failure) {
      setError(failure);

      return;
    }
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      setLinkLabel("Copied");
      window.setTimeout(() => setLinkLabel("Copy share link"), 1500);
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
      <span className={PANEL_TITLE}>Share outside your teams</span>

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

      {/* The two methods are indented under a rule that descends from the Access level above, so it reads
          as the one capability both the email grant and the link carry. */}
      <div className="ml-1 flex flex-col gap-4 border-l-2 border-border pl-4">
        <Field label="By email">
          <div className="flex gap-2">
            <Input
              type="email"
              value={email}
              placeholder="name@example.com"
              aria-label="Email to share with"
              onChange={(event) => setEmail(event.target.value)}
            />
            <Button variant="ghost" onClick={() => void grantByEmail()} disabled={busy || email.trim() === ""}>
              Share
            </Button>
          </div>
        </Field>
        {message && <p className={MUTED}>{message}</p>}

        <div className="flex flex-col gap-2">
          <span className={FIELD_LABEL}>By link</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => void shareLink()} disabled={busy}>
              {busy ? "Working…" : linkLabel}
            </Button>
            <span className={MUTED}>Unique single-use link</span>
          </div>
        </div>
      </div>

      {error && <p className="m-0 text-sm text-danger">{error}</p>}
    </section>
  );
}
