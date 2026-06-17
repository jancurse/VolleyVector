import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { Settings } from "lucide-react";

import { createBoard } from "./boards/operations";
import type { Board } from "./boards/types";
import { COMMIT_CONFLICT, useBoards } from "./boards/useBoards";
import { ExportMenu } from "./bundle/ExportMenu";
import { ImportDialog } from "./bundle/ImportDialog";
import { ReplaceBoardDialog } from "./bundle/ReplaceBoardDialog";
import { bundleFilename, toBundle } from "./bundle/serialize";
import { useDraftPreviewRoute } from "./bundle/useDraftPreviewRoute";
import { BoardActionsMenu } from "./editor/BoardActionsMenu";
import { BoardEditor } from "./editor/BoardEditor";
import { clearDraftBackup, loadDraftBackup } from "./editor/draftBackup";
import { BoardView } from "./editor/BoardView";
import { BoardHistory } from "./history/BoardHistory";
import { NoteHistory } from "./history/NoteHistory";
import { Library } from "./library/Library";
import { allTags } from "./library/items";
import type { Selection } from "./library/selection";
import { appendBoardToBlocks, subtreeIds } from "./notes/operations";
import { AppearsIn } from "./notes/AppearsIn";
import { NoteEditor } from "./notes/NoteEditor";
import { NoteView } from "./notes/NoteView";
import { useNotes } from "./notes/useNotes";
import type { Note } from "./notes/types";
import { useTheme } from "./theme/useTheme";
import { MenuItem, MenuSeparator } from "./ui/Menu";
import { TooltipProvider } from "./ui/Tooltip";
import { useConfirm } from "./ui/useConfirm";
import { useAuth } from "./auth/useAuth";
import { Login } from "./auth/Login";
import { SetPassword } from "./auth/SetPassword";
import { isInviteLanding } from "./auth/inviteLanding";
import { Button } from "./ui/Button";
import { cx, MUTED } from "./ui/styles";
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
import { useGrantRoute } from "./sharing/useGrantRoute";
import { GrantAccept } from "./sharing/GrantAccept";
import { useInviteRoute } from "./invites/useInviteRoute";
import { InviteAccept } from "./invites/InviteAccept";
import { AccessManager } from "./sharing/AccessManager";
import { NoteAccessManager } from "./sharing/NoteAccessManager";
import { CopyToMenu } from "./sharing/CopyToMenu";
import type { CopyTarget } from "./sharing/CopyToMenu";
import { copyBoardToSpace, fetchBoardById } from "./sharing/share";
import { useRoute } from "./routing/useRoute";
import { buildPath, routeSpace } from "./routing/route";
import { NotFound } from "./routing/NotFound";
import {
  boardPrintRoute,
  boardRoute,
  canonicalRoute,
  findTeamId,
  findNoteId,
  libraryRoute,
  routeSpaceForSpace,
  spaceForRouteSpace,
  teamRoute,
  notePrintRoute,
  noteRoute,
} from "./routing/links";
import { BoardPrint } from "./print/BoardPrint";
import { PrintView } from "./print/PrintView";
import { NotePrint } from "./print/NotePrint";
import { AppShell } from "./shell/AppShell";
import { BrandLockup } from "./shell/BrandMark";
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

// The dev-only draft preview (`#/preview`) lazy-loads behind the DEV check, so its drafts/ glob — and
// every draft's contents — tree-shakes out of the production bundle entirely.
const DraftPreview = import.meta.env.DEV
  ? lazy(() => import("./bundle/DraftPreview").then((m) => ({ default: m.DraftPreview })))
  : null;

// The URL is the single source of truth for navigation: the active space, the browse selection, and the
// open board are all derived from the path-based route. A draft (the editor's working copy) and the
// note-editing toggle are the only navigation state not in the URL. App wires the stores together and
// renders the persistent shell; the share and invite hash links still win over everything.

export function App(): JSX.Element {
  const [, themePreference, setThemePreference] = useTheme();
  const { user, loading, signOut } = useAuth();
  const workspace = useWorkspace();
  const shareToken = useShareRoute();
  const inviteToken = useInviteRoute();
  const grantToken = useGrantRoute();
  const draftPreviewOpen = useDraftPreviewRoute() && import.meta.env.DEV;
  const { route, navigate } = useRoute();

  // A share or invite link rides the hash and owns the whole screen (it opens with or without an account),
  // a grant link rides it too (but only once signed in), and the dev-only draft preview rides it inside the
  // shell, so the path router stays dormant while one is active: its effects must not navigate the hash.
  const hashRoute = shareToken !== null || inviteToken !== null || grantToken !== null || draftPreviewOpen;

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
  } = useBoards(space, workspace.isAdmin, workspace.activeRole);
  const notes = useNotes(space, workspace.isAdmin, workspace.activeRole);
  const { confirm, dialog } = useConfirm();

  const [draft, setDraft] = useState<Board | null>(null);
  // Bumped when a backup restore replaces the draft in place, so the keyed editor remounts on it.
  const [draftRevision, setDraftRevision] = useState(0);
  // The note page a new draft was created from: its first commit appends the board to that note's
  // document. Null for a board created from the library or an edit of an existing board.
  const [draftNoteId, setDraftNoteId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [passwordReady, setPasswordReady] = useState(false);
  const [managingAccess, setManagingAccess] = useState(false);
  const [managingNoteAccess, setManagingNoteAccess] = useState(false);
  const [importing, setImporting] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [missingBoardId, setMissingBoardId] = useState<string | null>(null);

  // Below the full-sidebar width the navigation lives in an overlay: expanded from the rail's Notes
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
    route.kind === "note" ? { kind: "note", id: findNoteId(notes.notes, route.noteSlug) ?? "" } : { kind: "all" };
  const openId = route.kind === "board" ? route.boardId : null;
  const openBoard = openId !== null ? (boards.find((b) => b.id === openId) ?? null) : null;
  const editing = route.kind === "board" && route.edit;

  // History is a per-content surface; leaving the open board or note closes it. Reset during render, the
  // same way the draft is reconciled below.
  const contentKey =
    route.kind === "board" ? `b:${openId}` : route.kind === "note" ? `n:${route.noteSlug}` : route.kind;
  const [history, setHistory] = useState({ open: false, key: contentKey });

  if (history.key !== contentKey) setHistory({ open: false, key: contentKey });

  const viewingHistory = history.open;
  const setViewingHistory = (open: boolean) => setHistory({ open, key: contentKey });

  // Who may create in the active space: its owner (personal), an admin, or a coach of the active team.
  // Whether a specific board may be edited is its own derived capability (editor or owner). RLS enforces
  // all of this server-side; these flags only keep the UI honest.
  const canEdit = personal || workspace.isAdmin || workspace.activeRole === "coach";
  const canEditBoard = (b: Board): boolean => b.capability === "editor" || b.capability === "owner";
  const canEditNote = (n: Note): boolean => n.capability === "editor" || n.capability === "owner";

  const editableBoard = editing && openBoard && canEditBoard(openBoard) ? openBoard : null;

  // Reconcile the draft (the editor's working copy) with the route during render: drop it when the URL
  // leaves edit mode (so the back button exits the editor), and seed it from the board when an edit URL
  // is opened directly. Adjusting state during render is React's recommended alternative to an effect
  // here; it converges in one extra render and avoids the cascading renders of a reactive effect.
  if (!editing && draft !== null) {
    setDraft(null);
    setDraftNoteId(null);
  } else if (editableBoard !== null && (draft === null || draft.id !== editableBoard.id)) setDraft(editableBoard);

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

    const canonical = canonicalRoute(route, allTeams, notes.notes);

    if (buildPath(canonical) !== window.location.pathname) navigate(canonical, { replace: true });
  }, [route, hashRoute, navigate, allTeams, notes.notes]);

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

      // The board may live in several spaces; heal the link to one the viewer can reach — a team whose
      // library holds it, else their personal space.
      const teamGrant = res.grants.find((g) => g.team_id && allTeams.some((t) => t.teamId === g.team_id));
      const real: Space = teamGrant?.team_id ? { kind: "team", teamId: teamGrant.team_id } : { kind: "personal" };

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
    const isUpdate = boards.some((b) => b.id === updated.id);
    let error = await (isUpdate ? updateBoard(updated) : addBoard(updated));

    // A stale base means a co-editor committed first. Offer to overwrite their version; declining keeps the
    // draft open so the coach can reopen the board, see the latest, and reconcile by hand.
    if (error === COMMIT_CONFLICT) {
      const overwrite = await confirm({
        title: "This board changed while you were editing",
        description: "Someone else saved changes since you opened it. Overwrite their version with yours?",
        confirmLabel: "Overwrite",
        cancelLabel: "Keep editing",
        danger: true,
      });

      if (!overwrite) return "Reopen the board to see the latest changes, then edit again.";

      error = await updateBoard(updated, { overwrite: true });
    }

    if (error !== null) return error;

    // A board created from a note page joins that note's document now, after its first commit
    // succeeded. A failed link keeps the editor open and Done retries (the board save is idempotent).
    const note = draftNoteId !== null ? notes.notes.find((t) => t.id === draftNoteId) : undefined;

    if (note) {
      const linkError = await notes.updateNote(note.id, {
        blocks: appendBoardToBlocks(note.blocks, updated.id),
      });

      if (linkError !== null) return linkError;
    }

    setDraftNoteId(null);
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

  // Restore a past revision by committing its content as a new revision (append-only history). Overwrite
  // re-bases onto the current revision, so a restore lands even if the board moved on since it was opened.
  const restoreBoardRevision = async (snapshot: Board) => {
    const error = await updateBoard(snapshot, { overwrite: true });

    if (error !== null && error !== COMMIT_CONFLICT) {
      void confirm({ title: "Couldn’t restore", description: error, confirmLabel: "OK" });

      return;
    }

    setViewingHistory(false);
  };

  const restoreNoteRevision = async (snapshot: Note) => {
    const error = await notes.updateNote(snapshot.id, { title: snapshot.title, blocks: snapshot.blocks });

    if (error !== null) {
      void confirm({ title: "Couldn’t restore", description: error, confirmLabel: "OK" });

      return;
    }

    setViewingHistory(false);
  };

  const startEdit = (board: Board) => {
    setDraft(board);
    setDraftNoteId(null);
    navigate(boardRoute(activeSpace, allTeams, board.id, true));
  };

  // A board created from a note page commits into that note's document; from the library it starts unlinked.
  const newBoard = () => {
    if (!user) return;

    const board = { ...createBoard(Date.now()), createdBy: user.id };

    setDraft(board);
    setDraftNoteId(route.kind === "note" ? findNoteId(notes.notes, route.noteSlug) : null);
    navigate(boardRoute(activeSpace, allTeams, board.id, true));
  };

  const cancelEdit = () => {
    const id = draft?.id;

    if (id) clearDraftBackup(id);
    setDraft(null);
    setDraftNoteId(null);
    navigate(id && boards.some((b) => b.id === id) ? boardRoute(activeSpace, allTeams, id, false) : homeRoute());
  };

  const switchSpace = (next: Space) => navigate(libraryRoute(next, allTeams));

  const selectNote = (next: Selection) => {
    if (next.kind === "all") {
      navigate(homeRoute());

      return;
    }

    const note = notes.notes.find((t) => t.id === next.id);

    if (note) navigate(noteRoute(activeSpace, allTeams, note));
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

  const createNote = (parentId: string | null) => {
    const id = notes.addNote(parentId);

    // Navigate by id (addNote only returns the id); the canonicalisation effect rewrites it to the slug.
    navigate({ kind: "note", space: routeSpaceForSpace(activeSpace, allTeams), noteSlug: id });
  };

  const removeNote = async (id: string) => {
    const ok = await confirm({
      title: "Delete this note and its subnotes?",
      description: "Boards they reference stay in the library.",
      confirmLabel: "Delete",
      danger: true,
    });

    if (!ok) return;

    const removed = subtreeIds(notes.notes, id);

    notes.removeNote(id);
    if (editingNoteId && removed.includes(editingNoteId)) setEditingNoteId(null);
    if (selection.kind === "note" && removed.includes(selection.id)) navigate(homeRoute());
  };

  const tagSuggestions = useMemo(() => allTags(boards), [boards]);

  const loader = (
    <div className={cx(BG, "items-center justify-center gap-6")}>
      <BrandLockup size={30} />
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

  // A grant link binds its grant to the signed-in caller, so it sits behind the gate above: once signed
  // in, it owns the screen to preview and claim the share before the app loads.
  if (grantToken) return <GrantAccept key={grantToken} token={grantToken} />;

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
  // app. This wins over the content-loading gate, so the prompt shows without waiting on boards/notes.
  if (!workspace.loading && workspace.displayName === null) return <NameSetup onSave={workspace.setDisplayName} />;

  // Block on the first load only. A later team switch keeps the prior content on screen until the new
  // data arrives, so switching teams (or working in a dialog mid-load) never blanks the whole app.
  if (workspace.loading || (boardsLoading && boards.length === 0) || (notes.loading && notes.notes.length === 0))
    return loader;

  const printNotFound = (
    <div className={cx(BG, "px-[clamp(1.1rem,4vw,2.75rem)] py-10")}>
      <NotFound onHome={() => navigate(homeRoute())} />
    </div>
  );

  // The print routes render their handout chrome-free, outside the shell. The space-sync effect above
  // aligns the active space to the URL, so the document just reads the loaded lists; a board id or
  // note slug the space does not hold is treated as not found once the space has settled.
  if (route.kind === "printBoard") {
    const board = boards.find((b) => b.id === route.boardId);

    if (!board) return !spaceReady || boardsLoading ? loader : printNotFound;

    return (
      <PrintView
        title={board.title || "Untitled board"}
        onBack={() => navigate(boardRoute(activeSpace, allTeams, board.id, false))}
      >
        <BoardPrint board={board} />
      </PrintView>
    );
  }

  if (route.kind === "printNote") {
    const noteId = findNoteId(notes.notes, route.noteSlug);
    const note = notes.notes.find((t) => t.id === noteId);

    if (!note) return !spaceReady || notes.loading ? loader : printNotFound;

    return (
      <PrintView title={note.title} onBack={() => navigate(noteRoute(activeSpace, allTeams, note))}>
        <NotePrint note={note} boards={boards} />
      </PrintView>
    );
  }

  const selectedNote = selection.kind === "note" ? notes.notes.find((t) => t.id === selection.id) : undefined;

  // The teams whose library the viewer may write to, as copy/move targets: an admin reaches every team;
  // anyone else the teams they coach, including the showcase space for its curators.
  const targetTeams = workspace.isAdmin
    ? allTeams
    : [...teams.filter((t) => t.role === "coach"), ...(showcase?.role === "coach" ? [showcase] : [])];

  // A copy into the active space is a duplicate: it stays in the open list (with its note) under a
  // fresh id and title. The view moves to the copy only after the awaited insert succeeds — navigating
  // sooner would open a board the list does not hold yet — and a failure stays put and reports back to
  // the menu item. addBoard stamps its timestamps.
  const duplicateBoard = async (board: Board): Promise<{ error: string | null }> => {
    const copy: Board = {
      ...board,
      id: crypto.randomUUID(),
      title: `Copy of ${board.title}`,
      createdBy: user.id,
      capability: "owner",
      currentRevisionId: null,
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

  // An import creates everything anew in the active space: notes first (parents before children, the
  // order the parser returns), then boards, each write awaited so a failure reports back to the dialog.
  const importBundle = async (newNotes: Note[], newBoards: Board[]): Promise<string | null> => {
    const noteError = await notes.insertNotes(newNotes);

    if (noteError !== null) return noteError;

    for (const board of newBoards) {
      const boardError = await addBoard({ ...board, createdBy: user.id });

      if (boardError !== null) return boardError;
    }

    return null;
  };

  // The space's JSON export (and, for its curators, import) on the All Boards page bar, and the
  // note's subtree export on its page bar. Export needs no edit rights, matching viewing.
  const spaceName = personal
    ? "My boards"
    : (allTeams.find((t) => activeSpace.kind === "team" && t.teamId === activeSpace.teamId)?.teamName ?? "Team");

  let content: JSX.Element;

  if (DraftPreview && draftPreviewOpen) {
    content = (
      <Suspense fallback={<p className={MUTED}>Loading…</p>}>
        <DraftPreview notes={notes.notes} canEdit={canEdit} onImport={importBundle} />
      </Suspense>
    );
  } else if (showEditor && draft) {
    content = (
      <BoardEditor
        key={`${draft.id}:${draftRevision}`}
        board={draft}
        onDone={commit}
        onCancel={cancelEdit}
        tagSuggestions={tagSuggestions}
      />
    );
  } else if (route.kind === "board") {
    if (openBoard && viewingHistory) {
      content = (
        <BoardHistory
          board={openBoard}
          onBack={() => setViewingHistory(false)}
          onRestore={canEditBoard(openBoard) ? restoreBoardRevision : undefined}
        />
      );
    } else if (openBoard) {
      // The board's actions sit on its title row, like every other surface's content header: an overflow
      // menu for the occasional actions (an owner's access manager, Copy to every writable space with the
      // active one duplicating, then Copy JSON), and Edit as the view's one primary action. RLS has the
      // final say on every write.
      content = (
        <BoardView
          board={openBoard}
          onBack={() => navigate(homeRoute())}
          meta={
            <AppearsIn
              boardId={openBoard.id}
              notes={notes.notes}
              onOpenNote={(id) => selectNote({ kind: "note", id })}
              onAddToNote={
                canEdit
                  ? (noteId) => {
                      const note = notes.notes.find((n) => n.id === noteId);

                      if (!note) return;

                      void notes
                        .updateNote(noteId, { blocks: appendBoardToBlocks(note.blocks, openBoard.id) })
                        .then((error) => {
                          if (error)
                            void confirm({ title: "Couldn’t add to note", description: error, confirmLabel: "OK" });
                        });
                    }
                  : undefined
              }
            />
          }
          actions={
            <>
              <BoardActionsMenu
                board={openBoard}
                onManageAccess={openBoard.capability === "owner" ? () => setManagingAccess(true) : undefined}
                onViewHistory={() => setViewingHistory(true)}
                onPrint={() => navigate(boardPrintRoute(activeSpace, allTeams, openBoard.id))}
                onReplace={canEditBoard(openBoard) ? () => setReplacing(true) : undefined}
                onDelete={canEditBoard(openBoard) ? () => void remove(openBoard.id) : undefined}
              >
                <CopyToMenu targets={copyTargets(openBoard)} />
              </BoardActionsMenu>
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
  } else if (route.kind === "note" && !notes.loading && selectedNote === undefined) {
    content = <NotFound onHome={() => navigate(homeRoute())} />;
  } else if (selectedNote && editingNoteId === selectedNote.id) {
    content = (
      <NoteEditor
        note={selectedNote}
        boards={boards}
        onCancel={() => setEditingNoteId(null)}
        onDone={async (patch) => {
          const error = await notes.updateNote(selectedNote.id, { title: patch.title, blocks: patch.blocks });

          if (error !== null) return error;

          setEditingNoteId(null);
          // The first rename away from "New note" re-mints the slug, so the URL's old handle would go
          // stale; re-point it at the id and let the canonicalisation effect rewrite it to the new slug.
          navigate(
            { kind: "note", space: routeSpaceForSpace(activeSpace, allTeams), noteSlug: selectedNote.id },
            { replace: true }
          );

          return null;
        }}
      />
    );
  } else if (selectedNote && viewingHistory) {
    content = (
      <NoteHistory
        note={selectedNote}
        boards={boards}
        onBack={() => setViewingHistory(false)}
        onOpenBoard={(id) => navigate(boardRoute(activeSpace, allTeams, id, false))}
        onRestore={canEditNote(selectedNote) ? restoreNoteRevision : undefined}
      />
    );
  } else if (selectedNote) {
    content = (
      <NoteView
        note={selectedNote}
        notes={notes.notes}
        boards={boards}
        onOpenBoard={(id) => navigate(boardRoute(activeSpace, allTeams, id, false))}
        onSelectNote={(id) => selectNote({ kind: "note", id })}
        onEdit={() => setEditingNoteId(selectedNote.id)}
        onAddSubnote={() => createNote(selectedNote.id)}
        onNewBoard={newBoard}
        canEdit={canEditNote(selectedNote)}
        menu={
          <ExportMenu
            label="Note actions"
            bundle={() => {
              // The note export carries the whole subtree and every board any note in it references.
              const subtree = subtreeIds(notes.notes, selectedNote.id);
              const inSubtree = notes.notes.filter((t) => subtree.includes(t.id));
              const referenced = new Set(
                inSubtree.flatMap((n) => n.blocks.flatMap((b) => (b.kind === "boards" ? b.boardIds : [])))
              );

              return toBundle(
                boards.filter((b) => referenced.has(b.id)),
                inSubtree
              );
            }}
            filename={bundleFilename(selectedNote.title)}
          >
            <MenuItem onClick={() => setViewingHistory(true)}>History…</MenuItem>
            <MenuItem onClick={() => navigate(notePrintRoute(activeSpace, allTeams, selectedNote))}>Print…</MenuItem>
            {selectedNote.capability === "owner" && (
              <>
                <MenuSeparator />
                <MenuItem onClick={() => setManagingNoteAccess(true)}>Manage access…</MenuItem>
                <MenuItem onClick={() => void removeNote(selectedNote.id)}>
                  <span className="text-danger">Delete note…</span>
                </MenuItem>
              </>
            )}
          </ExportMenu>
        }
      />
    );
  } else if (route.kind === "library" || route.kind === "note") {
    content = (
      <Library
        boards={boards}
        onOpen={(id) => navigate(boardRoute(activeSpace, allTeams, id, false))}
        onNew={newBoard}
        canEdit={canEdit}
        menu={
          <ExportMenu
            label="Library actions"
            bundle={() => toBundle(boards, notes.notes)}
            filename={bundleFilename(spaceName)}
          >
            {activeSpace.kind === "team" && canEdit && (
              <MenuItem className="gap-2" onClick={() => navigate(teamRoute(activeSpace.teamId, allTeams))}>
                <Settings size={15} aria-hidden="true" />
                Manage team…
              </MenuItem>
            )}
            {canEdit && <MenuItem onClick={() => setImporting(true)}>Import JSON…</MenuItem>}
            {import.meta.env.DEV && (
              <MenuItem onClick={() => (window.location.hash = "#/preview")}>Draft preview…</MenuItem>
            )}
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
      notes={notes.notes}
      selection={selection}
      onSelectNote={closing(selectNote)}
      onNewNote={closing(() => createNote(null))}
      onReorderNote={notes.reorderNote}
      onNestNote={notes.reparentNote}
      canEdit={canEdit}
      isAdmin={workspace.isAdmin}
      adminActive={route.kind === "admin"}
      onOpenAdmin={closing(() => navigate({ kind: "admin", sub: "teams" }))}
    />
  );

  const topBar = (
    <TopBar
      crumbs={breadcrumbs(route, allTeams, notes.notes, boards)}
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
        {(boardsError || notes.error) && (
          <p className="mb-3 w-full max-w-[1320px] text-sm text-danger">{boardsError ?? notes.error}</p>
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
        <ImportDialog open={importing} onOpenChange={setImporting} notes={notes.notes} onImport={importBundle} />
      )}
      {openBoard && canEditBoard(openBoard) && (
        <ReplaceBoardDialog open={replacing} onOpenChange={setReplacing} board={openBoard} onReplace={updateBoard} />
      )}
      {openBoard && (
        <AccessManager
          open={managingAccess}
          onOpenChange={setManagingAccess}
          board={openBoard}
          coachedTeams={targetTeams}
          memberTeams={teams}
          teamName={(teamId) => allTeams.find((t) => t.teamId === teamId)?.teamName ?? "a team"}
          currentUserId={user.id}
        />
      )}
      {selectedNote && (
        <NoteAccessManager
          open={managingNoteAccess}
          onOpenChange={setManagingNoteAccess}
          note={selectedNote}
          notes={notes.notes}
          coachedTeams={targetTeams}
          memberTeams={teams}
          teamName={(teamId) => allTeams.find((t) => t.teamId === teamId)?.teamName ?? "a team"}
          currentUserId={user.id}
        />
      )}
    </TooltipProvider>
  );
}
