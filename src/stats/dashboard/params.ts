import type { Skill } from "../types";
import { ALL } from "./data";
import type { Action } from "./data";

/** The rally log's column filters; an empty value shows everything. */
export type LogFilter = "winner" | "player" | "action" | "result" | "zone";

/** Everything the viewer has picked; the exports carry it, so they open (and print) as seen. */
export type Params = {
  set: string;
  player: string;
  skill: Skill;
  detail: Action;
  mbase: "set" | "match";
  log: Record<LogFilter, string>;
};

export const DEFAULT_PARAMS: Params = {
  set: ALL,
  player: ALL,
  skill: "attack",
  detail: "attack",
  mbase: "match",
  log: { winner: "", player: "", action: "", result: "", zone: "" },
};

/** The actions in the order the dashboard lists them. */
export const ORDER: readonly Action[] = ["serve", "receive", "set", "tip", "attack", "block", "defense", "freeball"];

export const ZONE_SKILLS: readonly Skill[] = ["serve", "receive", "set", "attack", "block", "defense", "freeball"];

export const NOUN: Partial<Record<Action, string>> = {
  serve: "serves",
  receive: "receptions",
  set: "sets",
  tip: "tips",
  attack: "attacks",
  block: "blocks",
  defense: "digs",
  freeball: "freeballs",
};

export const ZONE_HINTS: Partial<Record<Skill, string>> = {
  serve: "Where the serve went (0 is an error).",
  receive: "Where the player received from.",
  set: "Who was set: 1 back row, 2 opposite, 3 middle, 4 outside, 5 libero, 6 pipe.",
  attack: "Where the attack went (0 is an error).",
  block: "Where the attack came from (0 when not recorded).",
  defense: "Where the player defended from.",
  freeball: "Where the freeball went (0 is an error).",
};
