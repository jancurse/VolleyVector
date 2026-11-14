export type Team = "us" | "them";

export type Skill = "serve" | "receive" | "set" | "attack" | "block" | "defense" | "freeball" | "misc";

/** A single ball contact by one of our players. */
export type Touch = {
  kind: "touch";
  id: number;
  timestamp: number;
  player: string;
  stat: Skill;
  result: string;
  zone: string;
  /** Optional detail for some results, e.g. a defense error due to positioning. */
  reason?: string;
};

/**
 * A manually recorded rally end. Rarely needed, since rally winners are
 * inferred from who serves next; used for untouched aces, the last rally of a
 * set, or to note why a rally ended (e.g. opponent attack error).
 */
export type PointEvent = {
  kind: "point";
  id: number;
  timestamp: number;
  winner: Team;
  /** Why the rally ended, from POINT_REASONS (e.g. opponent serve error). */
  reason?: string;
  note?: string;
};

/** A substitution: `in` takes over the court position (or libero role) held by `out`. */
export type SubEvent = {
  kind: "sub";
  id: number;
  timestamp: number;
  out: string;
  in: string;
};

export type MatchEvent = Touch | PointEvent | SubEvent;

/** Who is on court during a rally. */
export type Court = {
  /** Players by court position: index 0 is position 1 (the server), index 5 is position 6. */
  positions: string[];
  libero: string;
};

export type MatchMeta = {
  setNumber: string;
  homeTeam: string;
  awayTeam: string;
  date: string;
  youtubeUrl: string;
  /** Who served the first rally; inferred from the first touch when null. */
  firstServe: Team | null;
  /** Our rotation (1-6) at the start of the set. */
  startRotation: number;
  /** Starting lineup by court position (index 0 = position 1); empty when not set. */
  lineup: string[];
  libero: string;
};

export type Rally = {
  index: number;
  startTime: number;
  endTime: number;
  serving: Team | null;
  /** Our rotation during this rally. */
  rotation: number;
  touches: Touch[];
  winner: Team | null;
  /** The event that decided the rally, if any. */
  endedBy: MatchEvent | null;
  /** Winner deduced from who served next, rather than recorded. */
  inferred: boolean;
  /** Our players on court, when a starting lineup is set. */
  court: Court | null;
  /** Substitutions made before or during this rally. */
  subs: SubEvent[];
  /** Score after this rally (before it, if the rally is still open). */
  score: { us: number; them: number };
};

export type AppData = {
  version: 2;
  players: string[];
  events: MatchEvent[];
  meta: MatchMeta;
};

/** One set's worth of data for the stats: its meta and derived rallies. A match has several. */
export type ReportSet = {
  meta: MatchMeta;
  rallies: Rally[];
};

/** A recorded set as the games list shows it: its score and video, without the event data. */
export type SetSummary = {
  id: string;
  gameId: string;
  setNumber: number;
  us: number;
  them: number;
  videoUrl: string;
  touches: number;
  finished: boolean;
  updatedAt: string;
  /** Who saved it last: their display name, empty when unknown. */
  updatedBy: string;
};
