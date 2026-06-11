#!/usr/bin/env node
// Standalone bundle validator: `node validate.mjs <bundle.json>`. No dependencies and no imports from
// the app, so it can travel with the skill. A repo test feeds the example bundles through both this
// and the real app parser, so the two cannot drift apart silently.

import { readFileSync } from "node:fs";

const FORMAT_VERSION = 1;
const ROLES = ["setter", "outside", "middle", "opposite", "libero", "ball", "coach", "player"];
const COLORS = ["blue", "red", "green", "amber", "violet", "slate"];
const ANNOTATION_KINDS = ["line", "arrow", "rect", "ellipse", "polygon", "free", "text"];
const REACH = 0.1; // how far past the court a marker may sit before the app clamps it

const errors = [];
const warnings = [];

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPoint(value) {
  return isRecord(value) && Number.isFinite(value.x) && Number.isFinite(value.y);
}

function inReach(point) {
  return point.x >= -REACH && point.x <= 1 + REACH && point.y >= -REACH && point.y <= 1 + REACH;
}

const file = process.argv[2];

if (!file) {
  console.error("Usage: node validate.mjs <bundle.json>");
  process.exit(2);
}

let bundle;

try {
  bundle = JSON.parse(readFileSync(file, "utf8"));
} catch (cause) {
  console.error(`Cannot read bundle: ${cause.message}`);
  process.exit(1);
}

if (!isRecord(bundle)) errors.push("The bundle must be a JSON object.");
else {
  const version = bundle.formatVersion;

  if (!Number.isInteger(version) || version < 0) errors.push('"formatVersion" must be a non-negative integer.');
  else if (version > FORMAT_VERSION) errors.push(`formatVersion ${version} is newer than this validator (${FORMAT_VERSION}).`);
  else if (version < FORMAT_VERSION) warnings.push(`formatVersion ${version} is older than current (${FORMAT_VERSION}).`);

  const topics = Array.isArray(bundle.topics) ? bundle.topics : (errors.push('"topics" must be an array.'), []);
  const boards = Array.isArray(bundle.boards) ? bundle.boards : (errors.push('"boards" must be an array.'), []);

  const refs = new Set();
  const topicRefs = new Set();
  const boardRefs = new Set();

  for (const [list, set] of [
    [topics, topicRefs],
    [boards, boardRefs],
  ])
    for (const entry of list)
      if (isRecord(entry) && typeof entry.ref === "string" && entry.ref !== "") {
        if (refs.has(entry.ref)) errors.push(`Duplicate ref "${entry.ref}".`);
        refs.add(entry.ref);
        set.add(entry.ref);
      }

  topics.forEach((topic, i) => {
    const where = isRecord(topic) && typeof topic.ref === "string" ? `Topic "${topic.ref}"` : `Topic ${i + 1}`;

    if (!isRecord(topic)) return errors.push(`${where}: must be an object.`);
    if (typeof topic.ref !== "string" || topic.ref === "") errors.push(`${where}: "ref" must be a non-empty string.`);
    if (typeof topic.title !== "string") errors.push(`${where}: "title" must be a string.`);
    if (topic.parentRef != null && !topicRefs.has(topic.parentRef))
      errors.push(`${where}: unknown parentRef "${topic.parentRef}".`);

    if (topic.blocks !== undefined) {
      if (!Array.isArray(topic.blocks)) return errors.push(`${where}: "blocks" must be an array.`);
      topic.blocks.forEach((block, j) => {
        const ok =
          isRecord(block) &&
          ((block.kind === "markdown" && typeof block.text === "string") ||
            (block.kind === "boards" && Array.isArray(block.boardRefs)));

        if (!ok) return errors.push(`${where} block ${j + 1}: must be a markdown block (text) or a boards block (boardRefs).`);
        if (block.kind === "boards")
          for (const ref of block.boardRefs)
            if (!boardRefs.has(ref)) errors.push(`${where}: unknown board ref "${ref}" in a boards block.`);
      });
    }
  });

  // Cycle check over the parent refs.
  const parentOf = new Map(topics.filter(isRecord).map((t) => [t.ref, t.parentRef ?? null]));

  for (const ref of topicRefs) {
    const seen = new Set();
    let current = ref;

    while (current !== null && topicRefs.has(current)) {
      if (seen.has(current)) {
        errors.push(`Topic "${ref}": its parent refs form a cycle.`);
        break;
      }
      seen.add(current);
      current = parentOf.get(current) ?? null;
    }
  }

  boards.forEach((board, i) => {
    const where = isRecord(board) && typeof board.ref === "string" ? `Board "${board.ref}"` : `Board ${i + 1}`;

    if (!isRecord(board)) return errors.push(`${where}: must be an object.`);
    if (typeof board.ref !== "string" || board.ref === "") errors.push(`${where}: "ref" must be a non-empty string.`);
    if (typeof board.title !== "string") errors.push(`${where}: "title" must be a string.`);
    if (board.mode !== "positions" && board.mode !== "basic")
      errors.push(`${where}: "mode" must be "positions" or "basic".`);
    if (board.topicRef != null && !topicRefs.has(board.topicRef))
      errors.push(`${where}: unknown topicRef "${board.topicRef}".`);
    if (board.tags !== undefined && !(Array.isArray(board.tags) && board.tags.every((t) => typeof t === "string")))
      errors.push(`${where}: "tags" must be a string array.`);

    const markerIds = new Set();

    if (!Array.isArray(board.markers)) errors.push(`${where}: "markers" must be an array.`);
    else
      board.markers.forEach((marker, j) => {
        const at = `${where} marker ${j + 1}`;

        if (!isRecord(marker) || typeof marker.id !== "string" || marker.id === "")
          return errors.push(`${at}: must be an object with a non-empty string "id".`);
        if (markerIds.has(marker.id)) errors.push(`${at}: duplicate marker id "${marker.id}".`);
        markerIds.add(marker.id);
        if (!ROLES.includes(marker.role)) errors.push(`${at}: unknown role "${marker.role}".`);
        if (marker.color !== undefined && !COLORS.includes(marker.color))
          errors.push(`${at}: unknown color "${marker.color}".`);
      });

    if (!Array.isArray(board.steps) || board.steps.length === 0)
      return errors.push(`${where}: "steps" must be a non-empty array.`);

    board.steps.forEach((step, j) => {
      const at = `${where} step ${j + 1}`;

      if (!isRecord(step) || !isRecord(step.positions))
        return errors.push(`${at}: must be an object with a "positions" map.`);

      for (const id of markerIds)
        if (step.positions[id] === undefined)
          warnings.push(`${at}: no position for marker "${id}" — the app benches it on import.`);

      for (const [id, position] of Object.entries(step.positions)) {
        if (!markerIds.has(id)) warnings.push(`${at}: position for unknown marker id "${id}" is ignored.`);
        else if (!isPoint(position)) errors.push(`${at}: position of marker "${id}" must be an { x, y } point.`);
        else if (!inReach(position)) warnings.push(`${at}: marker "${id}" is off the court — the app clamps it.`);
      }

      if (step.annotations !== undefined) {
        if (!Array.isArray(step.annotations)) return errors.push(`${at}: "annotations" must be an array.`);
        step.annotations.forEach((annotation, k) => {
          const bad =
            !isRecord(annotation) ||
            !ANNOTATION_KINDS.includes(annotation.kind) ||
            !COLORS.includes(annotation.color) ||
            !(Number.isFinite(annotation.width) && annotation.width > 0);

          if (bad) warnings.push(`${at} annotation ${k + 1}: malformed — the app drops it on import.`);
        });
      }
    });
  });
}

for (const message of errors) console.error(`ERROR: ${message}`);
for (const message of warnings) console.warn(`WARNING: ${message}`);

if (errors.length > 0) {
  console.error(`\n${errors.length} error(s), ${warnings.length} warning(s).`);
  process.exit(1);
}

console.log(`Valid bundle: ${warnings.length} warning(s).`);
