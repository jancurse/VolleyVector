import { useState } from "react";
import type { JSX } from "react";

import { Markdown } from "../ui/Markdown";
import { MUTED, PANEL, PANEL_TITLE } from "../ui/styles";
import { Tab, TabList, TabPanel, Tabs } from "../ui/Tabs";
import { Textarea } from "../ui/Textarea";

// A markdown text card with a write/preview toggle, so a coach can author plain text and see it
// rendered without leaving the editor. Used for both a board's description and a step instruction.
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
  placeholder = "Describe this board in markdown…",
  compact = false,
}: DescriptionEditorProps): JSX.Element {
  const [mode, setMode] = useState("write");
  const preview = compact ? "min-h-[96px]" : "min-h-[190px]";

  return (
    <Tabs value={mode} onValueChange={setMode} className={PANEL}>
      <div className="flex items-center justify-between">
        <span className={PANEL_TITLE}>{title}</span>
        <TabList ariaLabel={`${title} mode`}>
          <Tab value="write">Write</Tab>
          <Tab value="preview">Preview</Tab>
        </TabList>
      </div>

      <TabPanel value="write" className="flex">
        <Textarea
          value={value}
          placeholder={placeholder}
          aria-label={`${title} text`}
          compact={compact}
          onChange={(event) => onChange(event.target.value)}
        />
      </TabPanel>
      <TabPanel value="preview" className={preview}>
        {value.trim() ? (
          <Markdown className={preview}>{value}</Markdown>
        ) : (
          <p className={MUTED}>Nothing to preview yet.</p>
        )}
      </TabPanel>
    </Tabs>
  );
}
