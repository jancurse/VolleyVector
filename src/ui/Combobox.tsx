import { useRef, useState } from "react";
import type { ComponentProps } from "react";
import { Combobox as BaseCombobox } from "@base-ui/react/combobox";
import { Plus, X } from "lucide-react";

import { cx, OVERLAY, OVERLAY_ITEM, OVERLAY_MOTION, TAG_CHIP } from "./styles";

// A multi-select, creatable tag input built around a ghost chip: the tags render as chips, followed
// by a dashed "+ Tag" chip that morphs into a chip-shaped input right where the new chip will appear.
// Existing tags are offered as suggestions (accepted by click or keyboard); a brand-new tag commits on
// Enter, comma, or blur with no confirmation step, and the input stays armed for the next tag.
// Escape (or leaving the empty input) collapses back to the ghost chip. Backspace on an empty input
// removes the last tag. Duplicates are ignored case-insensitively.
type ComboboxProps = {
  value: readonly string[];
  onChange: (tags: string[]) => void;
  suggestions?: readonly string[];
  placeholder?: string;
  inputLabel?: string;
};

const MAX_SUGGESTIONS = 8;

const norm = (s: string) => s.trim().toLowerCase();

const CHIP_REMOVE =
  "flex cursor-pointer items-center border-0 bg-transparent p-0 leading-none text-text-dim transition-colors hover:text-danger";
// The add affordance: a ghost of the chip it will become, dashed and dim until engaged.
const ADD_CHIP =
  "inline-flex cursor-pointer items-center gap-1 rounded-pill border border-dashed border-border bg-transparent px-2 py-0.5 text-xs font-semibold text-text-dim transition-colors duration-150 ease-settle hover:border-[color-mix(in_srgb,var(--accent)_45%,var(--border))] hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
// The armed state: the same chip shape as a committed tag, now holding the input.
const INPUT_CHIP =
  "inline-flex items-center rounded-pill border border-border bg-control px-2 py-0.5 transition-[border-color] duration-150 ease-settle focus-within:border-accent";
const INPUT =
  "w-28 min-w-0 border-0 bg-transparent p-0 font-ui text-xs font-semibold text-text focus:outline-none placeholder:font-medium placeholder:text-text-dim";

export function Combobox({
  value,
  onChange,
  suggestions = [],
  placeholder = "Add a tag…",
  inputLabel = "Add tag",
}: ComboboxProps) {
  const [active, setActive] = useState(false);
  const [query, setQuery] = useState("");
  const queryRef = useRef("");
  const highlightedRef = useRef<string | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const chipRef = useRef<HTMLSpanElement>(null);

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

  const onKeyDown: NonNullable<ComponentProps<typeof BaseCombobox.Input>["onKeyDown"]> = (event) => {
    if (event.key === "Escape") {
      // Base UI's own Escape clears the whole multi-select value (every committed chip), so swallow
      // it. First Escape clears a part-typed tag; on an empty input it disarms back to the ghost
      // chip, handing focus back so the keyboard never lands in a void.
      event.preventBaseUIHandler();
      if (q !== "") {
        setInput("");

        return;
      }

      setActive(false);
      window.setTimeout(() => addRef.current?.focus(), 0);

      return;
    }

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

  // Commit the typed text when focus truly leaves, then disarm. Deferring lets a click-selection
  // clear the query first (handleValueChange empties it), so selecting a suggestion never also adds
  // the typed text — and a selection click that returns focus to the input stays armed.
  const onBlur = () => {
    window.setTimeout(() => {
      if (queryRef.current.trim() !== "") commitText(queryRef.current);
      if (!document.activeElement?.closest("[data-tag-input]")) setActive(false);
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
      <BaseCombobox.InputGroup data-tag-input className="flex w-full flex-wrap items-center gap-1.5">
        <BaseCombobox.Chips className="flex w-full flex-wrap items-center gap-1.5">
          <BaseCombobox.Value>
            {(tags: string[]) => (
              <>
                {tags.map((tag) => (
                  <BaseCombobox.Chip key={tag} className={TAG_CHIP} aria-label={tag}>
                    {tag}
                    <BaseCombobox.ChipRemove className={CHIP_REMOVE} aria-label={`Remove ${tag}`}>
                      <X size={12} aria-hidden="true" className="block" />
                    </BaseCombobox.ChipRemove>
                  </BaseCombobox.Chip>
                ))}
                {active ? (
                  <span ref={chipRef} className={INPUT_CHIP}>
                    <BaseCombobox.Input
                      autoFocus
                      className={INPUT}
                      placeholder={placeholder}
                      aria-label={inputLabel}
                      onKeyDown={onKeyDown}
                      onBlur={onBlur}
                    />
                  </span>
                ) : (
                  <button
                    ref={addRef}
                    type="button"
                    className={ADD_CHIP}
                    aria-label={inputLabel}
                    onClick={() => setActive(true)}
                  >
                    <Plus size={12} aria-hidden="true" className="block" />
                    Tag
                  </button>
                )}
              </>
            )}
          </BaseCombobox.Value>
        </BaseCombobox.Chips>
      </BaseCombobox.InputGroup>
      <BaseCombobox.Portal>
        <BaseCombobox.Positioner anchor={chipRef} sideOffset={6} align="start" className="z-30 outline-none">
          <BaseCombobox.Popup
            className={cx(
              OVERLAY,
              "max-h-[220px] w-max min-w-44 max-w-72 flex-col gap-px overflow-y-auto",
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
