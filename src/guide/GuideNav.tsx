import type { AnchorHTMLAttributes, JSX } from "react";

import { cx, PANEL_TITLE } from "../ui/styles";
import { GUIDE_GROUPS, GUIDE_TOPICS } from "./guideContent";
import type { GuideTopicId } from "./guideContent";

// The guide's table of contents beside a topic: every topic by chapter, the open one marked.
type GuideNavProps = {
  activeId: GuideTopicId;
  link: (id: GuideTopicId | null) => AnchorHTMLAttributes<HTMLAnchorElement>;
};

const LINK =
  "flex items-center gap-2 rounded-md px-2 py-1 font-ui text-sm font-medium no-underline transition-colors duration-150 ease-settle";

export function GuideNav({ activeId, link }: GuideNavProps): JSX.Element {
  return (
    <nav aria-label="Guide topics" className="sticky top-20 flex w-56 flex-none flex-col gap-4 max-lg:hidden">
      {GUIDE_GROUPS.map((group) => (
        <div key={group} className="flex flex-col gap-1">
          <p className={cx(PANEL_TITLE, "px-2")}>{group}</p>
          <ul className="m-0 flex list-none flex-col gap-px p-0">
            {GUIDE_TOPICS.filter((topic) => topic.group === group).map(({ id, title }) => (
              <li key={id}>
                <a
                  {...link(id)}
                  aria-current={id === activeId ? "page" : undefined}
                  className={cx(
                    LINK,
                    id === activeId ? "bg-accent-weak text-text" : "text-text-dim hover:bg-control hover:text-text"
                  )}
                >
                  {title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
