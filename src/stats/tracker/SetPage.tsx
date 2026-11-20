import { useMemo, useState } from "react";
import type { JSX } from "react";
import { AlertTriangle, ArrowLeft, Download } from "lucide-react";

import { LoginForm } from "../../auth/LoginForm";
import type { Game } from "../../games/types";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { IconButton } from "../../ui/IconButton";
import { useConfirm } from "../../ui/useConfirm";
import {
  CALLOUT_WARN,
  STATUS_NOTE,
  STICKY_BANNER,
  TRACKER_STACK,
  TRACKER_TITLE,
  TRACKER_WORKSPACE,
} from "../../ui/styles";
import { versus } from "../../games/format";
import { withGameMeta } from "../gameSets";
import { supabaseSetBackend } from "../sets";
import { writeBackup } from "../sync/setSync";
import type { SetBackend } from "../sync/setSync";
import { downloadSet, useSetSync } from "../sync/useSetSync";
import type { AppData } from "../types";
import { Centered } from "./Centered";
import { ReopenDialog } from "./ReopenDialog";
import { SaveStatus } from "./SaveStatus";
import { Tracker } from "./Tracker";

type SetPageProps = {
  setId: string;
  game: Game;
  teamName: string;
  /** Who is recording; kept with the local copy. */
  userId?: string;
  finished: boolean;
  /** False once the session is gone (signed out elsewhere, or it lapsed): recording carries on locally. */
  signedIn: boolean;
  /** Whether the app's sidebar and top bar are hidden for the tracker, and how to switch that. */
  focus?: boolean;
  onFocus?: (focus: boolean) => void;
  /** Lay the tracker out as panes filling the window (a wide enough screen), not as a stacked page. */
  panes?: boolean;
  onBack: () => void;
  /** Open the next set, started in this browser from `next`. */
  onNextSet: (next: AppData) => void;
  /** Mark the set finished on the server, or take that back. Resolves to whether it worked. */
  onFinish: (finished: boolean) => Promise<boolean>;
  /** The set's stats were saved, so its summary changed. */
  onStatsSaved: () => void;
  backend?: SetBackend;
};

/**
 * One set in the tracker, kept safe as it changes (see setSync.ts). Its changes reach the stats everyone reads
 * only when the coach presses Done. Mount it keyed by the set id.
 */
export function SetPage({
  setId,
  game,
  teamName,
  userId,
  finished,
  signedIn,
  focus,
  onFocus,
  panes = false,
  onBack,
  onNextSet,
  onFinish,
  onStatsSaved,
  backend = supabaseSetBackend,
}: SetPageProps): JSX.Element {
  const sync = useSetSync(setId, { game, teamName, userId }, backend);
  const { opened, snapshot } = sync;
  const { confirm, dialog } = useConfirm();
  const [signingIn, setSigningIn] = useState(false);
  // What this page last set the server's finished mark to, ahead of the game's own list reloading.
  const [marked, setMarked] = useState<boolean | null>(null);
  const ready = opened?.kind === "ready" ? opened.data : null;
  // The game's teams and date win over whatever the set carried.
  const initial = useMemo(() => ready && withGameMeta(ready, game, teamName), [ready, game, teamName]);
  const title = [teamName, versus(game.opponent, game.venue)].filter(Boolean).join(" ") || game.name || "Game";

  const back = async () => {
    if (
      !(await sync.flush()) &&
      !(await confirm({
        title: "Leave with changes not saved yet?",
        description: "They stay in this browser and are saved the next time you open this set here.",
        confirmLabel: "Leave",
      }))
    )
      return;

    if (
      (snapshot.stats === "changed" || snapshot.stats === "saving") &&
      !(await confirm({
        title: "Leave with changes not in the stats?",
        description:
          "Your changes are kept with the set, but the team’s stats show them only once you press Done while editing it. You can do that the next time you open the set.",
        confirmLabel: "Leave",
      }))
    )
      return;

    onBack();
  };

  const saveStats = async (): Promise<boolean> => {
    const error = await sync.publish();

    if (error) await confirm({ title: "Couldn’t save the stats", description: error, confirmLabel: "OK" });
    else onStatsSaved();

    return !error;
  };

  const nextSet = async (next: AppData) => {
    if (!(await sync.flush())) {
      await confirm({
        title: "This set isn’t saved yet",
        description: "So the next set wasn’t started. Check your connection and try again.",
        confirmLabel: "OK",
      });

      return;
    }

    onNextSet(next);
  };

  // Done saves the set's stats and marks the server's copy finished, so everything is saved first. Editing takes
  // a finished set back, once what this browser holds is saved.
  const finish = async (done: boolean): Promise<boolean> => {
    if (done) {
      if (!(await saveStats()) || !(await onFinish(true))) return false;
      setMarked(true);

      return true;
    }
    if (!(marked ?? finished)) return true;
    if (await sync.flush()) {
      if (!(await onFinish(false))) return false;
      setMarked(false);

      return true;
    }

    await confirm({
      title: "This set isn’t saved yet",
      description: "So it wasn’t opened for editing. Check your connection and try again.",
      confirmLabel: "OK",
    });

    return false;
  };

  const discard = async () => {
    const ok = await confirm({
      title: "Discard this browser’s copy?",
      description: "The set is no longer on the server. Download the copy first if you want to keep it.",
      confirmLabel: "Discard",
      danger: true,
    });

    if (!ok) return;

    writeBackup(localStorage, setId, null);
    onBack();
  };

  if (!opened) return <Centered>Loading the set…</Centered>;

  if (opened.kind === "choose")
    return <ReopenDialog choice={opened.choice} onResolve={(keep) => sync.resolveReopen(opened.choice, keep)} />;

  if (opened.kind === "error" || opened.kind === "missing") {
    const backup = opened.kind === "missing" ? opened.backup : null;

    return (
      <Centered>
        <p className={CALLOUT_WARN}>
          {opened.kind === "error"
            ? `Couldn’t open the set: ${opened.message}`
            : backup
              ? "This set was deleted from the game, but this browser still has a copy of it."
              : "This set doesn’t exist, or you can’t see it."}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" paired onClick={onBack}>
            <ArrowLeft size={15} aria-hidden="true" /> Back to the game
          </Button>
          {backup && (
            <Button variant="ghost" paired onClick={() => downloadSet(backup.data, setId, "deleted")}>
              <Download size={15} aria-hidden="true" /> Download this browser’s copy
            </Button>
          )}
          {backup && (
            <Button variant="danger" onClick={() => void discard()}>
              Discard it
            </Button>
          )}
          {opened.kind === "error" && <Button onClick={sync.reload}>Try again</Button>}
        </div>
      </Centered>
    );
  }

  return (
    <div className={panes ? TRACKER_WORKSPACE : TRACKER_STACK}>
      {snapshot.conflict && (
        <div className={STICKY_BANNER}>
          <AlertTriangle size={16} aria-hidden="true" className="text-danger" />
          <span className="flex-1">
            {snapshot.conflict.updatedBy} saved this set
            {snapshot.conflict.updatedAt ? ` at ${new Date(snapshot.conflict.updatedAt).toLocaleTimeString()}` : ""},
            after you opened it. Your latest changes are kept in this browser but not saved.
          </span>
          <Button variant="ghost" paired onClick={sync.discardMine}>
            Keep theirs (reload)
          </Button>
          <Button onClick={sync.overwrite}>Keep mine (overwrite)</Button>
        </div>
      )}
      {(!signedIn || snapshot.saveState === "signedOut") && (
        <div className={STICKY_BANNER}>
          <span className="flex-1">
            You’re signed out. Keep recording: every change is kept in this browser, and saving resumes once you sign in
            again.
          </span>
          <Button onClick={() => setSigningIn(true)}>Sign in</Button>
        </div>
      )}
      {snapshot.saveState === "refused" && (
        <div className={STICKY_BANNER}>
          <span className="flex-1">{snapshot.error}</span>
          {ready && (
            <Button variant="ghost" paired onClick={() => downloadSet(ready, setId, "unsaved")}>
              Download this browser’s copy
            </Button>
          )}
          <Button onClick={sync.retry}>Try again</Button>
        </div>
      )}
      {initial && (
        <Tracker
          initial={initial}
          names={{ us: teamName || "Us", them: game.opponent || "Them" }}
          focus={focus}
          onFocus={onFocus}
          panes={panes}
          statsBehind={snapshot.stats === "changed"}
          onChange={sync.onChange}
          onNextSet={(next) => void nextSet(next)}
          onFinish={finish}
          header={
            <div className="flex min-w-0 items-center gap-2">
              <IconButton variant="plain" size="sm" aria-label="Back to the game" onClick={() => void back()}>
                <ArrowLeft size={16} aria-hidden="true" />
              </IconButton>
              <h1 className={TRACKER_TITLE}>
                Set {initial.meta.setNumber || "?"} · {title}
              </h1>
              <SaveStatus snapshot={snapshot} />
              {snapshot.stats === "changed" && (
                <span
                  className={STATUS_NOTE}
                  title="Press Done, after Edit set if the set is locked, to put your changes in the team’s stats"
                >
                  Not in the stats yet
                </span>
              )}
            </div>
          }
        />
      )}
      <Dialog open={signingIn && !signedIn} onOpenChange={setSigningIn} title="Sign in to resume saving">
        <LoginForm />
      </Dialog>
      {dialog}
    </div>
  );
}
