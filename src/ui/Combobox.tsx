import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Combobox as BaseCombobox } from "@base-ui/react/combobox";

import { cx, OVERLAY, OVERLAY_ITEM, OVERLAY_MOTION } from "./styles";

// A multi-select, creatable tag input. Existing tags are offered as suggestions (accepted by click or
// keyboard); a brand-new tag commits immediately on Enter, comma, or blur with no confirmation step.
// Backspace on an empty input removes the last tag. Duplicates are ignored case-insensitively.
type ComboboxProps = {
  value: readonly string[];
  onChange: (tags: string[]) => void;
  suggestions?: readonly string[];
  placeholder?: string;
  inputLabel?: string;
};

const MAX_SUGGESTIONS = 8;

const norm = (s: string) => s.trim().toLowerCase();

const CHIP =
  "inline-flex items-center gap-1 rounded-pill border border-border bg-control px-2 py-0.5 text-xs font-semibold text-text";
const CHIP_REMOVE =
  "flex cursor-pointer items-center border-0 bg-transparent p-0 leading-none text-text-dim transition-colors hover:text-danger";
const INPUT =
  "min-w-[7rem] flex-1 border-0 bg-transparent px-0.5 py-1 font-ui text-base text-text focus:outline-none placeholder:text-text-dim";

export function Combobox({
  value,
  onChange,
  suggestions = [],
  placeholder = "Add a tag…",
  inputLabel = "Add tag",
}: ComboboxProps) {
  const [query, setQuery] = useState("");
  const queryRef = useRef("");
  const highlightedRef = useRef<string | null>(null);

  const setInput = (next: string) => {
    queryRef.current = next;
    setQuery(next);
  };

  const has = (tag: string) => value.some((t) => norm(t) === norm(tag));

  const commitText = (text: string) => {
    const v = text.trim();

    setInput("");
    if (v && !has(v)) onChange([...value, v]);
  };

  const q = query.trim();
  const selected = new Set(value.map(norm));
  const matches = suggestions
    .filter((s) => !selected.has(norm(s)) && s.toLowerCase().includes(q.toLowerCase()))
    .slice(0, MAX_SUGGESTIONS);
  const exact = suggestions.some((s) => norm(s) === norm(q)) || selected.has(norm(q));
  const creatable = q !== "" && !exact ? q : null;
  const items = creatable ? [...matches, creatable] : matches;

  const handleValueChange = (next: string[]) => {
    const cleaned: string[] = [];

    for (const tag of next) {
      const v = tag.trim();

      if (v && !cleaned.some((c) => norm(c) === norm(v))) cleaned.push(v);
    }

    setInput("");
    onChange(cleaned);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && q === "" && value.length > 0) {
      onChange(value.slice(0, -1));

      return;
    }

    if (event.key === ",") {
      event.preventDefault();
      commitText(highlightedRef.current ?? query);

      return;
    }

    if (event.key === "Enter" && !highlightedRef.current && q !== "") {
      event.preventDefault();
      commitText(query);
    }
  };

  // Commit the typed text when focus truly leaves. Deferring lets a click-selection clear the query
  // first (handleValueChange empties it), so selecting a suggestion never also adds the typed text.
  const onBlur = () => {
    window.setTimeout(() => {
      if (queryRef.current.trim() !== "") commitText(queryRef.current);
    }, 0);
  };

  return (
    <BaseCombobox.Root
      items={items}
      multiple
      filter={null}
      value={value as string[]}
      inputValue={query}
      onInputValueChange={setInput}
      onValueChange={handleValueChange}
      onItemHighlighted={(item) => {
        highlightedRef.current = (item as string | undefined) ?? null;
      }}
    >
      <BaseCombobox.InputGroup className="flex w-full flex-wrap items-center gap-1.5">
        <BaseCombobox.Chips className="flex w-full flex-wrap items-center gap-1.5">
          <BaseCombobox.Value>
            {(tags: string[]) => (
              <>
                {tags.map((tag) => (
                  <BaseCombobox.Chip key={tag} className={CHIP} aria-label={tag}>
                    {tag}
                    <BaseCombobox.ChipRemove className={CHIP_REMOVE} aria-label={`Remove ${tag}`}>
                      <XIcon />
                    </BaseCombobox.ChipRemove>
                  </BaseCombobox.Chip>
                ))}
                <BaseCombobox.Input
                  className={INPUT}
                  placeholder={tags.length > 0 ? "" : placeholder}
                  aria-label={inputLabel}
                  onKeyDown={onKeyDown}
                  onBlur={onBlur}
                />
              </>
            )}
          </BaseCombobox.Value>
        </BaseCombobox.Chips>
      </BaseCombobox.InputGroup>
      <BaseCombobox.Portal>
        <BaseCombobox.Positioner sideOffset={6} className="z-30 outline-none">
          <BaseCombobox.Popup
            className={cx(
              OVERLAY,
              "max-h-[220px] w-[var(--anchor-width)] flex-col gap-px overflow-y-auto",
              OVERLAY_MOTION
            )}
          >
            <BaseCombobox.List>
              {(item: string) => (
                <BaseCombobox.Item key={item} value={item} className={OVERLAY_ITEM}>
                  {item === creatable ? `Add “${item}”` : item}
                </BaseCombobox.Item>
              )}
            </BaseCombobox.List>
          </BaseCombobox.Popup>
        </BaseCombobox.Positioner>
      </BaseCombobox.Portal>
    </BaseCombobox.Root>
  );
}

function XIcon() {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      className="block"
    >
      <path d="M4 4l8 8M12 4l-8 8" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
}
