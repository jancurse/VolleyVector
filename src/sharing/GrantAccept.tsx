import { useEffect, useState } from "react";
import type { JSX } from "react";

import { buildPath } from "../routing/route";
import { Button } from "../ui/Button";
import { cx, EYEBROW, MUTED, PANEL } from "../ui/styles";
import { accessLinkPreview, fetchNoteSlug, redeemAccessLink } from "./grants";
import type { GrantLinkPreview } from "./grants";

const BACKGROUND =
  "flex min-h-[100dvh] flex-col items-center justify-center px-6 [background:radial-gradient(135%_90%_at_50%_-10%,var(--bg-glow),transparent_55%),var(--bg)]";

type Loaded =
  | { status: "loading"; preview: null }
  | { status: "invalid"; preview: null }
  | { status: "ready"; preview: GrantLinkPreview };

const CAPABILITY_LABEL: Record<GrantLinkPreview["capability"], string> = {
  viewer: "view",
  editor: "edit",
  owner: "own",
};

// The redeem screen for a grant link, reached at `#/grant/<token>` once the visitor is signed in (the
// grant binds to their account, so unlike a share link this sits behind the login gate). It previews the
// content the link opens, then claims the single-use grant on Accept and lands on the granted content in
// the visitor's personal space (where the grant places it), reloading so the workspace loads fresh.
export function GrantAccept({ token }: { token: string }): JSX.Element {
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading", preview: null });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    void accessLinkPreview(token).then(({ preview }) => {
      if (active) setLoaded(preview ? { status: "ready", preview } : { status: "invalid", preview: null });
    });

    return () => {
      active = false;
    };
  }, [token]);

  const finish = () => window.location.replace(window.location.origin);

  // Where to land after redeeming: the granted board or note in the personal space (the grant places it
  // there), falling back to the personal library when a note's slug cannot be resolved.
  const landingPath = async (boardId: string | null, topicId: string | null): Promise<string> => {
    const space = { kind: "personal" } as const;

    if (boardId) return buildPath({ kind: "board", space, boardId, edit: false });
    if (topicId) {
      const slug = await fetchNoteSlug(topicId);

      if (slug) return buildPath({ kind: "note", space, noteSlug: slug });
    }

    return buildPath({ kind: "library", space });
  };

  const accept = async () => {
    setError(null);
    setBusy(true);

    const { boardId, topicId, error: failure } = await redeemAccessLink(token);

    if (failure) {
      setError(failure);
      setBusy(false);

      return;
    }

    window.location.replace(window.location.origin + (await landingPath(boardId, topicId)));
  };

  const preview = loaded.status === "ready" ? loaded.preview : null;
  const noun = preview?.kind === "note" ? "note" : "board";

  return (
    <div className={BACKGROUND}>
      <div className={cx(PANEL, "w-full max-w-[24rem] gap-5")}>
        <div>
          <p className={EYEBROW}>VolleyVector</p>
          <h1 className="m-0 font-display text-[1.9rem] font-bold tracking-[-0.025em]">Shared with you</h1>
        </div>

        {loaded.status === "loading" && <p className={MUTED}>Loading…</p>}

        {loaded.status === "invalid" && (
          <p className={MUTED}>This link is no longer valid. It may have been used already or expired.</p>
        )}

        {preview && (
          <>
            <p className={MUTED}>
              You’ve been invited to {CAPABILITY_LABEL[preview.capability]} the {noun} “{preview.title}”.
            </p>
            {error && <p className="m-0 text-sm text-danger">{error}</p>}
            <Button onClick={() => void accept()} disabled={busy}>
              {busy ? "Accepting…" : "Accept"}
            </Button>
          </>
        )}

        <Button variant="text" size="sm" onClick={finish}>
          Go to VolleyVector
        </Button>
      </div>
    </div>
  );
}
