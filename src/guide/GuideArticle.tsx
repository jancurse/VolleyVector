import type { AnchorHTMLAttributes, JSX } from "react";
import { ArrowLeft, ArrowRight, Lightbulb } from "lucide-react";

import { Markdown } from "../ui/Markdown";
import { Table, TableCell } from "../ui/Table";
import { cx, EYEBROW, KBD, KBD_QUIET, PANEL, PANEL_TITLE, TAG_CHIP, TITLE } from "../ui/styles";
import { GUIDE_TOPICS, guideTopic } from "./guideContent";
import type { GuideTopic, GuideTopicId } from "./guideContent";
import { GuideNotice } from "./GuideNotice";

const HEADING = "m-0 font-display font-bold tracking-[-0.015em]";
const STEP_LINK =
  "flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-panel px-3.5 py-3 text-sm font-semibold text-text no-underline transition-colors duration-150 ease-settle hover:bg-control";

type GuideArticleProps = {
  topic: GuideTopic;
  link: (id: GuideTopicId | null) => AnchorHTMLAttributes<HTMLAnchorElement>;
};

/** One topic of the guide: what it is for, then its definitions, step-by-step tasks, lookups, and tips. */
export function GuideArticle({ topic, link }: GuideArticleProps): JSX.Element {
  const { title, group, icon: Icon, who, intro, concepts, tasks, references, tips, related } = topic;
  const index = GUIDE_TOPICS.indexOf(topic);
  const previous = GUIDE_TOPICS[index - 1];
  const next = GUIDE_TOPICS[index + 1];

  return (
    <article className="flex max-w-3xl min-w-0 flex-1 flex-col gap-8">
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <span className="grid size-12 flex-none place-items-center rounded-xl bg-accent-weak text-accent">
            <Icon size={22} aria-hidden="true" />
          </span>
          <div>
            <p className={EYEBROW}>{group}</p>
            <h1 className={TITLE}>{title}</h1>
          </div>
        </div>
        <Markdown className="text-lg text-text-dim">{intro}</Markdown>
        {who && <span className={cx(TAG_CHIP, "self-start")}>For: {who}</span>}
      </header>

      {concepts && (
        <dl className="m-0 grid gap-3 sm:grid-cols-2">
          {concepts.map(({ term, text }) => (
            <div key={term} className={cx(PANEL, "gap-1.5")}>
              <dt className={cx(HEADING, "text-display-xs")}>{term}</dt>
              <dd className="m-0">
                <Markdown>{text}</Markdown>
              </dd>
            </div>
          ))}
        </dl>
      )}

      {tasks?.map((task) => (
        <section key={task.title} aria-label={task.title} className="flex flex-col gap-3">
          <h2 className={cx(HEADING, "text-display-md")}>{task.title}</h2>
          {task.intro && <Markdown className="text-text-dim">{task.intro}</Markdown>}
          <ol className={cx(PANEL, "m-0 list-none gap-3")}>
            {task.steps.map((step, i) => (
              <li key={step} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="grid size-6 flex-none place-items-center rounded-full bg-accent-weak font-mono text-xs font-semibold text-accent"
                >
                  {i + 1}
                </span>
                <Markdown className="min-w-0 flex-1">{step}</Markdown>
              </li>
            ))}
          </ol>
          {task.after && <Markdown className="text-sm text-text-dim">{task.after}</Markdown>}
        </section>
      ))}

      {references?.map((reference) => (
        <section key={reference.title} aria-label={reference.title} className="flex flex-col gap-3">
          <h2 className={cx(HEADING, "text-display-md")}>{reference.title}</h2>
          {reference.intro && <Markdown className="text-text-dim">{reference.intro}</Markdown>}
          <Table width={reference.keys ? "compact" : "page"}>
            <tbody>
              {reference.rows.map(([term, meaning]) => (
                <tr key={term}>
                  <TableCell className="align-top font-semibold">
                    {reference.keys ? <kbd className={cx(KBD, KBD_QUIET, "px-1.5")}>{term}</kbd> : term}
                  </TableCell>
                  <TableCell className="align-top">
                    <Markdown className="text-text-dim">{meaning}</Markdown>
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>
      ))}

      {tips && (
        <section aria-label="Good to know" className={cx(PANEL, "gap-3")}>
          <h2 className={PANEL_TITLE}>Good to know</h2>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {tips.map((tip) => (
              <li key={tip} className="flex items-start gap-2.5">
                <Lightbulb size={15} aria-hidden="true" className="mt-0.5 flex-none text-accent" />
                <Markdown className="min-w-0 flex-1">{tip}</Markdown>
              </li>
            ))}
          </ul>
        </section>
      )}

      {related && (
        <p className="m-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className={PANEL_TITLE}>Related</span>
          {related.map((id) => (
            <a key={id} {...link(id)} className="text-accent hover:underline">
              {guideTopic(id)?.title}
            </a>
          ))}
        </p>
      )}

      <nav aria-label="More topics" className="flex flex-wrap gap-3 border-t border-border pt-6">
        {previous && (
          <a {...link(previous.id)} className={STEP_LINK}>
            <ArrowLeft size={15} aria-hidden="true" className="flex-none text-text-dim" />
            {previous.title}
          </a>
        )}
        {next && (
          <a {...link(next.id)} className={cx(STEP_LINK, "justify-end text-right")}>
            {next.title}
            <ArrowRight size={15} aria-hidden="true" className="flex-none text-text-dim" />
          </a>
        )}
      </nav>

      <GuideNotice />
    </article>
  );
}
