import { useMemo, useState } from "react";
import type { JSX, KeyboardEvent } from "react";

// Edits an item's organising tags: a row of removable chips plus an input that commits a new tag on
// Enter, comma, or blur. As you type, existing tags from across the library are offered so you reuse
// one instead of retyping a near-duplicate; a brand-new name is still committed as typed. Duplicates
// (case-insensitive) are ignored.
type TagEditorProps = {
  tags: readonly string[];
  /** Existing tags across the library, offered as autocomplete. */
  suggestions?: readonly string[];
  onChange: (tags: string[]) => void;
};

const MAX_SUGGESTIONS = 8;

export function TagEditor({ tags, suggestions = [], onChange }: TagEditorProps): JSX.Element {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);

  const has = (tag: string) => tags.some((t) => t.toLowerCase() === tag.toLowerCase());

  const matches = useMemo(() => {
    const query = input.trim().toLowerCase();

    return suggestions
      .filter((s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()) && s.toLowerCase().includes(query))
      .slice(0, MAX_SUGGESTIONS);
  }, [suggestions, tags, input]);

  const commit = (tag: string) => {
    const value = tag.trim();

    setInput("");
    setActive(-1);
    if (value !== "" && !has(value)) onChange([...tags, value]);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit(active >= 0 && matches[active] ? matches[active] : input);
    } else if (event.key === "ArrowDown" && matches.length > 0) {
      event.preventDefault();
      setActive((a) => (a + 1) % matches.length);
    } else if (event.key === "ArrowUp" && matches.length > 0) {
      event.preventDefault();
      setActive((a) => (a <= 0 ? matches.length - 1 : a - 1));
    } else if (event.key === "Escape") {
      setActive(-1);
      setFocused(false);
    } else if (event.key === "Backspace" && input === "" && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const showList = focused && matches.length > 0;

  return (
    <section className="vc-tag-edit" aria-label="Tags">
      <div className="vc-desc-head">
        <span className="vc-panel-title">Tags</span>
      </div>
      <div className="vc-tag-row">
        {tags.map((tag) => (
          <span key={tag} className="vc-tag">
            {tag}
            <button
              type="button"
              className="vc-tag-x"
              aria-label={`Remove ${tag}`}
              onClick={() => onChange(tags.filter((t) => t !== tag))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          className="vc-tag-input"
          value={input}
          placeholder="Add a tag…"
          aria-label="Add tag"
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          onChange={(event) => {
            setInput(event.target.value);
            setActive(-1);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            commit(input);
          }}
        />
      </div>
      {showList && (
        <ul className="vc-tag-suggest" role="listbox" aria-label="Existing tags">
          {matches.map((suggestion, i) => (
            <li key={suggestion}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                className={`vc-tag-suggest-item${i === active ? " vc-tag-suggest-item--on" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commit(suggestion)}
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
