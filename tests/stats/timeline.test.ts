import { describe, expect, test } from "vitest";

import { deriveRallies } from "../../src/stats/rallies";
import { serveStandIns } from "../../src/stats/setDraft";
import { emptyData } from "../../src/stats/store";
import { neighbour, openingRally, possessions, timeline } from "../../src/stats/timeline";
import type { TimelineItem } from "../../src/stats/timeline";
import type { AppData, DraftContact, DraftRally, MatchEvent, Skill } from "../../src/stats/types";

const meta = { firstServe: null, startRotation: 1, lineup: [], libero: "" };
const touch = (id: number, timestamp: number, stat: Skill, result: string): MatchEvent => ({
  kind: "touch",
  id,
  timestamp,
  player: "Mira",
  stat,
  zone: "1",
  result,
});
const contact = (id: number, time: number, extra: Partial<DraftContact> = {}): DraftContact => ({
  id,
  time,
  model: true,
  ...extra,
});
const set = (events: MatchEvent[], contacts: DraftContact[], rallies: DraftRally[]): AppData => ({
  ...emptyData(["Mira"]),
  events,
  draft: { rallies, contacts },
});
// The rallies as the tracker shows them: the app's own, with the draft's unrecorded rallies standing in.
const shape = (events: MatchEvent[], contacts: DraftContact[] = [], rallies: DraftRally[] = []) =>
  timeline(deriveRallies([...events, ...serveStandIns(set(events, contacts, rallies))], meta), contacts, rallies).map(
    (g) => [
      g.rally.index,
      g.items.map((i) => (i.kind === "contact" ? `c${i.contact.id}` : `e${i.event.id}`)).join(" "),
      g.rally.winner ? `${g.rally.winner}${g.settled ? "" : "?"}` : "",
    ]
  );

describe("timeline", () => {
  // Rally 1 is received and won; rally 2 is ours to serve and still in play.
  const played = [touch(1, 10, "receive", "dig23"), touch(2, 12, "attack", "kill"), touch(3, 30, "serve", "dig23")];
  const first = [1, "e1 e2", "us"];

  const drafted: DraftRally[] = [
    { start: 60, end: 66, serving: "us" },
    { start: 80, end: 86, serving: "them" },
  ];

  test.each<[string, MatchEvent[], DraftContact[], DraftRally[], unknown[]]>([
    ["recorded rallies alone, oldest first", played, [], [], [first, [2, "e3", ""]]],
    [
      "a contact joins the rally in play at its time",
      played,
      [contact(1, 11), contact(2, 33)],
      [],
      [
        [1, "e1 c1 e2", "us"],
        [2, "e3 c2", ""],
      ],
    ],
    [
      "a rally the draft knows shows before anything of it is recorded, and its server wins the one before for now",
      played,
      [contact(2, 59), contact(4, 81)],
      drafted,
      [first, [2, "e3", "us?"], [3, "c2", "them?"], [4, "c4", ""]],
    ],
    [
      "once something of a draft's rally is recorded, the recorded events speak for it",
      [...played, touch(4, 61, "receive", "dig23")],
      [],
      drafted,
      [first, [2, "e3", "them"], [3, "e4", "them?"], [4, "", ""]],
    ],
    ["contacts alone", [], [contact(1, 5)], [], [[1, "c1", ""]]],
  ])("%s", (_name, events, contacts, rallies, expected) => {
    expect(shape(events, contacts, rallies)).toEqual(expected);
  });

  test("a rally starts before its serve and ends after its last touch, or where the draft ends it", () => {
    const groups = timeline(deriveRallies([...played, ...serveStandIns(set(played, [], drafted))], meta), [], drafted);

    expect(groups.map((g) => [g.start, g.end, g.outline])).toEqual([
      [10, 13, false],
      [30, 31, false],
      [60, 66, true],
      [80, 86, true],
    ]);
  });

  test("the first mark of a rally known from the draft alone shows as its serve, by the side the draft names", () => {
    const marks = [
      { id: 1, time: 79 },
      { id: 2, time: 81 },
    ];
    const groups = timeline(
      deriveRallies([...played, ...serveStandIns(set(played, marks, drafted))], meta),
      marks,
      drafted,
      true
    );

    expect(groups.at(-1)?.items.map((i) => i.kind === "contact" && [i.contact.side, i.contact.skill])).toEqual([
      ["them", "serve"],
      [undefined, undefined],
    ]);
  });

  test("without a draft too, the first mark after a decided rally is the serve of the side the rally rules name", () => {
    // We won rally 1, so we serve rally 2.
    const won = [touch(1, 10, "receive", "dig23"), touch(2, 12, "attack", "kill")];
    const marks = [
      { id: 1, time: 30 },
      { id: 2, time: 32 },
    ];
    const rallies = deriveRallies(won, meta);

    expect(
      timeline(rallies, marks)
        .at(-1)
        ?.items.map((i) => i.kind === "contact" && i.contact.skill)
    ).toEqual(["serve", undefined]);
    expect([openingRally(rallies, marks, 30)?.serving, openingRally(rallies, marks, 32)]).toEqual(["us", null]);
  });

  test("a point entered between two rallies of the draft leaves the next one standing in", () => {
    const point: MatchEvent = { kind: "point", id: 9, timestamp: 57, winner: "them" };

    // 57 lies within the lead of the rally that starts at 60, and belongs to the one before.
    expect(serveStandIns(set([...played, point], [], drafted)).map((e) => e.timestamp)).toEqual([60, 80]);
  });

  test("marks on the last touches of a rally stay in it once it is decided", () => {
    const won = [touch(1, 10, "receive", "dig23"), touch(2, 15, "attack", "kill")];
    const marks = [
      { id: 1, time: 13 },
      { id: 2, time: 16 },
    ];
    const groups = timeline(deriveRallies(won, meta), marks);

    expect(
      groups.map((g) => g.items.map((i) => (i.kind === "contact" ? `c${i.contact.id}` : `e${i.event.id}`)))
    ).toEqual([["e1", "c1", "e2"], ["c2"]]);
  });

  test.each<[string, number, DraftContact[], MatchEvent[], unknown]>([
    ["the first contact of a rally with no play recorded", 58, [], played, "us"],
    ["not when a contact before it still waits", 61, [contact(1, 59)], played, null],
    ["not once the rally has something recorded", 82, [], [...played, touch(4, 81, "receive", "dig23")], null],
  ])("the side that serves is the guess for %s", (_name, time, contacts, events, expected) => {
    const rallies = deriveRallies([...events, ...serveStandIns(set(events, contacts, drafted))], meta);

    expect(openingRally(rallies, contacts, time)?.serving ?? null).toBe(expected);
  });
});

describe("neighbour", () => {
  const contacts = [contact(1, 5), contact(2, 5), contact(3, 9)];

  test.each<[string, { time: number; id?: number }, 1 | -1, number | undefined]>([
    ["after a contact, the next at the same time", { time: 5, id: 1 }, 1, 2],
    ["after a contact that is gone", { time: 5, id: 2 }, 1, 3],
    ["before a contact", { time: 9, id: 3 }, -1, 2],
    ["after a bare time", { time: 6 }, 1, 3],
    ["before a bare time", { time: 6 }, -1, 2],
    ["past the last", { time: 9, id: 3 }, 1, undefined],
  ])("%s", (_name, from, direction, id) => {
    expect(neighbour(contacts, from, direction)?.id).toBe(id);
  });
});

describe("possessions", () => {
  const event = (e: MatchEvent): TimelineItem => ({ kind: "event", time: e.timestamp, event: e });

  test("a rally falls into each team's touches up to the ball going over or three touches, and a point stands alone", () => {
    const rows = possessions([
      event({ kind: "opponent", id: 1, timestamp: 1, stat: "serve" }),
      event(touch(2, 2, "receive", "dig23")),
      event(touch(3, 3, "set", "on")),
      event(touch(4, 4, "attack", "dig23")),
      event(touch(6, 8, "defense", "dig23")),
      event(touch(7, 9, "freeball", "dig23")),
      event(touch(8, 12, "block", "kill")),
      { kind: "contact", time: 13, contact: { id: 1, time: 13 } },
      { kind: "contact", time: 14, contact: { id: 2, time: 14 } },
      { kind: "contact", time: 15, contact: { id: 3, time: 15 } },
      { kind: "contact", time: 16, contact: { id: 4, time: 16 } },
      event({ kind: "point", id: 9, timestamp: 17, winner: "us" }),
    ]);

    expect(rows.map((p) => [p.side, p.items.length])).toEqual([
      ["them", 1],
      ["us", 3],
      ["us", 2],
      ["us", 4],
      ["us", 1],
      [null, 1],
    ]);
  });
});
