import { useEffect, useState } from "react";
import type { JSX } from "react";

import { buildPath } from "../routing/route";
import { supabase } from "../supabase/client";
import type { Capability } from "../supabase/rows";
import { Button } from "../ui/Button";
import { cx, EYEBROW, MUTED, PANEL } from "../ui/styles";
import { accessLinkPreview, fetchNoteSlug, redeemAccessLink } from "./grants";
import type { GrantLinkPreview } from "./grants";

const BACKGROUND = "flex min-h-[100dvh] flex-col items-center justify-center px-6 [background:var(--app-backdrop)]";

type Loaded =
  | { status: "loading"; preview: null }
  | { status: "invalid"; preview: null }
  | { status: "ready"; preview: GrantLinkPreview };

const CAPABILITY_LABEL: Record<Capability, string> = {
  viewer: "view",
  editor: "edit",
  owner: "own",
};

const CAPABILITY_RANK: Record<Capability, number> = { viewer: 1, editor: 2, owner: 3 };

// The capability the caller effectively holds after redeeming, read from the same security-definer helper the
// policies use. The redeemer reads their own access, so this is no account-existence oracle; null when the
// content cannot be resolved.
async function effectiveCapability(boardId: string | null, topicId: string | null): Promise<Capability | null> {
  const { data } = boardId
    ? await supabase.rpc("board_capability", { board: boardId })
    : await supabase.rpc("topic_capability", { topic: topicId });

  return (data as Capability | null) ?? null;
}

// The redeem outcome the caller sees, plus where to land on the content. The message reflects the resulting
// access: the link granted/upgraded to the capability the caller now holds, or they already held a higher one.
type Outcome = { message: string; path: string };

// The redeem screen for a grant link, reached at `#/grant/<token>` once the visitor is signed in (the
// grant binds to their account, so unlike a share link this sits behind the login gate). It previews the
// content the link opens, then claims the single-use grant on Accept and reports the resulting capability —
// granted/upgraded, or already held — before opening the content in the visitor's personal space.
export function GrantAccept({ token }: { token: string }): JSX.Element {
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading", preview: null });
  const [outcome, setOutcome] = useState<Outcome | null>(null);
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

    // Read the resulting access rather than assume the link's offer applied: an upgrade-or-grant leaves a
    // higher existing grant untouched, so the caller may already hold more than the link carried. When the
    // read is unavailable, fall back to the offered capability, which the link grants at least.
    const offered = loaded.preview?.capability ?? null;
    const effective = await effectiveCapability(boardId, topicId);
    const noun = loaded.preview?.kind === "note" ? "note" : "board";
    // The capability the caller now holds, falling back to the link's offer when the read is unavailable.
    const capability = effective ?? offered;
    const message =
      effective && offered && CAPABILITY_RANK[effective] > CAPABILITY_RANK[offered]
        ? `You already had ${CAPABILITY_LABEL[effective]} access to this ${noun}.`
        : `You now have ${capability ? `${CAPABILITY_LABEL[capability]} ` : ""}access to this ${noun}.`;

    setOutcome({ message, path: window.location.origin + (await landingPath(boardId, topicId)) });
    setBusy(false);
  };

  const open = () => outcome && window.location.replace(outcome.path);

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

        {preview && !outcome && (
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

        {outcome && (
          <>
            <p className={MUTED}>{outcome.message}</p>
            <Button onClick={open}>Open {noun}</Button>
          </>
        )}

        <Button variant="text" size="sm" onClick={finish}>
          Go to VolleyVector
        </Button>
      </div>
    </div>
  );
}
