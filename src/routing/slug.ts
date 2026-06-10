// Slugs are minted once at creation and never change on rename, so a bookmarked URL stays valid.

/** Folds a title to a URL slug: lowercase, accents stripped, non-alphanumerics hyphenated. */
export function slugify(title: string): string {
  const folded = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return folded || "untitled";
}

/** Disambiguates a slug against taken ones by appending -2, -3, … to the first free suffix. */
export function uniqueSlug(title: string, taken: Iterable<string>): string {
  const base = slugify(title);
  const used = new Set(taken);

  if (!used.has(base)) return base;
  let n = 2;

  while (used.has(`${base}-${n}`)) n += 1;

  return `${base}-${n}`;
}
