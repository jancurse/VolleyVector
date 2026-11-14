import { useEffect } from "react";
import type { AnchorHTMLAttributes, JSX, MouseEvent } from "react";
import { ArrowLeft } from "lucide-react";

import { PAGE } from "../ui/styles";
import { GuideArticle } from "./GuideArticle";
import { guideTopic } from "./guideContent";
import type { GuideTopicId } from "./guideContent";
import { guideHref } from "./guideHref";
import { GuideNav } from "./GuideNav";
import { GuideOverview } from "./GuideOverview";

type GuidePageProps = {
  /** The open topic from the URL; anything that names no topic shows the overview. */
  topicId: string | null;
  onOpen: (topic: GuideTopicId | null) => void;
};

/** The user guide at `/guide`: an overview of every topic, and one page per topic at `/guide/<topic>`. */
export function GuidePage({ topicId, onOpen }: GuidePageProps): JSX.Element {
  const topic = guideTopic(topicId);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [topicId]);

  // A real link, so it opens in a new tab on request; a plain click moves within the app.
  const link = (id: GuideTopicId | null): AnchorHTMLAttributes<HTMLAnchorElement> => ({
    href: guideHref(id),
    onClick: (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      event.preventDefault();
      onOpen(id);
    },
  });

  if (!topic)
    return (
      <section className={PAGE}>
        <GuideOverview link={link} />
      </section>
    );

  return (
    <section className={PAGE}>
      <a
        {...link(null)}
        className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-text-dim no-underline hover:text-text"
      >
        <ArrowLeft size={15} aria-hidden="true" /> All topics
      </a>
      <div className="flex items-start gap-12">
        <GuideArticle topic={topic} link={link} />
        <GuideNav activeId={topic.id} link={link} />
      </div>
    </section>
  );
}
