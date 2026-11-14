import type { JSX } from "react";
import { Sparkles } from "lucide-react";

import { Markdown } from "../ui/Markdown";
import { CALLOUT_NOTE, cx } from "../ui/styles";
import { GUIDE_AI_NOTICE } from "./guideContent";

/** The note that the guide is AI-written, and where to report a step that is wrong. */
export function GuideNotice(): JSX.Element {
  return (
    <div className={cx(CALLOUT_NOTE, "flex items-start gap-2.5")}>
      <Sparkles size={15} aria-hidden="true" className="mt-0.5 flex-none text-accent" />
      <Markdown className="min-w-0 flex-1 text-sm">{GUIDE_AI_NOTICE}</Markdown>
    </div>
  );
}
