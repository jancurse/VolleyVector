import type { JSX } from "react";

import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import type { ReopenChoice } from "../sync/setSync";

/**
 * This browser has changes to the set that never reached the server, but the server copy changed since. The
 * coach picks one; the other is downloaded as a file first. Closing the dialog decides nothing.
 */
export function ReopenDialog({
  choice,
  onResolve,
}: {
  choice: ReopenChoice;
  onResolve: (keepMine: boolean) => void;
}): JSX.Element {
  const mine = choice.mine.events.length;
  const theirs = choice.theirs.data.events.length;

  return (
    <Dialog open onOpenChange={() => undefined} title="This set changed in two places">
      <p className="m-0 text-base text-text-dim">
        This browser has changes to set {choice.mine.meta.setNumber || "?"} that never reached the server ({mine}{" "}
        events), and the saved set has changed since ({theirs} events). Keep one of them. The other is downloaded as a
        file first, so nothing is lost.
      </p>
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="ghost" paired onClick={() => onResolve(false)}>
          Keep the saved one
        </Button>
        <Button onClick={() => onResolve(true)}>Keep this browser’s</Button>
      </div>
    </Dialog>
  );
}
