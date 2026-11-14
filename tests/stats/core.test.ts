// Core stats tests: rallies, predictions, entry, store, exports, highlights, and dashboard data.
import { describe, expect, test } from "vitest";

import { formatGameDate } from "../../src/games/format";

import { predictSkill } from "../../src/stats/codes";
import {
  OPPONENT,
  buildClips,
  filterActions,
  highlightActions,
  highlightRallies,
  matchLabel,
} from "../../src/stats/clips";
import { clearLast, currentStep, isComplete, newDraft, setField } from "../../src/stats/draft";
import { ALL, clipSelection, matchTables, pointTypes, setScores, skillSummary } from "../../src/stats/dashboard/data";
import { csvCell, toCsv } from "../../src/stats/exporters";
import { deriveRallies, predictPlayer } from "../../src/stats/rallies";
import { emptyData, initState, parseImport, reducer } from "../../src/stats/store";
import type { MatchEvent, MatchMeta, Skill, Team, Touch } from "../../src/stats/types";

let nextId = 1;
const touch = (timestamp: number, player: string, stat: Skill, result: string, zone = "1"): MatchEvent => ({
  kind: "touch",
  id: nextId++,
  timestamp,
  player,
  stat,
  result,
  zone,
});
const point = (timestamp: number, winner: Team): MatchEvent => ({ kind: "point", id: nextId++, timestamp, winner });
const meta = { firstServe: null, startRotation: 1 };

describe("deriveRallies", () => {
  test("ends rallies on decisive results and tracks score, serve and rotation", () => {
    const events = [
      touch(1, "Mira", "serve", "dig23"),
      touch(5, "Suki", "defense", "dig01"),
      touch(6, "Nell", "set", "on"),
      touch(7, "Sian", "attack", "kill"), // us 1-0, we keep serve
      touch(20, "Mira", "serve", "net"), // them 1-1, they serve
      touch(40, "Juno", "receive", "dig23"),
      touch(42, "Nell", "set", "on"),
      touch(43, "Sian", "attack", "kill"), // side-out: us 2-1, rotate
      point(60, "them"), // e.g. opponent kill nobody touched
    ];
    const rallies = deriveRallies(events, meta);

    expect(rallies.map((r) => r.winner)).toEqual(["us", "them", "us", "them", null]);
    expect(rallies.map((r) => r.serving)).toEqual(["us", "us", "them", "us", "them"]);
    expect(rallies.map((r) => r.rotation)).toEqual([1, 1, 1, 2, 2]);
    expect(rallies.at(-1)!.score).toEqual({ us: 2, them: 2 });
    expect(rallies[0]!.touches).toHaveLength(4);
  });

  test("infers first server from a receive and orders by timestamp", () => {
    const events = [touch(5, "Nell", "set", "on"), touch(3, "Juno", "receive", "dig01")];
    const [first] = deriveRallies(events, meta);

    expect(first!.serving).toBe("them");
    expect(first!.touches.map((t) => t.stat)).toEqual(["receive", "set"]);
  });

  test("infers the winner of an unfinished rally from who serves next", () => {
    const rallies = deriveRallies(
      [
        touch(1, "Mira", "serve", "dig23"),
        touch(5, "Suki", "defense", "dig01"), // ...opponent then kills it untouched
        touch(20, "Juno", "receive", "dig23"), // so they serve: they won
        touch(22, "Nell", "set", "on"), // ...opponent attacks out
        touch(40, "Mira", "serve", "dig01"), // we serve: we won
      ],
      meta
    );

    expect(rallies.map((r) => [r.winner, r.inferred])).toEqual([
      ["them", true],
      ["us", true],
      [null, false],
    ]);
    expect(rallies[0]!.endTime).toBe(5);
    expect(rallies.at(-1)!.rotation).toBe(2);
  });

  test("detects a rally with none of our touches (opponent serve error)", () => {
    const rallies = deriveRallies(
      [
        touch(1, "Juno", "receive", "dig23"),
        touch(3, "Sian", "attack", "out"), // they win, they serve next
        touch(20, "Mira", "serve", "dig01"), // ...but we serve: they missed theirs
      ],
      meta
    );

    expect(rallies.map((r) => [r.serving, r.winner, r.touches.length])).toEqual([
      ["them", "them", 2],
      ["them", "us", 0],
      ["us", null, 1],
    ]);
    expect(rallies.at(-1)!.score).toEqual({ us: 1, them: 1 });
  });

  test("a receive tagged just after the set that followed it still opens the rally", () => {
    const rallies = deriveRallies(
      [touch(1, "Mira", "serve", "out"), touch(30, "Nell", "set", "on"), touch(31.5, "Juno", "receive", "dig01")],
      meta
    );

    expect(rallies).toHaveLength(2);
    expect(rallies[1]!.touches.map((t) => t.stat)).toEqual(["receive", "set"]);
    expect(rallies[1]!.serving).toBe("them");
  });

  test("an explicit point matches what inference would give", () => {
    const base = [touch(1, "Mira", "serve", "dig23"), touch(20, "Mira", "serve", "dig23")];
    const inferred = deriveRallies(base, meta);
    const explicit = deriveRallies([...base, point(10, "us")], meta);

    expect(explicit.at(-1)!.score).toEqual(inferred.at(-1)!.score);
    expect(explicit[0]!.inferred).toBe(false);
  });

  test("respects explicit first serve and start rotation", () => {
    const rallies = deriveRallies([point(1, "us")], { firstServe: "them", startRotation: 6 });

    expect(rallies[0]!.serving).toBe("them");
    expect(rallies[1]!.rotation).toBe(1);
  });
});

describe("predictions", () => {
  test("next skill follows the usual flow", () => {
    expect(predictSkill(null, "us")).toBe("serve");
    expect(predictSkill(null, "them")).toBe("receive");
    const t = (stat: Skill, result: string) => touch(0, "x", stat, result) as Touch;

    expect(predictSkill(t("receive", "dig23"), null)).toBe("set");
    expect(predictSkill(t("set", "on"), null)).toBe("attack");
    expect(predictSkill(t("attack", "defended"), null)).toBe("defense");
  });

  test("predicts setter and server in the same rotation", () => {
    const rallies = deriveRallies(
      [touch(1, "Mira", "serve", "dig01"), touch(3, "Nell", "set", "on"), point(5, "us")],
      meta
    );

    expect(predictPlayer(rallies, "set")).toBe("Nell");
    expect(predictPlayer(rallies, "serve")).toBe("Mira");
  });
});

describe("draft", () => {
  test("error results fill zone 0 and complete the stat", () => {
    let d = newDraft(10, "Mira", "serve");

    expect(currentStep(d)).toBe("result");
    d = setField(d, "result", "net");
    expect(d.zone).toBe("0");
    expect(isComplete(d)).toBe(true);
    d = setField(d, "result", "dig01");
    expect(d.zone).toBe("");
  });

  test("changing skill resets result; backspace steps back", () => {
    let d = setField(setField(newDraft(0, "Mira", "serve"), "result", "ace"), "stat", "attack");

    expect(d.result).toBe("");
    d = setField(d, "result", "kill");
    d = setField(d, "zone", "4");
    expect(clearLast(d).zone).toBe("");
    expect(clearLast(setField(newDraft(0, "M", "serve"), "result", "out")).result).toBe("");
  });
});

describe("store", () => {
  test("refuses a file that is not a set export", () => {
    expect(() => parseImport([{ player: "Mira", stat: "serve", result: "ace" }])).toThrow(/Unrecognised file/);
    expect(() => parseImport({ hello: "world" })).toThrow(/Unrecognised file/);
    expect(() => parseImport({ version: 2, events: [{ kind: "touch", timestamp: 1 }] })).toThrow(/Unrecognised file/);
  });

  test("round-trips an export", () => {
    const data = { ...emptyData(["Mira"]), events: [touch(1, "Mira", "serve", "ace")] };
    const parsed = parseImport(JSON.parse(JSON.stringify(data)));

    expect(parsed.events).toEqual(data.events);
    expect(parsed.players).toEqual(["Mira"]);
  });

  test("undo and redo, which leave a set detail edited since alone", () => {
    let s = initState(emptyData());

    s = reducer(s, { type: "addPlayer", name: "Mira" });
    s = reducer(s, { type: "setMeta", meta: { setNumber: "2" } });
    s = reducer(s, { type: "undo" });
    expect(s.data.players).toEqual([]);
    expect(s.data.meta.setNumber).toBe("2");
    s = reducer(s, { type: "redo" });
    expect(s.data.players).toEqual(["Mira"]);
    expect(s.data.meta.setNumber).toBe("2");
  });

  test("next set keeps players and bumps set number", () => {
    let s = initState({ ...emptyData(["Mira"]), events: [point(1, "us")] });

    s = reducer(s, { type: "setMeta", meta: { setNumber: "2", homeTeam: "QBC" } });
    s = reducer(s, { type: "newSet", keepPlayers: true });
    expect(s.data.events).toEqual([]);
    expect(s.data.players).toEqual(["Mira"]);
    expect(s.data.meta.setNumber).toBe("3");
    expect(s.data.meta.homeTeam).toBe("QBC");
  });
});

describe("csv", () => {
  test("escapes commas, quotes and newlines", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("plain")).toBe("plain");
    const csv = toCsv(deriveRallies([touch(1, "Mira", "misc", "weird, play")], meta));

    expect(csv.split("\n")[1]).toContain('"weird, play"');
    const pointRow = toCsv(
      deriveRallies([{ kind: "point", id: 99, timestamp: 2, winner: "us", reason: "attack_error" }], meta)
    ).split("\n")[1];

    expect(pointRow).toContain("point_us,attack_error");
  });
});

describe("touch reasons", () => {
  test("defense error can carry an optional positioning reason", async () => {
    const { toggleReason, draftToTouch } = await import("../../src/stats/draft");
    let d = setField(newDraft(0, "Suki", "defense"), "result", "error");

    d = toggleReason(d, "positioning");
    d = setField(d, "zone", "5");
    expect(draftToTouch(d, 1)).toMatchObject({ result: "error", reason: "positioning" });
    // Switching result drops a reason that no longer applies.
    expect(setField(d, "result", "dig01").reason).toBe("");
    // Optional: saving without it still works and stores no reason.
    const plain = draftToTouch(setField(setField(newDraft(0, "Suki", "defense"), "result", "error"), "zone", "5"), 2);

    expect(plain.reason).toBeUndefined();
    expect(toCsv(deriveRallies([draftToTouch(d, 3)], meta)).split("\n")[1]).toContain("error,positioning,5");
  });
});

describe("lineup and substitutions", () => {
  const lineup = ["P1", "P2", "P3", "P4", "P5", "P6"];
  const sub = (timestamp: number, out: string, inn: string): MatchEvent => ({
    kind: "sub",
    id: nextId++,
    timestamp,
    out,
    in: inn,
  });

  test("court rotates on side-outs and position 1 serves", () => {
    const m = { ...meta, lineup, libero: "Lib" };
    const rallies = deriveRallies(
      [
        touch(1, "P4", "receive", "dig23"),
        touch(3, "P3", "attack", "kill"), // side-out: rotate
        touch(20, "P2", "serve", "net"), // P2 now in position 1
        touch(40, "Lib", "receive", "dig23"),
        touch(42, "P3", "attack", "kill"), // side-out again
      ],
      m
    );

    expect(rallies[0]!.court!.positions).toEqual(lineup);
    expect(rallies[1]!.court!.positions[0]).toBe("P2");
    expect(rallies.at(-1)!.court!.positions[0]).toBe("P3");
    expect(rallies.at(-1)!.court!.libero).toBe("Lib");
    expect(predictPlayer(rallies, "serve")).toBe("P3");
  });

  test("a substitution swaps the player in place, including the libero", () => {
    const m = { ...meta, lineup, libero: "Lib" };
    const rallies = deriveRallies([touch(1, "P1", "serve", "ace"), sub(10, "P4", "Bench"), sub(11, "Lib", "Lib2")], m);
    const court = rallies.at(-1)!.court!;

    expect(court.positions[3]).toBe("Bench");
    expect(court.libero).toBe("Lib2");
    expect(rallies.at(-1)!.subs).toHaveLength(2);
    expect(rallies[0]!.court!.positions[3]).toBe("P4"); // earlier rallies unchanged
    // Subs don't end rallies or change the score.
    expect(rallies.at(-1)!.score).toEqual({ us: 1, them: 0 });
  });

  test("no lineup means no court, and serve prediction falls back to history", () => {
    const rallies = deriveRallies([touch(1, "Mira", "serve", "ace")], meta);

    expect(rallies[0]!.court).toBeNull();
    expect(predictPlayer(rallies, "serve")).toBe("Mira");
  });
});

describe("highlights", () => {
  const set = (n: string, events: MatchEvent[], youtubeUrl = "https://youtu.be/SQzjcBT2DW4") => {
    const m = { ...emptyData().meta, setNumber: n, homeTeam: "V3", awayTeam: "Opal", date: "2025-11-09", youtubeUrl };

    return { meta: m, rallies: deriveRallies(events, m) };
  };
  const at = (time: number, videoId: string | null = "abcdefghijk") => ({
    match: "m",
    date: "2025-11-09",
    set: "Set 1",
    videoId,
    time,
    player: "",
    action: "",
    outcome: "",
    zone: "",
    score: "",
    rally: 1,
  });

  test("lists our touches and the opponent's untouched points with labels and score", () => {
    const actions = highlightActions(
      set("2", [touch(10, "Mira", "serve", "dig23"), touch(14, "Sian", "attack", "kill"), point(30, "them")])
    );

    expect(actions.map((a) => [a.time, a.player, a.action, a.outcome, a.score])).toEqual([
      [10, "Mira", "Serve", "Dig 2-3", "1–0"],
      [14, "Sian", "Attack", "Kill", "1–0"],
      [30, OPPONENT, "Point", "Point", "1–1"],
    ]);
    expect(actions[0]).toMatchObject({
      match: `V3 vs Opal, ${formatGameDate("2025-11-09")}`,
      set: "Set 2",
      videoId: "SQzjcBT2DW4",
    });
  });

  test("labels a match from whatever the file names, with a trailing dot on the video link", () => {
    const meta = (m: Partial<MatchMeta>) => ({ meta: { ...emptyData().meta, ...m }, rallies: [] });

    expect(matchLabel(meta({ date: "", homeTeam: "Opal", awayTeam: "Pumas" }))).toBe("Opal vs Pumas");
    expect(matchLabel(meta({ date: "2026-10-03", awayTeam: "Pumas" }))).toBe(`Pumas, ${formatGameDate("2026-10-03")}`);
    expect(matchLabel(meta({ date: "" }))).toBe("Untitled match");
    const actions = highlightActions(
      set("1", [touch(5, "Saba", "attack", "kill")], "https://www.youtube.com/watch?v=wSSHpSYEIbY.")
    );

    expect(actions[0]!.videoId).toBe("wSSHpSYEIbY");
  });

  test("filters by intersecting fields, with an empty selection keeping everything", () => {
    const actions = [
      ...highlightActions(set("1", [touch(1, "Mira", "attack", "kill"), touch(5, "Suki", "attack", "kill")])),
      ...highlightActions(set("2", [touch(1, "Mira", "attack", "kill")])),
    ];

    expect(filterActions(actions, { player: new Set() })).toHaveLength(3);
    expect(filterActions(actions, { player: new Set(["Mira"]), set: new Set(["Set 1"]) })).toHaveLength(1);
  });

  test("summarizes each finished rally: who won, touches and what ended it", () => {
    const s1 = set("1", [
      touch(10, "Mira", "serve", "dig23"),
      touch(14, "Suki", "attack", "kill"),
      point(30, "us"),
      touch(40, "Mira", "serve", "out"),
    ]);

    expect(highlightRallies(s1).map((r) => [r.won, r.touches, r.ended])).toEqual([
      [true, 2, "Suki · Attack Kill"],
      [true, 0, ""],
      [false, 1, "Mira · Serve Out"],
    ]);
  });

  test("plays several matches in date order, whatever their teams are called", () => {
    const clips = buildClips(
      [
        { ...at(1), match: "Eagles vs Opal", date: "2025-11-12" },
        { ...at(2, "zzzzzzzzzzz"), match: "Eagles vs Pumas", date: "2025-10-03" },
      ],
      5,
      3
    );

    expect(clips.map((c) => c.actions[0]!.match)).toEqual(["Eagles vs Pumas", "Eagles vs Opal"]);
  });

  test("pads windows and merges those that overlap in one video", () => {
    const clips = buildClips([at(100), at(106), at(120), at(121, "zzzzzzzzzzz"), at(2)], 5, 3);

    expect(clips.map((c) => [c.videoId, c.start, c.end, c.actions.length])).toEqual([
      ["abcdefghijk", 0, 5, 1],
      ["abcdefghijk", 95, 109, 2],
      ["abcdefghijk", 115, 123, 1],
      ["zzzzzzzzzzz", 116, 124, 1],
    ]);
  });
});

describe("stats dashboard", () => {
  const events = [
    touch(1, "Mira", "serve", "dig23"),
    touch(4, "Nell", "set", "on"),
    touch(5, "Sian", "attack", "kill"), // us 1-0
    touch(20, "Mira", "serve", "out"), // them 1-1
    touch(40, "Juno", "receive", "dig01"),
    touch(42, "Nell", "set", "over_score"), // us 2-1
  ];
  const sets = [
    {
      meta: { ...emptyData().meta, setNumber: "2", homeTeam: "Opal", awayTeam: "Pumas" },
      rallies: deriveRallies(events, meta),
    },
  ];
  const tables = matchTables(sets);

  test("flattens sets into touches and finished rallies, with a set sent over as a setter tip", () => {
    expect(tables.sets.map((s) => s.label)).toEqual(["Set 2"]);
    expect(tables.touches).toHaveLength(6);
    expect(tables.rallies.map((r) => [r.winner, r.endSkill, r.endResult])).toEqual([
      ["us", "attack", "Kill"],
      ["them", "serve", "Out"],
      ["us", "set", "Over (pt)"],
    ]);
    expect(tables.touches.find((t) => t.result === "Over (pt)")).toMatchObject({
      action: "tip",
      grade: "Successful",
      outcome: "point",
    });
    expect(setScores(tables.sets, tables.rallies)).toEqual([{ set: "0", us: 2, them: 1, rallies: 3, won: true }]);
  });

  test("scores each action and sorts points by how they were won", () => {
    const all = skillSummary(tables.touches).filter((r) => r.set === ALL && r.player === ALL);

    expect(all.find((r) => r.skill === "serve")).toMatchObject({ attempts: 2, pos: 0, errors: 1, score: -0.5 });
    expect(all.find((r) => r.skill === "set")).toMatchObject({ attempts: 1, score: 1 });
    expect(pointTypes(tables.rallies).filter((r) => r.set === ALL)).toEqual([
      { set: ALL, type: "Kills", us: 2, them: 0 },
      { set: ALL, type: "Opponent errors", us: 0, them: 1 },
    ]);
  });

  test("turns a tap on a grade into the highlights filter for exactly those touches", () => {
    const sel = clipSelection(tables, { set: "0", player: ALL, action: "tip", grade: "Successful" });

    expect([...sel.action!]).toEqual(["Set"]);
    expect([...sel.outcome!]).toEqual(["Over (pt)"]);
    const picked = filterActions(highlightActions(sets[0]!), sel);

    expect(picked.map((a) => [a.player, a.outcome])).toEqual([["Nell", "Over (pt)"]]);
  });
});
