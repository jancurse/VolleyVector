import { useEffect, useState } from "react";

import { invitePreview } from "./invites";
import type { InvitePreview } from "./invites";

/** The resolution of an invite token: none present, still loading, invalid/spent, or a valid preview. */
export type InvitePreviewState =
  | { status: "none" }
  | { status: "loading" }
  | { status: "invalid" }
  | { status: "ready"; preview: InvitePreview };

function initial(token: string | null): InvitePreviewState {
  return token ? { status: "loading" } : { status: "none" };
}

/** Resolve an invite token (from `useInviteRoute`) to its preview, so a surface can adapt to the invite
 *  state. Null token resolves to `none`; a spent or unknown token to `invalid`. */
export function useInvitePreview(token: string | null): InvitePreviewState {
  const [state, setState] = useState<{ token: string | null; value: InvitePreviewState }>(() => ({
    token,
    value: initial(token),
  }));

  // Reset to the neutral state when the token changes, during render (the adjustment React recommends over
  // an effect); the effect below only sets state asynchronously, once the preview resolves.
  if (state.token !== token) setState({ token, value: initial(token) });

  useEffect(() => {
    if (!token) return;

    let active = true;

    void invitePreview(token).then(({ preview }) => {
      if (active) setState({ token, value: preview ? { status: "ready", preview } : { status: "invalid" } });
    });

    return () => {
      active = false;
    };
  }, [token]);

  return state.value;
}
