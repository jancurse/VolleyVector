import type { JSX } from "react";
import { FolderOpen } from "lucide-react";

import { Select } from "../ui/Select";
import { FIELD_LABEL } from "../ui/styles";
import { flattenTopics } from "./operations";
import type { Topic } from "./types";

// A single-select over the topic tree, depth-indented, with a "none" option at the top. Filing a
// board (None → Unfiled) and nesting a topic (None → Top level) both use it. `exclude` keeps a topic
// from being nested under itself or one of its descendants. The empty-string value is "none". The
// field variant is a labelled boxed select; quiet is an inline folder-glyph control for a metadata
// row, where the dropdown itself explains the choice.
type TopicPickerProps = {
  topics: readonly Topic[];
  value: string | null;
  onChange: (id: string | null) => void;
  label: string;
  noneLabel: string;
  exclude?: ReadonlySet<string>;
  variant?: "field" | "quiet";
};

export function TopicPicker({
  topics,
  value,
  onChange,
  label,
  noneLabel,
  exclude,
  variant = "field",
}: TopicPickerProps): JSX.Element {
  const options = [
    { value: "", label: noneLabel },
    ...flattenTopics(topics)
      .filter(({ topic }) => !exclude?.has(topic.id))
      .map(({ topic, depth }) => ({ value: topic.id, label: topic.title, depth })),
  ];

  if (variant === "quiet") {
    return (
      <Select
        variant="quiet"
        icon={<FolderOpen size={14} className="block" />}
        ariaLabel={label}
        value={value ?? ""}
        onValueChange={(next) => onChange(next === "" ? null : next)}
        options={options}
      />
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className={FIELD_LABEL}>{label}</span>
      <Select
        ariaLabel={label}
        value={value ?? ""}
        onValueChange={(next) => onChange(next === "" ? null : next)}
        options={options}
      />
    </div>
  );
}
