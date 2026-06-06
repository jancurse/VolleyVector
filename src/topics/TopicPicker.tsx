import type { JSX } from "react";

import { Select } from "../ui/Select";
import { PANEL, PANEL_TITLE } from "../ui/styles";
import { flattenTopics } from "./operations";
import type { Topic } from "./types";

// A single-select over the topic tree, depth-indented, with a "none" option at the top. Filing a
// board (None → Unfiled) and nesting a topic (None → Top level) both use it. `exclude` keeps a topic
// from being nested under itself or one of its descendants. The empty-string value is "none".
type TopicPickerProps = {
  topics: readonly Topic[];
  value: string | null;
  onChange: (id: string | null) => void;
  label: string;
  noneLabel: string;
  exclude?: ReadonlySet<string>;
};

export function TopicPicker({ topics, value, onChange, label, noneLabel, exclude }: TopicPickerProps): JSX.Element {
  const options = [
    { value: "", label: noneLabel },
    ...flattenTopics(topics)
      .filter(({ topic }) => !exclude?.has(topic.id))
      .map(({ topic, depth }) => ({ value: topic.id, label: topic.title, depth })),
  ];

  return (
    <section className={PANEL} aria-label={label}>
      <span className={PANEL_TITLE}>{label}</span>
      <Select
        ariaLabel={label}
        value={value ?? ""}
        onValueChange={(next) => onChange(next === "" ? null : next)}
        options={options}
      />
    </section>
  );
}
