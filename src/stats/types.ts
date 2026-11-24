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
  /** The kind of attack or defense (see TYPES), on a set recording detailed stats; absent when not recorded. */
  type?: string;
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

/** What a set with detailed stats records of the opponent: their serve. */
export type OpponentSkill = "serve";

/**
 * A touch of the opponent's. It holds only its time and skill. How they dug or blocked a ball of ours is that ball's
 * result, and no event of its own.
 */
export type OpponentTouch = {
  kind: "opponent";
  id: number;
  timestamp: number;
  stat: OpponentSkill;
};

export type MatchEvent = Touch | PointEvent | SubEvent | OpponentTouch;

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
  /** A score typed in: for a set recorded without stats, or one whose stats are incomplete. It wins over the events'. */
  score?: { us: number; them: number };
  /** Record detailed stats: the kind of each attack and defense, and how the opponent dug an attack. */
  detailed?: boolean;
  /** Which half of the court is ours, seen from the camera. A model reading the video needs it. */
  ourHalf?: "near" | "far";
  /** How far the video is stored turned from upright, clockwise in degrees; absent when upright. */
  videoTurn?: 90 | 180 | 270;
};

export type Rally = {
  index: number;
  startTime: number;
  endTime: number;
  serving: Team | null;
  /** Our rotation during this rally. */
  rotation: number;
  touches: Touch[];
  /** The opponent's recorded touches, on a set with detailed stats. */
  opponent: OpponentTouch[];
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

/** A rally of a draft: where it starts and ends in the video, and who serves it. */
export type DraftRally = { start: number; end: number; serving: Team | null };

/** A contact that has a time and still needs describing: marked by the recorder, or placed by a model. */
export type DraftContact = {
  id: number;
  time: number;
  side?: Team;
  /** A guess at the skill. */
  skill?: Exclude<Skill, "misc">;
  /** Placed by a model, not marked by the recorder. */
  model?: true;
};

/**
 * Contacts waiting to be described, and the rallies a model found. Only the tracker reads it: rallies, the score
 * and the stats come from `events` alone. It lives in the set's working copy, never in its saved stats.
 */
export type SetDraft = { rallies: DraftRally[]; contacts: DraftContact[] };

export type AppData = {
  version: 2;
  players: string[];
  events: MatchEvent[];
  meta: MatchMeta;
  draft?: SetDraft;
};

/** One set's worth of data for the stats: its meta and derived rallies. A match has several. */
export type ReportSet = {
  meta: MatchMeta;
  rallies: Rally[];
};

/** A recorded set as the games list shows it: its saved stats' score and video, without the event data. */
export type SetSummary = {
  id: string;
  gameId: string;
  setNumber: number;
  us: number;
  them: number;
  videoUrl: string;
  touches: number;
  finished: boolean;
  /** The working copy's version: it changes with every save. */
  version: number;
  /** Whether the set has saved stats, which the stats pages read. */
  statsSaved: boolean;
  /** Whether the working copy has changes its saved stats lack (always, before they are first saved). */
  unsavedStats: boolean;
  updatedAt: string;
  /** Who saved it last: their display name, empty when unknown. */
  updatedBy: string;
};
