/**
 * Tables behind the stats dashboard, worked out from loaded sets.
 *
 * `matchTables` flattens sets into one row per touch and one per finished
 * rally; the other functions aggregate those rows. Per-set rows use the set's
 * `id`; "all" rows cover every loaded set.
 */
import { matchLabel, type Selection } from "../clips";
import { pointReasonLabel, resultLabel, skillDef, touchOutcome } from "../codes";
import type { ReportSet } from "../types";
import type { Skill, Team } from "../types";
import { extractYoutubeId } from "../youtube";

export const ALL = "all";

/** A dashboard action: an app skill, except that a set sent over counts as a setter tip. */
export type Action = Skill | "tip";

export type SetInfo = {
  id: string;
  /** "Set 2", or with the match in front when several matches are loaded. */
  label: string;
  /** How the highlights player names this set's match and set. */
  match: string;
  setName: string;
  home: string;
  away: string;
  date: string;
  videoId: string | null;
};

export type TouchRow = {
  set: string;
  rally: number;
  time: number;
  player: string;
  skill: Skill;
  action: Action;
  result: string;
  grade: string;
  level: number;
  outcome: "point" | "error" | "in_play";
  zone: string;
};

export type RallyRow = {
  set: string;
  rally: number;
  start: number;
  end: number;
  serving: Team | null;
  /** Our players by court position (index 0 = position 1), when a lineup is set. */
  court: string[] | null;
  libero: string;
  winner: Team;
  scoreUs: number;
  scoreThem: number;
  touches: number;
  endKind: "touch" | "point" | "none";
  endPlayer: string;
  endSkill: Skill | "";
  endResult: string;
  endReason: string;
  endNote: string;
};

export type MatchTables = {
  sets: SetInfo[];
  touches: TouchRow[];
  rallies: RallyRow[];
};

// --- Grading -----------------------------------------------------------------

/** Outcome of each result label, from best (level 0) to worst (3). Levels 0-1 are good for us. */
const GRADES: Record<Exclude<Action, "misc">, Record<string, [string, number]>> = {
  serve: {
    Ace: ["Ace", 0],
    "Dig 0-1": ["Out of system", 1],
    "Dig 2-3": ["In system", 2],
    Out: ["Error", 3],
    Net: ["Error", 3],
  },
  receive: { "Dig 2-3": ["In system", 1], "Dig 0-1": ["Out of system", 2], Error: ["Error", 3] },
  set: { On: ["On", 1], Off: ["Off", 2], Error: ["Error", 3] },
  tip: { "Over (pt)": ["Successful", 0], "Over (def)": ["Defended", 2] },
  attack: {
    Kill: ["Kill", 0],
    "Block tool": ["Kill", 0],
    Defended: ["Defended", 2],
    "Blocked, in play": ["Defended", 2],
    "Blocked, kill": ["Blocked", 3],
    Out: ["Error", 3],
    Net: ["Error", 3],
  },
  block: { Kill: ["Kill", 0], Touch: ["Touch", 1], Tooled: ["Error", 3], Net: ["Error", 3] },
  defense: { "Dig 2-3": ["In system", 1], "Dig 0-1": ["Out of system", 2], Error: ["Error", 3] },
  freeball: {
    Point: ["Point", 0],
    "Dig 0-1": ["Out of system", 1],
    "Dig 2-3": ["In system", 2],
    Out: ["Error", 3],
    Net: ["Error", 3],
  },
};

export type ScoreDef = {
  posName: string;
  name: string;
  kind: "eff" | "pct" | "count";
  formula: string;
  pos: string[];
  neg?: string[];
};

/** The standard score per action. */
const SCORES: Partial<Record<Action, ScoreDef>> = {
  serve: {
    posName: "Aces",
    name: "Serve efficiency",
    kind: "eff",
    formula: "(aces − errors) ÷ serves",
    pos: ["Ace"],
    neg: ["Out", "Net"],
  },
  receive: {
    posName: "In system",
    name: "Positive %",
    kind: "pct",
    formula: "in system (Dig 2-3) ÷ receptions",
    pos: ["Dig 2-3"],
  },
  set: { posName: "On", name: "On %", kind: "pct", formula: "On ÷ sets", pos: ["On"] },
  tip: { posName: "Successful", name: "Success %", kind: "pct", formula: "Over (pt) ÷ tips", pos: ["Over (pt)"] },
  attack: {
    posName: "Kills",
    name: "Hitting %",
    kind: "eff",
    formula: "(kills − errors − blocked) ÷ attacks",
    pos: ["Kill", "Block tool"],
    neg: ["Out", "Net", "Blocked, kill"],
  },
  block: { posName: "Kill blocks", name: "Kill blocks", kind: "count", formula: "blocks scored", pos: ["Kill"] },
  defense: {
    posName: "In system",
    name: "Positive %",
    kind: "pct",
    formula: "in system (Dig 2-3) ÷ digs",
    pos: ["Dig 2-3"],
  },
  freeball: {
    posName: "In system",
    name: "Positive %",
    kind: "pct",
    formula: "in system (Dig 2-3) ÷ freeballs",
    pos: ["Dig 2-3"],
  },
};

export function grade(skill: Skill, result: string): { action: Action; grade: string; level: number } {
  const action: Action = skill === "set" && GRADES.tip[result] ? "tip" : skill;
  const [g, level] = (action !== "misc" && GRADES[action][result]) || [result, 2];

  return { action, grade: g, level };
}

// --- Rows --------------------------------------------------------------------

export function matchTables(loaded: ReportSet[]): MatchTables {
  const indexed = loaded.map((set, index) => ({ set, index, match: matchLabel(set) }));
  const several = new Set(indexed.map((s) => s.match)).size > 1;

  indexed.sort(
    (a, b) =>
      (several ? a.set.meta.date.localeCompare(b.set.meta.date) || a.match.localeCompare(b.match) : 0) ||
      (parseInt(a.set.meta.setNumber, 10) || 0) - (parseInt(b.set.meta.setNumber, 10) || 0) ||
      a.index - b.index
  );

  const sets: SetInfo[] = [];
  const touches: TouchRow[] = [];
  const rallies: RallyRow[] = [];

  for (const { set, index, match } of indexed) {
    const id = String(index);
    // Same naming as the highlights player, so a set links to its clips.
    const setName = `Set ${set.meta.setNumber || index + 1}`;

    sets.push({
      id,
      label: several ? `${match} · ${setName}` : setName,
      match,
      setName,
      home: set.meta.homeTeam,
      away: set.meta.awayTeam,
      date: set.meta.date,
      videoId: extractYoutubeId(set.meta.youtubeUrl),
    });
    for (const r of set.rallies) {
      for (const t of r.touches) {
        const result = resultLabel(t.stat, t.result);
        const winner = touchOutcome(t);

        touches.push({
          set: id,
          rally: r.index,
          time: t.timestamp,
          player: t.player,
          skill: t.stat,
          result,
          ...grade(t.stat, result),
          outcome: winner === "us" ? "point" : winner === "them" ? "error" : "in_play",
          zone: t.zone,
        });
      }
      if (!r.winner) continue;
      const end = r.endedBy;

      rallies.push({
        set: id,
        rally: r.index,
        start: r.startTime,
        end: r.endTime,
        serving: r.serving,
        court: r.court?.positions ?? null,
        libero: r.court?.libero ?? "",
        winner: r.winner,
        scoreUs: r.score.us,
        scoreThem: r.score.them,
        touches: r.touches.length,
        endKind: end?.kind === "touch" ? "touch" : end?.kind === "point" ? "point" : "none",
        endPlayer: end?.kind === "touch" ? end.player : "",
        endSkill: end?.kind === "touch" ? end.stat : "",
        endResult: end?.kind === "touch" ? resultLabel(end.stat, end.result) : "",
        endReason: end?.kind === "point" ? pointReasonLabel(end.winner, end.reason) : "",
        endNote: end?.kind === "point" ? (end.note ?? "") : "",
      });
    }
  }

  return { sets, touches, rallies };
}

// --- Small helpers -------------------------------------------------------------

const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0);
const mean = <T>(xs: T[], f: (x: T) => number) => (xs.length ? sum(xs, f) / xs.length : NaN);
const groupBy = <T, K>(xs: T[], key: (x: T) => K) => {
  const m = new Map<K, T[]>();

  for (const x of xs) {
    const k = key(x);
    const g = m.get(k);

    if (g) g.push(x);
    else m.set(k, [x]);
  }

  return m;
};
/** Sample standard deviation. */
const deviation = (xs: number[]) => {
  if (xs.length < 2) return NaN;
  const m = mean(xs, (x) => x);

  return Math.sqrt(sum(xs, (x) => (x - m) ** 2) / (xs.length - 1));
};
const bump = <K>(m: Map<K, number>, k: K, by = 1) => m.set(k, (m.get(k) ?? 0) + by);

/** Set touches per player in each set; the setter is the player on court with most. */
function setTouches(touches: TouchRow[]) {
  const sets = new Map<string, Map<string, number>>();

  for (const t of touches)
    if (t.skill === "set") {
      if (!sets.has(t.set)) sets.set(t.set, new Map());
      bump(sets.get(t.set)!, t.player);
    }

  return (set: string) => sets.get(set) ?? new Map<string, number>();
}

const setterOf = (court: string[], counts: Map<string, number>) =>
  court.reduce((best, p) => ((counts.get(p) ?? 0) > (counts.get(best) ?? 0) ? p : best), court[0]!);

// --- Aggregates ----------------------------------------------------------------

export type SkillSummary = {
  set: string;
  player: string;
  skill: Action;
  attempts: number;
  pos: number;
  errors: number;
  net: number;
  score: number | null;
  def: ScoreDef | undefined;
  errorRate: number;
};

/** Attempts, positive outcomes, errors, net (positive − errors) and standard score per action, set and player. */
export function skillSummary(touches: TouchRow[]): SkillSummary[] {
  const m = new Map<string, Omit<SkillSummary, "net" | "score" | "def" | "errorRate"> & { neg: number }>();

  for (const t of touches) {
    const sc = SCORES[t.action];

    for (const set of [ALL, t.set])
      for (const player of [ALL, t.player]) {
        const k = `${set}|${player}|${t.action}`;
        let r = m.get(k);

        if (!r) m.set(k, (r = { set, player, skill: t.action, attempts: 0, pos: 0, neg: 0, errors: 0 }));
        r.attempts++;
        if (sc?.pos.includes(t.result)) r.pos++;
        if (sc?.neg?.includes(t.result)) r.neg++;
        if (t.outcome === "error") r.errors++;
      }
  }

  return [...m.values()].map(({ neg, ...r }) => {
    const def = SCORES[r.skill];
    const score = !def
      ? null
      : def.kind === "count"
        ? r.pos
        : def.kind === "eff"
          ? (r.pos - neg) / r.attempts
          : r.pos / r.attempts;

    return { ...r, net: r.pos - r.errors, score, def, errorRate: r.errors / r.attempts };
  });
}

export type GradeCount = {
  set: string;
  player: string;
  skill: Action;
  zone: string;
  grade: string;
  level: number;
  n: number;
};

/** Touches per action and outcome, per set, player and zone (each also "all"). */
export function skillGrades(touches: TouchRow[]): GradeCount[] {
  const m = new Map<string, GradeCount>();

  for (const t of touches)
    for (const set of [ALL, t.set])
      for (const player of [ALL, t.player])
        for (const zone of [ALL, t.zone]) {
          const k = [set, player, t.action, zone, t.grade].join("|");
          const r = m.get(k);

          if (r) r.n++;
          else m.set(k, { set, player, skill: t.action, zone, grade: t.grade, level: t.level, n: 1 });
        }

  return [...m.values()];
}

export type PlusMinus = {
  set: string;
  player: string;
  /** Rallies on court. */
  rallies: number;
  won: number;
  /** Rallies in the lineup (for a libero: as the active libero). */
  lineup: number;
  setsPlayed: number;
  plusMinus: number;
  wonRate: number;
};

/**
 * Rallies won minus lost while on court, per player. On court = the lineup,
 * except that a back-row middle is replaced by the libero unless serving.
 * Middles are two and five places after the setter (5-1). The libero is the
 * set's starting libero until another libero touches the ball.
 */
export function plusMinus(rallies: RallyRow[], touches: TouchRow[]): PlusMinus[] {
  const counts = setTouches(touches);
  const inRally = new Map<string, Set<string>>();

  for (const t of touches) {
    const k = `${t.set}|${t.rally}`;

    inRally.set(k, (inRally.get(k) ?? new Set<string>()).add(t.player));
  }
  const liberos = new Set(rallies.map((r) => r.libero).filter(Boolean));
  const m = new Map<string, Omit<PlusMinus, "plusMinus" | "wonRate">>();
  const row = (set: string, player: string) => {
    const k = `${set}|${player}`;
    let r = m.get(k);

    if (!r) m.set(k, (r = { set, player, rallies: 0, won: 0, lineup: 0, setsPlayed: 0 }));

    return r;
  };
  const setLen = new Map<string, number>();

  for (const [set, rs] of groupBy(rallies, (r) => r.set)) {
    let libero = "";

    for (const r of [...rs].sort((a, b) => a.rally - b.rally)) {
      if (!r.court) continue;
      if (!libero) libero = r.libero;
      const touched = inRally.get(`${set}|${r.rally}`) ?? new Set();

      for (const l of liberos) if (l !== libero && touched.has(l)) libero = l;
      const court = r.court;

      bump(setLen, set);
      for (const p of libero ? [...court, libero] : court) row(set, p).lineup++;
      const c = counts(set);
      const setter = setterOf(court, c);
      const on = new Set(court);

      if (libero && c.get(setter)) {
        const s = court.indexOf(setter);

        for (const i of [(s + 2) % 6, (s + 5) % 6]) {
          const back = i === 0 || i === 4 || i === 5;

          if (back && !(i === 0 && r.serving === "us")) {
            on.delete(court[i]!);
            on.add(libero);
          }
        }
      }
      for (const p of on)
        for (const s of [ALL, set]) {
          row(s, p).rallies++;
          if (r.winner === "us") row(s, p).won++;
        }
    }
  }
  for (const r of [...m.values()])
    if (r.set !== ALL) {
      r.setsPlayed = r.lineup / setLen.get(r.set)!;
      const a = row(ALL, r.player);

      a.lineup += r.lineup;
      a.setsPlayed += r.setsPlayed;
    }

  return [...m.values()]
    .filter((r) => r.rallies || r.lineup)
    .map((r) => ({ ...r, plusMinus: 2 * r.won - r.rallies, wonRate: r.rallies ? r.won / r.rallies : 0 }));
}

export type RunRow = {
  set: string;
  /** Rallies won (positive) or lost (negative) in a row before this one; ±3 means 3 or more. */
  run: number;
  side: "Break point" | "Side-out";
  won: number;
  n: number;
  expSet: number;
  expMatch: number;
  zSet: number | null;
  zMatch: number | null;
};

export type MomentumModel = {
  set: string;
  baseline: "set" | "match";
  n: number;
  effect: number;
  nullEffect: number;
  corrected: number;
  ci: number;
  z: number | null;
  p: number;
};

/**
 * Rallies by the run before them, against the side-out or break-point average
 * of the set or match, and a momentum effect: a linear probability model of
 * winning a rally on an EWMA (half-life 2 rallies) of earlier results in the
 * set, with serve/receive baselines removed. The raw effect is biased on short
 * sequences, so it is corrected by 1000 simulated matches with no momentum.
 */
export function momentum(rallies: RallyRow[]): { runs: RunRow[]; models: MomentumModel[] } {
  const runs: RunRow[] = [];
  const models: MomentumModel[] = [];

  type Side = "serve" | "receive";
  const sideOf = (r: RallyRow): Side => (r.serving === "us" ? "serve" : "receive");
  const alpha = 1 - 0.5 ** (1 / 2);

  for (const filter of [ALL, ...new Set(rallies.map((r) => r.set))]) {
    const rs = rallies.filter((r) => r.serving && (filter === ALL || r.set === filter));
    const rate = (key: (r: RallyRow) => string) => {
      const g = new Map<string, [number, number]>();

      for (const r of rs) {
        const k = key(r);
        const v = g.get(k) ?? [0, 0];

        v[0] += r.winner === "us" ? 1 : 0;
        v[1]++;
        g.set(k, v);
      }

      return (r: RallyRow) => {
        const [w, n] = g.get(key(r))!;

        return w / n;
      };
    };
    const pSet = rate((r) => `${r.set}|${sideOf(r)}`);
    const pMatch = rate(sideOf);
    const bySet = groupBy(rs, (r) => r.set);
    const seq: { y: number; run: number; ps: number; pm: number }[] = [];

    for (const list of bySet.values()) {
      list.sort((a, b) => a.rally - b.rally);
      let run = 0;

      for (const r of list) {
        const y = r.winner === "us" ? 1 : 0;

        seq.push({ y, run, ps: pSet(r), pm: pMatch(r) });
        run = y ? (run > 0 ? run + 1 : 1) : run < 0 ? run - 1 : -1;
      }
    }
    for (const k of [-3, -2, -1, 1, 2, 3]) {
      const rows = seq.filter((x) => (k === 3 ? x.run >= 3 : k === -3 ? x.run <= -3 : x.run === k));

      if (!rows.length) continue;
      const won = sum(rows, (x) => x.y);
      const n = rows.length;
      const es = sum(rows, (x) => x.ps);
      const em = sum(rows, (x) => x.pm);
      const z = (e: number, v: number) => (v > 0 ? (won - e) / Math.sqrt(v) : null);

      runs.push({
        set: filter,
        run: k,
        side: k > 0 ? "Break point" : "Side-out",
        won,
        n,
        expSet: es / n,
        expMatch: em / n,
        zSet: z(
          es,
          sum(rows, (x) => x.ps * (1 - x.ps))
        ),
        zMatch: z(
          em,
          sum(rows, (x) => x.pm * (1 - x.pm))
        ),
      });
    }

    type Obs = { set: string; first: Side; ys: number[] };
    type Row = { y: number; m: number; g: string; gm: Side };
    const build = (sets: Obs[]) => {
      const rows: Row[] = [];

      for (const { set, first, ys } of sets) {
        let m = 0;
        let side = first;

        for (const y of ys) {
          rows.push({ y, m, g: `${set}|${side}`, gm: side });
          m = (1 - alpha) * m + alpha * (y ? 1 : -1);
          side = y ? "serve" : "receive";
        }
      }

      return rows;
    };
    const slope = (rows: Row[], gk: "g" | "gm") => {
      const xs: number[] = [];
      const ys: number[] = [];

      for (const g of groupBy(rows, (x) => x[gk]).values()) {
        const mx = mean(g, (x) => x.m);
        const my = mean(g, (x) => x.y);

        for (const x of g) {
          xs.push(x.m - mx);
          ys.push(x.y - my);
        }
      }
      const sxx = sum(xs, (x) => x * x);

      return sxx ? xs.reduce((a, x, i) => a + x * ys[i]!, 0) / sxx : null;
    };
    const observed: Obs[] = [...bySet].map(([set, list]) => ({
      set,
      first: sideOf(list[0]!),
      ys: list.map((r) => (r.winner === "us" ? 1 : 0)),
    }));
    const obsRows = build(observed);
    let seed = 12345;
    const rand = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);

      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    for (const [baseline, gk] of [
      ["set", "g"],
      ["match", "gm"],
    ] as const) {
      const p = new Map([...groupBy(obsRows, (x) => x[gk])].map(([k, g]) => [k, mean(g, (x) => x.y)]));
      const sims: number[] = [];

      for (let k = 0; k < 1000; k++) {
        const simulated = observed.map(({ set, first, ys }) => {
          let side = first;
          const res = ys.map(() => {
            const y = rand() < p.get(gk === "g" ? `${set}|${side}` : side)! ? 1 : 0;

            side = y ? "serve" : "receive";

            return y;
          });

          return { set, first, ys: res };
        });
        const b = slope(build(simulated), gk);

        if (b != null) sims.push(b);
      }
      const b = slope(obsRows, gk);

      if (b == null) continue;
      const mu = mean(sims, (x) => x);
      const sd = deviation(sims);

      models.push({
        set: filter,
        baseline,
        n: obsRows.length,
        effect: 2 * b,
        nullEffect: 2 * mu,
        corrected: 2 * (b - mu),
        ci: 2 * 1.96 * sd,
        z: sd ? (b - mu) / sd : null,
        p: sims.filter((x) => Math.abs(x - mu) >= Math.abs(b - mu)).length / sims.length,
      });
    }
  }

  return { runs, models };
}

export const POINT_TYPES = ["Kills", "Aces", "Blocks", "Opponent errors", "Other", "Not recorded"] as const;
export type PointType = (typeof POINT_TYPES)[number];

/**
 * How each rally was won, for the team that won it. An opponent kill or ace we
 * touched is logged on our receive, defense or block error, so it counts as
 * their kill or ace.
 */
function pointType(r: RallyRow): PointType {
  const s = r.endSkill;

  if (r.endKind === "none") return "Not recorded";
  if (r.winner === "us") {
    if (r.endKind === "point") return r.endReason === "Other" ? "Other" : "Opponent errors";
    if (s === "serve") return "Aces";
    if (s === "block") return "Blocks";

    return "Kills";
  }
  if (r.endKind === "point")
    return r.endReason === "Opp kill, untouched" ? "Kills" : r.endReason === "Opp ace, untouched" ? "Aces" : "Other";
  if (s === "receive") return "Aces";
  if (s === "defense" || (s === "block" && r.endResult === "Tooled")) return "Kills";
  if (s === "attack" && r.endResult === "Blocked, kill") return "Blocks";

  return "Opponent errors";
}

export function pointTypes(rallies: RallyRow[]) {
  const m = new Map<string, { set: string; type: PointType; us: number; them: number }>();

  for (const r of rallies)
    for (const set of [ALL, r.set]) {
      const type = pointType(r);
      const k = `${set}|${type}`;

      if (!m.has(k)) m.set(k, { set, type, us: 0, them: 0 });
      m.get(k)![r.winner]++;
    }

  return [...m.values()];
}

export type RotationRow = {
  set: string;
  rotation: number;
  receive: number;
  receiveWon: number;
  serve: number;
  serveWon: number;
  setter: string;
};

/**
 * Rallies won and played per rotation, split by who served. Rotation = our
 * setter's court position; the setter is the player on court with most set
 * touches in that set. Rallies with no lineup are left out.
 */
export function rotationStats(rallies: RallyRow[], touches: TouchRow[]): RotationRow[] {
  const counts = setTouches(touches);
  const m = new Map<string, Omit<RotationRow, "setter"> & { setters: Set<string> }>();

  for (const r of rallies) {
    if (!r.serving || !r.court) continue;
    const c = counts(r.set);
    const setter = setterOf(r.court, c);

    if (!c.get(setter)) continue;
    const rotation = r.court.indexOf(setter) + 1;

    for (const set of [ALL, r.set]) {
      const k = `${set}|${rotation}`;
      let row = m.get(k);

      if (!row)
        m.set(k, (row = { set, rotation, receive: 0, receiveWon: 0, serve: 0, serveWon: 0, setters: new Set() }));
      if (r.serving === "us") {
        row.serve++;
        if (r.winner === "us") row.serveWon++;
      } else {
        row.receive++;
        if (r.winner === "us") row.receiveWon++;
      }
      row.setters.add(setter);
    }
  }

  return [...m.values()].map(({ setters, ...row }) => ({ ...row, setter: [...setters].join(", ") }));
}

export type SetScore = {
  set: string;
  us: number;
  them: number;
  rallies: number;
  won: boolean;
};

/** Final score of each set (after its last rally). */
export function setScores(sets: SetInfo[], rallies: RallyRow[]): SetScore[] {
  const bySet = groupBy(rallies, (r) => r.set);

  return sets.flatMap((s) => {
    const rs = bySet.get(s.id);

    if (!rs) return [];
    const last = rs.reduce((a, b) => (b.rally > a.rally ? b : a));

    return [
      { set: s.id, us: last.scoreUs, them: last.scoreThem, rallies: rs.length, won: last.scoreUs > last.scoreThem },
    ];
  });
}

export const actionLabel = (a: Action) => (a === "tip" ? "Setter tip" : skillDef(a).label);

// --- Highlights ------------------------------------------------------------------

/** Touches a tap on the dashboard can play as highlights; "all" matches any set or player. */
export type ClipQuery = {
  set: string;
  player: string;
  action: Action;
  grade?: string;
  zone?: string;
};

export const clipTouches = ({ touches }: MatchTables, q: ClipQuery) =>
  touches.filter(
    (t) =>
      (q.set === ALL || t.set === q.set) &&
      (q.player === ALL || t.player === q.player) &&
      t.action === q.action &&
      (!q.grade || t.grade === q.grade) &&
      (!q.zone || t.zone === q.zone)
  );

/** The highlights filter that plays exactly the touches of `q`. */
export function clipSelection(tables: MatchTables, q: ClipQuery): Partial<Selection> {
  const sel: Partial<Selection> = {
    action: new Set([skillDef(q.action === "tip" ? "set" : q.action).label]),
    // Grades and tips are groups of results, so pick the results they cover.
    outcome: new Set(clipTouches(tables, q).map((t) => t.result)),
  };
  const info = tables.sets.find((s) => s.id === q.set);

  if (info) {
    sel.match = new Set([info.match]);
    sel.set = new Set([info.setName]);
  }
  if (q.player !== ALL) sel.player = new Set([q.player]);
  if (q.zone) sel.zone = new Set([q.zone]);

  return sel;
}
