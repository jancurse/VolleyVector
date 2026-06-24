import { useState } from "react";
import type { JSX } from "react";

import { useAuth } from "../auth/useAuth";
import { AuthTabs } from "../auth/AuthTabs";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { BrandLockup } from "../shell/BrandMark";
import { TermsConsentLabel } from "../legal/TermsConsentLabel";
import { recordTermsAcceptance } from "../legal/acceptTerms";
import { cx, MUTED, OVERLAY_SURFACE } from "../ui/styles";
import type { InvitePreviewState } from "./useInvitePreview";
import { redeemInvite, redeemInviteAsCurrentUser } from "./invites";

const CARD = cx(OVERLAY_SURFACE, "flex w-full max-w-[24rem] flex-col gap-5 px-[1.15rem] pt-[1.1rem] pb-[1.25rem]");

const MIN_LENGTH = 8;

// The invite body of the shared auth surface. It describes every right the link carries (join a team,
// receive invites, set up an account) and adapts to each: a signed-in visitor claims what applies in one
// click; a signed-out visitor sets up an account when the link allows it, or otherwise signs in to claim.
// A link with no team renders team-less copy. The preview is resolved by the surface and passed in, so
// this component owns no fetch. Redeeming runs server-side; on success we reload at the root so the
// workspace loads fresh.
export function InviteAccept({
  token,
  state,
  initialMode = "create",
  onDecline,
}: {
  token: string;
  /** The link's resolved preview, owned by the surface so the fetch happens once. */
  state: InvitePreviewState;
  /** Which side the surface opened on: account setup ("create") or sign-in. */
  initialMode?: "create" | "signin";
  /** Dismiss the surface, used by the signed-in claim overlay's Decline. */
  onDecline?: () => void;
}): JSX.Element {
  const { user, signIn, signOut } = useAuth();

  const [mode, setMode] = useState<"create" | "signin">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const finish = () => window.location.replace(window.location.origin);

  const claim = async () => {
    setError(null);
    setBusy(true);

    const { error: failure } = await redeemInviteAsCurrentUser(token);

    if (failure) {
      setError(failure);
      setBusy(false);

      return;
    }

    finish();
  };

  const signUp = async () => {
    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);

      return;
    }

    if (password !== confirm) {
      setError("The passwords do not match.");

      return;
    }

    setError(null);
    setBusy(true);

    const { error: failure } = await redeemInvite(token, email.trim(), password);

    if (failure) {
      setError(failure);
      setBusy(false);

      return;
    }

    // The account now exists with everything claimed; sign in so the reload lands in the app, not the gate.
    const { error: signInError } = await signIn(email.trim(), password);

    if (signInError) {
      setError(signInError);
      setBusy(false);

      return;
    }

    await recordTermsAcceptance();
    finish();
  };

  // Signing in is enough here: the auth listener flips this surface to the signed-in branch, whose
  // one-click claim confirms which account is claiming before anything is redeemed.
  const signInExisting = async () => {
    setError(null);
    setBusy(true);

    const { error: failure } = await signIn(email.trim(), password);

    if (failure) setError(failure);
    setBusy(false);
  };

  // Escape hatch for a shared or borrowed device (and for testing): sign out so the link can onboard a
  // brand-new account, or be claimed by a different existing one, instead of the auto-claimed session. The
  // auth listener flips back to the signed-out branch; the dev auto-login runs only once, so it stays out.
  const switchAccount = async () => {
    setError(null);
    setBusy(true);
    await signOut();
    setMode("create");
    setBusy(false);
  };

  const preview = state.status === "ready" ? state.preview : null;
  const team = preview?.teamName ?? null;
  const roleLabel = preview?.role === "coach" ? "a coach" : "a player";
  const quota = preview?.grantQuota ?? 0;
  const allowsNewAccount = preview?.allowsNewAccount ?? false;

  // What this link adds for an existing account: a team membership and/or a quota grant (never an account).
  const claims = [
    team && `join ${team} as ${roleLabel}`,
    quota > 0 && `get ${quota} ${quota === 1 ? "invite" : "invites"}`,
  ]
    .filter(Boolean)
    .join(" and ");

  const title = team ? `Join ${team}` : quota > 0 ? "Claim your invites" : "Join VolleyVector";

  const quotaNote =
    quota > 0 ? ` You’ll also get ${quota} ${quota === 1 ? "invite" : "invites"} to bring others on.` : "";
  const creating = allowsNewAccount && mode === "create";

  return (
    <div className={CARD}>
      <div>
        <BrandLockup />
        <h1 className="m-0 mt-3 font-display text-[1.9rem] font-bold tracking-[-0.025em]">
          {state.status === "ready" ? title : "Invite"}
        </h1>
      </div>

      {(state.status === "loading" || state.status === "none") && <p className={MUTED}>Loading…</p>}

      {state.status === "invalid" && (
        <p className={MUTED}>This invite link is no longer valid. It may have been used already or expired.</p>
      )}

      {state.status === "ready" && user && (
        <>
          <p className={MUTED}>
            {claims
              ? `You’re signed in as ${user.email}. This link will ${claims}.`
              : `You’re signed in as ${user.email}. This link has nothing to add to your account.`}
          </p>
          {error && <p className="m-0 text-sm text-danger">{error}</p>}
          {claims ? (
            <Button onClick={() => void claim()} disabled={busy}>
              {busy ? "Working…" : team ? `Join ${team}` : "Claim invites"}
            </Button>
          ) : (
            <Button onClick={finish}>Continue</Button>
          )}
          {onDecline && (
            <Button variant="ghost" paired disabled={busy} onClick={onDecline}>
              Decline
            </Button>
          )}
          <Button variant="text" size="sm" disabled={busy} onClick={() => void switchAccount()}>
            Not you? Sign out
          </Button>
        </>
      )}

      {state.status === "ready" && !user && (
        <>
          {allowsNewAccount && (
            <AuthTabs
              value={creating ? "signup" : "signin"}
              onValueChange={(side) => {
                setMode(side === "signup" ? "create" : "signin");
                setError(null);
              }}
            />
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void (creating ? signUp() : signInExisting());
            }}
            className="flex flex-col gap-5"
          >
            <p className={MUTED}>
              {creating
                ? `Set up your account${team ? ` to join ${team} as ${roleLabel}` : ""}.${quotaNote}`
                : `${team ? `Sign in to join ${team} as ${roleLabel}.` : "Sign in to claim this invite."}${quotaNote}`}
            </p>
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                autoFocus
                required
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={creating ? "new-password" : "current-password"}
                required
              />
            </Field>
            {creating && (
              <Field label="Confirm password">
                <Input
                  type="password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  autoComplete="new-password"
                  required
                />
              </Field>
            )}
            {creating && (
              <Checkbox checked={accepted} onCheckedChange={setAccepted} ariaLabel="I agree to the Terms & Privacy">
                <TermsConsentLabel />
              </Checkbox>
            )}
            {error && <p className="m-0 text-sm text-danger">{error}</p>}
            <Button
              type="submit"
              disabled={busy || email.trim() === "" || password === "" || (creating && (confirm === "" || !accepted))}
            >
              {creating
                ? busy
                  ? "Working…"
                  : team
                    ? `Join ${team}`
                    : "Create account"
                : busy
                  ? "Signing in…"
                  : "Sign in"}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
