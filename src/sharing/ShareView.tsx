import { useEffect, useState } from "react";
import type { JSX } from "react";

import { useAuth } from "../auth/useAuth";
import type { Board } from "../boards/types";
import { BoardView } from "../editor/BoardView";
import { CopyJsonButton } from "../editor/CopyJsonButton";
import { cx, MUTED } from "../ui/styles";
import { useWorkspace } from "../workspace/useWorkspace";
import { boardByToken, copyBoardToSpace } from "./share";
import { CopyToPersonalButton } from "./CopyToPersonalButton";
import { PromoteToTeamMenu } from "./PromoteToTeamMenu";
import { ShareFrame } from "./ShareFrame";

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
    <ShareFrame>
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
          backLabel={user ? "← Open VolleyVector" : "← Sign in"}
          actions={actions}
        />
      )}
    </ShareFrame>
  );
}
