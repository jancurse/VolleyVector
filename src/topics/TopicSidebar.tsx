import type { JSX } from "react";

import type { Selection } from "../library/selection";
import { Button } from "../ui/Button";
import { Collapsible, CollapsibleCaret, CollapsiblePanel } from "../ui/Collapsible";
import { cx } from "../ui/styles";
import { childrenOf } from "./operations";
import { TopicRowMenu } from "./TopicRowMenu";
import type { Topic } from "./types";

// The persistent table of contents for the browse surface: All Boards on top, then the topic tree
// with disclosure controls, plus a quiet affordance to add a root topic. Each row carries a quiet
// organise menu (reorder and nesting) that stays hidden until the row is hovered or focused, so the
// sidebar reads as quiet and typographic rather than as app chrome. Nesting lives here, not in the
// topic editor.
type TopicSidebarProps = {
  topics: readonly Topic[];
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onNewTopic: () => void;
  onReorder: (id: string, dir: -1 | 1) => void;
  /** Re-parent a topic — nesting and un-nesting live here, not in the topic editor. */
  onNest: (id: string, parentId: string | null) => void;
  /** Whether to offer the new-topic and per-row organise actions (a coach of this team, or an admin). */
  canEdit: boolean;
};

const NAV_ITEM =
  "w-full cursor-pointer rounded-md border-0 bg-transparent px-[0.55rem] py-[0.4rem] text-left font-ui text-base font-semibold text-text-dim transition-colors duration-150 ease-settle hover:bg-control hover:text-text";
const ROW =
  "group flex items-center gap-[0.05rem] rounded-md transition-colors duration-150 ease-settle hover:bg-control";
const LINK =
  "flex-1 min-w-0 cursor-pointer truncate border-0 bg-transparent px-[0.2rem] py-[0.36rem] text-left font-ui text-base font-semibold text-text-dim transition-colors group-hover:text-text";
const CONTROLS =
  "flex pr-[0.2rem] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100";

export function TopicSidebar({
  topics,
  selection,
  onSelect,
  onNewTopic,
  onReorder,
  onNest,
  canEdit,
}: TopicSidebarProps): JSX.Element {
  const renderRow = (topic: Topic, depth: number, hasChildren: boolean): JSX.Element => {
    const on = selection.kind === "topic" && selection.id === topic.id;
    const siblings = childrenOf(topics, topic.parentId);
    const index = siblings.findIndex((s) => s.id === topic.id);

    return (
      <div className={cx(ROW, on && "bg-accent-weak")} style={{ paddingLeft: `${depth * 0.9}rem` }}>
        {hasChildren ? (
          <CollapsibleCaret label={`Toggle ${topic.title} subtopics`} />
        ) : (
          <span className="w-5 flex-none" />
        )}
        <button
          type="button"
          className={cx(LINK, on && "text-text")}
          aria-current={on}
          onClick={() => onSelect({ kind: "topic", id: topic.id })}
        >
          {topic.title}
        </button>
        <span className={cx(CONTROLS, !canEdit && "hidden")}>
          <TopicRowMenu
            title={topic.title}
            canMoveUp={index > 0}
            canMoveDown={index < siblings.length - 1}
            nestUnder={index > 0 ? siblings[index - 1].title : null}
            isNested={topic.parentId !== null}
            onMove={(dir) => onReorder(topic.id, dir)}
            onNest={() => onNest(topic.id, siblings[index - 1].id)}
            onMoveToTop={() => onNest(topic.id, null)}
          />
        </span>
      </div>
    );
  };

  const renderTopic = (topic: Topic, depth: number): JSX.Element => {
    const children = childrenOf(topics, topic.id);

    if (children.length === 0) return <div key={topic.id}>{renderRow(topic, depth, false)}</div>;

    return (
      <Collapsible key={topic.id} defaultOpen>
        {renderRow(topic, depth, true)}
        <CollapsiblePanel>{children.map((child) => renderTopic(child, depth + 1))}</CollapsiblePanel>
      </Collapsible>
    );
  };

  return (
    <nav
      className="sticky top-[clamp(0.5rem,2vh,1rem)] flex flex-col gap-[0.1rem] animate-rise motion-reduce:animate-none max-[860px]:static"
      aria-label="Topics"
    >
      <button
        type="button"
        className={cx(NAV_ITEM, selection.kind === "all" && "bg-accent-weak text-text")}
        aria-current={selection.kind === "all"}
        onClick={() => onSelect({ kind: "all" })}
      >
        All Boards
      </button>

      <p className="mt-4 mb-[0.35rem] px-[0.55rem] font-mono text-2xs font-medium uppercase tracking-[0.22em] text-text-dim">
        Topics
      </p>
      <div className="flex flex-col gap-[0.05rem]">
        {childrenOf(topics, null).map((topic) => renderTopic(topic, 0))}
      </div>

      {canEdit && (
        <Button variant="dashed" size="sm" className="mt-[0.6rem] justify-start text-left" onClick={onNewTopic}>
          + New topic
        </Button>
      )}
    </nav>
  );
}
