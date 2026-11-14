import type { JSX, ReactNode } from "react";
import { CircleHelp } from "lucide-react";

import { Tooltip } from "../ui/Tooltip";
import { iconButtonClass } from "../ui/styles";
import { guideTopic } from "./guideContent";
import type { GuideTopicId } from "./guideContent";
import { guideHref } from "./guideHref";

// A quiet way into the guide from the surface a topic explains. It opens in a new tab, so a draft in the
// editor or a set being recorded stays where it is. Bare, it is a small help icon; with children, a text link.
export function GuideLink({ topic, children }: { topic: GuideTopicId; children?: ReactNode }): JSX.Element {
  const label = `Guide: ${guideTopic(topic)?.title ?? "how this works"}`;
  const link = { href: guideHref(topic), target: "_blank", rel: "noopener" };

  if (children)
    return (
      <a
        {...link}
        className="inline-flex items-center gap-1.5 self-start text-sm text-text-dim hover:text-text hover:underline"
      >
        <CircleHelp size={14} aria-hidden="true" className="flex-none" />
        {children}
      </a>
    );

  return (
    <Tooltip label={label}>
      <a {...link} aria-label={label} className={iconButtonClass("plain", "sm")}>
        <CircleHelp size={16} aria-hidden="true" />
      </a>
    </Tooltip>
  );
}
