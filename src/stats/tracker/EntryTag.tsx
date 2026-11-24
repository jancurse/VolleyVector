import type { JSX } from "react";
import { Sparkles } from "lucide-react";

/** What the open entry is, as a quiet note beside its time: a contact of the draft and how many are left. */
export function EntryTag({
  review,
  label,
}: {
  /** Set while the entry describes a contact of the draft. */
  review: { left: number; ai: boolean } | null;
  /** What the entry is otherwise. */
  label: string;
}): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-text-dim">
      {review?.ai && <Sparkles size={12} className="text-accent" aria-hidden="true" />}
      {review ? `${review.ai ? "AI contact" : "Marked contact"} · ${review.left} left` : label}
    </span>
  );
}
