// The guide's topic ids and titles, apart from its text: the help links and the breadcrumb name a topic without
// loading the guide.

export type GuideTopicId =
  | "basics"
  | "build"
  | "animate"
  | "draw"
  | "rotation"
  | "notes"
  | "share"
  | "keep"
  | "team"
  | "games"
  | "stats-basics"
  | "record"
  | "fix-stats"
  | "read-stats"
  | "highlights"
  | "report"
  | "import-sets"
  | "help";

export const GUIDE_TITLES: Record<GuideTopicId, string> = {
  basics: "The basics",
  build: "Build a board",
  animate: "Animate a play",
  draw: "Draw on the court",
  rotation: "Check a rotation",
  notes: "Organise with notes",
  share: "Share boards and notes",
  keep: "History, print, and export",
  team: "Set up a team",
  games: "Plan a game",
  "stats-basics": "How stats work",
  record: "Record a set",
  "fix-stats": "Check and fix a set",
  "read-stats": "Read the stats",
  highlights: "Watch highlights",
  report: "Make a match report",
  "import-sets": "Import set files",
  help: "When something goes wrong",
};

/** The title of a guide topic, or nothing for an id that is none. */
export const guideTitle = (id: string | null): string | undefined =>
  id !== null && Object.hasOwn(GUIDE_TITLES, id) ? GUIDE_TITLES[id as GuideTopicId] : undefined;
