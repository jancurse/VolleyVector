import type { JSX } from "react";

import { Combobox } from "../ui/Combobox";
import { PANEL, PANEL_TITLE } from "../ui/styles";

// Edits an item's organising tags: removable chips plus a creatable autocomplete. Existing tags from
// across the library are offered so you reuse one instead of retyping a near-duplicate; a brand-new
// name commits as typed. The control behaviour lives in the shared Combobox wrapper.
type TagEditorProps = {
  tags: readonly string[];
  /** Existing tags across the library, offered as autocomplete. */
  suggestions?: readonly string[];
  onChange: (tags: string[]) => void;
};

export function TagEditor({ tags, suggestions = [], onChange }: TagEditorProps): JSX.Element {
  return (
    <section className={PANEL} aria-label="Tags">
      <span className={PANEL_TITLE}>Tags</span>
      <Combobox value={tags} onChange={onChange} suggestions={suggestions} />
    </section>
  );
}
