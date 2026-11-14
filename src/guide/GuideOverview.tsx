import type { AnchorHTMLAttributes, JSX } from "react";

import { Markdown } from "../ui/Markdown";
import { cx, EYEBROW, PANEL, PANEL_TITLE, TAG_CHIP, TITLE } from "../ui/styles";
import { GUIDE_GROUPS, GUIDE_LEDE, GUIDE_TOPICS } from "./guideContent";
import type { GuideTopicId } from "./guideContent";
import { GuideNotice } from "./GuideNotice";

const CARD = cx(
  PANEL,
  "h-full gap-2 text-text no-underline transition-colors duration-150 ease-settle hover:border-accent/50 hover:bg-control"
);

/** The guide's front page: every topic as a card, by chapter. */
export function GuideOverview({
  link,
}: {
  link: (id: GuideTopicId | null) => AnchorHTMLAttributes<HTMLAnchorElement>;
}): JSX.Element {
  return (
    <>
      <div className="flex max-w-3xl flex-col gap-4">
        <div>
          <p className={EYEBROW}>Guide</p>
          <h1 className={TITLE}>How to use VolleyVector</h1>
        </div>
        <p className="m-0 text-lg text-text-dim">{GUIDE_LEDE}</p>
        <GuideNotice />
      </div>

      {GUIDE_GROUPS.map((group) => (
        <section key={group} aria-label={group} className="flex flex-col gap-3">
          <h2 className={PANEL_TITLE}>{group}</h2>
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
            {GUIDE_TOPICS.filter((topic) => topic.group === group).map(({ id, title, icon: Icon, who, intro }) => (
              <li key={id}>
                <a {...link(id)} className={CARD}>
                  <span className="flex items-center gap-3">
                    <span className="grid size-9 flex-none place-items-center rounded-lg bg-accent-weak text-accent">
                      <Icon size={17} aria-hidden="true" />
                    </span>
                    <span className="font-display text-display-xs font-bold tracking-[-0.015em]">{title}</span>
                    {who && <span className={cx(TAG_CHIP, "ml-auto max-sm:hidden")}>{who}</span>}
                  </span>
                  <Markdown className="text-sm text-text-dim">{intro}</Markdown>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
