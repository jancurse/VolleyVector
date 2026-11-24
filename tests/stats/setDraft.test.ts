import { describe, expect, test } from "vitest";

import { toJson } from "../../src/stats/exporters";
import { deriveRallies } from "../../src/stats/rallies";
import {
  addMark,
  dropContacts,
  loadDraft,
  parseDraft,
  sceneText,
  serveJump,
  withoutDraft,
} from "../../src/stats/setDraft";
import type { ModelDraft } from "../../src/stats/setDraft";
import { emptyData, initState, parseImport, reducer } from "../../src/stats/store";
import type { AppData, MatchEvent } from "../../src/stats/types";

const serve: MatchEvent = {
  kind: "touch",
  id: 1,
  timestamp: 12,
  player: "Mira",
  stat: "serve",
  result: "dig23",
  zone: "5",
};
const withEvents = (events: MatchEvent[], draft?: AppData["draft"]): AppData => ({
  ...emptyData(["Mira"]),
  events,
  ...(draft && { draft }),
});
const parsed = (text: string): ModelDraft => {
  const result = parseDraft(text);

  if (!result.ok) throw new Error(result.errors.join(" "));

  return result.draft;
};

describe("a set file from before the draft", () => {
  // As the tracker exported it before this layer existed: no draft, no opponent touches, no video details.
  const file = {
    version: 2,
    metadata: {
      setNumber: "1",
      homeTeam: "Eagles",
      awayTeam: "Riverside",
      date: "2026-10-30",
      youtubeUrl: "https://youtu.be/abcdefghijk",
      firstServe: null,
      startRotation: 1,
      lineup: [],
      libero: "",
      exportedAt: "2026-10-30T20:00:00.000Z",
    },
    players: ["Mira", "Suki"],
    events: [
      { kind: "touch", id: 1, timestamp: 12, player: "Mira", stat: "serve", result: "ace", zone: "5" },
      { kind: "point", id: 2, timestamp: 40, winner: "them", reason: "kill" },
      { kind: "sub", id: 3, timestamp: 41, out: "Mira", in: "Suki" },
    ],
    stats: [
      {
        rally: 1,
        serving: "us",
        rotation: 1,
        rallyWinner: "us",
        scoreUs: 1,
        scoreThem: 0,
        timestamp: 12,
        server: "",
        id: 1,
        player: "Mira",
        stat: "serve",
        result: "ace",
        zone: "5",
        reason: "",
      },
    ],
    rallies: [
      {
        index: 1,
        startTime: 12,
        endTime: 12,
        serving: "us",
        rotation: 1,
        court: null,
        winner: "us",
        scoreUs: 1,
        scoreThem: 0,
        touches: 1,
      },
      {
        index: 2,
        startTime: 12,
        endTime: 40,
        serving: "us",
        rotation: 1,
        court: null,
        winner: "them",
        scoreUs: 1,
        scoreThem: 1,
        touches: 0,
      },
    ],
  };

  test("loads and exports unchanged", () => {
    const data = parseImport(file);
    const out = JSON.parse(toJson(data, deriveRallies(data.events, data.meta)));

    expect(data).not.toHaveProperty("draft");
    expect({ ...out, metadata: { ...out.metadata, exportedAt: file.metadata.exportedAt } }).toEqual(file);
  });
});

describe("the draft in a set", () => {
  test("a set file keeps its draft and video details, and drops what it cannot read of them", () => {
    const data = parseImport({
      version: 2,
      events: [{ kind: "opponent", id: 1, timestamp: 3, stat: "serve" }],
      metadata: { ourHalf: "far", videoTurn: 90 },
      draft: {
        rallies: [{ start: 3, end: 9, serving: "them" }, { end: 4 }],
        contacts: [{ id: 1, time: 5 }, { time: "x" }],
      },
    });

    expect(data.meta).toMatchObject({ ourHalf: "far", videoTurn: 90 });
    expect(data.draft).toEqual({ rallies: [{ start: 3, end: 9, serving: "them" }], contacts: [{ id: 1, time: 5 }] });
    expect(JSON.parse(toJson(data, deriveRallies(data.events, data.meta))).draft).toEqual(data.draft);
  });

  test("describing a contact takes it out of the draft, and undo puts it back", () => {
    let state = initState(withEvents([], addMark(addMark(undefined, 12), 14)));

    state = reducer(state, { type: "addEvent", event: serve, contact: 1 });
    expect(state.data.draft?.contacts).toEqual([{ id: 2, time: 14 }]);

    state = reducer(state, { type: "setDraft", draft: undefined });
    expect(state.data).not.toHaveProperty("draft");

    state = reducer(reducer(state, { type: "undo" }), { type: "undo" });
    expect(state.data.draft?.contacts).toHaveLength(2);
  });
});

describe("parseDraft", () => {
  test.each([
    { text: "Sorry, I cannot watch videos.", error: /No draft found/ },
    { text: '{"rallies": [', error: /No draft found/ },
    { text: '{"rallies": [}', error: /Not valid JSON/ },
    { text: '{"touches": []}', error: /no "rallies" list/ },
    { text: '{"rallies": [{"end": 3}]}', error: /no rally and no contact/ },
  ])("refuses $text", ({ text, error }) => {
    const result = parseDraft(text);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.join(" ")).toMatch(error);
  });

  test("reads a pasted chat answer, in either contact shape and time format, and says what it dropped", () => {
    const result = parseDraft(`Here is the draft:
\`\`\`json
{"rallies": [
  {"start": "00:21", "end": "1:02:03", "serving": "us", "contacts": [["00:21", "us", "serve"], ["0:24.5", "them", "receive"]]},
  {"serve": 40, "serving": "nobody", "touches": [{"t": 41, "side": "us", "skill": "spike"}, ["soon", "us", "set"], [43, "ref", "set"]]},
  {"end": 50}
]}
\`\`\``);

    expect(result).toMatchObject({
      ok: true,
      draft: {
        rallies: [
          { start: 21, end: 3723, serving: "us" },
          { start: 40, end: 40, serving: null },
        ],
        contacts: [
          { time: 21, side: "us", skill: "serve" },
          { time: 24.5, side: "them", skill: "receive" },
          { time: 41, side: "us" },
          { time: 43, skill: "set" },
        ],
      },
    });
    expect(result.ok && result.notices).toHaveLength(4);
  });
});

describe("loadDraft", () => {
  const model = parsed(
    JSON.stringify({
      rallies: [
        {
          start: 10,
          end: 20,
          serving: "us",
          contacts: [
            [10, "us", "serve"],
            [12, "them", "receive"],
            [13, "them", "set"],
            [14, "them", "attack"],
            [15, "us", "block"],
            [16, "us", "attack"],
            [16.5, "them", "block"],
          ],
        },
        { start: 30, end: 31, serving: "them", contacts: [[30, "them", "serve"]] },
      ],
    })
  );

  test("keeps of the opponent only their serves", () => {
    const draft = loadDraft(emptyData(), model);

    expect(draft.contacts.map((c) => [c.time, c.side, c.skill])).toEqual([
      [10, "us", "serve"],
      [15, "us", "block"],
      [16, "us", "attack"],
      [30, "them", "serve"],
    ]);
    expect(draft.contacts.every((c) => c.model)).toBe(true);
    expect(draft.rallies).toHaveLength(2);
  });

  test("adds to the draft the set holds, leaving out contacts already recorded", () => {
    const marked = withEvents([{ ...serve, timestamp: 10.5 }], addMark(undefined, 99));
    const draft = loadDraft(marked, model);

    expect(draft.contacts.map((c) => c.time)).toEqual([15, 16, 30, 99]);
    expect(draft.contacts.filter((c) => !c.model)).toEqual([{ id: 1, time: 99 }]);
  });

  test("the rallies give the next serve to jump to, 3 s before it", () => {
    const starts = loadDraft(emptyData(), model).rallies.map((r) => r.start);

    expect([serveJump(starts, 0), serveJump(starts, 10), serveJump(starts, 100), serveJump(starts, 20, -1)]).toEqual([
      7,
      27,
      null,
      7,
    ]);
  });
});

test("the scene names our half and how the video is turned", () => {
  expect(sceneText({ ourHalf: "far" })).toMatch(/plays on the far half/);
  expect(sceneText({ ourHalf: "near", videoTurn: 90 })).toMatch(/nearer to the camera[\s\S]*quarter turn clockwise/);
});

describe("clearing the draft", () => {
  const draft = {
    rallies: [{ start: 10, end: 18, serving: "us" as const }],
    contacts: [
      { id: 1, time: 11 },
      { id: 2, time: 12, model: true as const },
    ],
  };

  test("clearing the marks keeps what a model placed, and clearing a model's draft keeps the marks", () => {
    expect(dropContacts(draft, "marks")).toEqual({ rallies: draft.rallies, contacts: [draft.contacts[1]] });
    expect(dropContacts(draft, "model")).toEqual({ rallies: [], contacts: [draft.contacts[0]] });
  });

  test("a set without its draft is what its saved stats hold", () => {
    expect(withoutDraft(withEvents([serve], draft))).toEqual(withEvents([serve]));
  });
});
