// The single source of truth for control styling: shared Tailwind class strings the src/ui wrappers
// compose. Nothing outside src/ui defines control styling, so every button, input, and overlay looks
// identical because it is built from these strings.

/** Join truthy class fragments. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// ---- Buttons ----------------------------------------------------------------------------------

export type ButtonVariant = "primary" | "ghost" | "text" | "danger" | "danger-strong" | "danger-solid" | "dashed";
export type ButtonSize = "sm" | "md";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 cursor-pointer font-semibold whitespace-nowrap transition-[filter,color,background-color,border-color,transform] duration-150 ease-settle disabled:cursor-default disabled:opacity-40";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "flex-none border-0 bg-accent text-on-accent hover:brightness-[1.08] active:scale-[0.97]",
  ghost: "border border-border bg-control text-text hover:bg-control-hover active:scale-[0.98]",
  text: "border-0 bg-transparent text-text-dim hover:text-text hover:bg-control",
  danger:
    "border-0 bg-transparent text-text-dim hover:text-danger hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]",
  "danger-strong":
    "border border-danger bg-transparent text-danger hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] active:scale-[0.98]",
  "danger-solid": "flex-none border-0 bg-danger text-on-accent hover:brightness-[1.08] active:scale-[0.97]",
  dashed:
    "border border-dashed border-border bg-transparent text-text-dim hover:text-text hover:border-[color-mix(in_srgb,var(--accent)_55%,var(--border))]",
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "text-sm px-2 py-1 rounded-sm",
  md: "text-base px-4.5 py-2 rounded-md",
};

// A lone ghost/text/dashed reads a touch smaller than a prominent button at the same size, one scale
// step below it. A quiet button `paired` with a prominent one in an action row instead takes the full
// size, so the two align on height, font, and radius; only its quiet chrome (transparent/bordered, dim)
// sets it apart. The prominent variants below keep the full size regardless.
const BUTTON_SIZE_QUIET: Record<ButtonSize, string> = {
  sm: "text-xs px-2 py-1 rounded-sm",
  md: "text-sm px-2.5 py-1.5 rounded-md",
};

// The full-size variants: a fill or a strong border carries the action, so they never drop a size step.
const FULL_SIZE_VARIANTS = new Set<ButtonVariant>(["primary", "danger-strong", "danger-solid"]);

export function buttonClass(variant: ButtonVariant, size: ButtonSize, paired = false): string {
  const sizing = paired || FULL_SIZE_VARIANTS.has(variant) ? BUTTON_SIZE[size] : BUTTON_SIZE_QUIET[size];

  return cx(BUTTON_BASE, BUTTON_VARIANT[variant], sizing);
}

// ---- Icon buttons -----------------------------------------------------------------------------

export type IconButtonVariant = "control" | "accent" | "plain";
export type IconButtonSize = "xs" | "sm" | "md" | "lg";

const ICON_BASE =
  "inline-grid place-items-center cursor-pointer transition-[background-color,filter,transform,opacity,color] duration-200 ease-settle disabled:cursor-default disabled:opacity-40";

const ICON_VARIANT: Record<IconButtonVariant, string> = {
  control:
    "border border-border bg-control text-text hover:not-disabled:bg-control-hover active:not-disabled:scale-[0.93]",
  accent:
    "border border-transparent bg-accent text-on-accent hover:not-disabled:brightness-[1.08] active:not-disabled:scale-[0.93]",
  plain: "border-0 bg-transparent text-text-dim hover:not-disabled:bg-control-hover hover:not-disabled:text-text",
};

const ICON_SIZE: Record<IconButtonSize, string> = {
  xs: "h-5.5 w-5 rounded-xs text-sm",
  sm: "size-7.5 rounded-sm text-lg",
  md: "size-10 rounded-lg",
  lg: "size-13 rounded-xl",
};

export function iconButtonClass(variant: IconButtonVariant, size: IconButtonSize): string {
  return cx(ICON_BASE, ICON_VARIANT[variant], ICON_SIZE[size]);
}

// ---- Toggles ----------------------------------------------------------------------------------

/** A pill toggle: quiet by default, accent-tinted when pressed. Shared by the wrapped tag filter and
    the standalone Toggle control. */
export const TOGGLE_PILL =
  "inline-flex items-center gap-1.5 cursor-pointer rounded-pill border border-border bg-control px-2.5 py-1 font-ui text-sm font-semibold text-text-dim transition-colors duration-150 ease-settle hover:bg-control-hover hover:text-text data-[pressed]:border-[color-mix(in_srgb,var(--accent)_45%,transparent)] data-[pressed]:bg-accent-weak data-[pressed]:text-text";

// ---- Panels, fields, overlays -----------------------------------------------------------------

/** The bordered card the inspector, description, tag editor, and note picker share. */
export const PANEL =
  "flex flex-col gap-[0.9rem] rounded-xl border border-border bg-panel pt-[1.1rem] px-[1.15rem] pb-[1.25rem]";

/** A small uppercase mono caption, used as a panel title and section heading. */
export const PANEL_TITLE = "m-0 font-mono text-xs font-medium uppercase tracking-[0.22em] text-text-dim";

/** The field label above an input, smaller than a panel title. */
export const FIELD_LABEL = "font-mono text-2xs font-medium uppercase tracking-[0.16em] text-text-dim";

/** Quiet italic placeholder copy (empty states). */
export const MUTED = "m-0 italic text-text-dim";

/** A tag chip, shared by the tag input's removable chips and the board view's read-only tags. */
export const TAG_CHIP =
  "inline-flex items-center gap-1 rounded-pill border border-border bg-control px-2 py-0.5 text-xs font-semibold text-text";

/** The spaced mono uppercase eyebrow above a title. */
export const EYEBROW = "m-0 mb-[0.4rem] font-mono text-xs font-medium uppercase tracking-[0.28em] text-text-dim";

/** The large display title shared by the board view, library, and note pages. */
export const TITLE = "m-0 font-display text-[clamp(1.7rem,3.5vw,2.6rem)] font-bold leading-[1.05] tracking-[-0.025em]";

/** The full-width, max-width fragment every page-width surface shares (board view/editor, notes, history). */
export const PAGE_WIDTH = "w-full max-w-[var(--shell-max)]";

/** The board view's court-beside-detail grid: court column then a flexible panel, stacked at the court breakpoint. */
export const VIEW_BODY =
  "grid grid-cols-[var(--court-size)_minmax(0,1fr)] items-start gap-[clamp(1.25rem,3vw,2.5rem)] max-court:grid-cols-[minmax(0,1fr)]";

/** The centred, max-width column the library and note pages share. */
export const PAGE = cx(
  "mx-auto flex",
  PAGE_WIDTH,
  "flex-col gap-[clamp(1rem,3vh,1.6rem)] animate-rise motion-reduce:animate-none"
);

/** The title-and-actions bar atop a page. */
export const PAGE_BAR = "flex flex-wrap items-end justify-between gap-4 max-[760px]:items-start";

/** Box input / textarea chrome. */
export const INPUT =
  "w-full border border-border bg-control text-text rounded-md transition-[border-color,background-color] duration-150 ease-settle focus:outline-none focus:border-accent focus:bg-control-hover placeholder:text-text-dim";

/** The floating overlay surface (border, fill, shadow) without padding, so a caller can set its own. It
    rides the dedicated elevated `overlay` token, the lightest layer, so every popup reads as lifted. */
export const OVERLAY_SURFACE = "z-20 rounded-lg border border-border bg-overlay shadow-overlay outline-none";

/** The dimming scrim behind a modal (the centred dialogs and the side panel), fading with the overlay. */
export const BACKDROP =
  "fixed inset-0 z-40 bg-black/40 transition-opacity duration-150 ease-settle data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none";

/** A floating overlay surface for menus, listboxes, and combobox popups. */
export const OVERLAY = cx(OVERLAY_SURFACE, "p-1");

/** Restrained enter/exit for overlays, on the shared settle easing; honours reduced motion. */
export const OVERLAY_MOTION =
  "origin-[var(--transform-origin)] transition-[opacity,transform] duration-[140ms] ease-settle data-[starting-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[ending-style]:scale-[0.98] motion-reduce:transition-none";

/** A highlightable row inside an overlay (menu item, listbox option). */
export const OVERLAY_ITEM =
  "flex w-full items-center cursor-default select-none rounded-sm px-2 py-1.5 text-left font-ui text-base font-semibold text-text outline-none data-[highlighted]:bg-control-hover data-[selected]:bg-control-hover";

// ---- Tables (management pages) ----------------------------------------------------------------

// One shared table look for every management page (members, teams, accounts, recovery), so all four
// render identically from existing tokens. The frame wraps the table as a panel card; the table drops
// its last row's rule so it never doubles the frame's border.

/** The bordered card a management table sits in, matching the panel surface. */
export const TABLE_FRAME = "overflow-hidden rounded-xl border border-border bg-panel";

/** The table element: full width, with the last body row's rule removed. */
export const TABLE = "w-full border-collapse text-left text-base [&_tbody_tr:last-child_td]:border-0";

/** A header cell: a quiet mono caption per column. */
export const TABLE_HEAD_CELL =
  "border-b border-border px-4 py-2.5 font-mono text-2xs font-semibold uppercase tracking-[0.16em] text-text-dim";

/** A body cell, ruled off from the next row. */
export const TABLE_CELL = "border-b border-border px-4 py-3 align-middle";

// ---- Swatches and domain composites -----------------------------------------------------------

/** The swatch disc's box, shared by the inspector's swatch pickers and the palette legend. Marker
    swatches fill it with court SVG art; SWATCH_FLAT adds the plain CSS disc for ink-colour chips. */
export const SWATCH_BASE = "grid size-7.5 flex-none place-items-center rounded-full";

/** The flat coloured-disc look for swatches that show an ink colour rather than a marker. */
export const SWATCH_FLAT = "border-2 font-mono text-2xs font-bold";

/** The palette's "add a marker" pill: a ghost pill carrying a leading role swatch and the role name. */
export const LEGEND_BUTTON =
  "inline-flex cursor-pointer items-center gap-2 rounded-pill border border-border bg-control py-1 pr-3 pl-1.5 text-text transition-[background-color,transform] duration-150 ease-settle hover:bg-control-hover active:scale-[0.96]";

/** One step chip in the step strip: a bordered segment holding the step number and, when editable, a
    remove control. The fill and border colour come from the active/inactive variant below, never here,
    so the two never both set a background (cx concatenates, it does not merge). The `group` lets the
    remove reveal on hover/focus-within; `relative` anchors the drag lift above its neighbours. */
export const STEP_CHIP =
  "group relative inline-flex select-none items-center rounded-lg border transition-[border-color,background-color,box-shadow] duration-150 ease-settle";
/** An inactive step chip: the quiet control fill and default border. */
export const STEP_CHIP_OFF = "border-border bg-control";
/** The active step chip: a solid accent fill, so the current step reads at a glance on any background
    (the faint tint did not). Its number switches to on-accent for contrast in StepStrip. */
export const STEP_CHIP_ON = "border-transparent bg-accent shadow-sm";
/** A chip lifted mid-drag: raised above its neighbours with the overlay cast and an accent edge. */
export const STEP_CHIP_DRAGGING = "z-10 border-accent shadow-overlay";
/** The step-number button inside a chip — the scrub target and the pointer drag handle. The text colour
    comes from the active/inactive branch in StepStrip, not here, for the same no-merge reason. */
export const STEP_NUM =
  "min-w-9 rounded-md border-0 bg-transparent px-2.5 py-2 font-mono text-sm font-semibold outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent";
/** The remove control inside an editable chip: a comfortable target that reveals on hover/focus. A coarse
    pointer has no hover, so it stays visible there rather than lurking invisibly over half the chip. */
export const STEP_REMOVE =
  "mr-1 grid size-6.5 flex-none place-items-center rounded-md text-text-dim opacity-0 outline-none transition-[opacity,color,background-color] duration-150 ease-settle pointer-coarse:opacity-100 hover:bg-control-hover hover:text-danger focus-visible:opacity-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent group-hover:opacity-100 group-focus-within:opacity-100";
