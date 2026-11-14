import { useMemo, useState } from "react";
import type { JSX } from "react";
import { AlertTriangle, ArrowLeft, Download } from "lucide-react";

import { LoginForm } from "../../auth/LoginForm";
import type { Game } from "../../games/types";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { useConfirm } from "../../ui/useConfirm";
import { CALLOUT_WARN, cx, EYEBROW, PAGE_WIDTH, STICKY_BANNER, TITLE } from "../../ui/styles";
import { formatGameDate, versus } from "../../games/format";
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
  onBack: () => void;
  /** Open the next set, started in this browser from `next`. */
  onNextSet: (next: AppData) => void;
  onFinish: (finished: boolean) => Promise<void>;
  backend?: SetBackend;
};

/** One set in the tracker, kept safe as it changes (see setSync.ts). Mount it keyed by the set id. */
export function SetPage({
  setId,
  game,
  teamName,
  userId,
  finished,
  signedIn,
  onBack,
  onNextSet,
  onFinish,
  backend = supabaseSetBackend,
}: SetPageProps): JSX.Element {
  const sync = useSetSync(setId, { game, teamName, userId }, backend);
  const { opened, snapshot } = sync;
  const { confirm, dialog } = useConfirm();
  const [signingIn, setSigningIn] = useState(false);
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

    onBack();
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

  // Finishing marks the server's copy, so everything is saved first.
  const finish = async (done: boolean) => {
    if (await sync.flush()) return onFinish(done);

    await confirm({
      title: "This set isn’t saved yet",
      description: "So it wasn’t changed. Check your connection and try again.",
      confirmLabel: "OK",
    });
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
    <div className={cx("mx-auto flex flex-col gap-3", PAGE_WIDTH)}>
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
          finished={finished}
          onChange={sync.onChange}
          onNextSet={(next) => void nextSet(next)}
          onFinish={(f) => void finish(f)}
          header={
            <div className="flex min-w-0 flex-col">
              <Button variant="text" className="mb-2 self-start pl-0" onClick={() => void back()}>
                <ArrowLeft size={15} aria-hidden="true" /> Back to the game
              </Button>
              <p className={EYEBROW}>
                {[
                  `Set ${initial.meta.setNumber || "?"}`,
                  game.date && formatGameDate(game.date),
                  finished && "finished",
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              <h1 className={TITLE}>{title}</h1>
              <div className="mt-2">
                <SaveStatus snapshot={snapshot} />
              </div>
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
