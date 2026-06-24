import { useState } from "react";
import type { CSSProperties, JSX } from "react";
import { Moon, Sun } from "lucide-react";

import type { AuthSide } from "../auth/AuthTabs";
import type { Theme, ThemePreference } from "../theme/useTheme";
import { clearInvite } from "../invites/useInviteRoute";
import { useInvitePreview } from "../invites/useInvitePreview";
import { BrandLockup, BrandMark } from "../shell/BrandMark";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { TooltipProvider } from "../ui/Tooltip";
import { cx, EYEBROW } from "../ui/styles";
import { AuthModal } from "./AuthModal";
import { DEFENCE_BOARD, DRILL_BOARD, ROTATION_BOARD, ROTATION_SCRIPT } from "./exampleBoards";
import { RotationShowcase } from "./RotationShowcase";
import { ShowcaseBoard } from "./ShowcaseBoard";
import { openTry } from "./useTryRoute";

// The logged-out landing page: a text hero, then three example boards (a drill, a defence position, and
// a live rotation editor), each drawn through the app's own Court so it can't drift. Try it opens the
// no-account sandbox, and an invite link raises a banner.

const ROOT = "flex min-h-[100dvh] flex-col [background:var(--app-backdrop)]";

const SHELL = "mx-auto w-full max-w-[var(--shell-max)] px-[clamp(1.15rem,4vw,2.75rem)]";

// A staggered entrance so the hero settles in on load; held off under reduced motion.
const RISE = "animate-rise motion-reduce:animate-none";
const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

// The shared frame for the sections below the hero: a top border and a centred, vertically padded column.
const SECTION =
  "flex flex-col items-center gap-[clamp(1.75rem,4.5vh,3.25rem)] border-t border-border py-[clamp(3rem,9vh,6rem)] text-center";
const SECTION_H2 =
  "m-0 font-display text-[clamp(1.6rem,3.6vw,2.4rem)] font-bold leading-[1.1] tracking-[-0.02em] text-text";
const SECTION_BOARD = "w-full max-w-[var(--shell-max)] text-left";

export function LandingPage({
  theme,
  onSetTheme,
  inviteToken = null,
}: {
  theme: Theme;
  onSetTheme: (preference: ThemePreference) => void;
  /** The invite token in the URL, when the visitor arrived through an invite link. */
  inviteToken?: string | null;
}): JSX.Element {
  // The auth surface is opened by every door, on the side the door picks; null is closed.
  const [authSide, setAuthSide] = useState<AuthSide | null>(null);

  // A valid preview raises the invite banner and switches the page into invite mode; anything else (no
  // token, still resolving, or spent/invalid) is the standard landing.
  const inviteState = useInvitePreview(inviteToken);
  const preview = inviteState.status === "ready" ? inviteState.preview : null;
  const inviteLine = preview?.teamName
    ? `You’ve been invited to join ${preview.teamName} as ${preview.role === "coach" ? "a coach" : "a player"}.`
    : "You’ve been invited to VolleyVector.";

  return (
    <TooltipProvider>
      <div className={ROOT}>
        <header className="sticky top-0 z-30 border-b border-transparent bg-[color-mix(in_srgb,var(--bg)_78%,transparent)] backdrop-blur-md">
          <div className={cx(SHELL, "flex items-center justify-between py-3.5")}>
            <BrandLockup size={25} />
            <div className="flex items-center gap-1.5">
              <IconButton
                variant="plain"
                size="sm"
                aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                onClick={() => onSetTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
              </IconButton>
              <Button variant="ghost" onClick={() => setAuthSide("signin")}>
                Sign in
              </Button>
            </div>
          </div>
        </header>

        {inviteState.status === "invalid" && (
          <div className="border-b border-border bg-control">
            <div className={cx(SHELL, "py-2.5")}>
              <p className="m-0 text-sm text-text-dim">
                That invite link is no longer valid. It may have been used already or expired.
              </p>
            </div>
          </div>
        )}

        {preview && (
          <div className="border-b border-border bg-accent-weak">
            <div className={cx(SHELL, "flex flex-wrap items-center justify-between gap-3 py-2.5")}>
              <p className="m-0 text-sm font-medium text-text">{inviteLine}</p>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => setAuthSide("signup")}>
                  Accept invite
                </Button>
                <Button variant="ghost" size="sm" paired onClick={clearInvite}>
                  Decline
                </Button>
              </div>
            </div>
          </div>
        )}

        <main className={cx(SHELL, "flex flex-1 flex-col")}>
          <section className="flex min-h-[55vh] flex-col items-center justify-center gap-[clamp(1.1rem,2.4vh,1.65rem)] py-[clamp(3rem,8vh,5rem)] text-center">
            <p className={cx(EYEBROW, RISE)} style={delay(0)}>
              Volleyball tactics &amp; drills
            </p>
            <h1
              className={cx(
                "m-0 font-display text-[clamp(2.3rem,5.4vw,3.7rem)] font-bold leading-[1.02] tracking-[-0.03em] text-text",
                RISE
              )}
              style={delay(70)}
            >
              Build the play.
              <br />
              Watch it move.
            </h1>
            <div className={cx("flex flex-col items-center gap-2.5", RISE)} style={delay(230)}>
              <Button onClick={openTry} className="px-6 py-2.5 text-base">
                Try it
              </Button>
              <p className="m-0 text-sm text-text-dim">No account needed.</p>
            </div>
          </section>

          <section className={SECTION}>
            <h2 className={SECTION_H2}>Optimise your rotations.</h2>
            <div className={SECTION_BOARD}>
              <RotationShowcase board={ROTATION_BOARD} script={ROTATION_SCRIPT} />
            </div>
          </section>

          <section className={SECTION}>
            <h2 className={SECTION_H2}>Build a drill.</h2>
            <div className={SECTION_BOARD}>
              <ShowcaseBoard board={DRILL_BOARD} />
            </div>
          </section>

          <section className={SECTION}>
            <h2 className={SECTION_H2}>Create a tactic board.</h2>
            <div className={SECTION_BOARD}>
              <ShowcaseBoard board={DEFENCE_BOARD} />
            </div>
          </section>

          <section className={SECTION}>
            <div className="flex flex-col items-center gap-[clamp(1rem,2.4vh,1.5rem)]">
              <h2 className={SECTION_H2}>Build your first board.</h2>
              <Button onClick={openTry} className="px-6 py-2.5 text-base">
                Try it
              </Button>
            </div>
          </section>
        </main>

        <footer className="border-t border-border">
          <div className={cx(SHELL, "flex flex-wrap items-center justify-between gap-3 py-7 text-sm text-text-dim")}>
            <span className="inline-flex items-center gap-2 font-display font-semibold text-text">
              <BrandMark size={18} />
              VolleyVector
            </span>
          </div>
        </footer>

        <AuthModal
          open={authSide !== null}
          onOpenChange={(next) => {
            if (!next) setAuthSide(null);
          }}
          initialSide={authSide ?? "signin"}
          inviteToken={inviteToken}
          state={inviteState}
          onTry={openTry}
        />
      </div>
    </TooltipProvider>
  );
}
