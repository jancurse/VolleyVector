import { useEffect, useState } from "react";
import type { JSX } from "react";

import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Input } from "../ui/Input";
import { MUTED } from "../ui/styles";
import { useCopyLabel } from "../ui/useCopyLabel";
import { fetchGameShareToken, gameShareUrl, shareGame } from "./share";

type ShareGameDialogProps = { gameId: string; onClose: () => void };

/** A game's share link: a coach turns it on, copies it, and turns it off again, which stops the link working. */
export function ShareGameDialog({ gameId, onClose }: ShareGameDialogProps): JSX.Element {
  const [state, setState] = useState<{ token: string | null; error: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const { copied, copy } = useCopyLabel();

  useEffect(() => {
    let active = true;

    void fetchGameShareToken(gameId).then((result) => active && setState(result));

    return () => {
      active = false;
    };
  }, [gameId]);

  const share = (shared: boolean) => {
    setBusy(true);
    void shareGame(gameId, shared).then(({ token, error }) => {
      setBusy(false);
      setState((prev) => ({ token: error ? (prev?.token ?? null) : token, error }));
    });
  };

  const url = state?.token ? gameShareUrl(state.token) : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title="Share game">
      <p className="m-0 text-text-dim">
        Anyone with the link can view this game without an account: its details, squad, rotations, and saved stats. They
        cannot change anything.
      </p>
      {!state ? (
        <p className={MUTED}>Loading…</p>
      ) : url ? (
        <>
          <Input readOnly aria-label="Share link" value={url} onFocus={(e) => e.target.select()} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" paired disabled={busy} onClick={() => share(false)}>
              Stop sharing
            </Button>
            <Button onClick={() => copy(url)}>{copied ? "Copied" : "Copy link"}</Button>
          </div>
        </>
      ) : (
        <div className="flex justify-end">
          <Button disabled={busy} onClick={() => share(true)}>
            Turn on sharing
          </Button>
        </div>
      )}
      {state?.error && <p className="m-0 text-sm text-danger">{state.error}</p>}
    </Dialog>
  );
}
