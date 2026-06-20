// Blocking PR guard (.github/workflows/ci.yml): fail when a migration the PR adds would apply out of order
// or duplicate an existing version. A migration's version is the numeric timestamp prefix of its filename
// in supabase/migrations/. It compares the PR's added migrations against origin/main, a no-op when none.
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const MIGRATIONS_DIR = "supabase/migrations";

export type OrderCheck = {
  highest: string | null; // main's highest migration version, or null when main has no migrations
  errors: string[]; // one message per offending added file
};

// The numeric timestamp prefix of a migration filename ("20260618120000"), or null if it has none.
export function migrationVersion(file: string): string | null {
  const match = /^(\d+)_/.exec(file.split("/").pop() ?? "");

  return match ? match[1] : null;
}

// existingFiles: the migrations already on main. addedFiles: the migrations the PR adds. A file is an error
// when its version is not after main's highest, or it duplicates another file added in the same PR. Versions
// compare as numbers: a short hand-picked prefix must read as earlier than a 14-digit timestamp, not after it.
export function checkMigrationOrder(existingFiles: readonly string[], addedFiles: readonly string[]): OrderCheck {
  const existing = existingFiles.map(migrationVersion).filter((v): v is string => v !== null);
  const highest = existing.length ? existing.reduce((a, b) => (Number(a) >= Number(b) ? a : b)) : null;
  const addedVersions = addedFiles.map(migrationVersion);
  const errors: string[] = [];

  addedFiles.forEach((file, i) => {
    const version = addedVersions[i];

    if (version === null) {
      errors.push(`${file}: filename has no numeric version prefix`);

      return;
    }

    const reasons: string[] = [];

    if (highest !== null && Number(version) <= Number(highest)) {
      reasons.push(`version ${version} is not after main's highest (${highest})`);
    }
    if (addedVersions.filter((v) => v === version).length > 1) {
      reasons.push(`version ${version} duplicates another migration added in this PR`);
    }
    if (reasons.length) errors.push(`${file}: ${reasons.join("; ")}`);
  });

  return { highest, errors };
}

function gitLines(args: string[]): string[] {
  return execFileSync("git", args, { encoding: "utf8" })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function run(): void {
  const sql = (file: string): boolean => file.endsWith(".sql");
  const existing = gitLines(["ls-tree", "-r", "--name-only", "origin/main", "--", MIGRATIONS_DIR]).filter(sql);
  const added = gitLines([
    "diff",
    "--name-only",
    "--diff-filter=A",
    "--no-renames",
    "origin/main...HEAD",
    "--",
    MIGRATIONS_DIR,
  ]).filter(sql);

  if (added.length === 0) {
    console.log("No migrations added in this PR; nothing to check.");

    return;
  }

  const { highest, errors } = checkMigrationOrder(existing, added);

  if (errors.length === 0) {
    console.log(`Migration ordering OK: ${added.length} added, all after main's highest version (${highest}).`);

    return;
  }

  console.error(`Migration ordering check failed. main's highest version is ${highest}.`);
  for (const error of errors) console.error(`  - ${error}`);
  console.error("Fix: rebase on main, then rename each migration to a fresh, later timestamp (supabase migration new).");
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run();
