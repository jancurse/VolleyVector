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
  ["x", "Move the entry beside the video, or under it"],
  ["Tab", "Mark a contact at the video’s time (no pause). With an entry open, the new contact takes its place"],
  ["Enter", "Open the row you jumped to. Otherwise describe the next contact from where the video is, or new stat"],
  ["↓ / ↑", "Jump to the next / previous row of the recorded stats. With an entry open, that row opens too"],
  ["< / >", "Move the open row, or the one you jumped to, 0.1 s earlier / later (Alt: half a second)"],
  ["/", "Move the open row to where the video is"],
  ["Del", "Delete the open contact, or the row you jumped to"],
  ["n", "Jump to the next rally (Shift: the one before)"],
  ["o, then s", "Detailed stats: the opponent’s serve (o again: ours after all)"],
  ["1–9, 0", "Pick player, result or zone (whichever is highlighted)"],
  ["Shift+1–9", "Change player at any step"],
  ["s r e a b d m", "Serve, Receive, sEt, Attack, Block, Defense, Misc"],
  ["h t f", "Kind of attack: Hit, Tip (detailed stats), Freeball"],
  ["h c l w", "Kind of defense (detailed stats): Hit, block Cover, free baLl, doWn ball"],
  ["p", "Defense error: toggle “positioning” reason (before the zone)"],
  ["Backspace", "Undo last choice in the stat"],
  ["Esc", "Cancel stat (a contact being described stays, for later)"],
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
