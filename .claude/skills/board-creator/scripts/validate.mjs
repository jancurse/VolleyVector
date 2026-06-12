#!/usr/bin/env node
// Standalone bundle validator: `node validate.mjs <bundle.json>`. No dependencies and no imports from
// the app, so it can travel with the skill. A repo test feeds the example bundles through both this
// and the real app parser, so the two cannot drift apart silently.

import { readFileSync } from "node:fs";

const FORMAT_VERSION = 2;
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

// Rotation legality, mirroring src/boards/rotation.ts.
const ROTATION_SLOTS = [1, 2, 3, 4, 5, 6];
const FRONT_ROW = [2, 3, 4];
const PLAYER_ROLES = ["setter", "outside", "middle", "opposite", "libero", "player"];
const Y_PAIRS = [
  [1, 2],
  [6, 3],
  [5, 4],
]; // [back, front]
const X_PAIRS = [
  [4, 3],
  [3, 2],
  [5, 6],
  [6, 1],
]; // [left, right]

// The 5-1 service order S → OH1 → MB1 → OPP → OH2 → MB2, with a libero standing in for MB2 on the
// back-row middle slot, or null when the roster is not a 5-1.
function presetAssignment(markers, rotation) {
  const players = markers.filter((m) => isRecord(m) && PLAYER_ROLES.includes(m.role));

  if (players.length !== 6) return null;

  const of = (role) =>
    players.filter((p) => p.role === role).sort((a, b) => (a.label ?? "").localeCompare(b.label ?? ""));
  const [setters, outsides, middles, opposites, liberos] = ["setter", "outside", "middle", "opposite", "libero"].map(of);

  if (setters.length !== 1 || outsides.length !== 2 || opposites.length !== 1) return null;
  if (middles.length + liberos.length !== 2 || middles.length === 0) return null;

  const order = [setters[0], outsides[0], middles[0], opposites[0], outsides[1], middles[1] ?? liberos[0]];
  const slotAt = (i) => ((rotation - 1 + i) % 6) + 1;
  const assignment = {};

  order.forEach((p, i) => (assignment[slotAt(i)] = p.id));

  if (liberos.length === 1) {
    const middleSlot = slotAt(2);
    const otherSlot = slotAt(5);
    const frontSlot = FRONT_ROW.includes(middleSlot) ? middleSlot : otherSlot;

    assignment[frontSlot] = order[2].id;
    assignment[frontSlot === middleSlot ? otherSlot : middleSlot] = liberos[0].id;
  }

  return assignment;
}

// A complete custom assignment (six slots, six distinct known markers), or null while inactive.
function customAssignment(entries, markerIds) {
  const ids = ROTATION_SLOTS.map((slot) => entries[slot]).filter((id) => typeof id === "string" && markerIds.has(id));

  if (new Set(ids).size !== 6) return null;

  return Object.fromEntries(ROTATION_SLOTS.map((slot) => [slot, entries[slot]]));
}

// The overlap checks of FIVB Rule 7.4 (ties are legal), an assigned player outside the playing
// area, and a libero on a front-row slot. Skipped when an assigned marker has no valid position.
function rotationViolations(assignment, positions, markers) {
  const at = (slot) => positions[assignment[slot]];

  if (ROTATION_SLOTS.some((slot) => !isPoint(at(slot)))) return [];

  const name = (slot) => `"${assignment[slot]}" (slot ${slot})`;
  const messages = [];

  for (const [back, front] of Y_PAIRS)
    if (at(back).y < at(front).y) messages.push(`rotation overlap — ${name(back)} must stay behind ${name(front)}.`);
  for (const [left, right] of X_PAIRS)
    if (at(left).x > at(right).x) messages.push(`rotation overlap — ${name(left)} must stay left of ${name(right)}.`);
  for (const slot of ROTATION_SLOTS) {
    const p = at(slot);

    if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1)
      messages.push(`rotation — ${name(slot)} is outside the playing area.`);
    if (FRONT_ROW.includes(slot) && markers.find((m) => isRecord(m) && m.id === assignment[slot])?.role === "libero")
      messages.push(`rotation — libero ${name(slot)} cannot take a front-row slot.`);
  }

  return messages;
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
    if (board.rotationStrict !== undefined && typeof board.rotationStrict !== "boolean")
      errors.push(`${where}: "rotationStrict" must be a boolean.`);

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

      if (step.rotation !== undefined) {
        const isSlot = (value) => Number.isInteger(value) && value >= 1 && value <= 6;
        const rotation = step.rotation;

        if (!isRecord(rotation) || (rotation.kind !== "preset" && rotation.kind !== "custom"))
          warnings.push(`${at}: unreadable rotation — the app drops it on import.`);
        else if (rotation.kind === "preset" && !isSlot(rotation.rotation))
          warnings.push(`${at}: preset rotation must be a slot 1–6 — the app drops it on import.`);
        else if (rotation.kind === "custom" && !isRecord(rotation.assignment))
          warnings.push(`${at}: custom rotation needs an "assignment" map — the app drops it on import.`);
        else {
          if (rotation.kind === "custom")
            for (const [slot, id] of Object.entries(rotation.assignment))
              if (!isSlot(Number(slot)) || typeof id !== "string" || !markerIds.has(id))
                warnings.push(`${at}: custom rotation entry "${slot}" — the app drops it on import.`);

          const markers = Array.isArray(board.markers) ? board.markers : [];
          const assignment =
            rotation.kind === "preset"
              ? presetAssignment(markers, rotation.rotation)
              : customAssignment(rotation.assignment, markerIds);

          if (rotation.kind === "preset" && !assignment)
            warnings.push(`${at}: preset rotation needs a 5-1 roster — it stays inactive in the app.`);
          if (assignment)
            for (const message of rotationViolations(assignment, step.positions, markers))
              warnings.push(`${at}: ${message}`);
        }
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
