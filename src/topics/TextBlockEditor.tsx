import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";

import { Markdown } from "../ui/Markdown";
import { MUTED } from "../ui/styles";
import { Textarea } from "../ui/Textarea";

// One topic text block, edited in place. It shows rendered markdown until clicked, then becomes a raw
// textarea (auto-focused) that snaps back to rendered on blur — so only the block you are in is raw,
// and the rest read as prose. An empty block starts in edit mode, so a freshly added block is ready
// to type into. Commit still flows through the parent's draft via onChange.
type TextBlockEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

export function TextBlockEditor({ value, onChange }: TextBlockEditorProps): JSX.Element {
  const [editing, setEditing] = useState(value.trim() === "");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  if (editing) {
    return (
      <Textarea
        ref={ref}
        compact
        value={value}
        placeholder="Write in markdown…"
        aria-label="Text block"
        rows={3}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => setEditing(false)}
      />
    );
  }

  return (
    <div
      className="cursor-text rounded-lg px-3 py-2 transition-colors duration-150 ease-settle hover:bg-control"
      role="button"
      tabIndex={0}
      aria-label="Edit text block"
      onClick={() => setEditing(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setEditing(true);
        }
      }}
    >
      {value.trim() ? <Markdown>{value}</Markdown> : <span className={MUTED}>Click to write…</span>}
    </div>
  );
}
