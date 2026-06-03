import { useState } from "react";
import type { JSX } from "react";

import { TacticEditor } from "./editor/TacticEditor";
import { TacticList } from "./editor/TacticList";
import { TacticView } from "./editor/TacticView";
import { createTactic } from "./tactics/operations";
import type { Tactic } from "./tactics/types";
import { useTactics } from "./tactics/useTactics";
import { useTheme } from "./theme/useTheme";
import { ThemeToggle } from "./ui/ThemeToggle";

export function App(): JSX.Element {
  const [theme, toggleTheme] = useTheme();
  const { tactics, addTactic, deleteTactic, updateTactic } = useTactics();
  const [currentId, setCurrentId] = useState<string>(() => tactics[0]?.id ?? "");
  // The tactic being edited (a draft committed on Done); null means we are viewing, not editing.
  const [draft, setDraft] = useState<Tactic | null>(null);

  const current = tactics.find((t) => t.id === currentId) ?? tactics[0] ?? null;
  const isExisting = draft !== null && tactics.some((t) => t.id === draft.id);

  const commit = (updated: Tactic) => {
    if (tactics.some((t) => t.id === updated.id)) updateTactic(updated.id, () => updated);
    else addTactic(updated);

    setCurrentId(updated.id);
    setDraft(null);
  };

  const remove = (id: string) => {
    if (!window.confirm("Delete this tactic? This cannot be undone.")) return;

    deleteTactic(id);
    setCurrentId(tactics.find((t) => t.id !== id)?.id ?? "");
    setDraft(null);
  };

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

      {draft ? (
        <main className="vc-stage">
          <TacticEditor
            key={draft.id}
            tactic={draft}
            onDone={commit}
            onCancel={() => setDraft(null)}
            onDelete={isExisting ? () => remove(draft.id) : undefined}
          />
        </main>
      ) : (
        <main className="vc-workspace">
          <TacticList
            tactics={tactics}
            currentId={current?.id ?? ""}
            onSelect={setCurrentId}
            onCreate={() => setDraft(createTactic(Date.now()))}
          />
          {current ? (
            <TacticView tactic={current} onEdit={() => setDraft(current)} />
          ) : (
            <div className="vc-empty">
              <p>No tactics yet.</p>
              <button type="button" className="vc-new" onClick={() => setDraft(createTactic(Date.now()))}>
                + New tactic
              </button>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
