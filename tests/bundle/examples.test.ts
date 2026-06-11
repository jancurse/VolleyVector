import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { parseBundle } from "../../src/bundle/parse";

// The board-creator skill's example bundles must satisfy both the real app parser and the skill's
// standalone validator, so the two cannot drift apart without failing here.

const SKILL_DIR = join(process.cwd(), ".claude/skills/board-creator");
const EXAMPLES = readdirSync(join(SKILL_DIR, "examples")).filter((name) => name.endsWith(".json"));

describe.each(EXAMPLES)("example bundle %s", (name) => {
  const file = join(SKILL_DIR, "examples", name);

  test("parses cleanly through src/bundle", () => {
    const result = parseBundle(readFileSync(file, "utf8"), []);

    if (!result.ok) throw new Error(result.errors.join("\n"));
    expect(result.value.notices).toEqual([]);
    expect(result.value.boards.length).toBeGreaterThan(0);
  });

  test("passes scripts/validate.mjs without warnings", () => {
    const output = execFileSync(process.execPath, [join(SKILL_DIR, "scripts/validate.mjs"), file], {
      encoding: "utf8",
    });

    expect(output).toContain("Valid bundle: 0 warning(s).");
  });
});
