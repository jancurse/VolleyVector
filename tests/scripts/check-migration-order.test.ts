import { describe, expect, it } from "vitest";

import { checkMigrationOrder, migrationVersion } from "../../scripts/check-migration-order.ts";

const file = (version: string): string => `supabase/migrations/${version}_name.sql`;

// A synthetic main history; its highest version is the second entry.
const MAIN = [file("20260101000000"), file("20260601000000")];

describe("migrationVersion", () => {
  it("reads the timestamp prefix, or null when there is none", () => {
    expect(migrationVersion(file("20260618120000"))).toBe("20260618120000");
    expect(migrationVersion("supabase/migrations/no_prefix.sql")).toBeNull();
  });
});

describe("checkMigrationOrder", () => {
  it("reports main's highest and passes when the PR adds no migrations", () => {
    expect(checkMigrationOrder(MAIN, [])).toEqual({ highest: "20260601000000", errors: [] });
  });

  it("passes a migration after main's highest", () => {
    expect(checkMigrationOrder(MAIN, [file("20260701000000")]).errors).toEqual([]);
  });

  it.each(["20260101000000", "20260601000000"])("fails a migration not after main's highest (%s)", (version) => {
    const { errors } = checkMigrationOrder(MAIN, [file(version)]);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(version); // names the offending file
    expect(errors[0]).toContain("20260601000000"); // names main's highest
  });

  it("compares versions numerically, not as strings", () => {
    // "999" sorts after a 14-digit timestamp as a string, but is an earlier number.
    expect(checkMigrationOrder(MAIN, [file("999")]).errors).toHaveLength(1);
  });

  it("fails two added migrations that share a version, even past main's highest", () => {
    const { errors } = checkMigrationOrder(MAIN, [file("20260701000000"), file("20260701000000")]);

    expect(errors).toHaveLength(2);
    expect(errors.every((e) => e.includes("duplicates"))).toBe(true);
  });
});
