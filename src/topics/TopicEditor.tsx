import { useMemo, useState } from "react";
import type { JSX } from "react";

import { DescriptionEditor } from "../editor/DescriptionEditor";
import { subtreeIds } from "./operations";
import { TopicPicker } from "./TopicPicker";
import type { Topic } from "./types";

// Editing a topic, mirroring BoardView → BoardEditor: a working draft of the title, the markdown
// explanation, and the parent (to nest it), committed on Done. Structural moves among siblings live
// in the sidebar; deletion lives here, beside Done, as a board's does in its editor.
type TopicEditorProps = {
  topic: Topic;
  topics: readonly Topic[];
  onDone: (patch: { title: string; body: string; parentId: string | null }) => void;
  onCancel: () => void;
  onDelete: () => void;
};

export function TopicEditor({ topic, topics, onDone, onCancel, onDelete }: TopicEditorProps): JSX.Element {
  const [title, setTitle] = useState(topic.title);
  const [body, setBody] = useState(topic.body);
  const [parentId, setParentId] = useState(topic.parentId);

  const exclude = useMemo(() => new Set(subtreeIds(topics, topic.id)), [topics, topic.id]);

  return (
    <section className="vc-editor vc-topic-editor">
      <div className="vc-editor-bar">
        <button type="button" className="vc-text-button" onClick={onCancel}>
          Cancel
        </button>
        <input
          className="vc-title-input"
          value={title}
          placeholder="Untitled topic"
          aria-label="Topic title"
          onChange={(event) => setTitle(event.target.value)}
        />
        <button type="button" className="vc-text-button vc-text-button--danger" onClick={onDelete}>
          Delete
        </button>
        <button type="button" className="vc-primary" onClick={() => onDone({ title, body, parentId })}>
          Done
        </button>
      </div>

      <div className="vc-topic-editor-body">
        <DescriptionEditor
          title="Explanation"
          value={body}
          onChange={setBody}
          placeholder="Explain this topic in markdown…"
        />
        <TopicPicker
          topics={topics}
          value={parentId}
          onChange={setParentId}
          label="Parent topic"
          noneLabel="Top level"
          exclude={exclude}
        />
      </div>
    </section>
  );
}
