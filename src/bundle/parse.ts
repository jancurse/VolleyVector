import { normalizeAnnotation } from "../boards/normalize";
import { benchPosition } from "../boards/operations";
import type { Annotation, Board, BoardStep, RotationSlot, StepRotation } from "../boards/types";
import { clampToCourt } from "../court/geometry";
import type { NormalizedPoint } from "../court/geometry";
import { COLOR_KEYS, ROLES } from "../court/roles";
import type { ColorKey, MarkerRole } from "../court/roles";
import type { AnnotationDash, AnnotationFill, Marker } from "../court/types";
import { uniqueSlug } from "../routing/slug";
import type { Topic, TopicBlock } from "../topics/types";
import type { BundleBoard, BundleStep, BundleTopic } from "./types";
import { FORMAT_VERSION } from "./types";

// Parses bundle JSON into ready-to-insert topics and boards. Strict on structure — malformed JSON,
// missing required fields, unknown refs, and ref cycles come back as readable errors — and lenient on
// content: coordinates clamp to the court, a step missing a marker's position benches that marker, an
// invalid annotation is dropped, and unknown extra fields are ignored, each with a notice. The result
// carries fresh ids throughout, so importing is always create-only and never collides.

export type BundleImport = {
  /** Fresh-id topics, parents before children, slugs and orders minted against the existing tree. */
  topics: Topic[];
  /** Fresh-id boards, filed into the new topics (or Unfiled). Owner and timestamps are the caller's. */
  boards: Board[];
  /** Non-blocking leniency and version notes to surface beside the preview. */
  notices: string[];
};

export type ParseResult = { ok: true; value: BundleImport } | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPoint(value: unknown): value is NormalizedPoint {
  return isRecord(value) && Number.isFinite(value.x) && Number.isFinite(value.y);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isRole(value: unknown): value is MarkerRole {
  return typeof value === "string" && value in ROLES;
}

function isColorKey(value: unknown): value is ColorKey {
  return typeof value === "string" && (COLOR_KEYS as string[]).includes(value);
}

/** Validate and clean one annotation (any stored shape, legacy included), or null when unusable. */
function parseAnnotation(raw: unknown): Annotation | null {
  if (!isRecord(raw) || !isColorKey(raw.color)) return null;
  if (typeof raw.width !== "number" || !Number.isFinite(raw.width) || raw.width <= 0) return null;

  const dash: AnnotationDash | undefined = raw.dash === "solid" || raw.dash === "dashed" ? raw.dash : undefined;
  const fill: AnnotationFill | undefined =
    raw.fill === "none" || raw.fill === "tint" || raw.fill === "hachure" ? raw.fill : undefined;
  const style = { id: crypto.randomUUID(), color: raw.color, width: raw.width, ...(dash && { dash }) };
  const point = (value: unknown): NormalizedPoint | null => (isPoint(value) ? clampToCourt(value) : null);
  const points = (value: unknown, min: number): NormalizedPoint[] | null =>
    Array.isArray(value) && value.length >= min && value.every(isPoint) ? value.map(clampToCourt) : null;

  switch (raw.kind) {
    case "line": {
      const a = point(raw.a);
      const b = point(raw.b);

      return a && b ? { ...style, kind: "line", a, b } : null;
    }
    case "arrow": {
      const from = point(raw.from);
      const to = point(raw.to);
      const via = point(raw.via);

      return from && to ? { ...style, kind: "arrow", from, to, ...(via && { via }) } : null;
    }
    // Legacy shapes (the retired area, a closed shape without a fill) normalize like stored rows do.
    case "area":
    case "rect":
    case "ellipse": {
      const a = point(raw.a);
      const b = point(raw.b);

      if (!a || !b) return null;

      const box = { ...style, a, b, ...(fill && { fill }) };

      return raw.kind === "area"
        ? normalizeAnnotation({ ...box, kind: "area" })
        : raw.kind === "rect"
          ? normalizeAnnotation({ ...box, kind: "rect" })
          : normalizeAnnotation({ ...box, kind: "ellipse" });
    }
    case "polygon": {
      const vertices = points(raw.points, 3);

      return vertices ? { ...style, kind: "polygon", points: vertices, fill: fill ?? "none" } : null;
    }
    case "free": {
      const stroke = points(raw.points, 2);

      return stroke ? { ...style, kind: "free", points: stroke } : null;
    }
    case "text": {
      const at = point(raw.at);

      return at && typeof raw.text === "string" ? { ...style, kind: "text", at, text: raw.text } : null;
    }
    default:
      return null;
  }
}

function isSlot(value: unknown): value is RotationSlot {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 6;
}

/** Validate and clean one step's rotation, or null when unusable. A custom assignment keeps only
 *  entries with a valid slot and a known marker id, counting what it drops. */
function parseRotation(
  raw: unknown,
  markerIds: ReadonlySet<string>
): { rotation: StepRotation; dropped: number } | null {
  if (!isRecord(raw)) return null;
  if (raw.kind === "preset")
    return isSlot(raw.rotation) ? { rotation: { kind: "preset", rotation: raw.rotation }, dropped: 0 } : null;
  if (raw.kind !== "custom" || !isRecord(raw.assignment)) return null;

  const assignment: Partial<Record<RotationSlot, string>> = {};
  let dropped = 0;

  for (const [slot, id] of Object.entries(raw.assignment)) {
    const number = Number(slot);

    if (isSlot(number) && typeof id === "string" && markerIds.has(id)) assignment[number] = id;
    else dropped += 1;
  }

  return { rotation: { kind: "custom", assignment }, dropped };
}

/** Validate one topic entry into the typed shape, pushing errors; refs are cross-checked by the caller. */
function parseTopicEntry(raw: unknown, index: number, errors: string[]): BundleTopic | null {
  const where = `Topic ${index + 1}`;

  if (!isRecord(raw)) {
    errors.push(`${where}: must be an object.`);

    return null;
  }

  const before = errors.length;

  if (typeof raw.ref !== "string" || raw.ref === "") errors.push(`${where}: "ref" must be a non-empty string.`);
  if (typeof raw.title !== "string") errors.push(`${where}: "title" must be a string.`);
  if (raw.parentRef !== undefined && raw.parentRef !== null && typeof raw.parentRef !== "string")
    errors.push(`${where}: "parentRef" must be a topic ref or null.`);

  const blocks: BundleTopic["blocks"] = [];

  if (raw.blocks !== undefined) {
    if (!Array.isArray(raw.blocks)) errors.push(`${where}: "blocks" must be an array.`);
    else
      raw.blocks.forEach((block: unknown, i: number) => {
        if (isRecord(block) && block.kind === "markdown" && typeof block.text === "string")
          blocks.push({ kind: "markdown", text: block.text });
        else if (isRecord(block) && block.kind === "boards" && isStringArray(block.boardRefs))
          blocks.push({ kind: "boards", boardRefs: block.boardRefs });
        else errors.push(`${where} block ${i + 1}: must be a markdown block (text) or a boards block (boardRefs).`);
      });
  }

  if (errors.length > before || typeof raw.ref !== "string" || typeof raw.title !== "string") return null;

  return {
    ref: raw.ref,
    title: raw.title,
    parentRef: typeof raw.parentRef === "string" ? raw.parentRef : null,
    blocks,
  };
}

/** Validate one board entry into the typed shape, pushing errors; refs are cross-checked by the caller.
 *  An unusable step rotation is dropped with a notice, like an invalid annotation. */
function parseBoardEntry(raw: unknown, index: number, errors: string[], notices: string[]): BundleBoard | null {
  if (!isRecord(raw)) {
    errors.push(`Board ${index + 1}: must be an object.`);

    return null;
  }

  const where = typeof raw.ref === "string" && raw.ref !== "" ? `Board "${raw.ref}"` : `Board ${index + 1}`;
  const before = errors.length;

  if (typeof raw.ref !== "string" || raw.ref === "") errors.push(`${where}: "ref" must be a non-empty string.`);
  if (typeof raw.title !== "string") errors.push(`${where}: "title" must be a string.`);
  if (raw.mode !== "positions" && raw.mode !== "basic") errors.push(`${where}: "mode" must be "positions" or "basic".`);
  if (raw.topicRef !== undefined && raw.topicRef !== null && typeof raw.topicRef !== "string")
    errors.push(`${where}: "topicRef" must be a topic ref or null.`);
  if (raw.description !== undefined && typeof raw.description !== "string")
    errors.push(`${where}: "description" must be a string.`);
  if (raw.tags !== undefined && !isStringArray(raw.tags)) errors.push(`${where}: "tags" must be a string array.`);
  if (raw.autoArrows !== undefined && typeof raw.autoArrows !== "boolean")
    errors.push(`${where}: "autoArrows" must be a boolean.`);
  if (raw.rotationStrict !== undefined && typeof raw.rotationStrict !== "boolean")
    errors.push(`${where}: "rotationStrict" must be a boolean.`);

  const markers: BundleBoard["markers"] = [];
  const markerIds = new Set<string>();

  if (!Array.isArray(raw.markers)) errors.push(`${where}: "markers" must be an array.`);
  else
    raw.markers.forEach((marker: unknown, i: number) => {
      const at = `${where} marker ${i + 1}`;

      if (!isRecord(marker) || typeof marker.id !== "string" || marker.id === "") {
        errors.push(`${at}: must be an object with a non-empty string "id".`);

        return;
      }

      if (markerIds.has(marker.id)) errors.push(`${at}: duplicate marker id "${marker.id}".`);
      markerIds.add(marker.id);

      if (!isRole(marker.role)) {
        errors.push(`${at}: unknown role "${String(marker.role)}".`);

        return;
      }

      if (marker.label !== undefined && typeof marker.label !== "string") {
        errors.push(`${at}: "label" must be a string.`);

        return;
      }

      if (marker.color !== undefined && !isColorKey(marker.color)) {
        errors.push(`${at}: unknown color "${String(marker.color)}".`);

        return;
      }

      markers.push({
        id: marker.id,
        role: marker.role,
        ...(marker.label !== undefined && { label: marker.label }),
        ...(marker.color !== undefined && { color: marker.color }),
      });
    });

  const steps: BundleStep[] = [];

  if (!Array.isArray(raw.steps) || raw.steps.length === 0) errors.push(`${where}: "steps" must be a non-empty array.`);
  else
    raw.steps.forEach((step: unknown, i: number) => {
      const at = `${where} step ${i + 1}`;

      if (!isRecord(step) || !isRecord(step.positions)) {
        errors.push(`${at}: must be an object with a "positions" map.`);

        return;
      }

      if (step.instruction !== undefined && typeof step.instruction !== "string")
        errors.push(`${at}: "instruction" must be a string.`);
      if (step.annotations !== undefined && !Array.isArray(step.annotations))
        errors.push(`${at}: "annotations" must be an array.`);

      const positions: Record<string, NormalizedPoint> = {};

      for (const [id, position] of Object.entries(step.positions)) {
        // Positions keyed by an unknown marker id are ignored, like other extra fields.
        if (!markerIds.has(id)) continue;
        if (isPoint(position)) positions[id] = position;
        else errors.push(`${at}: position of marker "${id}" must be an { x, y } point.`);
      }

      const rotation = step.rotation === undefined ? null : parseRotation(step.rotation, markerIds);

      if (step.rotation !== undefined && !rotation) notices.push(`${at}: dropped a rotation it could not read.`);
      if (rotation && rotation.dropped > 0)
        notices.push(
          `${at}: dropped ${rotation.dropped} custom rotation entr${rotation.dropped === 1 ? "y" : "ies"} with an unknown slot or marker.`
        );

      steps.push({
        ...(typeof step.instruction === "string" && { instruction: step.instruction }),
        positions,
        ...(Array.isArray(step.annotations) && { annotations: step.annotations }),
        ...(rotation && { rotation: rotation.rotation }),
      });
    });

  if (
    errors.length > before ||
    typeof raw.ref !== "string" ||
    typeof raw.title !== "string" ||
    (raw.mode !== "positions" && raw.mode !== "basic")
  )
    return null;

  return {
    ref: raw.ref,
    title: raw.title,
    mode: raw.mode,
    markers,
    steps,
    topicRef: typeof raw.topicRef === "string" ? raw.topicRef : null,
    ...(typeof raw.description === "string" && { description: raw.description }),
    ...(isStringArray(raw.tags) && { tags: raw.tags }),
    ...(typeof raw.autoArrows === "boolean" && { autoArrows: raw.autoArrows }),
    ...(typeof raw.rotationStrict === "boolean" && { rotationStrict: raw.rotationStrict }),
  };
}

/** Check every cross-reference resolves within the bundle and parent refs form no cycle. */
function checkRefs(topics: readonly BundleTopic[], boards: readonly BundleBoard[], errors: string[]): void {
  const topicRefs = new Set(topics.map((t) => t.ref));
  const boardRefs = new Set(boards.map((b) => b.ref));
  const parentOf = new Map(topics.map((t) => [t.ref, t.parentRef ?? null]));

  for (const topic of topics) {
    if (topic.parentRef != null && !topicRefs.has(topic.parentRef))
      errors.push(`Topic "${topic.ref}": unknown parentRef "${topic.parentRef}".`);
    for (const block of topic.blocks ?? [])
      if (block.kind === "boards")
        for (const ref of block.boardRefs)
          if (!boardRefs.has(ref)) errors.push(`Topic "${topic.ref}": unknown board ref "${ref}" in a boards block.`);

    const seen = new Set<string>();
    let current: string | null = topic.ref;

    while (current !== null && topicRefs.has(current)) {
      if (seen.has(current)) {
        errors.push(`Topic "${topic.ref}": its parent refs form a cycle.`);
        break;
      }
      seen.add(current);
      current = parentOf.get(current) ?? null;
    }
  }

  for (const board of boards)
    if (board.topicRef != null && !topicRefs.has(board.topicRef))
      errors.push(`Board "${board.ref}": unknown topicRef "${board.topicRef}".`);
}

/** Mint the import: fresh ids, slugs, and orders for topics (parents first), then the boards. */
function materialize(
  topics: readonly BundleTopic[],
  boards: readonly BundleBoard[],
  existingTopics: readonly Topic[],
  notices: string[]
): BundleImport {
  const boardIdByRef = new Map(boards.map((b) => [b.ref, crypto.randomUUID()]));
  const topicIdByRef = new Map<string, string>();
  const slugs = existingTopics.map((t) => t.slug);
  // Imported roots append after the existing roots; children of imported topics start at 0.
  const nextOrder = new Map<string | null, number>([
    [null, existingTopics.filter((t) => t.parentId === null).reduce((max, t) => Math.max(max, t.order), -1) + 1],
  ]);

  const byParent = new Map<string | null, BundleTopic[]>();

  for (const topic of topics) {
    const key = topic.parentRef ?? null;

    byParent.set(key, [...(byParent.get(key) ?? []), topic]);
  }

  const walk = (parentRef: string | null): BundleTopic[] =>
    (byParent.get(parentRef) ?? []).flatMap((t) => [t, ...walk(t.ref)]);

  const newTopics = walk(null).map((topic): Topic => {
    const id = crypto.randomUUID();

    topicIdByRef.set(topic.ref, id);

    const parentId = topic.parentRef != null ? (topicIdByRef.get(topic.parentRef) ?? null) : null;
    const order = nextOrder.get(parentId) ?? 0;

    nextOrder.set(parentId, order + 1);

    const slug = uniqueSlug(topic.title, slugs);

    slugs.push(slug);

    const blocks = (topic.blocks ?? []).map(
      (block): TopicBlock =>
        block.kind === "markdown"
          ? { id: crypto.randomUUID(), kind: "markdown", text: block.text }
          : { id: crypto.randomUUID(), kind: "boards", boardIds: block.boardRefs.map((r) => boardIdByRef.get(r)!) }
    );

    return { id, title: topic.title, slug, blocks, parentId, order };
  });

  const newBoards = boards.map((board): Board => {
    const steps = board.steps.map((step, i): BoardStep => {
      const positions: Record<string, NormalizedPoint> = {};
      const placed: Marker[] = [];

      for (const marker of board.markers) {
        const raw = step.positions[marker.id];
        let position: NormalizedPoint;

        if (raw === undefined) {
          notices.push(`Board "${board.ref}" step ${i + 1}: no position for marker "${marker.id}" — benched it.`);
          position = benchPosition(placed);
        } else {
          position = clampToCourt(raw);
          if (position.x !== raw.x || position.y !== raw.y)
            notices.push(`Board "${board.ref}" step ${i + 1}: marker "${marker.id}" was off the court — clamped.`);
        }

        positions[marker.id] = position;
        placed.push({ ...marker, position });
      }

      const annotations = (step.annotations ?? []).map(parseAnnotation).filter((a) => a !== null);

      if (annotations.length < (step.annotations?.length ?? 0))
        notices.push(`Board "${board.ref}" step ${i + 1}: dropped an annotation it could not read.`);

      return {
        id: crypto.randomUUID(),
        instruction: step.instruction ?? "",
        positions,
        ...(annotations.length > 0 && { annotations }),
        ...(step.rotation && { rotation: step.rotation }),
      };
    });

    return {
      id: boardIdByRef.get(board.ref)!,
      title: board.title,
      description: board.description ?? "",
      mode: board.mode,
      markers: board.markers,
      steps,
      tags: board.tags ?? [],
      topicId: board.topicRef != null ? (topicIdByRef.get(board.topicRef) ?? null) : null,
      owner: null,
      authorLocked: false,
      shared: false,
      teamId: null,
      autoArrows: board.autoArrows ?? true,
      rotationStrict: board.rotationStrict ?? false,
      createdAt: 0,
      updatedAt: 0,
    };
  });

  return { topics: newTopics, boards: newBoards, notices };
}

/** Parse bundle JSON into ready-to-insert content, against the active space's existing topics. */
export function parseBundle(text: string, existingTopics: readonly Topic[]): ParseResult {
  const errors: string[] = [];
  const notices: string[] = [];

  let root: unknown;

  try {
    root = JSON.parse(text);
  } catch (parseError) {
    return { ok: false, errors: [`Not valid JSON: ${(parseError as Error).message}`] };
  }

  if (!isRecord(root)) return { ok: false, errors: ["The bundle must be a JSON object."] };

  const version = root.formatVersion;

  if (typeof version !== "number" || !Number.isInteger(version) || version < 0)
    return { ok: false, errors: ['"formatVersion" must be a non-negative integer.'] };
  if (version > FORMAT_VERSION)
    return {
      ok: false,
      errors: [
        `This bundle uses format version ${version}, newer than this app supports (${FORMAT_VERSION}). Update the app to import it.`,
      ],
    };
  if (version < FORMAT_VERSION)
    notices.push(`This bundle uses an older format (version ${version}); whatever wrote it may be out of date.`);

  if (!Array.isArray(root.topics)) errors.push('"topics" must be an array.');
  if (!Array.isArray(root.boards)) errors.push('"boards" must be an array.');
  if (errors.length > 0) return { ok: false, errors };

  const topics = (root.topics as unknown[]).map((raw, i) => parseTopicEntry(raw, i, errors));
  const boards = (root.boards as unknown[]).map((raw, i) => parseBoardEntry(raw, i, errors, notices));

  const seenRefs = new Set<string>();

  for (const entry of [...topics, ...boards]) {
    if (!entry) continue;
    if (seenRefs.has(entry.ref)) errors.push(`Duplicate ref "${entry.ref}".`);
    seenRefs.add(entry.ref);
  }

  const cleanTopics = topics.filter((t) => t !== null);
  const cleanBoards = boards.filter((b) => b !== null);

  if (errors.length === 0) checkRefs(cleanTopics, cleanBoards, errors);
  if (errors.length > 0) return { ok: false, errors };

  return { ok: true, value: materialize(cleanTopics, cleanBoards, existingTopics, notices) };
}
