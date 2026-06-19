import { useEffect, useState } from "react";
import type { JSX } from "react";

import { useAuth } from "../auth/useAuth";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { BrandLockup } from "../shell/BrandMark";
import { cx, MUTED, PANEL } from "../ui/styles";
import type { InvitePreview } from "./invites";
import { invitePreview, redeemInvite, redeemInviteAsCurrentUser } from "./invites";

const BACKGROUND =
  "flex min-h-[100dvh] flex-col items-center justify-center px-6 [background:radial-gradient(135%_90%_at_50%_-10%,var(--bg-glow),transparent_55%),var(--bg)]";

type Loaded =
  | { status: "loading"; preview: null }
  | { status: "invalid"; preview: null }
  | { status: "ready"; preview: InvitePreview };

// The one no-account entry point besides a share link: an invite link. It describes every right the link
// carries (join a team, receive invites, set up an account) and adapts to each: a signed-in visitor claims
// what applies in one click; a signed-out visitor sets up an account when the link allows it, or otherwise
// signs in to claim. A link with no team renders team-less copy. Redeeming runs server-side; on success we
// reload at the root so the workspace loads fresh.
export function InviteAccept({ token }: { token: string }): JSX.Element {
  const { user, signIn } = useAuth();

  const [loaded, setLoaded] = useState<Loaded>({ status: "loading", preview: null });
  const [mode, setMode] = useState<"create" | "signin">("create");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    void invitePreview(token).then(({ preview }) => {
      if (active) setLoaded(preview ? { status: "ready", preview } : { status: "invalid", preview: null });
    });

    return () => {
      active = false;
    };
  }, [token]);

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

    finish();
  };

  // Signing in is enough here: the auth listener flips this screen to the signed-in branch, whose
  // one-click claim confirms which account is claiming before anything is redeemed.
  const signInExisting = async () => {
    setError(null);
    setBusy(true);

    const { error: failure } = await signIn(email.trim(), password);

    if (failure) setError(failure);
    setBusy(false);
  };

  const preview = loaded.status === "ready" ? loaded.preview : null;
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

  const title = team ? `Join ${team}` : quota > 0 ? "Claim your invites" : "Join VolleyCoach";

  const quotaNote =
    quota > 0 ? ` You’ll also get ${quota} ${quota === 1 ? "invite" : "invites"} to bring others on.` : "";
  const creating = allowsNewAccount && mode === "create";

  return (
    <div className={BACKGROUND}>
      <div className={cx(PANEL, "w-full max-w-[24rem] gap-5")}>
        <div>
          <BrandLockup />
          <h1 className="m-0 mt-3 font-display text-[1.9rem] font-bold tracking-[-0.025em]">
            {loaded.status === "ready" ? title : "Invite"}
          </h1>
        </div>

        {loaded.status === "loading" && <p className={MUTED}>Loading…</p>}

        {loaded.status === "invalid" && (
          <p className={MUTED}>This invite link is no longer valid. It may have been used already or expired.</p>
        )}

        {loaded.status === "ready" && user && (
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
          </>
        )}

        {loaded.status === "ready" && !user && (
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
            {error && <p className="m-0 text-sm text-danger">{error}</p>}
            <Button type="submit" disabled={busy || email.trim() === "" || password === ""}>
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
            {allowsNewAccount && (
              <Button
                variant="text"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setMode(mode === "create" ? "signin" : "create");
                  setError(null);
                }}
              >
                {mode === "create" ? "Already have an account? Sign in" : "New here? Set up an account"}
              </Button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
