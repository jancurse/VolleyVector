import type { JSX } from "react";

import { flattenTopics } from "./operations";
import type { Topic } from "./types";

// A single-select over the topic tree, depth-indented, with a "none" option at the top. Filing a
// board (None → Unfiled) and nesting a topic (None → Top level) both use it. `exclude` keeps a topic
// from being nested under itself or one of its descendants.
type TopicPickerProps = {
  topics: readonly Topic[];
  value: string | null;
  onChange: (id: string | null) => void;
  label: string;
  noneLabel: string;
  exclude?: ReadonlySet<string>;
};

export function TopicPicker({ topics, value, onChange, label, noneLabel, exclude }: TopicPickerProps): JSX.Element {
  const options = flattenTopics(topics).filter(({ topic }) => !exclude?.has(topic.id));

  return (
    <section className="vc-picker-card" aria-label={label}>
      <div className="vc-desc-head">
        <span className="vc-panel-title">{label}</span>
      </div>
      <select
        className="vc-input vc-select"
        aria-label={label}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}
      >
        <option value="">{noneLabel}</option>
        {options.map(({ topic, depth }) => (
          <option key={topic.id} value={topic.id}>
            {`${"  ".repeat(depth)}${topic.title}`}
          </option>
        ))}
      </select>
    </section>
  );
}
