import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { faviconSvg, maskableSvg, ogSvg } from "../../scripts/generate-brand-assets";

// The committed brand SVGs are generated from brandMarkGeometry by scripts/generate-brand-assets.ts.
// Asserting each file equals its builder makes the "generated, never hand-edited" guarantee real: editing
// the geometry without rerunning `npm run generate:brand` fails here. The PNGs derive from these same SVGs.

const assets: { file: string; build: () => string }[] = [
  { file: "public/favicon.svg", build: faviconSvg },
  { file: "public/brand/icon-maskable.svg", build: maskableSvg },
  { file: "public/og-image.svg", build: ogSvg },
];

describe.each(assets)("brand asset $file", ({ file, build }) => {
  test("matches the generator (run `npm run generate:brand` after editing the geometry)", () => {
    expect(readFileSync(join(process.cwd(), file), "utf8")).toBe(build());
  });
});
