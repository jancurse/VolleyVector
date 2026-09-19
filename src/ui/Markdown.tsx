import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cx } from "./styles";

// Rendered markdown (GitHub flavour) styled by the typography plugin. The prose palette is mapped onto
// the app's theme tokens in index.css; the heading modifiers hold h1-h3 to the app's display scale,
// since the plugin's own ramp is tuned for article pages and would dominate a description panel.
const PROSE = "prose prose-sm max-w-none prose-h1:text-display-md prose-h2:text-display-sm prose-h3:text-display-xs";

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cx(PROSE, className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
