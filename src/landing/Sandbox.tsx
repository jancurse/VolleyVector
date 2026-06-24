import { useMemo, useState } from "react";
import type { JSX } from "react";
import { Moon, Sun } from "lucide-react";

import { createBoard } from "../boards/operations";
import type { Board } from "../boards/types";
import { BoardEditor } from "../editor/BoardEditor";
import { BoardView } from "../editor/BoardView";
import { ExportMenu } from "../bundle/ExportMenu";
import { bundleFilename, toBundle } from "../bundle/serialize";
import { LibraryCard } from "../library/LibraryCard";
import { boardToItem } from "../library/items";
import { BoardPrint } from "../print/BoardPrint";
import { PrintView } from "../print/PrintView";
import type { Theme, ThemePreference } from "../theme/useTheme";
import { BrandLockup } from "../shell/BrandMark";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { MenuItem } from "../ui/Menu";
import { TooltipProvider } from "../ui/Tooltip";
import { cx, EYEBROW, TITLE } from "../ui/styles";
import { DEMO_BOARD } from "./demoBoard";

// The no-account "Try it" sandbox, reached from the landing hero and addressable at #/try. A logged-out
// visitor builds a real board with the same view/edit surfaces as the app, entirely in memory: editing and
// committing update local state only, and nothing is ever read from or written to Supabase. Export matches
// the in-app board actions (Copy/Download JSON and Print). Because the print route resolves a board by id
// from the loaded library, the sandbox renders its transient board straight through PrintView/BoardPrint.

const BG = "flex min-h-[100dvh] flex-col [background:var(--app-backdrop)]";

const SHELL = "mx-auto w-full max-w-[var(--shell-max)] px-[clamp(1.1rem,4vw,2.75rem)]";

type Mode = "view" | "edit" | "print";

export function Sandbox({
  theme,
  onSetTheme,
  onExit,
}: {
  theme: Theme;
  onSetTheme: (preference: ThemePreference) => void;
  onExit: () => void;
}): JSX.Element {
  // Null board is the start chooser; once chosen, the board lives here and the mode picks the surface.
  const [board, setBoard] = useState<Board | null>(null);
  const [mode, setMode] = useState<Mode>("view");

  const start = (next: Board) => {
    setBoard(next);
    setMode("view");
  };

  // The two start options, shown as the real library card so they track the live boards. Memoized so each
  // card keeps a stable identity across renders; the blank's timestamps are cosmetic here and never shown.
  const sample = useMemo((): Board => ({ ...DEMO_BOARD, capability: "owner" }), []);
  const blank = useMemo(() => createBoard(0), []);

  // Print is a chrome-free, full-screen surface (it forces the light theme), so it replaces the sandbox
  // shell entirely while it is up — exactly as the app's print route does.
  if (board && mode === "print") {
    return (
      <PrintView title={board.title || "Untitled board"} onBack={() => setMode("view")}>
        <BoardPrint board={board} />
      </PrintView>
    );
  }

  return (
    <TooltipProvider>
      <div className={BG}>
        <header className="sticky top-0 z-30 border-b border-border bg-[color-mix(in_srgb,var(--bg)_78%,transparent)] backdrop-blur-md">
          <div className={cx(SHELL, "flex items-center justify-between gap-3 py-3.5")}>
            <div className="flex items-center gap-3">
              <BrandLockup size={22} />
              <span className="font-mono text-2xs font-medium uppercase tracking-[0.18em] text-text-dim">Sandbox</span>
            </div>
            <div className="flex items-center gap-1.5">
              <IconButton
                variant="plain"
                size="sm"
                aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                onClick={() => onSetTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
              </IconButton>
              <Button variant="ghost" onClick={onExit}>
                Exit
              </Button>
            </div>
          </div>
        </header>

        <main className={cx(SHELL, "flex-1 py-[clamp(1.5rem,4vh,3rem)]")}>
          {board === null ? (
            <div className="mx-auto flex max-w-[44rem] flex-col items-center gap-8 py-[clamp(2rem,8vh,5rem)] text-center">
              <div className="flex flex-col items-center gap-3">
                <p className={EYEBROW}>Try it</p>
                <h1 className={TITLE}>Build a board</h1>
                <p className="m-0 max-w-[32rem] text-lg leading-relaxed text-text-dim">
                  No account, nothing saved. Start from a sample play, or a blank court.
                </p>
              </div>
              <div className="grid w-full grid-cols-1 gap-4 text-left sm:grid-cols-2">
                <LibraryCard item={boardToItem(sample)} onOpen={() => start(sample)} />
                <LibraryCard item={boardToItem(blank)} onOpen={() => start(blank)} />
              </div>
            </div>
          ) : mode === "edit" ? (
            <BoardEditor
              board={board}
              onDone={async (updated) => {
                setBoard(updated);
                setMode("view");

                return null;
              }}
              onCancel={() => setMode("view")}
            />
          ) : (
            <BoardView
              board={board}
              backLabel="← Start over"
              onBack={() => setBoard(null)}
              actions={
                <>
                  <ExportMenu
                    label="Board actions"
                    bundle={() => toBundle([board], [])}
                    filename={bundleFilename(board.title || "board")}
                  >
                    <MenuItem onClick={() => setMode("print")}>Print…</MenuItem>
                  </ExportMenu>
                  <Button variant="primary" onClick={() => setMode("edit")}>
                    Edit
                  </Button>
                </>
              }
            />
          )}
        </main>
      </div>
    </TooltipProvider>
  );
}
