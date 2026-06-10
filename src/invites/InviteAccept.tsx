import { useEffect, useState } from "react";
import type { JSX } from "react";

import { useAuth } from "../auth/useAuth";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { cx, EYEBROW, MUTED, PANEL } from "../ui/styles";
import type { InvitePreview } from "./invites";
import { invitePreview, redeemInvite, redeemInviteAsCurrentUser } from "./invites";

const BACKGROUND =
  "flex min-h-[100dvh] flex-col items-center justify-center px-6 [background:radial-gradient(135%_90%_at_50%_-10%,var(--bg-glow),transparent_55%),var(--bg)]";

type Loaded =
  | { status: "loading"; preview: null }
  | { status: "invalid"; preview: null }
  | { status: "ready"; preview: InvitePreview };

// The one no-account entry point besides a share link: an invite link. It opens its team, then either
// offers an already signed-in visitor a one-click join or lets a newcomer set up an account with their
// own email and password. Redeeming runs server-side; on success we reload at the root so the workspace
// loads fresh and lands the new member in the team.
export function InviteAccept({ token }: { token: string }): JSX.Element {
  const { user, signIn } = useAuth();

  const [loaded, setLoaded] = useState<Loaded>({ status: "loading", preview: null });
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

  const join = async () => {
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

    // The account now exists and is on the team; sign in so the reload lands in the app, not the gate.
    const { error: signInError } = await signIn(email.trim(), password);

    if (signInError) {
      setError(signInError);
      setBusy(false);

      return;
    }

    finish();
  };

  const team = loaded.status === "ready" ? loaded.preview.teamName : "";
  const roleLabel = loaded.status === "ready" && loaded.preview.role === "coach" ? "a coach" : "a player";

  return (
    <div className={BACKGROUND}>
      <div className={cx(PANEL, "w-full max-w-[24rem] gap-5")}>
        <div>
          <p className={EYEBROW}>VolleyCoach</p>
          {loaded.status === "ready" ? (
            <h1 className="m-0 font-display text-[1.9rem] font-bold tracking-[-0.025em]">Join {team}</h1>
          ) : (
            <h1 className="m-0 font-display text-[1.9rem] font-bold tracking-[-0.025em]">Invite</h1>
          )}
        </div>

        {loaded.status === "loading" && <p className={MUTED}>Loading…</p>}

        {loaded.status === "invalid" && (
          <p className={MUTED}>This invite link is no longer valid. It may have been used already or expired.</p>
        )}

        {loaded.status === "ready" && user && (
          <>
            <p className={MUTED}>
              You’re signed in as {user.email}. Join {team} as {roleLabel}.
            </p>
            {error && <p className="m-0 text-sm text-danger">{error}</p>}
            <Button onClick={() => void join()} disabled={busy}>
              {busy ? "Joining…" : `Join ${team}`}
            </Button>
          </>
        )}

        {loaded.status === "ready" && !user && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void signUp();
            }}
            className="flex flex-col gap-5"
          >
            <p className={MUTED}>
              Set up your account to join {team} as {roleLabel}.
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
                autoComplete="new-password"
                required
              />
            </Field>
            {error && <p className="m-0 text-sm text-danger">{error}</p>}
            <Button type="submit" disabled={busy || email.trim() === "" || password === ""}>
              {busy ? "Joining…" : `Join ${team}`}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
