import type { JSX } from "react";
import { ArrowUpRight, Circle, MousePointer2, Pencil, Pentagon, Slash, Square, Type, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { AnnotationTool } from "../court/types";
import { Toolbar, ToolbarButton } from "../ui/Toolbar";
import { cx } from "../ui/styles";

// The court tool picker: switch between editing markers and drawing each annotation kind. It is a
// segmented set of icon buttons (templated on MarkerPalette's row), single-select, so exactly one tool
// is active at a time. `markers` is the default and leaves the marker editing exactly as before. Each
// tool carries a single-letter hotkey, shown in its tooltip and dispatched by useEditorShortcuts.

const TOOLS: { tool: AnnotationTool; label: string; hotkey: string; Icon: LucideIcon }[] = [
  { tool: "markers", label: "Edit markers", hotkey: "M", Icon: Users },
  { tool: "select", label: "Select drawing", hotkey: "V", Icon: MousePointer2 },
  { tool: "line", label: "Draw line", hotkey: "L", Icon: Slash },
  { tool: "arrow", label: "Draw arrow", hotkey: "A", Icon: ArrowUpRight },
  { tool: "rect", label: "Draw rectangle", hotkey: "R", Icon: Square },
  { tool: "ellipse", label: "Draw ellipse", hotkey: "O", Icon: Circle },
  { tool: "polygon", label: "Draw polygon", hotkey: "G", Icon: Pentagon },
  { tool: "free", label: "Draw freehand", hotkey: "P", Icon: Pencil },
  { tool: "text", label: "Add text", hotkey: "T", Icon: Type },
];

/** The active tool per lowercase hotkey, for the editor's keyboard shortcuts. */
export const TOOL_HOTKEYS: Record<string, AnnotationTool> = Object.fromEntries(
  TOOLS.map(({ hotkey, tool }) => [hotkey.toLowerCase(), tool])
);

const GROUP = "inline-flex flex-wrap items-center gap-0.5 rounded-md border border-border bg-control p-0.5";
const TOOL =
  "grid size-9 cursor-pointer place-items-center rounded-sm border-0 transition-[color,background-color,filter] duration-150 ease-settle";
const TOOL_OFF = "bg-transparent text-text-dim hover:text-text";
// The armed tool takes the full accent fill (the app's primary-action language), unmissable at a glance.
const TOOL_ON = "bg-accent text-on-accent shadow-sm hover:brightness-[1.08]";

type AnnotationToolbarProps = {
  tool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
};

export function AnnotationToolbar({ tool, onToolChange }: AnnotationToolbarProps): JSX.Element {
  return (
    <Toolbar ariaLabel="Drawing tools" className={GROUP}>
      {TOOLS.map(({ tool: value, label, hotkey, Icon }) => (
        <ToolbarButton
          key={value}
          className={cx(TOOL, tool === value ? TOOL_ON : TOOL_OFF)}
          aria-label={label}
          aria-pressed={tool === value}
          aria-keyshortcuts={hotkey}
          tooltip={`${label} (${hotkey})`}
          onClick={() => onToolChange(value)}
        >
          <Icon size={17} aria-hidden="true" />
        </ToolbarButton>
      ))}
    </Toolbar>
  );
}
