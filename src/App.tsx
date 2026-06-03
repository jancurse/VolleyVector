import { useMemo, useState } from "react";
import type { JSX } from "react";

import { createDrill } from "./drills/operations";
import type { Drill } from "./drills/types";
import { useDrills } from "./drills/useDrills";
import { DrillEditor } from "./editor/DrillEditor";
import { DrillView } from "./editor/DrillView";
import { TacticEditor } from "./editor/TacticEditor";
import { TacticView } from "./editor/TacticView";
import { Library } from "./library/Library";
import { allTags } from "./library/items";
import type { LibraryKind } from "./library/items";
import { createTactic } from "./tactics/operations";
import type { Tactic } from "./tactics/types";
import { useTactics } from "./tactics/useTactics";
import { useTheme } from "./theme/useTheme";
import { ThemeToggle } from "./ui/ThemeToggle";

// The app moves between three surfaces: the library grid (home), a read-only view of one item, and
// the editor for a working draft. A draft takes precedence over everything; otherwise an open item
// shows its view; otherwise the library. Committing or deleting a draft returns to the right surface.
type Open = { kind: LibraryKind; id: string } | null;

export function App(): JSX.Element {
  const [theme, toggleTheme] = useTheme();

  const { tactics, addTactic, deleteTactic, updateTactic } = useTactics();
  const { drills, addDrill, deleteDrill, updateDrill } = useDrills();

  const [open, setOpen] = useState<Open>(null);
  const [tacticDraft, setTacticDraft] = useState<Tactic | null>(null);
  const [drillDraft, setDrillDraft] = useState<Drill | null>(null);

  const openTactic = open?.kind === "tactic" ? (tactics.find((t) => t.id === open.id) ?? null) : null;
  const openDrill = open?.kind === "drill" ? (drills.find((d) => d.id === open.id) ?? null) : null;

  const commitTactic = (updated: Tactic) => {
    if (tactics.some((t) => t.id === updated.id)) updateTactic(updated.id, () => updated);
    else addTactic(updated);

    setTacticDraft(null);
    setOpen({ kind: "tactic", id: updated.id });
  };

  const removeTactic = (id: string) => {
    if (!window.confirm("Delete this tactic? This cannot be undone.")) return;

    deleteTactic(id);
    setTacticDraft(null);
    setOpen(null);
  };

  const commitDrill = (updated: Drill) => {
    if (drills.some((d) => d.id === updated.id)) updateDrill(updated.id, () => updated);
    else addDrill(updated);

    setDrillDraft(null);
    setOpen({ kind: "drill", id: updated.id });
  };

  const removeDrill = (id: string) => {
    if (!window.confirm("Delete this drill? This cannot be undone.")) return;

    deleteDrill(id);
    setDrillDraft(null);
    setOpen(null);
  };

  const tacticExisting = tacticDraft !== null && tactics.some((t) => t.id === tacticDraft.id);
  const drillExisting = drillDraft !== null && drills.some((d) => d.id === drillDraft.id);

  const tagSuggestions = useMemo(() => allTags(tactics, drills), [tactics, drills]);

  let main: JSX.Element;

  if (tacticDraft) {
    main = (
      <main className="vc-stage">
        <TacticEditor
          key={tacticDraft.id}
          tactic={tacticDraft}
          onDone={commitTactic}
          onCancel={() => setTacticDraft(null)}
          onDelete={tacticExisting ? () => removeTactic(tacticDraft.id) : undefined}
          tagSuggestions={tagSuggestions}
        />
      </main>
    );
  } else if (drillDraft) {
    main = (
      <main className="vc-stage">
        <DrillEditor
          key={drillDraft.id}
          drill={drillDraft}
          onDone={commitDrill}
          onCancel={() => setDrillDraft(null)}
          onDelete={drillExisting ? () => removeDrill(drillDraft.id) : undefined}
          tagSuggestions={tagSuggestions}
        />
      </main>
    );
  } else if (openTactic) {
    main = (
      <main className="vc-stage">
        <TacticView tactic={openTactic} onEdit={() => setTacticDraft(openTactic)} onBack={() => setOpen(null)} />
      </main>
    );
  } else if (openDrill) {
    main = (
      <main className="vc-stage">
        <DrillView drill={openDrill} onEdit={() => setDrillDraft(openDrill)} onBack={() => setOpen(null)} />
      </main>
    );
  } else {
    main = (
      <main className="vc-home">
        <Library
          tactics={tactics}
          drills={drills}
          onOpen={(kind, id) => setOpen({ kind, id })}
          onNewTactic={() => setTacticDraft(createTactic(Date.now()))}
          onNewDrill={() => setDrillDraft(createDrill(Date.now()))}
        />
      </main>
    );
  }

  return (
    <div className="vc-app">
      <header className="vc-header">
        <div className="vc-brand">
          <svg className="vc-logo" viewBox="0 0 24 24" width={22} height={22} aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="12" cy="15" r="2.1" fill="currentColor" />
          </svg>
          <span>VolleyCoach</span>
        </div>
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </header>

      {main}
    </div>
  );
}
