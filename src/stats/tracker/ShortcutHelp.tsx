import type { JSX } from "react";
import { Keyboard } from "lucide-react";

import { IconButton } from "../../ui/IconButton";
import { Popover } from "../../ui/Popover";

const SHORTCUTS: [string, string][] = [
  ["Space", "Play / pause"],
  ["← / →", "Seek 2s (Shift: 5s)"],
  [", / .", "Step one frame"],
  ["[ / ]", "Slower / faster"],
  ["v", "Focus mode: hide the app’s sidebar and top bar"],
  ["Tab", "Mark a contact while the video plays (no pause)"],
  ["Enter", "Describe marked contacts, or new stat (predicted player & skill)"],
  ["1–9, 0", "Pick player, result or zone (whichever is highlighted)"],
  ["Shift+1–9", "Change player at any step"],
  ["s r e a b d m", "Serve, Receive, sEt, Attack, Block, Defense, Misc"],
  ["h t f", "Kind of attack: Hit, Tip (detailed stats), Freeball"],
  ["h c l w", "Kind of defense (detailed stats): Hit, block Cover, free baLl, doWn ball"],
  ["p", "Defense error: toggle “positioning” reason (before the zone)"],
  ["Backspace", "Undo last choice in the stat"],
  ["Esc", "Cancel stat (while describing marks: skip this mark)"],
  ["+ / -", "Manual point us / them (untouched ace, last rally of the set)"],
  ["then 1–4", "Optional reason, e.g. opponent serve / attack error"],
  ["Ctrl+Z / Ctrl+Shift+Z", "Undo / redo"],
];

/** The tracker's keyboard shortcuts, behind a button in the set's bar. */
export function ShortcutHelp(): JSX.Element {
  return (
    <Popover
      ariaLabel="Keyboard shortcuts"
      align="end"
      trigger={
        <IconButton variant="plain" size="sm" aria-label="Keyboard shortcuts" tooltip={null} title="Keyboard shortcuts">
          <Keyboard size={16} aria-hidden="true" />
        </IconButton>
      }
    >
      <table className="w-full border-collapse text-sm">
        <tbody>
          {SHORTCUTS.map(([k, d]) => (
            <tr key={k} className="border-t border-border first:border-t-0">
              <td className="py-1 pr-3 font-mono text-xs whitespace-nowrap">{k}</td>
              <td className="py-1 text-text-dim">{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Popover>
  );
}
