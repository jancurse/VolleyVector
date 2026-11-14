import { describe, expect, test } from "vitest";

import {
  chartAttacksPerPlayer,
  chartDefensePerPlayer,
  chartOpponentErrors,
  chartScoresOverTime,
  chartServes,
} from "../../src/stats/report/chartGenerator";
import {
  finalScore,
  getFilteredDataframes,
  matchSummary,
  reportStats,
  reportTitle,
  scoresOverTime,
  setLabel,
} from "../../src/stats/report/statsAnalyzer";
import { deriveRallies } from "../../src/stats/rallies";
import { emptyData } from "../../src/stats/store";
import type { MatchEvent, Skill, Team, Touch } from "../../src/stats/types";

// The set and match report's data.

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

describe("report data", () => {
  test("uses rally scores and lists points we won without a deciding touch", () => {
    const rallies = deriveRallies(
      [
        touch(1, "Mira", "serve", "dig23"),
        { kind: "point", id: 500, timestamp: 9, winner: "us", reason: "attack_error" }, // explicit opp error
        touch(20, "Mira", "serve", "dig23"),
        touch(40, "Mira", "serve", "ace"), // inferred win for rally 2, then an ace
      ],
      meta
    );

    expect(finalScore(rallies)).toEqual([3, 0]);
    expect(scoresOverTime(rallies).map((s) => s.our_score)).toEqual([0, 1, 2, 3]);

    const opp = reportStats(rallies).filter((s) => s.player === "opponent");

    expect(opp.map((s) => s.stat)).toEqual(["attack_error", "unspecified"]);

    const [chart, total] = chartOpponentErrors(reportStats(rallies));

    expect(total).toBe(2);
    expect(chart?.data.labels).toEqual(["Attack", "Unspecified"]);
  });
});

describe("match report", () => {
  const set = (n: string, winners: Team[]) => {
    const m = { ...emptyData().meta, setNumber: n, homeTeam: "QBC", awayTeam: "WW", date: "2026-10-04" };

    return {
      meta: m,
      rallies: deriveRallies(
        winners.map((w, i) => point(i + 1, w)),
        m
      ),
    };
  };

  test("summarises several sets", () => {
    const sets = [set("1", ["us", "us", "them"]), set("2", ["them", "them"]), set("3", ["us"])];

    expect(matchSummary(sets)).toEqual({
      scores: [
        [2, 1],
        [0, 2],
        [1, 0],
      ],
      setsWon: [2, 1],
    });
    expect(reportTitle(sets)).toBe("QBC vs WW (2026-10-04) - Sets: Us 2 - 1 Opponent");
    expect(reportTitle([sets[0]])).toBe("QBC vs WW - Set 1 (2026-10-04) - Score: Us 2 - 1 Opponent");
    expect(setLabel({ ...sets[0], meta: { ...sets[0].meta, setNumber: "" } }, 3)).toBe("Set 4");
  });

  test("builds every chart from several sets as one match", () => {
    const rally = (t: number, server: string, hitter: string, result: string): MatchEvent[] => [
      touch(t, server, "serve", "dig23"),
      touch(t + 3, "Suki", "defense", "dig23", "5"),
      touch(t + 4, "Nell", "set", "on", "4"),
      touch(t + 5, hitter, "attack", result, result === "out" ? "0" : "5"),
    ];
    const sets = [1, 2, 3].map((n) => {
      const events = [
        ...rally(1, "Mira", "Sian", "kill"),
        ...rally(20, "Mira", "Juno", "out"),
        ...rally(40, "Ivy", "Sian", "kill"),
      ];
      const m = { ...emptyData().meta, setNumber: String(n) };

      return { meta: m, rallies: deriveRallies(events, m) };
    });
    const stats = sets.flatMap((s) => reportStats(s.rallies));
    const fd = getFilteredDataframes(stats);

    expect(stats).toHaveLength(sets.reduce((n, s) => n + reportStats(s.rallies).length, 0));
    expect(chartAttacksPerPlayer(fd.df)).not.toBeNull();
    expect(chartServes(fd.df_no_errors)).not.toBeNull();
    expect(sets.every((s) => chartScoresOverTime(scoresOverTime(s.rallies)))).toBe(true);
    expect(matchSummary(sets).setsWon).toEqual([3, 0]);
  });
});

describe("defense per player chart", () => {
  test("stacks outcomes per player and splits out positioning errors", () => {
    const events: MatchEvent[] = [
      touch(1, "Suki", "defense", "dig23"),
      touch(2, "Suki", "defense", "dig23"),
      touch(3, "Mira", "defense", "error"),
      { ...(touch(10, "Suki", "defense", "error") as Touch), reason: "positioning" },
    ];
    const chart = chartDefensePerPlayer(reportStats(deriveRallies(events, meta)));

    expect(chart?.data.labels).toEqual(["Mira", "Suki"]);
    expect(Object.fromEntries((chart?.data.datasets ?? []).map((d) => [d.label, d.data]))).toEqual({
      dig23: [0, 2],
      error: [1, 0],
      "error: positioning": [0, 1],
    });
    expect(chartDefensePerPlayer([])).toBeNull();
  });
});
