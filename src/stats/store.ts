import type { AppData, MatchEvent, MatchMeta } from "./types";

const HISTORY_LIMIT = 200;

export const today = () => new Date().toISOString().split("T")[0]!;

export const emptyMeta = (): MatchMeta => ({
  setNumber: "",
  homeTeam: "",
  awayTeam: "",
  date: today(),
  youtubeUrl: "",
  firstServe: null,
  startRotation: 1,
  lineup: [],
  libero: "",
});

export const emptyData = (players: string[] = []): AppData => ({
  version: 2,
  players,
  events: [],
  meta: emptyMeta(),
});

// ---------------------------------------------------------------------------
// Import

function uniquePlayers(events: MatchEvent[], players: string[] = []): string[] {
  const all = [...players];

  for (const e of events) {
    if (e.kind === "touch" && e.player && !all.includes(e.player)) all.push(e.player);
  }

  return all;
}

const EVENT_KINDS = new Set(["touch", "point", "sub"]);

/** Whether a value from a file has what every event needs: a kind, and a numeric id and time. */
function isEvent(value: unknown): value is MatchEvent {
  const e = value as Partial<MatchEvent> | null;

  return !!e && EVENT_KINDS.has(e.kind ?? "") && typeof e.id === "number" && typeof e.timestamp === "number";
}

/** Parse an exported set file. */
export function parseImport(raw: unknown): AppData {
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const meta: MatchMeta = { ...emptyMeta() };
    const m = (obj.metadata ?? obj.meta ?? {}) as Record<string, unknown>;

    for (const key of ["setNumber", "homeTeam", "awayTeam", "date", "youtubeUrl"] as const) {
      const value = m[key];

      if (typeof value === "string") meta[key] = value;
    }
    if (m.firstServe === "us" || m.firstServe === "them") meta.firstServe = m.firstServe;
    if (typeof m.startRotation === "number") meta.startRotation = m.startRotation;
    if (Array.isArray(m.lineup) && m.lineup.length === 6) meta.lineup = m.lineup.map(String);

    if (typeof m.libero === "string") meta.libero = m.libero;

    if (obj.version === 2 && Array.isArray(obj.events) && obj.events.every(isEvent)) {
      const events = obj.events;
      const players = Array.isArray(obj.players) ? (obj.players as string[]) : [];

      return { version: 2, players: uniquePlayers(events, players), events, meta };
    }
  }
  throw new Error("Unrecognised file: expected a volleyball stats export");
}

/** A fresh set following `data`: same match, video, starters and (optionally) players. */
export function nextSetData(data: AppData, keepPlayers = true): AppData {
  const next = emptyData(keepPlayers ? data.players : []);
  const setNum = parseInt(data.meta.setNumber, 10);

  next.meta = {
    ...next.meta,
    homeTeam: data.meta.homeTeam,
    awayTeam: data.meta.awayTeam,
    date: data.meta.date,
    youtubeUrl: data.meta.youtubeUrl,
    // Usually the same starters next set; easy to change if not.
    lineup: data.meta.lineup,
    libero: data.meta.libero,
    setNumber: Number.isFinite(setNum) ? String(setNum + 1) : "",
  };

  return next;
}

// ---------------------------------------------------------------------------
// Reducer with undo/redo

export type State = {
  data: AppData;
  past: AppData[];
  future: AppData[];
};

export type Action =
  | { type: "addEvent"; event: MatchEvent }
  | { type: "updateEvent"; event: MatchEvent }
  | { type: "deleteEvent"; id: number }
  | { type: "addPlayer"; name: string }
  | { type: "removePlayer"; name: string }
  | { type: "movePlayer"; name: string; delta: number }
  | { type: "setMeta"; meta: Partial<MatchMeta> }
  | { type: "setLineup"; lineup: string[]; libero: string }
  | { type: "replace"; data: AppData }
  | { type: "newSet"; keepPlayers: boolean }
  | { type: "undo" }
  | { type: "redo" };

export const initState = (data: AppData): State => ({ data, past: [], future: [] });

function apply(data: AppData, action: Action): AppData | null {
  switch (action.type) {
    case "addEvent":
      return { ...data, events: [...data.events, action.event] };
    case "updateEvent":
      return {
        ...data,
        events: data.events.map((e) => (e.id === action.event.id ? action.event : e)),
      };
    case "deleteEvent":
      return { ...data, events: data.events.filter((e) => e.id !== action.id) };
    case "addPlayer": {
      const name = action.name.trim();

      if (!name || data.players.includes(name)) return null;

      return { ...data, players: [...data.players, name] };
    }
    case "removePlayer":
      return { ...data, players: data.players.filter((p) => p !== action.name) };
    case "movePlayer": {
      const players = [...data.players];
      const from = players.indexOf(action.name);
      const to = from + action.delta;

      if (from < 0 || to < 0 || to >= players.length) return null;
      players.splice(from, 1);
      players.splice(to, 0, action.name);

      return { ...data, players };
    }
    case "setMeta":
      return { ...data, meta: { ...data.meta, ...action.meta } };
    case "setLineup":
      return { ...data, meta: { ...data.meta, lineup: action.lineup, libero: action.libero } };
    case "replace":
      return action.data;
    case "newSet":
      return nextSetData(data, action.keepPlayers);
    default:
      return null;
  }
}

export function reducer(state: State, action: Action): State {
  if (action.type === "undo") {
    const prev = state.past[state.past.length - 1];

    if (!prev) return state;

    return { data: prev, past: state.past.slice(0, -1), future: [state.data, ...state.future] };
  }
  if (action.type === "redo") {
    const [next, ...future] = state.future;

    if (!next) return state;

    return { data: next, past: [...state.past, state.data], future };
  }
  const data = apply(state.data, action);

  if (!data) return state;
  // Typing in metadata fields shouldn't flood the undo history. The edit goes into the history's sets too, so
  // undoing a stat doesn't take a set detail edited since back with it.
  if (action.type === "setMeta") {
    const edited = (d: AppData): AppData => ({ ...d, meta: { ...d.meta, ...action.meta } });

    return { data, past: state.past.map(edited), future: state.future.map(edited) };
  }

  return { data, past: [...state.past, state.data].slice(-HISTORY_LIMIT), future: [] };
}

export const newId = (events: MatchEvent[]): number => Math.max(Date.now(), ...events.map((e) => e.id + 1));
