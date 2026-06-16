import { useMemo } from "react";
import type { JSX } from "react";
import { Combobox as BaseCombobox } from "@base-ui/react/combobox";
import { Check, ChevronsUpDown } from "lucide-react";

import { cx, OVERLAY, OVERLAY_ITEM, OVERLAY_MOTION } from "../ui/styles";

// A searchable, grouped single-select for picking one access-list principal: a team to grant to, or a
// teammate. The eligible set can reach 100+, so it is typed-to-filter and grouped by where each option
// comes from (a Teams group, then one group per team for its members) rather than a flat list. Values
// are opaque `team:<id>` / `user:<id>` strings; the caller maps the picked value back to a principal.
export type PickerItem = { value: string; label: string };
export type PickerGroup = { heading: string; items: readonly PickerItem[] };

type PrincipalPickerProps = {
  groups: readonly PickerGroup[];
  /** The picked value, or "" for none. */
  value: string;
  onValueChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
};

const TRIGGER =
  "flex w-full items-center gap-2 rounded-md border border-border bg-control px-2.5 py-2 transition-colors duration-150 ease-settle focus-within:border-accent";
const INPUT =
  "min-w-0 flex-1 border-0 bg-transparent p-0 font-ui text-base text-text outline-none placeholder:text-text-dim";
const GROUP_LABEL = "px-2 pb-0.5 pt-1.5 font-mono text-2xs uppercase tracking-[0.16em] text-text-dim";

export function PrincipalPicker({
  groups,
  value,
  onValueChange,
  ariaLabel,
  placeholder = "Search people and teams…",
}: PrincipalPickerProps): JSX.Element {
  const labels = useMemo(() => {
    const map = new Map<string, string>();

    for (const group of groups) for (const item of group.items) map.set(item.value, item.label);

    return map;
  }, [groups]);

  // Base UI groups are `{ value: heading, items: leafValues }`; the leaf values are the selectable
  // strings, and itemToStringLabel below maps them to labels for display and filtering.
  const items = useMemo(
    () => groups.map((group) => ({ value: group.heading, items: group.items.map((item) => item.value) })),
    [groups]
  );

  return (
    <BaseCombobox.Root
      items={items}
      value={value || null}
      onValueChange={(next) => onValueChange((next as string | null) ?? "")}
      itemToStringLabel={(item) => labels.get(item as string) ?? ""}
    >
      <BaseCombobox.InputGroup className={TRIGGER}>
        <BaseCombobox.Input className={INPUT} placeholder={placeholder} aria-label={ariaLabel} />
        <BaseCombobox.Trigger aria-label="Open" className="flex shrink-0 cursor-pointer text-text-dim">
          <ChevronsUpDown size={14} aria-hidden="true" className="block" />
        </BaseCombobox.Trigger>
      </BaseCombobox.InputGroup>
      <BaseCombobox.Portal>
        {/* z-50 so the popup clears the z-40 modal layer when used inside a Dialog. */}
        <BaseCombobox.Positioner sideOffset={6} className="z-50 outline-none">
          <BaseCombobox.Popup
            className={cx(
              OVERLAY,
              "max-h-[min(22rem,var(--available-height))] w-[var(--anchor-width)] overflow-y-auto",
              OVERLAY_MOTION
            )}
          >
            <BaseCombobox.Empty className="px-2 py-2 text-sm text-text-dim">No matches.</BaseCombobox.Empty>
            <BaseCombobox.List>
              {(group: { value: string; items: string[] }) => (
                <BaseCombobox.Group key={group.value} items={group.items} className="flex flex-col">
                  <BaseCombobox.GroupLabel className={GROUP_LABEL}>{group.value}</BaseCombobox.GroupLabel>
                  <BaseCombobox.Collection>
                    {(item: string) => (
                      <BaseCombobox.Item key={item} value={item} className={OVERLAY_ITEM}>
                        <span className="truncate">{labels.get(item)}</span>
                        <BaseCombobox.ItemIndicator className="ml-auto flex text-accent">
                          <Check size={14} aria-hidden="true" className="block" />
                        </BaseCombobox.ItemIndicator>
                      </BaseCombobox.Item>
                    )}
                  </BaseCombobox.Collection>
                </BaseCombobox.Group>
              )}
            </BaseCombobox.List>
          </BaseCombobox.Popup>
        </BaseCombobox.Positioner>
      </BaseCombobox.Portal>
    </BaseCombobox.Root>
  );
}
