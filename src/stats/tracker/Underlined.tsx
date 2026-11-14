import type { JSX } from "react";

/** A label with its shortcut letter underlined, e.g. s<u>E</u>t. */
export function Underlined({ label, letter }: { label: string; letter: string }): JSX.Element {
  const i = label.toLowerCase().indexOf(letter);

  if (i < 0) return <>{label}</>;

  return (
    <>
      {label.slice(0, i)}
      <span className="underline decoration-2 underline-offset-2 pointer-coarse:no-underline">{label[i]}</span>
      {label.slice(i + 1)}
    </>
  );
}
