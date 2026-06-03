import { useState } from "react";
import type { JSX } from "react";
import ReactMarkdown from "react-markdown";

// The markdown description, with a write/preview toggle so a coach can author plain text and see it
// rendered without leaving the editor.
type DescriptionEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

export function DescriptionEditor({ value, onChange }: DescriptionEditorProps): JSX.Element {
  const [previewing, setPreviewing] = useState(false);

  return (
    <section className="vc-desc" aria-label="Description">
      <div className="vc-desc-head">
        <span className="vc-panel-title">Description</span>
        <div className="vc-segmented" role="group" aria-label="Description mode">
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
          placeholder="Describe the tactic in markdown…"
          aria-label="Description text"
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </section>
  );
}
