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
  "grid grid-cols-[var(--court-w)_minmax(0,1fr)] items-start gap-[clamp(1.25rem,3vw,2.5rem)] max-court:grid-cols-[minmax(0,1fr)]";

/** Repoints the court width token at the full court, for a surface framing a board with an opponent half. */
export const COURT_FULL_WIDTH = "[--court-w:var(--court-size-full)]";

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

/** A choosable row in a picker panel: a plain button that highlights on hover and keyboard focus. */
export const PICK_ROW =
  "flex w-full items-center gap-2.5 cursor-pointer rounded-sm px-2 py-1.5 text-left font-ui text-base text-text outline-none transition-colors duration-150 ease-settle hover:bg-control-hover focus-visible:bg-control-hover";

// ---- Tables (management pages) ----------------------------------------------------------------

// One shared table look for every management page (members, teams, accounts, recovery), so all four
// render identically from existing tokens. The frame wraps the table as a panel card; the table drops
// its last row's rule so it never doubles the frame's border.

/** The bordered card a management table sits in, matching the panel surface. */
export const TABLE_FRAME = "overflow-x-auto rounded-xl border border-border bg-panel";

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
/** The remove shortcut inside an editable chip, revealed on hover/focus. It is a mouse affordance: at
    26px it sits well inside one fingertip of the select target beside it, so a coarse pointer drops it
    and removes the current step from the strip's trailing action instead. */
export const STEP_REMOVE =
  "mr-1 grid size-6.5 flex-none place-items-center rounded-md text-text-dim opacity-0 outline-none transition-[opacity,color,background-color] duration-150 ease-settle pointer-coarse:hidden hover:bg-control-hover hover:text-danger focus-visible:opacity-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent group-hover:opacity-100 group-focus-within:opacity-100";

// ---- Rotation slips ---------------------------------------------------------------------------

/** A slip zone that opens a player picker: the whole zone is the target, tinted on hover and focus. */
export const SLIP_ZONE_BUTTON =
  "grid h-full w-full cursor-pointer outline-none transition-colors duration-150 ease-settle hover:bg-accent-weak focus-visible:bg-accent-weak focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent";

// ---- Stats tracker ----------------------------------------------------------------------------

/** The tracker's columns: video and log on the left, the side panels on the right; stacked when narrow. */
export const TRACKER_GRID =
  "grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_var(--container-tracker-side)] lg:grid-rows-[auto_1fr]";

/** A keyboard-shortcut badge shown on the control it triggers; hidden on a touch screen. */
export const KBD =
  "inline-flex min-w-4.5 items-center justify-center rounded-xs border border-b-2 px-1 font-mono text-2xs font-semibold leading-4 transition-opacity pointer-coarse:hidden";
/** The badge's colours: on a quiet control, or on an accent-filled one. Never both (cx does not merge). */
export const KBD_QUIET = "border-border bg-control text-text-dim";
export const KBD_ON_ACCENT = "border-on-accent/40 bg-transparent text-on-accent";

/** Our side (the accent) and theirs (danger) across the tracker and the stats: scores, outcomes, ticks. */
export const US_TEXT = "text-accent";
export const THEM_TEXT = "text-danger";
/** A rally's outcome as a left rule on a log row. */
export const US_RULE = "border-l-accent";
export const THEM_RULE = "border-l-danger";

/** A soft tint for "point to us" and "point to them" choices, and the matching hover. */
export const US_TINT = "bg-accent-weak hover:bg-[color-mix(in_srgb,var(--accent)_28%,transparent)]";
export const THEM_TINT =
  "bg-[color-mix(in_srgb,var(--danger)_14%,transparent)] hover:bg-[color-mix(in_srgb,var(--danger)_24%,transparent)]";

export type ChoiceTone = "idle" | "selected" | "suggested" | "good" | "bad";

/** One pick in the stat entry grid (player, skill, result, zone), with its hotkey badge pinned right. */
export const CHOICE_BASE =
  "relative w-full cursor-pointer truncate rounded-md py-2 pr-7 pl-2 text-left font-ui text-sm font-semibold transition-colors duration-150 ease-settle focus-visible:outline-2 focus-visible:outline-accent";

export const CHOICE_TONE: Record<ChoiceTone, string> = {
  idle: "bg-control text-text hover:bg-control-hover",
  selected: "bg-accent text-on-accent",
  suggested: "bg-accent-weak text-text outline-2 outline-dashed -outline-offset-2 outline-accent",
  good: cx(US_TINT, "text-text"),
  bad: cx(THEM_TINT, "text-text"),
};

/** The step of the stat entry waiting for input. */
export const ENTRY_STEP_ACTIVE = "bg-accent-weak ring-2 ring-accent";

/** A boxed call-out in the tracker: a warning on the danger tint, or a quiet note. */
export const DANGER_TINT = "bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]";
export const CALLOUT_WARN = cx(
  "m-0 rounded-md border border-[color-mix(in_srgb,var(--danger)_40%,transparent)] px-3 py-2 text-sm text-text",
  DANGER_TINT
);
export const CALLOUT_NOTE = "m-0 rounded-md border border-border bg-control px-3 py-2 text-sm text-text-dim";

/** The net above a court diagram: a small caption over a heavy line. */
export const NET_CAPTION = "text-center font-mono text-2xs uppercase tracking-[0.22em] text-text-dim";
export const NET_LINE = "border-t-4 border-text pt-1.5";

/** The video stage: black in either theme, as a player letterboxes. */
export const VIDEO_STAGE = "relative flex aspect-video items-center justify-center overflow-hidden bg-black";
/** A placeholder line on the black video stage. */
export const VIDEO_STAGE_NOTE = "m-0 text-center text-white/60";

/** The big "point to us / them" button in the scoreboard; the US_TINT or THEM_TINT gives its side. */
export const POINT_BUTTON =
  "flex cursor-pointer items-center justify-center gap-1.5 rounded-md py-2 text-sm font-semibold text-text transition-colors duration-150 ease-settle";

/** A link out of the app, in the accent colour or its surroundings' own. */
export const LINK = { accent: "text-accent hover:underline", inherit: "text-inherit hover:underline" };

/** The fill of a lineup court spot: picked, the libero's, or any other. */
export const COURT_SPOT_TONE = {
  active: "bg-accent text-on-accent",
  libero: "bg-accent-weak text-text hover:bg-control-hover",
  idle: "bg-control text-text hover:bg-control-hover",
};

/** The rotations' shading scale: the danger colour at one end, the panel in the middle, the accent at the other. */
export const HEAT_SCALE =
  "bg-linear-to-r from-[color-mix(in_srgb,var(--danger)_45%,var(--panel))] via-panel to-[color-mix(in_srgb,var(--accent)_45%,var(--panel))]";

/** A player's spot on the lineup court: a position number pinned left, the name, active when picked. */
export const COURT_SPOT =
  "relative w-full cursor-pointer truncate rounded-md py-1.5 pr-2 pl-6 text-left text-sm font-semibold transition-colors duration-150 ease-settle";

/** A notice pinned under the top bar, with its actions at the end (the tracker's save banners). */
export const STICKY_BANNER =
  "sticky top-15 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-overlay px-4 py-2 text-sm shadow-overlay";

// ---- Stats dashboard --------------------------------------------------------------------------

/** The dashboard's card grid: as many equal columns as fit, dense packing, a wide card spanning two. */
export const DASH_GRID =
  "@container grid grid-flow-row-dense grid-cols-[repeat(auto-fill,minmax(min(100%,var(--container-dash-card)),1fr))] gap-4";
/** A card that spans two columns once two fit. */
export const DASH_WIDE = "@dash-wide:col-span-2";
/** A dashboard card: the panel surface, kept whole on paper. */
export const DASH_CARD = cx(PANEL, "min-w-0 print:break-inside-avoid");
export const DASH_CARD_TITLE = "m-0 font-display text-display-xs font-bold text-text";
/** A section heading over a group of cards, ruled off below. */
export const DASH_SECTION_TITLE = cx(PANEL_TITLE, "border-b border-border pb-1.5 print:break-after-avoid");
/** A quiet caption under a card title or beside a chart. */
export const DASH_NOTE = "m-0 text-xs text-text-dim";
/** A big figure in a card (a score, a percentage). */
export const DASH_FIGURE = "font-display text-xl font-bold leading-none tabular-nums";
/** The text drawn inside the SVG charts. */
export const CHART_TEXT = "fill-text-dim text-xs";
/** A legend swatch. */
export const SWATCH = "inline-block size-3 flex-none rounded-xs";
/** The fill of each grade level of an outcome (0–1 good, 2 neutral, 3 an error). */
export const GRADE_FILL: Record<number, string> = {
  0: "bg-chart-us text-on-accent",
  1: "bg-chart-us text-on-accent",
  2: "bg-chart-them text-text",
  3: "bg-chart-bad text-on-accent",
};
/** A stacked outcome bar and one of its segments. */
export const OUTCOME_BAR = "flex h-5.5 gap-px overflow-hidden rounded-xs";
export const OUTCOME_SEGMENT =
  "relative block min-w-0.5 cursor-pointer overflow-hidden px-0.5 text-center text-xs leading-5.5 whitespace-nowrap";
/** A court zone or rotation cell in the dashboard's diagrams; the caller sets its shape and alignment. */
export const DASH_ZONE = "relative flex min-w-0 items-center rounded-xs border border-border text-xs";
/** A compact data table's header and body cells (the rally log). */
export const DATA_HEAD_TYPE = "font-mono text-2xs font-semibold tracking-[0.16em] text-text-dim uppercase";
export const DATA_HEAD_CELL = cx(
  "sticky top-0 border-b border-border bg-overlay px-2 py-1 text-left whitespace-nowrap print:static",
  DATA_HEAD_TYPE
);
export const DATA_CELL = "border-b border-border px-2 py-1 text-xs whitespace-nowrap";
/** The floating tooltip over a chart: the overlay surface, small text. */
export const CHART_TIP = cx(
  OVERLAY_SURFACE,
  "pointer-events-none absolute flex flex-col gap-0.5 px-2 py-1 text-xs whitespace-nowrap text-text"
);
/** A name column, a bar, and two figures: the player rows of the detail and playing-time panels. */
export const DASH_ROWS =
  "grid grid-cols-[minmax(var(--container-dash-name),max-content)_1fr_auto_auto] items-center gap-x-4 gap-y-1.5 text-xs";
/** The panel surface with its content flush to the sides and bottom, for a list that runs edge to edge. */
export const PANEL_FLUSH = "flex flex-col gap-[0.9rem] rounded-xl border border-border bg-panel pt-[1.1rem]";
/** The panel surface around a video, which runs to its edges. */
export const VIDEO_PANEL = "flex flex-col gap-[0.9rem] overflow-hidden rounded-xl border border-border bg-panel";
/** A panel's own side padding, for the parts of a flush panel that keep it. */
export const PANEL_PAD_X = "px-[1.15rem]";

/** A small figure tile (a set's score). */
export const DASH_TILE = "flex flex-col gap-1 rounded-lg border border-border bg-panel p-2";
/** A row that picks a player in the player grid. */
export const DASH_ROW_PICK =
  "cursor-pointer rounded-xs border-0 bg-transparent px-2 py-1 text-left whitespace-nowrap text-text hover:bg-control-hover aria-pressed:bg-accent aria-pressed:text-on-accent print:px-1 print:py-0.5";

// ---- Highlights -------------------------------------------------------------------------------

/**
 * The highlights layout, rearranged by the view's own width: narrow, the video, then the filters, then the
 * clips in one column; from hl-medium the filters sit left of the video with the clips under it; from hl-wide
 * the clips take a third column. --hl-reserve is the height kept under the video for its controls.
 */
export const HL_GRID =
  "grid grid-cols-1 items-start gap-4 [--hl-reserve:12rem] @hl-medium:grid-cols-[var(--container-hl-filters)_minmax(0,1fr)] @hl-medium:grid-rows-[auto_auto] @hl-medium:[--hl-reserve:24rem] @hl-wide:grid-cols-[var(--container-hl-filters)_minmax(0,1fr)_minmax(var(--container-hl-clips-min),var(--container-hl-clips))] @hl-wide:[--hl-reserve:10rem]";
export const HL_FILTERS =
  "order-2 flex flex-col gap-3 rounded-xl border border-border bg-panel p-4 @hl-medium:order-1 @hl-medium:row-span-2 @hl-wide:row-span-1";
export const HL_VIDEO = "order-1 flex flex-col gap-2 @hl-medium:order-2";
/** The video, its caption, and its controls share one width, no taller than the screen allows. */
export const HL_VIDEO_WIDTH = "mx-auto w-[min(100%,calc((100dvh-var(--hl-reserve))*16/9))]";
export const HL_CLIPS = "order-3 flex min-h-0 flex-col";
/** The highlights' pane on the stats page. */
export const HL_PANE = "@container";
export const HL_LIST = "max-h-[60vh] overflow-auto";

// ---- Set report -------------------------------------------------------------------------------

/** A document's own heading inside a page (the report's match), a step below the page title. */
export const DASH_HEADING = "m-0 font-display text-display-md font-bold leading-tight text-text";
/** The off-screen A4 sheet each report section is laid out on to be captured for the PDF. */
export const REPORT_SHEET = "fixed top-0 right-full w-a4 bg-white p-5 font-ui text-text";
