import { useState } from "react";
import type { JSX } from "react";

import { createDrill } from "./drills/operations";
import type { Drill } from "./drills/types";
import { useDrills } from "./drills/useDrills";
import { DrillEditor } from "./editor/DrillEditor";
import { DrillList } from "./editor/DrillList";
import { DrillView } from "./editor/DrillView";
import { TacticEditor } from "./editor/TacticEditor";
import { TacticList } from "./editor/TacticList";
import { TacticView } from "./editor/TacticView";
import { createTactic } from "./tactics/operations";
import type { Tactic } from "./tactics/types";
import { useTactics } from "./tactics/useTactics";
import { useTheme } from "./theme/useTheme";
import { CollectionSwitch } from "./ui/CollectionSwitch";
import type { Collection } from "./ui/CollectionSwitch";
import { ThemeToggle } from "./ui/ThemeToggle";

export function App(): JSX.Element {
  const [theme, toggleTheme] = useTheme();
  const [collection, setCollection] = useState<Collection>("tactics");

  const { tactics, addTactic, deleteTactic, updateTactic } = useTactics();
  const [tacticId, setTacticId] = useState<string>(() => tactics[0]?.id ?? "");
  const [tacticDraft, setTacticDraft] = useState<Tactic | null>(null);

  const { drills, addDrill, deleteDrill, updateDrill } = useDrills();
  const [drillId, setDrillId] = useState<string>(() => drills[0]?.id ?? "");
  const [drillDraft, setDrillDraft] = useState<Drill | null>(null);

  const currentTactic = tactics.find((t) => t.id === tacticId) ?? tactics[0] ?? null;
  const currentDrill = drills.find((d) => d.id === drillId) ?? drills[0] ?? null;

  const commitTactic = (updated: Tactic) => {
    if (tactics.some((t) => t.id === updated.id)) updateTactic(updated.id, () => updated);
    else addTactic(updated);

    setTacticId(updated.id);
    setTacticDraft(null);
  };

  const removeTactic = (id: string) => {
    if (!window.confirm("Delete this tactic? This cannot be undone.")) return;

    deleteTactic(id);
    setTacticId(tactics.find((t) => t.id !== id)?.id ?? "");
    setTacticDraft(null);
  };

  const commitDrill = (updated: Drill) => {
    if (drills.some((d) => d.id === updated.id)) updateDrill(updated.id, () => updated);
    else addDrill(updated);

    setDrillId(updated.id);
    setDrillDraft(null);
  };

  const removeDrill = (id: string) => {
    if (!window.confirm("Delete this drill? This cannot be undone.")) return;

    deleteDrill(id);
    setDrillId(drills.find((d) => d.id !== id)?.id ?? "");
    setDrillDraft(null);
  };

  const tacticExisting = tacticDraft !== null && tactics.some((t) => t.id === tacticDraft.id);
  const drillExisting = drillDraft !== null && drills.some((d) => d.id === drillDraft.id);
  const editing = collection === "tactics" ? tacticDraft : drillDraft;

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

      {editing ? (
        <main className="vc-stage">
          {collection === "tactics"
            ? tacticDraft && (
                <TacticEditor
                  key={tacticDraft.id}
                  tactic={tacticDraft}
                  onDone={commitTactic}
                  onCancel={() => setTacticDraft(null)}
                  onDelete={tacticExisting ? () => removeTactic(tacticDraft.id) : undefined}
                />
              )
            : drillDraft && (
                <DrillEditor
                  key={drillDraft.id}
                  drill={drillDraft}
                  onDone={commitDrill}
                  onCancel={() => setDrillDraft(null)}
                  onDelete={drillExisting ? () => removeDrill(drillDraft.id) : undefined}
                />
              )}
        </main>
      ) : (
        <main className="vc-workspace">
          <div className="vc-rail">
            <CollectionSwitch value={collection} onChange={setCollection} />
            {collection === "tactics" ? (
              <TacticList
                tactics={tactics}
                currentId={currentTactic?.id ?? ""}
                onSelect={setTacticId}
                onCreate={() => setTacticDraft(createTactic(Date.now()))}
              />
            ) : (
              <DrillList
                drills={drills}
                currentId={currentDrill?.id ?? ""}
                onSelect={setDrillId}
                onCreate={() => setDrillDraft(createDrill(Date.now()))}
              />
            )}
          </div>

          {collection === "tactics" ? (
            currentTactic ? (
              <TacticView tactic={currentTactic} onEdit={() => setTacticDraft(currentTactic)} />
            ) : (
              <div className="vc-empty">
                <p>No tactics yet.</p>
                <button type="button" className="vc-new" onClick={() => setTacticDraft(createTactic(Date.now()))}>
                  + New tactic
                </button>
              </div>
            )
          ) : currentDrill ? (
            <DrillView drill={currentDrill} onEdit={() => setDrillDraft(currentDrill)} />
          ) : (
            <div className="vc-empty">
              <p>No drills yet.</p>
              <button type="button" className="vc-new" onClick={() => setDrillDraft(createDrill(Date.now()))}>
                + New drill
              </button>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
