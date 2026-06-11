import { useState } from "react";
import type { JSX } from "react";
import { Tag } from "lucide-react";

import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Popover } from "../ui/Popover";
import { ToggleGroup } from "../ui/ToggleGroup";
import { MUTED, cx } from "../ui/styles";
import type { TagCount } from "./items";

// The tag filter: one-tap pills for the few most-used tags, with the whole vocabulary behind a
// searchable picker so the row never outgrows a line. An active tag always shows as a pressed pill —
// one not among the quick tags is pinned after them — so clearing a filter never needs the picker.
type TagFilterProps = {
  tags: readonly TagCount[];
  active: readonly string[];
  onChange: (tags: string[]) => void;
};

const QUICK_TAGS = 4;

export function TagFilter({ tags, active, onChange }: TagFilterProps): JSX.Element | null {
  const [query, setQuery] = useState("");

  if (tags.length === 0) return null;

  const quick = tags.slice(0, QUICK_TAGS).map((t) => t.tag);
  const pills = [...quick, ...active.filter((tag) => !quick.includes(tag))];
  const matches = tags.filter((t) => t.tag.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <>
      <ToggleGroup
        multiple
        variant="pills"
        ariaLabel="Filter by tag"
        items={pills.map((tag) => ({ value: tag, label: tag }))}
        value={[...active]}
        onValueChange={onChange}
      />
      {tags.length > QUICK_TAGS && (
        <Popover
          ariaLabel="All tags"
          align="start"
          trigger={
            <Button variant="ghost" size="sm">
              <Tag size={13} aria-hidden="true" />
              All tags
            </Button>
          }
        >
          <div className="flex w-72 flex-col gap-2.5">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tags…"
              aria-label="Search tags"
            />
            {matches.length > 0 ? (
              <div className="max-h-60 overflow-y-auto">
                <ToggleGroup
                  multiple
                  variant="pills"
                  ariaLabel="All tags"
                  items={matches.map((t) => ({
                    value: t.tag,
                    label: (
                      <>
                        {t.tag}
                        <span className="ml-1.5 text-xs text-text-dim">{t.count}</span>
                      </>
                    ),
                  }))}
                  value={[...active]}
                  onValueChange={onChange}
                />
              </div>
            ) : (
              <p className={cx(MUTED, "text-sm")}>No matching tags.</p>
            )}
          </div>
        </Popover>
      )}
    </>
  );
}
