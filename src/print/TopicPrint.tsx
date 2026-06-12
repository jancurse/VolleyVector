import type { JSX } from "react";

import type { Board } from "../boards/types";
import type { Topic } from "../topics/types";
import { Markdown } from "../ui/Markdown";
import { EYEBROW } from "../ui/styles";
import { BoardPrint } from "./BoardPrint";

// A topic as a printable document: its title, then its blocks in order — prose as-is, and each board
// group's members expanded through BoardPrint. Like TopicView, board blocks are placement hints: each
// is intersected with the topic's real members, a board never prints twice, and any member no block
// placed trails at the end.
type TopicPrintProps = {
  topic: Topic;
  /** Boards filed directly in this topic, newest first. */
  boards: readonly Board[];
};

export function TopicPrint({ topic, boards }: TopicPrintProps): JSX.Element {
  const byId = new Map(boards.map((b) => [b.id, b]));
  const shown = new Set<string>();

  const rendered = topic.blocks.map((block) => {
    if (block.kind === "markdown") {
      return block.text.trim() ? <Markdown key={block.id}>{block.text}</Markdown> : null;
    }

    const group: Board[] = [];

    for (const id of block.boardIds) {
      const board = byId.get(id);

      if (board && !shown.has(id)) {
        shown.add(id);
        group.push(board);
      }
    }

    return group.map((board) => <BoardPrint key={board.id} board={board} />);
  });

  const unplaced = boards.filter((b) => !shown.has(b.id));

  return (
    <article className="flex flex-col gap-8">
      <header className="break-inside-avoid break-after-avoid">
        <p className={EYEBROW}>Topic</p>
        <h1 className="m-0 font-display text-[2.1rem] font-bold leading-[1.05] tracking-[-0.025em]">{topic.title}</h1>
      </header>
      {rendered}
      {unplaced.map((board) => (
        <BoardPrint key={board.id} board={board} />
      ))}
    </article>
  );
}
