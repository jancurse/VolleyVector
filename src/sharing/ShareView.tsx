import { useEffect, useState } from "react";
import type { JSX } from "react";

import { useAuth } from "../auth/useAuth";
import type { Board } from "../boards/types";
import { BoardView } from "../editor/BoardView";
import { CopyJsonButton } from "../editor/CopyJsonButton";
import { Button } from "../ui/Button";
import { cx, MUTED } from "../ui/styles";
import { useWorkspace } from "../workspace/useWorkspace";
import { boardByToken, copyBoardToSpace } from "./share";
import { CopyToPersonalButton } from "./CopyToPersonalButton";
import { PromoteToTeamMenu } from "./PromoteToTeamMenu";

const BG =
  "flex min-h-[100dvh] flex-col [background:radial-gradient(135%_90%_at_50%_-10%,var(--bg-glow),transparent_55%),var(--bg)]";
const STAGE = "flex min-h-0 flex-1 flex-col items-center px-[clamp(1.1rem,4vw,2.75rem)] pb-[clamp(1.5rem,4vh,2.5rem)]";

type Loaded = { status: "loading" | "missing"; board: null } | { status: "ready"; board: Board };

// The one no-account surface: a share link opens exactly its one board, read-only, with no library or
// browse around it. A signed-in visitor can copy it into their own space, and a coach can add it to a
// team library; everyone else just reads it. The board is fetched through the public token function, so
// only a team board or a shared personal board ever resolves.
export function ShareView({ token }: { token: string }): JSX.Element {
  const { user } = useAuth();
  const workspace = useWorkspace();

  // App remounts this per token (keyed), so the initial loading state is fresh and the effect only runs
  // the async fetch — never a synchronous reset.
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading", board: null });

  useEffect(() => {
    let active = true;

    void boardByToken(token).then(({ board }) => {
      if (active) setLoaded(board ? { status: "ready", board } : { status: "missing", board: null });
    });

    return () => {
      active = false;
    };
  }, [token]);

  const openApp = () => {
    window.location.hash = "";
  };

  const coached = workspace.teams.filter((t) => t.role === "coach");

  let actions: JSX.Element | undefined;

  if (loaded.status === "ready") {
    const board = loaded.board;

    actions = (
      <>
        {user && <CopyToPersonalButton onCopy={() => copyBoardToSpace(board, user.id, { kind: "personal" })} />}
        {user && coached.length > 0 && (
          <PromoteToTeamMenu
            teams={coached}
            onPromote={(teamId) => copyBoardToSpace(board, user.id, { kind: "team", teamId })}
          />
        )}
        <CopyJsonButton board={board} />
      </>
    );
  }

  return (
    <div className={BG}>
      <header className="flex items-center justify-between px-[clamp(1.1rem,4vw,2.75rem)] py-[1.1rem]">
        <div className="flex items-center gap-[0.6rem] font-display text-display-md font-bold tracking-[-0.02em]">
          <svg className="text-text opacity-90" viewBox="0 0 24 24" width={22} height={22} aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="12" cy="15" r="2.1" fill="currentColor" />
          </svg>
          <span>VolleyCoach</span>
        </div>
        {!user && (
          <Button variant="ghost" size="sm" onClick={openApp}>
            Sign in
          </Button>
        )}
      </header>

      <main className={cx(STAGE, "pt-[clamp(0.5rem,2vh,1.5rem)]")}>
        {loaded.status === "loading" && <p className={MUTED}>Loading…</p>}
        {loaded.status === "missing" && (
          <p className={cx(MUTED, "px-6 py-16 text-center")}>
            This link doesn’t open a board. It may have stopped being shared.
          </p>
        )}
        {loaded.status === "ready" && (
          <BoardView
            board={loaded.board}
            onBack={openApp}
            backLabel={user ? "← Open VolleyCoach" : "← Sign in"}
            actions={actions}
          />
        )}
      </main>
    </div>
  );
}
