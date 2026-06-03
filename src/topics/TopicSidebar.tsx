import { useState } from "react";
import type { JSX } from "react";

import type { Selection } from "../library/selection";
import { childrenOf } from "./operations";
import type { Topic } from "./types";

// The persistent table of contents for the browse surface: All Boards on top, then the topic tree
// with disclosure controls, plus a quiet affordance to add a root topic. Reorder controls sit on each
// row but stay hidden until the row is hovered or focused, so the sidebar reads as quiet and
// typographic rather than as app chrome.
type TopicSidebarProps = {
  topics: readonly Topic[];
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onNewTopic: () => void;
  onReorder: (id: string, dir: -1 | 1) => void;
};

const CARET = (
  <svg viewBox="0 0 24 24" width={12} height={12} aria-hidden="true">
    <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
  </svg>
);

export function TopicSidebar({ topics, selection, onSelect, onNewTopic, onReorder }: TopicSidebarProps): JSX.Element {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });

  const renderTopic = (topic: Topic, depth: number): JSX.Element => {
    const children = childrenOf(topics, topic.id);
    const open = !collapsed.has(topic.id);
    const on = selection.kind === "topic" && selection.id === topic.id;
    const siblings = childrenOf(topics, topic.parentId);
    const index = siblings.findIndex((s) => s.id === topic.id);

    return (
      <div key={topic.id}>
        <div
          className={`vc-sidebar-row${on ? " vc-sidebar-row--on" : ""}`}
          style={{ paddingLeft: `${depth * 0.9}rem` }}
        >
          {children.length > 0 ? (
            <button
              type="button"
              className={`vc-sidebar-caret${open ? " vc-sidebar-caret--open" : ""}`}
              aria-label={`${open ? "Collapse" : "Expand"} ${topic.title}`}
              aria-expanded={open}
              onClick={() => toggle(topic.id)}
            >
              {CARET}
            </button>
          ) : (
            <span className="vc-sidebar-caret-spacer" />
          )}
          <button
            type="button"
            className="vc-sidebar-link"
            aria-current={on}
            onClick={() => onSelect({ kind: "topic", id: topic.id })}
          >
            {topic.title}
          </button>
          <span className="vc-sidebar-controls">
            <button
              type="button"
              className="vc-sidebar-ctrl"
              aria-label={`Move ${topic.title} up`}
              disabled={index <= 0}
              onClick={() => onReorder(topic.id, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              className="vc-sidebar-ctrl"
              aria-label={`Move ${topic.title} down`}
              disabled={index >= siblings.length - 1}
              onClick={() => onReorder(topic.id, 1)}
            >
              ↓
            </button>
          </span>
        </div>
        {open && children.map((child) => renderTopic(child, depth + 1))}
      </div>
    );
  };

  return (
    <nav className="vc-sidebar" aria-label="Topics">
      <button
        type="button"
        className={`vc-nav-item${selection.kind === "all" ? " vc-nav-item--on" : ""}`}
        aria-current={selection.kind === "all"}
        onClick={() => onSelect({ kind: "all" })}
      >
        All Boards
      </button>

      <p className="vc-sidebar-heading">Topics</p>
      <div className="vc-sidebar-tree">{childrenOf(topics, null).map((topic) => renderTopic(topic, 0))}</div>

      <button type="button" className="vc-sidebar-add" onClick={onNewTopic}>
        + New topic
      </button>
    </nav>
  );
}
