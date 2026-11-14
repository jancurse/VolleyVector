import type { JSX } from "react";

import { Collapsible, CollapsibleCaret, CollapsiblePanel } from "../../ui/Collapsible";
import { PANEL, PANEL_TITLE } from "../../ui/styles";

const SHORTCUTS: [string, string][] = [
  ["Space", "Play / pause"],
  ["← / →", "Seek 2s (Shift: 5s)"],
  [", / .", "Step one frame"],
  ["[ / ]", "Slower / faster"],
  ["Tab", "Mark a contact while the video plays (no pause)"],
  ["Enter", "Describe marked contacts, or new stat (predicted player & skill)"],
  ["1–9, 0", "Pick player, result or zone (whichever is highlighted)"],
  ["Shift+1–9", "Change player at any step"],
  ["s r e a b d f m", "Serve, Receive, sEt, Attack, Block, Defense, Freeball, Misc"],
  ["p", "Defense error: toggle “positioning” reason (before the zone)"],
  ["Backspace", "Undo last choice in the stat"],
  ["Esc", "Cancel stat (while describing marks: skip this mark)"],
  ["+ / -", "Manual point us / them (untouched ace, last rally of the set)"],
  ["then 1–4", "Optional reason, e.g. opponent serve / attack error"],
  ["Ctrl+Z / Ctrl+Shift+Z", "Undo / redo"],
];

/** The tracker's keyboard shortcuts, folded away by default. */
export function ShortcutHelp(): JSX.Element {
  return (
    <Collapsible defaultOpen={false} className={PANEL}>
      <div className="flex items-center gap-1">
        <CollapsibleCaret label="Keyboard shortcuts" />
        <h2 className={PANEL_TITLE}>Keyboard shortcuts</h2>
      </div>
      <CollapsiblePanel>
        <table className="w-full border-collapse text-sm">
          <tbody>
            {SHORTCUTS.map(([k, d]) => (
              <tr key={k} className="border-t border-border">
                <td className="py-1 pr-3 font-mono text-xs whitespace-nowrap">{k}</td>
                <td className="py-1 text-text-dim">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CollapsiblePanel>
    </Collapsible>
  );
}
