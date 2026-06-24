import { useState } from "react";
import type { JSX } from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";

import { useAuth } from "../auth/useAuth";
import { AuthTabs } from "../auth/AuthTabs";
import type { AuthSide } from "../auth/AuthTabs";
import { LoginForm } from "../auth/LoginForm";
import { InviteAccept } from "../invites/InviteAccept";
import type { InvitePreviewState } from "../invites/useInvitePreview";
import { BrandLockup } from "../shell/BrandMark";
import { cx, OVERLAY_MOTION, OVERLAY_SURFACE } from "../ui/styles";
import { RequestAccessForm } from "./RequestAccessForm";

// The one auth surface behind every door into VolleyVector: Sign in, Sign up, and Accept invite all open
// it, floated over the hero (logged out) or over the app (a signed-in invite claim). It carries a single
// Sign in / Sign up switch and adapts its body to context: the real login form, the invite-only
// request-access form, or the invite-accept flow when the link is valid. Reusing those bodies keeps one
// definition of each, so there is no parallel auth or invite screen to drift.

const BACKDROP =
  "fixed inset-0 z-40 bg-[color-mix(in_srgb,var(--bg)_72%,transparent)] backdrop-blur-[3px] transition-opacity duration-200 ease-settle data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 motion-reduce:transition-none";

const POPUP = cx(
  "fixed left-1/2 top-1/2 z-40 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[24rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 overflow-y-auto outline-none",
  OVERLAY_MOTION
);

const CARD = cx(OVERLAY_SURFACE, "flex w-full max-w-[24rem] flex-col gap-5 px-[1.15rem] pt-[1.1rem] pb-[1.25rem]");

const TIP: Record<AuthSide, string> = {
  signin: "Welcome back. Sign in to your VolleyVector account.",
  signup: "VolleyVector accounts are invite-only. You can still build a board without one.",
};

export function AuthModal({
  open,
  onOpenChange,
  initialSide,
  inviteToken,
  state,
  onTry,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which side the opening control selects; the in-surface switch can change it afterwards. */
  initialSide: AuthSide;
  /** The invite token in the URL, when the visitor arrived through an invite link. */
  inviteToken: string | null;
  /** The link's resolved preview, owned by the caller so the fetch happens once. */
  state: InvitePreviewState;
  /** Open the no-account sandbox, offered from the request-access body. */
  onTry: () => void;
}): JSX.Element {
  const { user } = useAuth();

  const [side, setSide] = useState(initialSide);
  const [wasOpen, setWasOpen] = useState(open);

  // Each fresh open starts on the side the opening control picked; the switch drives it from there.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSide(initialSide);
  }

  // Show the invite flow once a token resolves to a valid preview, or the visitor is already signed in
  // (the one-click claim, which also handles a now-invalid link). Otherwise the standard sign in/up surface.
  const preview = state.status === "ready" ? state.preview : null;
  const inviteBody = inviteToken !== null && (user !== null || preview !== null);

  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className={BACKDROP} />
        <BaseDialog.Popup className={POPUP}>
          <BaseDialog.Title className="sr-only">{inviteBody ? "Accept invite" : "Sign in or sign up"}</BaseDialog.Title>
          {inviteBody && inviteToken ? (
            <InviteAccept
              token={inviteToken}
              state={state}
              initialMode={initialSide === "signup" ? "create" : "signin"}
              onDecline={() => onOpenChange(false)}
            />
          ) : (
            <div className={CARD}>
              <BrandLockup />
              <div className="flex flex-col gap-3">
                <AuthTabs value={side} onValueChange={setSide} />
                <p className="m-0 text-sm leading-relaxed text-text-dim">{TIP[side]}</p>
              </div>
              {side === "signin" ? <LoginForm /> : <RequestAccessForm onTry={onTry} />}
            </div>
          )}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
