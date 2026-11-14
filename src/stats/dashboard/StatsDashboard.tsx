import { useCallback, useEffect, useMemo, useState } from "react";
import type { JSX } from "react";

import { formatGameDate } from "../../games/format";
import { Select } from "../../ui/Select";
import { ToggleGroup } from "../../ui/ToggleGroup";
import {
  cx,
  DASH_CARD,
  DASH_CARD_TITLE,
  DASH_GRID,
  DASH_NOTE,
  DASH_SECTION_TITLE,
  DASH_WIDE,
  SWATCH,
  TITLE,
} from "../../ui/styles";
import type { Selection } from "../clips";
import { skillDef } from "../codes";
import type { ReportSet } from "../types";
import { ClipsContext } from "./clips";
import { DashboardCard } from "./DashboardCard";
import {
  actionLabel,
  ALL,
  clipSelection,
  clipTouches,
  matchTables,
  momentum,
  plusMinus,
  pointTypes,
  rotationStats,
  setScores,
  skillGrades,
  skillSummary,
} from "./data";
import type { ClipQuery } from "./data";
import { Legend } from "./Legend";
import { MetricCards } from "./MetricCards";
import { Momentum } from "./Momentum";
import { DEFAULT_PARAMS, ORDER, ZONE_HINTS, ZONE_SKILLS } from "./params";
import type { Params } from "./params";
import { PlayerDetail } from "./PlayerDetail";
import { PlayerGrid } from "./PlayerGrid";
import { PlayingTime } from "./PlayingTime";
import { PointBreakdown } from "./PointBreakdown";
import { RallyLog } from "./RallyLog";
import { RotationKey } from "./RotationKey";
import { Rotations } from "./Rotations";
import { ScoreLines } from "./ScoreLines";
import { SetTiles } from "./SetTiles";
import { Zones } from "./Zones";

type StatsDashboardProps = {
  sets: readonly ReportSet[];
  /** Plays the matching moments; without it (the exported page) there is no clip button. */
  onClips?: (selection: Partial<Selection>) => void;
  /** The view to open with, e.g. the one an export was made from. */
  initial?: Partial<Params>;
  /** Called whenever the viewer changes a filter, so the exports start from the same view. */
  onParams?: (p: Params) => void;
  /** The match as the page's title, on the exported page; in the app the stats page carries the title. */
  showTitle?: boolean;
};

const SECTION = "flex flex-col gap-4";

/** Match stats from recorded sets: scores, rotations, momentum, outcomes per action, players, zones, rallies. */
export default function StatsDashboard({
  sets,
  onClips,
  initial,
  onParams,
  showTitle,
}: StatsDashboardProps): JSX.Element {
  const tables = useMemo(() => matchTables([...sets]), [sets]);
  const calc = useMemo(() => {
    const { touches, rallies } = tables;

    return {
      summary: skillSummary(touches),
      grades: skillGrades(touches),
      pm: plusMinus(rallies, touches),
      mom: momentum(rallies),
      points: pointTypes(rallies),
      rotations: rotationStats(rallies, touches),
      scores: setScores(tables.sets, rallies),
    };
  }, [tables]);
  const [p, setP] = useState<Params>(() => ({ ...DEFAULT_PARAMS, ...initial }));
  const up = useCallback((patch: Partial<Params>) => setP((x) => ({ ...x, ...patch })), []);

  useEffect(() => {
    onParams?.(p);
  }, [p, onParams]);

  const clips = useMemo(
    () => ({
      count: (q: ClipQuery) => clipTouches(tables, q).length,
      play: onClips && ((q: ClipQuery) => onClips(clipSelection(tables, q))),
    }),
    [tables, onClips]
  );

  // Players by how many touches they have.
  const players = useMemo(() => {
    const n = new Map<string, number>();

    for (const t of tables.touches) n.set(t.player, (n.get(t.player) ?? 0) + 1);

    return [...n].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [tables]);

  const matches = new Set(tables.sets.map((s) => s.match));
  const first = tables.sets[0];
  const title =
    matches.size > 1 ? `${matches.size} matches` : [first?.home, first?.away].filter(Boolean).join(" vs ") || "Match";
  const dates = [...new Set(tables.sets.map((s) => s.date).filter(Boolean))].map(formatGameDate).join(", ");
  const setLabels = new Map(tables.sets.map((s) => [s.id, s.label]));
  const actions = ORDER.filter((a) => calc.summary.some((r) => r.set === p.set && r.skill === a));

  return (
    <ClipsContext.Provider value={clips}>
      <div className="flex flex-col gap-7 text-sm text-text [print-color-adjust:exact]">
        <header className="flex flex-col gap-2">
          {showTitle && <h1 className={TITLE}>{title}</h1>}
          {dates && <p className={DASH_NOTE}>{dates}</p>}
          <SetTiles scores={calc.scores} sets={tables.sets} rallies={tables.rallies} />
        </header>

        <div className="border-b border-border pb-3 print:border-0">
          <ToggleGroup
            variant="pills"
            ariaLabel="Set"
            value={p.set}
            onValueChange={(set) => up({ set })}
            items={[
              { value: ALL, label: "All sets" },
              ...calc.scores.map((s) => ({ value: s.set, label: setLabels.get(s.set) ?? s.set })),
            ]}
          />
        </div>

        <section className={SECTION} aria-labelledby="dash-match">
          <h2 id="dash-match" className={DASH_SECTION_TITLE}>
            Match
          </h2>
          <div className={DASH_GRID}>
            <DashboardCard title="Point breakdown">
              <Legend
                items={[
                  { swatch: cx(SWATCH, "bg-chart-them"), label: "Opponent" },
                  { swatch: cx(SWATCH, "bg-chart-us"), label: "Us" },
                ]}
              />
              <PointBreakdown rows={calc.points.filter((r) => r.set === p.set)} />
            </DashboardCard>
            <DashboardCard title="Rotations">
              <RotationKey />
              <Rotations rows={calc.rotations.filter((r) => r.set === p.set)} />
            </DashboardCard>
            <DashboardCard
              title="Momentum"
              action={
                <ToggleGroup
                  ariaLabel="Baseline"
                  value={p.mbase}
                  onValueChange={(v) => up({ mbase: v === "set" ? "set" : "match" })}
                  items={[
                    { value: "set", label: "Set" },
                    { value: "match", label: "Match" },
                  ]}
                />
              }
            >
              <Legend
                items={[
                  { swatch: cx(SWATCH, "bg-chart-us"), label: "Won" },
                  { swatch: "inline-block h-3.5 w-0.5 bg-text", label: "Average" },
                ]}
              />
              <Momentum mom={calc.mom} set={p.set} mbase={p.mbase} />
            </DashboardCard>
            <DashboardCard title="Playing time">
              <PlayingTime rows={calc.pm.filter((r) => r.set === p.set)} />
            </DashboardCard>
            <DashboardCard title="Score progression" wide>
              <Legend
                items={[
                  { swatch: cx(SWATCH, "bg-chart-us"), label: "Us" },
                  { swatch: cx(SWATCH, "bg-chart-them"), label: "Opponent" },
                ]}
              />
              <ScoreLines rallies={tables.rallies} sets={tables.sets} set={p.set} />
            </DashboardCard>
          </div>
        </section>

        <section className={SECTION} aria-labelledby="dash-metrics">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="dash-metrics" className={cx(DASH_SECTION_TITLE, "flex-1")}>
              Metrics and zones{p.player === ALL ? "" : `: ${p.player}`}
            </h2>
            <div className="w-48 print:hidden">
              <Select
                ariaLabel="Player"
                value={p.player}
                onValueChange={(player) => up({ player })}
                options={[
                  { value: ALL, label: "All players" },
                  ...players.map((name) => ({ value: name, label: name })),
                ]}
              />
            </div>
          </div>
          <div className={DASH_GRID}>
            <div className={DASH_WIDE}>
              <MetricCards summary={calc.summary} grades={calc.grades} set={p.set} player={p.player} />
            </div>
            <DashboardCard title="Zones">
              <ToggleGroup
                variant="pills"
                ariaLabel="Zones for"
                value={p.skill}
                onValueChange={(v) => up({ skill: ZONE_SKILLS.find((s) => s === v) ?? p.skill })}
                items={ZONE_SKILLS.map((s) => ({ value: s, label: skillDef(s).label }))}
              />
              <p className={DASH_NOTE}>{ZONE_HINTS[p.skill]}</p>
              <p className={DASH_NOTE}>
                The shade counts touches and the bar shows their outcomes. Tap a zone for details.
              </p>
              <Zones
                grades={calc.grades.filter((r) => r.set === p.set && r.player === p.player && r.skill === p.skill)}
                skill={p.skill}
                set={p.set}
                player={p.player}
              />
            </DashboardCard>
          </div>
        </section>

        <section className={SECTION} aria-labelledby="dash-players">
          <h2 id="dash-players" className={DASH_SECTION_TITLE}>
            Players
          </h2>
          <div className={DASH_GRID}>
            <DashboardCard title="Player metrics" wide>
              <PlayerGrid
                summary={calc.summary}
                pm={calc.pm}
                set={p.set}
                player={p.player}
                onPlayer={(player) => up({ player })}
              />
            </DashboardCard>
            <DashboardCard title="Player detail">
              <ToggleGroup
                variant="pills"
                ariaLabel="Detail for"
                value={p.detail}
                onValueChange={(v) => up({ detail: actions.find((a) => a === v) ?? p.detail })}
                items={actions.map((a) => ({ value: a, label: actionLabel(a) }))}
              />
              <PlayerDetail summary={calc.summary} grades={calc.grades} set={p.set} action={p.detail} />
            </DashboardCard>
          </div>
        </section>

        <section className={SECTION} aria-labelledby="dash-rallies">
          <h2 id="dash-rallies" className={DASH_SECTION_TITLE}>
            Rallies
          </h2>
          <div className={DASH_CARD}>
            <h3 className={DASH_CARD_TITLE}>Rally log</h3>
            <p className={DASH_NOTE}>Every touch, grouped by rally. Filter in the column headers.</p>
            <RallyLog tables={tables} p={p} up={up} />
          </div>
        </section>
      </div>
    </ClipsContext.Provider>
  );
}
