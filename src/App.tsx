import { useMemo, useState } from "react";
import type { JSX } from "react";

import { createBoard } from "./boards/operations";
import type { Board } from "./boards/types";
import { useBoards } from "./boards/useBoards";
import { BoardEditor } from "./editor/BoardEditor";
import { BoardView } from "./editor/BoardView";
import { Browse } from "./library/Browse";
import { allTags } from "./library/items";
import type { Selection } from "./library/selection";
import { subtreeIds } from "./topics/operations";
import { useTopics } from "./topics/useTopics";
import { useTheme } from "./theme/useTheme";
import { DebugMenu } from "./ui/DebugMenu";
import { ThemeToggle } from "./ui/ThemeToggle";
import { TooltipProvider } from "./ui/Tooltip";
import { useConfirm } from "./ui/useConfirm";
import { useAuth } from "./auth/useAuth";
import { Login } from "./auth/Login";
import { Button } from "./ui/Button";
import { cx, MUTED } from "./ui/styles";
import { Select } from "./ui/Select";
import { TeamManager } from "./team/TeamManager";
import { useWorkspace } from "./workspace/useWorkspace";
import { useShareRoute } from "./sharing/useShareRoute";
import { ShareView } from "./sharing/ShareView";
import { ShareDialog } from "./sharing/ShareDialog";
import { CopyToPersonalButton } from "./sharing/CopyToPersonalButton";
import { copyBoardToPersonal, copyBoardToTeam } from "./sharing/share";

// The page shell: a radial-glow background over the theme's base colour, with the workspace surfaces
// stacked under the header.
const STAGE =
  "flex min-h-0 flex-1 flex-col items-center px-[clamp(1.1rem,4vw,2.75rem)] pt-[clamp(0.25rem,1.5vh,1rem)] pb-[clamp(1.5rem,4vh,2.5rem)]";

// The page background: a radial glow over the theme base, shared by the loading gate and the shell.
const BG =
  "flex min-h-[100dvh] flex-col [background:radial-gradient(135%_90%_at_50%_-10%,var(--bg-glow),transparent_55%),var(--bg)] transition-[background-color] duration-[400ms]";

// The app moves between three surfaces: the browse surface (the topic sidebar beside the board grid),
// a read-only view of one board, and the editor for a working draft. A draft takes precedence over
// everything; otherwise an open board shows its view; otherwise the browse surface. The sidebar
// belongs to the browse surface only — the board view and editor stay full-width.

export function App(): JSX.Element {
  const [theme, toggleTheme] = useTheme();
  const { user, loading, signOut } = useAuth();
  const workspace = useWorkspace();
  const shareToken = useShareRoute();

  // Hold content loads until the workspace has resolved the landing space, so the app does not fetch the
  // personal space and then immediately re-fetch the defaulted team.
  const space = workspace.loading ? null : workspace.activeSpace;

  const {
    boards,
    loading: boardsLoading,
    error: boardsError,
    addBoard,
    deleteBoard,
    updateBoard,
    unfileBoards,
    setBoardLock,
    shareBoard,
    unshareBoard,
    moveBoardToTeam,
  } = useBoards(space);
  const topics = useTopics(space);
  const { confirm, dialog } = useConfirm();

  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Board | null>(null);
  const [selection, setSelection] = useState<Selection>({ kind: "all" });
  const [managing, setManaging] = useState(false);
  const [sharing, setSharing] = useState(false);

  const openBoard = openId !== null ? (boards.find((b) => b.id === openId) ?? null) : null;

  const commit = (updated: Board) => {
    if (boards.some((b) => b.id === updated.id)) updateBoard(updated.id, () => updated);
    else addBoard(updated);

    setDraft(null);
    setOpenId(updated.id);
  };

  const remove = async (id: string) => {
    const ok = await confirm({
      title: "Delete this board?",
      description: "This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });

    if (!ok) return;

    deleteBoard(id);
    setDraft(null);
    setOpenId(null);
  };

  const createTopic = (parentId: string | null) => setSelection({ kind: "topic", id: topics.addTopic(parentId) });

  const removeTopic = async (id: string) => {
    const ok = await confirm({
      title: "Delete this topic and its subtopics?",
      description: "Its boards return to Unfiled.",
      confirmLabel: "Delete",
      danger: true,
    });

    if (!ok) return;

    const removed = subtreeIds(topics.topics, id);

    unfileBoards(boards.filter((b) => b.topicId !== null && removed.includes(b.topicId)).map((b) => b.id));
    topics.removeTopic(id);
    if (selection.kind === "topic" && removed.includes(selection.id)) setSelection({ kind: "all" });
  };

  const draftExisting = draft !== null && boards.some((b) => b.id === draft.id);
  const tagSuggestions = useMemo(() => allTags(boards), [boards]);

  const loader = (
    <div className={cx(BG, "items-center justify-center")}>
      <p className={MUTED}>Loading…</p>
    </div>
  );

  // A share link is the one URL-addressable surface, openable with or without an account, so it wins
  // over the loading gate and the login screen.
  if (shareToken) return <ShareView key={shareToken} token={shareToken} />;

  if (loading) return loader;
  if (!user) return <Login />;

  if (workspace.error) {
    return (
      <div className={cx(BG, "items-center justify-center px-6 text-center")}>
        <p className={MUTED}>Couldn’t load your workspace: {workspace.error}</p>
      </div>
    );
  }

  // Block on the first load only. A later team switch keeps the prior content on screen until the new
  // data arrives, so switching teams (or working in a dialog mid-load) never blanks the whole app.
  if (workspace.loading || (boardsLoading && boards.length === 0) || (topics.loading && topics.topics.length === 0))
    return loader;

  const personal = workspace.activeSpace.kind === "personal";
  const teamName = workspace.teams.find((t) => t.teamId === workspace.activeTeamId)?.teamName;

  // Who may curate the active space: in the personal space, its owner (always); in a team space, an
  // admin or a coach of that team. A team board may also be author-locked, so editing it needs its
  // author or an admin. RLS enforces all of this server-side; these flags only keep the UI honest by
  // hiding affordances a write would be refused.
  const canEdit = personal || workspace.isAdmin || workspace.activeRole === "coach";
  const canEditBoard = (b: Board): boolean =>
    personal || workspace.isAdmin || (workspace.activeRole === "coach" && (!b.authorLocked || b.owner === user.id));

  let main: JSX.Element;

  if (draft) {
    main = (
      <main className={STAGE}>
        <BoardEditor
          key={draft.id}
          board={draft}
          onDone={commit}
          onCancel={() => setDraft(null)}
          onDelete={draftExisting ? () => remove(draft.id) : undefined}
          tagSuggestions={tagSuggestions}
          topics={topics.topics}
        />
      </main>
    );
  } else if (openBoard) {
    // A team board offers a personal copy to any viewer; the owner of a personal board gets the share
    // controls. Both write through RLS, which has the final say.
    const viewActions =
      personal && openBoard.owner === user.id ? (
        <Button variant="ghost" onClick={() => setSharing(true)}>
          {openBoard.shared ? "Shared" : "Share"}
        </Button>
      ) : !personal ? (
        <CopyToPersonalButton onCopy={() => copyBoardToPersonal(openBoard, user.id)} />
      ) : undefined;

    main = (
      <main className={STAGE}>
        <BoardView
          board={openBoard}
          canEdit={canEditBoard(openBoard)}
          canSetLock={!personal && (workspace.isAdmin || openBoard.owner === user.id)}
          onToggleLock={() => setBoardLock(openBoard.id, !openBoard.authorLocked)}
          onEdit={() => setDraft(openBoard)}
          onBack={() => setOpenId(null)}
          actions={viewActions}
        />
      </main>
    );
  } else {
    main = (
      <main className={STAGE}>
        <Browse
          boards={boards}
          topics={topics}
          selection={selection}
          onSelect={setSelection}
          onOpenBoard={setOpenId}
          onNewBoard={() => setDraft({ ...createBoard(Date.now()), owner: user.id })}
          onCreateTopic={createTopic}
          onDeleteTopic={removeTopic}
          onUnfileBoard={(boardId) => unfileBoards([boardId])}
          canEdit={canEdit}
        />
      </main>
    );
  }

  return (
    <TooltipProvider>
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
          <div className="flex items-center gap-2">
            {import.meta.env.DEV && <DebugMenu />}
            <div className="w-44 max-[760px]:hidden">
              <Select
                ariaLabel="Active space"
                value={personal ? "personal" : `team:${workspace.activeTeamId}`}
                options={[
                  { value: "personal", label: "Personal" },
                  ...workspace.teams.map((t) => ({ value: `team:${t.teamId}`, label: t.teamName })),
                ]}
                onValueChange={(next) =>
                  workspace.setActiveSpace(
                    next === "personal" ? { kind: "personal" } : { kind: "team", teamId: next.slice(5) }
                  )
                }
              />
            </div>
            {!personal && canEdit && (
              <Button variant="ghost" size="sm" onClick={() => setManaging(true)}>
                Manage
              </Button>
            )}
            <span className="font-mono text-2xs text-text-dim max-[640px]:hidden">{user.email}</span>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <Button variant="ghost" size="sm" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </header>

        {(boardsError || topics.error) && (
          <p className="mx-auto mb-2 max-w-[1320px] px-[clamp(1.1rem,4vw,2.75rem)] text-sm text-danger">
            {boardsError ?? topics.error}
          </p>
        )}

        {main}
        {dialog}
        <TeamManager
          open={managing}
          onOpenChange={setManaging}
          teamId={workspace.activeTeamId}
          teamName={teamName ?? ""}
          isAdmin={workspace.isAdmin}
          onCreateTeam={workspace.createTeam}
        />
        {openBoard && (
          <ShareDialog
            open={sharing}
            onOpenChange={setSharing}
            board={openBoard}
            teams={workspace.teams}
            onShare={(teamId) => shareBoard(openBoard.id, teamId)}
            onUnshare={() => unshareBoard(openBoard.id)}
            onMoveToTeam={(teamId) => {
              moveBoardToTeam(openBoard.id, teamId);
              setSharing(false);
              setOpenId(null);
            }}
            onCopyToTeam={(teamId) => copyBoardToTeam(openBoard, user.id, teamId)}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
