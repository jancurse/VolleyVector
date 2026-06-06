import { useMemo, useState } from "react";
import type { JSX } from "react";

import { DescriptionEditor } from "../editor/DescriptionEditor";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
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
    <section className="mx-auto flex w-full max-w-[1320px] flex-col gap-[clamp(0.75rem,2vh,1.25rem)] animate-rise motion-reduce:animate-none">
      <div className="flex items-center gap-4">
        <Button variant="text" onClick={onCancel}>
          Cancel
        </Button>
        <Input
          variant="title"
          value={title}
          placeholder="Untitled topic"
          aria-label="Topic title"
          onChange={(event) => setTitle(event.target.value)}
        />
        <Button variant="danger" onClick={onDelete}>
          Delete
        </Button>
        <Button variant="primary" onClick={() => onDone({ title, body, parentId })}>
          Done
        </Button>
      </div>

      <div className="flex max-w-[720px] flex-col gap-4">
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
