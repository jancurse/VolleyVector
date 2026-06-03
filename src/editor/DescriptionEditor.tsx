import { useState } from "react";
import type { JSX } from "react";
import ReactMarkdown from "react-markdown";

// A markdown text card with a write/preview toggle, so a coach can author plain text and see it
// rendered without leaving the editor. Used for both a tactic/drill description and a step instruction.
type DescriptionEditorProps = {
  value: string;
  onChange: (value: string) => void;
  title?: string;
  placeholder?: string;
  /** A shorter field, for the step instruction that sits beside the fuller description. */
  compact?: boolean;
};

export function DescriptionEditor({
  value,
  onChange,
  title = "Description",
  placeholder = "Describe the tactic in markdown…",
  compact = false,
}: DescriptionEditorProps): JSX.Element {
  const [previewing, setPreviewing] = useState(false);

  return (
    <section className={`vc-desc${compact ? " vc-desc--compact" : ""}`} aria-label={title}>
      <div className="vc-desc-head">
        <span className="vc-panel-title">{title}</span>
        <div className="vc-segmented" role="group" aria-label={`${title} mode`}>
          <button
            type="button"
            className={`vc-seg${previewing ? "" : " vc-seg--on"}`}
            aria-pressed={!previewing}
            onClick={() => setPreviewing(false)}
          >
            Write
          </button>
          <button
            type="button"
            className={`vc-seg${previewing ? " vc-seg--on" : ""}`}
            aria-pressed={previewing}
            onClick={() => setPreviewing(true)}
          >
            Preview
          </button>
        </div>
      </div>

      {previewing ? (
        <div className="vc-markdown">
          {value.trim() ? <ReactMarkdown>{value}</ReactMarkdown> : <p className="vc-muted">Nothing to preview yet.</p>}
        </div>
      ) : (
        <textarea
          className="vc-textarea"
          value={value}
          placeholder={placeholder}
          aria-label={`${title} text`}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </section>
  );
}
