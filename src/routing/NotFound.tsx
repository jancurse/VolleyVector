import type { JSX } from "react";

import { Button } from "../ui/Button";
import { EYEBROW, MUTED, PAGE, TITLE } from "../ui/styles";

// The in-app not-found surface for an unrecognised path or an unreadable board. RLS hides rows it does
// not return rather than answering 403, so "wrong space" and "no permission" are indistinguishable and
// both land here. It reuses the library/topic page scaffolding so it reads as part of the app, not a
// dead end.
export function NotFound({ onHome }: { onHome: () => void }): JSX.Element {
  return (
    <section className={PAGE}>
      <div>
        <p className={EYEBROW}>Not found</p>
        <h1 className={TITLE}>This page isn’t here</h1>
      </div>
      <p className={MUTED}>The link may be broken, or the board may have moved or stopped being shared.</p>
      <div>
        <Button variant="ghost" onClick={onHome}>
          Go to your library
        </Button>
      </div>
    </section>
  );
}
