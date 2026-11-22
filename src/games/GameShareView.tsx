import { useEffect, useState } from "react";
import type { JSX } from "react";

import type { GameTab } from "../routing/route";
import { ShareFrame } from "../sharing/ShareFrame";
import type { StatsTab } from "../stats/StatsPage";
import { cx, MUTED } from "../ui/styles";
import { GamePage } from "./GamePage";
import { gameByToken } from "./share";
import type { SharedGame } from "./share";

const NO_SETS = new Map<string, never>();
const refused = () => Promise.resolve({ error: "This game is read-only." });

// What a game's share link opens, with or without an account: the game page, read-only, with nothing of the app
// around it. Everything on it comes from the one public token function, so it shows the game's squad and its
// sets' saved stats and never asks the server for more.
export function GameShareView({ token }: { token: string }): JSX.Element {
  // App remounts this per token (keyed), so the loading state is fresh.
  const [loaded, setLoaded] = useState<{ shared: SharedGame | null } | null>(null);
  const [tab, setTab] = useState<GameTab | StatsTab>("overview");

  useEffect(() => {
    let active = true;

    void gameByToken(token).then((shared) => active && setLoaded({ shared }));

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <ShareFrame>
      {!loaded ? (
        <p className={MUTED}>Loading…</p>
      ) : !loaded.shared ? (
        <p className={cx(MUTED, "px-6 py-16 text-center")}>
          This link doesn’t open a game. It may have stopped being shared.
        </p>
      ) : (
        <GamePage
          game={loaded.shared.game}
          teamName={loaded.shared.teamName}
          roster={loaded.shared.roster}
          canEdit={false}
          shared={loaded.shared.stats}
          sets={loaded.shared.sets}
          localSets={NO_SETS}
          setsLoading={false}
          setsError={null}
          onReloadSets={() => {}}
          onSave={refused}
          onRenameInSets={() => Promise.resolve(undefined)}
          onAddPlayers={() => Promise.resolve({ error: "This game is read-only.", added: [] })}
          onDelete={() => {}}
          onPrint={() => {}}
          onOpenSet={() => {}}
          onNewSet={() => Promise.resolve()}
          onDeleteSet={() => {}}
          onImportSets={() => {}}
          onScoreSet={() => Promise.resolve("This game is read-only.")}
          tab={tab}
          onTab={setTab}
        />
      )}
    </ShareFrame>
  );
}
