import { useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";

import { boardsInTopic, createBoard } from "./boards/operations";
import type { Board } from "./boards/types";
import { useBoards } from "./boards/useBoards";
import { ExportMenu } from "./bundle/ExportMenu";
import { ImportDialog } from "./bundle/ImportDialog";
import { bundleFilename, toBundle } from "./bundle/serialize";
import { BoardActionsMenu } from "./editor/BoardActionsMenu";
import { BoardEditor } from "./editor/BoardEditor";
import { clearDraftBackup, loadDraftBackup } from "./editor/draftBackup";
import { BoardView } from "./editor/BoardView";
import { Library } from "./library/Library";
import { allTags } from "./library/items";
import type { Selection } from "./library/selection";
import { subtreeIds } from "./topics/operations";
import { TopicEditor } from "./topics/TopicEditor";
import { TopicView } from "./topics/TopicView";
import { useTopics } from "./topics/useTopics";
import { useTheme } from "./theme/useTheme";
import { MenuItem } from "./ui/Menu";
import { TooltipProvider } from "./ui/Tooltip";
import { useConfirm } from "./ui/useConfirm";
import { useAuth } from "./auth/useAuth";
import { Login } from "./auth/Login";
import { SetPassword } from "./auth/SetPassword";
import { isInviteLanding } from "./auth/inviteLanding";
import { Button } from "./ui/Button";
import { cx, MUTED } from "./ui/styles";
import type { Topic } from "./topics/types";
import { TeamPage } from "./team/TeamPage";
import { AdminPage } from "./admin/AdminPage";
import { SettingsPage } from "./account/SettingsPage";
import { NameSetup } from "./account/NameSetup";
import { deleteAccount } from "./supabase/deleteAccount";
import { useWorkspace } from "./workspace/useWorkspace";
import { sameSpace } from "./workspace/space";
import type { Space } from "./workspace/space";
import { useShareRoute } from "./sharing/useShareRoute";
import { ShareView } from "./sharing/ShareView";
import { useInviteRoute } from "./invites/useInviteRoute";
import { InviteAccept } from "./invites/InviteAccept";
import { ShareDialog } from "./sharing/ShareDialog";
import { CopyToMenu } from "./sharing/CopyToMenu";
import type { CopyTarget } from "./sharing/CopyToMenu";
import { MoveToMenu } from "./sharing/MoveToMenu";
import { copyBoardToSpace, fetchBoardById } from "./sharing/share";
import { useRoute } from "./routing/useRoute";
import { buildPath, routeSpace } from "./routing/route";
import { NotFound } from "./routing/NotFound";
import {
  boardRoute,
  canonicalRoute,
  findTeamId,
  findTopicId,
  libraryRoute,
  routeSpaceForSpace,
  spaceForRouteSpace,
  teamRoute,
  topicRoute,
} from "./routing/links";
import { AppShell } from "./shell/AppShell";
import { Sidebar } from "./shell/Sidebar";
import { SidebarRail } from "./shell/SidebarRail";
import { TopBar } from "./shell/TopBar";
import { AvatarMenu } from "./shell/AvatarMenu";
import { breadcrumbs } from "./shell/breadcrumb";
import { useSidebarMode } from "./shell/useSidebarMode";
import { SidePanel } from "./ui/SidePanel";

// The page background: a radial glow over the theme base, used by the full-screen gates (loading, error).
// The authenticated shell paints its own matching background in AppShell.
const BG =
  "flex min-h-[100dvh] flex-col [background:radial-gradient(135%_90%_at_50%_-10%,var(--bg-glow),transparent_55%),var(--bg)] transition-[background-color] duration-[400ms]";

// The URL is the single source of truth for navigation: the active space, the browse selection, and the
// open board are all derived from the path-based route. A draft (the editor's working copy) and the
// topic-editing toggle are the only navigation state not in the URL. App wires the stores together and
// renders the persistent shell; the share and invite hash links still win over everything.

export function App(): JSX.Element {
  const [, themePreference, setThemePreference] = useTheme();
  const { user, loading, signOut } = useAuth();
  const workspace = useWorkspace();
  const shareToken = useShareRoute();
  const inviteToken = useInviteRoute();
  const { route, navigate } = useRoute();

  // A share or invite link rides the hash and owns the whole screen (it opens with or without an account),
  // so the path router stays dormant while one is active: its effects must not navigate and clear the hash.
  const hashRoute = shareToken !== null || inviteToken !== null;

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

  const [draft, setDraft] = useState<Board | null>(null);
  // Bumped when a backup restore replaces the draft in place, so the keyed editor remounts on it.
  const [draftRevision, setDraftRevision] = useState(0);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [passwordReady, setPasswordReady] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [missingBoardId, setMissingBoardId] = useState<string | null>(null);

  // Below the full-sidebar width the navigation lives in an overlay: expanded from the rail's Topics
  // toggle, or from the drawer toggle in the top bar. Anything picked inside it closes it.
  const sidebarMode = useSidebarMode();
  const [navOpen, setNavOpen] = useState(false);

  if (sidebarMode === "full" && navOpen) setNavOpen(false);

  const activeSpace = workspace.activeSpace;
  const teams = workspace.teams;
  const otherTeams = workspace.otherTeams;
  const showcase = workspace.showcase;
  // Routing resolves team slugs across every reachable team: an admin may be in a non-member team's
  // space, and everyone may be in the showcase space.
  const allTeams = useMemo(
    () => [...teams, ...otherTeams, ...(showcase ? [showcase] : [])],
    [teams, otherTeams, showcase]
  );
  const personal = activeSpace.kind === "personal";
  const setActiveSpace = workspace.setActiveSpace;

  // Selection, open board, and edit mode are all read off the current route.
  const selection: Selection =
    route.kind === "topic" ? { kind: "topic", id: findTopicId(topics.topics, route.topicSlug) ?? "" } : { kind: "all" };
  const openId = route.kind === "board" ? route.boardId : null;
  const openBoard = openId !== null ? (boards.find((b) => b.id === openId) ?? null) : null;
  const editing = route.kind === "board" && route.edit;

  // Who may curate the active space: in the personal space, its owner (always); in a team space, an
  // admin or a coach of that team. A team board may also be author-locked, so editing it needs its
  // author or an admin. RLS enforces all of this server-side; these flags only keep the UI honest.
  const canEdit = personal || workspace.isAdmin || workspace.activeRole === "coach";
  const canEditBoard = (b: Board): boolean =>
    personal || workspace.isAdmin || (workspace.activeRole === "coach" && (!b.authorLocked || b.owner === user?.id));

  const editableBoard = editing && openBoard && canEditBoard(openBoard) ? openBoard : null;

  // Reconcile the draft (the editor's working copy) with the route during render: drop it when the URL
  // leaves edit mode (so the back button exits the editor), and seed it from the board when an edit URL
  // is opened directly. Adjusting state during render is React's recommended alternative to an effect
  // here; it converges in one extra render and avoids the cascading renders of a reactive effect.
  if (!editing && draft !== null) setDraft(null);
  else if (editableBoard !== null && (draft === null || draft.id !== editableBoard.id)) setDraft(editableBoard);

  const showEditor = editing && draft !== null && draft.id === openId;

  // Whether the active space already matches the route's space. Until it does (a deep link or the landing
  // redirect is still aligning the space), the loaded boards belong to a different library, so resolving a
  // board id against them would be wrong — wait for the space-sync effect to catch up first.
  const target = routeSpace(route);
  const spaceReady = target === null || sameSpace(spaceForRouteSpace(target, allTeams), activeSpace);

  // A board URL whose id the matched space's list does not hold, and which is not a fresh, uncommitted draft.
  const needsBoardLookup =
    spaceReady && route.kind === "board" && openBoard === null && !(draft !== null && draft.id === route.boardId);

  if (!needsBoardLookup && missingBoardId !== null) setMissingBoardId(null);

  const homeRoute = () => libraryRoute(activeSpace, allTeams);

  // Follow the URL's space: when the route names a different library than the active one, switch to it.
  useEffect(() => {
    const spaceTarget = routeSpace(route);

    if (hashRoute || !user || !spaceTarget) return;

    const next = spaceForRouteSpace(spaceTarget, allTeams);

    if (!sameSpace(next, activeSpace)) setActiveSpace(next);
  }, [route, hashRoute, user, allTeams, activeSpace, setActiveSpace]);

  // The bare "/" URL carries no space; once the workspace resolves, send it to the landing library (the
  // first team, else personal), matching the previous default. This canonicalises "/" to a real path.
  useEffect(() => {
    if (hashRoute || route.kind !== "root" || !user || workspace.loading) return;

    const next: Space = teams[0] ? { kind: "team", teamId: teams[0].teamId } : { kind: "personal" };

    navigate(libraryRoute(next, allTeams), { replace: true });
  }, [route, hashRoute, user, workspace.loading, teams, allTeams, navigate]);

  // Canonicalise routable paths in place (e.g. "/admin" → "/admin/teams", trailing slashes, and an old
  // id link replaceState-ing to its slug link), without a new history entry. Root redirects above;
  // not-found keeps the path it failed to parse.
  useEffect(() => {
    if (hashRoute || route.kind === "root" || route.kind === "notFound") return;

    const canonical = canonicalRoute(route, allTeams, topics.topics);

    if (buildPath(canonical) !== window.location.pathname) navigate(canonical, { replace: true });
  }, [route, hashRoute, navigate, allTeams, topics.topics]);

  // Resolve a board URL the active space does not hold: confirm it is unreadable (→ not found), or
  // self-heal a stale link to the board's real space. The synchronous resets happen in render above; the
  // async lookup is the only side effect, so its setState lands in the promise callback, not the body.
  useEffect(() => {
    if (hashRoute || !needsBoardLookup || !user || boardsLoading || route.kind !== "board") return;

    const id = route.boardId;
    const edit = route.edit;
    let active = true;

    void fetchBoardById(id).then((res) => {
      if (!active) return;

      if (!res.board) {
        setMissingBoardId(id);

        return;
      }

      const real: Space =
        res.scope === "team" && res.teamId ? { kind: "team", teamId: res.teamId } : { kind: "personal" };

      if (!sameSpace(real, activeSpace)) {
        setActiveSpace(real);
        navigate(boardRoute(real, allTeams, id, edit), { replace: true });
      }
    });

    return () => {
      active = false;
    };
  }, [hashRoute, needsBoardLookup, user, boardsLoading, route, activeSpace, allTeams, setActiveSpace, navigate]);

  // Offer to restore a localStorage draft backup when an edit URL opens. A backup newer than the saved
  // board — or one for a board no list holds, i.e. a never-committed draft after a reload — is work a
  // crash or reload would otherwise have lost: restoring seeds the editor from it, declining discards
  // it. Checked once per edit entry, so the editor's own backup writes never re-prompt mid-session.
  const backupChecked = useRef<string | null>(null);

  useEffect(() => {
    if (!editing || route.kind !== "board") {
      backupChecked.current = null;

      return;
    }

    if (hashRoute || !user || boardsLoading || !spaceReady || backupChecked.current === route.boardId) return;

    const id = route.boardId;

    backupChecked.current = id;

    const backup = loadDraftBackup(id);

    if (!backup) return;

    const saved = boards.find((b) => b.id === id);

    // A backup no newer than the saved board is a leftover from a committed session — drop it quietly.
    if (saved && backup.updatedAt <= saved.updatedAt) {
      clearDraftBackup(id);

      return;
    }

    void confirm({
      title: "Restore unsaved changes?",
      description: "This board has edits from an earlier session that were never saved.",
      confirmLabel: "Restore",
      cancelLabel: "Discard",
    }).then((restore) => {
      if (restore) {
        setDraft(backup);
        setDraftRevision((r) => r + 1);
      } else {
        clearDraftBackup(id);
      }
    });
  }, [editing, hashRoute, user, boardsLoading, spaceReady, route, boards, confirm]);

  // Done's commit: awaited, so a failure keeps the draft on screen (the editor shows the returned
  // error and retries) and only a verified save drops the draft and navigates to the view.
  const commit = async (updated: Board): Promise<string | null> => {
    const error = await (boards.some((b) => b.id === updated.id) ? updateBoard(updated) : addBoard(updated));

    if (error !== null) return error;

    clearDraftBackup(updated.id);
    setDraft(null);
    navigate(boardRoute(activeSpace, allTeams, updated.id, false));

    return null;
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
    clearDraftBackup(id);
    setDraft(null);
    navigate(homeRoute());
  };

  const startEdit = (board: Board) => {
    setDraft(board);
    navigate(boardRoute(activeSpace, allTeams, board.id, true));
  };

  // New board placement: unfiled from the library, pre-filed into the topic when created from its page.
  const newBoard = () => {
    if (!user) return;

    const topicId = route.kind === "topic" ? findTopicId(topics.topics, route.topicSlug) : null;
    const board = { ...createBoard(Date.now()), owner: user.id, topicId };

    setDraft(board);
    navigate(boardRoute(activeSpace, allTeams, board.id, true));
  };

  const cancelEdit = () => {
    const id = draft?.id;

    if (id) clearDraftBackup(id);
    setDraft(null);
    navigate(id && boards.some((b) => b.id === id) ? boardRoute(activeSpace, allTeams, id, false) : homeRoute());
  };

  const switchSpace = (next: Space) => navigate(libraryRoute(next, allTeams));

  const selectTopic = (next: Selection) => {
    if (next.kind === "all") {
      navigate(homeRoute());

      return;
    }

    const topic = topics.topics.find((t) => t.id === next.id);

    if (topic) navigate(topicRoute(activeSpace, allTeams, topic));
  };

  const deleteOwnAccount = async () => {
    const ok = await confirm({
      title: "Delete your account?",
      description:
        "Your personal content is archived for 3 months; team content you authored stays with the team. This cannot be undone.",
      confirmLabel: "Delete account",
      danger: true,
    });

    if (!ok) return;

    const { error } = await deleteAccount();

    if (error) {
      await confirm({ title: "Could not delete your account", description: error, confirmLabel: "OK" });

      return;
    }

    await signOut();
  };

  const createTopic = (parentId: string | null) => {
    const id = topics.addTopic(parentId);

    // Navigate by id (addTopic only returns the id); the canonicalisation effect rewrites it to the slug.
    navigate({ kind: "topic", space: routeSpaceForSpace(activeSpace, allTeams), topicSlug: id });
  };

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
    if (editingTopicId && removed.includes(editingTopicId)) setEditingTopicId(null);
    if (selection.kind === "topic" && removed.includes(selection.id)) navigate(homeRoute());
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

  // An invite link is openable with or without an account: a signed-in visitor joins in one click, a
  // newcomer sets up an account. Resolve auth first so it knows which, then let it win over the gate.
  if (inviteToken) return <InviteAccept key={inviteToken} token={inviteToken} />;

  if (!user) return <Login />;

  // An invite email signs its recipient in as a freshly created, passwordless account. Collect a password
  // before the app, so the account is usable for ordinary sign-in afterwards.
  if (isInviteLanding && !passwordReady)
    return <SetPassword email={user.email ?? ""} onDone={() => setPasswordReady(true)} />;

  if (workspace.error) {
    return (
      <div className={cx(BG, "items-center justify-center px-6 text-center")}>
        <p className={MUTED}>Couldn’t load your workspace: {workspace.error}</p>
      </div>
    );
  }

  // Once the workspace resolves, a user with no display name set must choose one before reaching the
  // app. This wins over the content-loading gate, so the prompt shows without waiting on boards/topics.
  if (!workspace.loading && workspace.displayName === null) return <NameSetup onSave={workspace.setDisplayName} />;

  // Block on the first load only. A later team switch keeps the prior content on screen until the new
  // data arrives, so switching teams (or working in a dialog mid-load) never blanks the whole app.
  if (workspace.loading || (boardsLoading && boards.length === 0) || (topics.loading && topics.topics.length === 0))
    return loader;

  const selectedTopic = selection.kind === "topic" ? topics.topics.find((t) => t.id === selection.id) : undefined;

  // The teams whose library the viewer may write to, as copy/move targets: an admin reaches every team;
  // anyone else the teams they coach, including the showcase space for its curators.
  const targetTeams = workspace.isAdmin
    ? allTeams
    : [...teams.filter((t) => t.role === "coach"), ...(showcase?.role === "coach" ? [showcase] : [])];

  // A copy into the active space is a duplicate: it stays in the open list (with its topic) under a
  // fresh id and title. The view moves to the copy only after the awaited insert succeeds — navigating
  // sooner would open a board the list does not hold yet — and a failure stays put and reports back to
  // the menu item. addBoard stamps its timestamps.
  const duplicateBoard = async (board: Board): Promise<{ error: string | null }> => {
    const copy: Board = {
      ...board,
      id: crypto.randomUUID(),
      title: `Copy of ${board.title}`,
      owner: user.id,
      authorLocked: false,
      shared: false,
      teamId: activeSpace.kind === "team" ? activeSpace.teamId : null,
    };

    const error = await addBoard(copy);

    if (error === null) navigate(boardRoute(activeSpace, allTeams, copy.id, false));

    return { error };
  };

  // One copy target per writable space, with the active space acting as the duplicate.
  const copyTargets = (board: Board): CopyTarget[] => [
    personal
      ? { key: "personal", label: "My Boards", kind: "duplicate", onDuplicate: () => duplicateBoard(board) }
      : {
          key: "personal",
          label: "My Boards",
          kind: "copy",
          onCopy: () => copyBoardToSpace(board, user.id, { kind: "personal" }),
        },
    ...targetTeams.map(
      (t): CopyTarget =>
        activeSpace.kind === "team" && activeSpace.teamId === t.teamId
          ? { key: t.teamId, label: t.teamName, kind: "duplicate", onDuplicate: () => duplicateBoard(board) }
          : {
              key: t.teamId,
              label: t.teamName,
              kind: "copy",
              onCopy: () => copyBoardToSpace(board, user.id, { kind: "team", teamId: t.teamId }),
            }
    ),
  ];

  // An import creates everything anew in the active space: topics first (parents before children, the
  // order the parser returns), then boards, each write awaited so a failure reports back to the dialog.
  const importBundle = async (newTopics: Topic[], newBoards: Board[]): Promise<string | null> => {
    const topicError = await topics.insertTopics(newTopics);

    if (topicError !== null) return topicError;

    for (const board of newBoards) {
      const boardError = await addBoard({ ...board, owner: user.id });

      if (boardError !== null) return boardError;
    }

    return null;
  };

  // The space's JSON export (and, for its curators, import) on the All Boards page bar, and the
  // topic's subtree export on its page bar. Export needs no edit rights, matching viewing.
  const spaceName = personal
    ? "My boards"
    : (allTeams.find((t) => activeSpace.kind === "team" && t.teamId === activeSpace.teamId)?.teamName ?? "Team");

  // Moving relocates the original into a team library, so it is confirmed, unlike a copy.
  const moveBoard = async (board: Board, teamId: string) => {
    const name = targetTeams.find((t) => t.teamId === teamId)?.teamName ?? "the team";
    const ok = await confirm({
      title: `Move this board to ${name}?`,
      description: "It leaves My Boards and joins the team’s library.",
      confirmLabel: "Move",
    });

    if (!ok) return;

    moveBoardToTeam(board.id, teamId);
    navigate(homeRoute());
  };

  let content: JSX.Element;

  if (showEditor && draft) {
    content = (
      <BoardEditor
        key={`${draft.id}:${draftRevision}`}
        board={draft}
        onDone={commit}
        onCancel={cancelEdit}
        onDelete={draftExisting ? () => remove(draft.id) : undefined}
        tagSuggestions={tagSuggestions}
        topics={topics.topics}
      />
    );
  } else if (route.kind === "board") {
    if (openBoard) {
      // The board's actions sit on its title row, like every other surface's content header: an overflow
      // menu for the occasional actions (Copy to every writable space with the active one duplicating,
      // the owner's Move to, then the author lock and Copy JSON), the share dialog for the owner of a
      // personal board, and Edit as the view's one primary action. RLS has the final say on every write.
      content = (
        <BoardView
          board={openBoard}
          onBack={() => navigate(homeRoute())}
          actions={
            <>
              <BoardActionsMenu
                board={openBoard}
                canLock={!personal && (workspace.isAdmin || openBoard.owner === user.id)}
                onToggleLock={() => setBoardLock(openBoard.id, !openBoard.authorLocked)}
              >
                <CopyToMenu targets={copyTargets(openBoard)} />
                {personal && openBoard.owner === user.id && targetTeams.length > 0 && (
                  <MoveToMenu teams={targetTeams} onMove={(teamId) => void moveBoard(openBoard, teamId)} />
                )}
              </BoardActionsMenu>
              {personal && openBoard.owner === user.id && (
                <Button variant="ghost" onClick={() => setSharing(true)}>
                  {openBoard.shared ? "Shared" : "Share"}
                </Button>
              )}
              {canEditBoard(openBoard) && (
                <Button variant="primary" onClick={() => startEdit(openBoard)}>
                  Edit
                </Button>
              )}
            </>
          }
        />
      );
    } else if (missingBoardId === route.boardId) {
      content = <NotFound onHome={() => navigate(homeRoute())} />;
    } else {
      content = <p className={MUTED}>Loading…</p>;
    }
  } else if (route.kind === "topic" && !topics.loading && selectedTopic === undefined) {
    content = <NotFound onHome={() => navigate(homeRoute())} />;
  } else if (selectedTopic && editingTopicId === selectedTopic.id) {
    content = (
      <TopicEditor
        topic={selectedTopic}
        boards={boards}
        onCancel={() => setEditingTopicId(null)}
        onDelete={() => removeTopic(selectedTopic.id)}
        onUnfileBoard={(boardId) => unfileBoards([boardId])}
        onDone={async (patch) => {
          const error = await topics.updateTopic(selectedTopic.id, { title: patch.title, blocks: patch.blocks });

          if (error !== null) return error;

          setEditingTopicId(null);
          // The first rename away from "New topic" re-mints the slug, so the URL's old handle would go
          // stale; re-point it at the id and let the canonicalisation effect rewrite it to the new slug.
          navigate(
            { kind: "topic", space: routeSpaceForSpace(activeSpace, allTeams), topicSlug: selectedTopic.id },
            { replace: true }
          );

          return null;
        }}
      />
    );
  } else if (selectedTopic) {
    // The topic export carries the whole subtree and every board filed under any topic in it.
    const subtree = subtreeIds(topics.topics, selectedTopic.id);

    content = (
      <TopicView
        topic={selectedTopic}
        topics={topics.topics}
        boards={boardsInTopic(boards, selectedTopic.id)}
        onOpenBoard={(id) => navigate(boardRoute(activeSpace, allTeams, id, false))}
        onSelectTopic={(id) => selectTopic({ kind: "topic", id })}
        onEdit={() => setEditingTopicId(selectedTopic.id)}
        onAddSubtopic={() => createTopic(selectedTopic.id)}
        onNewBoard={newBoard}
        canEdit={canEdit}
        menu={
          <ExportMenu
            label="Topic actions"
            bundle={() =>
              toBundle(
                boards.filter((b) => b.topicId !== null && subtree.includes(b.topicId)),
                topics.topics.filter((t) => subtree.includes(t.id))
              )
            }
            filename={bundleFilename(selectedTopic.title)}
          />
        }
      />
    );
  } else if (route.kind === "library" || route.kind === "topic") {
    content = (
      <Library
        boards={boards}
        onOpen={(id) => navigate(boardRoute(activeSpace, allTeams, id, false))}
        onNew={newBoard}
        canEdit={canEdit}
        menu={
          <ExportMenu
            label="Library actions"
            bundle={() => toBundle(boards, topics.topics)}
            filename={bundleFilename(spaceName)}
          >
            {canEdit && <MenuItem onClick={() => setImporting(true)}>Import JSON…</MenuItem>}
          </ExportMenu>
        }
      />
    );
  } else if (route.kind === "settings") {
    content = (
      <SettingsPage
        email={user.email ?? ""}
        displayName={workspace.displayName ?? ""}
        onSave={workspace.setDisplayName}
      />
    );
  } else if (route.kind === "team") {
    // The team in the URL is one the user can reach (else it resolves to nothing → not found). Management
    // is coach-facing: a coach of that team or an admin curates it, anyone else reads the roster only. An
    // admin moves on and off the roster freely: join with a chosen role, or leave (their reach stays).
    const teamId = findTeamId(allTeams, route.teamSlug);
    const team = allTeams.find((t) => t.teamId === teamId);
    // The caller's membership role. A showcase membership lives only on `showcase.role` (the workspace
    // keeps it out of `teams`), so a curator manages the Inspiration team like any coach.
    const memberRole =
      teams.find((t) => t.teamId === teamId)?.role ?? (showcase?.teamId === teamId ? showcase.role : null);

    content =
      teamId && team ? (
        <TeamPage
          teamId={teamId}
          teamName={team.teamName}
          canManage={workspace.isAdmin || memberRole === "coach"}
          currentUserId={user.id}
          onJoin={workspace.isAdmin && memberRole === null ? (role) => workspace.joinTeam(teamId, role) : undefined}
          onLeave={workspace.isAdmin && memberRole !== null ? () => workspace.leaveTeam(teamId) : undefined}
        />
      ) : (
        <NotFound onHome={() => navigate(homeRoute())} />
      );
  } else if (route.kind === "admin") {
    content = workspace.isAdmin ? (
      <AdminPage
        sub={route.sub}
        onNavigateSub={(sub) => navigate({ kind: "admin", sub })}
        onCreateTeam={workspace.createTeam}
        currentUserId={user.id}
      />
    ) : (
      <NotFound onHome={() => navigate(homeRoute())} />
    );
  } else if (route.kind === "root") {
    content = <p className={MUTED}>Loading…</p>;
  } else {
    content = <NotFound onHome={() => navigate(homeRoute())} />;
  }

  // Wraps a navigation pick so it also closes the overlay; a no-op while the static column shows.
  const closing = <A extends unknown[]>(fn: (...args: A) => void) => {
    return (...args: A) => {
      setNavOpen(false);
      fn(...args);
    };
  };

  const sidebar = (
    <Sidebar
      activeSpace={activeSpace}
      teams={teams}
      otherTeams={otherTeams}
      showcase={showcase}
      onSwitchSpace={closing(switchSpace)}
      canManageActiveTeam={!personal && canEdit}
      onManageTeam={closing((teamId: string) => navigate(teamRoute(teamId, allTeams)))}
      topics={topics.topics}
      selection={selection}
      onSelectTopic={closing(selectTopic)}
      onNewTopic={closing(() => createTopic(null))}
      onReorderTopic={topics.reorderTopic}
      onNestTopic={topics.reparentTopic}
      canEdit={canEdit}
      isAdmin={workspace.isAdmin}
      adminActive={route.kind === "admin"}
      onOpenAdmin={closing(() => navigate({ kind: "admin", sub: "teams" }))}
    />
  );

  const topBar = (
    <TopBar
      crumbs={breadcrumbs(route, allTeams, topics.topics, boards)}
      onNavigate={navigate}
      onOpenNav={sidebarMode === "drawer" ? () => setNavOpen(true) : undefined}
      account={
        <AvatarMenu
          displayName={workspace.displayName ?? ""}
          email={user.email ?? ""}
          themePreference={themePreference}
          onSetTheme={setThemePreference}
          onAccountSettings={() => navigate({ kind: "settings" })}
          onSignOut={() => void signOut()}
          onDeleteAccount={() => void deleteOwnAccount()}
        />
      }
    />
  );

  return (
    <TooltipProvider>
      <AppShell
        mode={sidebarMode}
        sidebar={
          sidebarMode === "full" ? (
            sidebar
          ) : sidebarMode === "rail" ? (
            <SidebarRail
              activeSpace={activeSpace}
              teams={teams}
              otherTeams={otherTeams}
              showcase={showcase}
              onSwitchSpace={switchSpace}
              expanded={navOpen}
              onExpand={() => setNavOpen(true)}
              isAdmin={workspace.isAdmin}
              adminActive={route.kind === "admin"}
              onOpenAdmin={() => navigate({ kind: "admin", sub: "teams" })}
            />
          ) : undefined
        }
        topBar={topBar}
      >
        {(boardsError || topics.error) && (
          <p className="mb-3 w-full max-w-[1320px] text-sm text-danger">{boardsError ?? topics.error}</p>
        )}
        {content}
      </AppShell>
      {sidebarMode !== "full" && (
        <SidePanel open={navOpen} onOpenChange={setNavOpen} label="Navigation">
          {sidebar}
        </SidePanel>
      )}
      {dialog}
      {canEdit && (
        <ImportDialog open={importing} onOpenChange={setImporting} topics={topics.topics} onImport={importBundle} />
      )}
      {openBoard && (
        <ShareDialog
          open={sharing}
          onOpenChange={setSharing}
          board={openBoard}
          teams={teams}
          onShare={(teamId) => shareBoard(openBoard.id, teamId)}
          onUnshare={() => unshareBoard(openBoard.id)}
        />
      )}
    </TooltipProvider>
  );
}
