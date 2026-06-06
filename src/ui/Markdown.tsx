import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";

import { cx } from "./styles";

// Renders markdown with the app's type styling. Replaces the old .vc-markdown rules: each element maps
// to Tailwind utilities here, so markdown styling lives in one place with the rest of the UI.
const components: Components = {
  h1: (props) => (
    <h1 className="mt-[1em] mb-[0.4em] font-display text-display-md font-bold tracking-[-0.015em]" {...props} />
  ),
  h2: (props) => (
    <h2 className="mt-[1em] mb-[0.4em] font-display text-display-sm font-bold tracking-[-0.015em]" {...props} />
  ),
  h3: (props) => (
    <h3 className="mt-[1em] mb-[0.4em] font-display text-display-xs font-bold tracking-[-0.015em]" {...props} />
  ),
  p: (props) => <p className="my-[0.5em]" {...props} />,
  ul: (props) => <ul className="my-[0.5em] list-disc pl-[1.3em]" {...props} />,
  ol: (props) => <ol className="my-[0.5em] list-decimal pl-[1.3em]" {...props} />,
  li: (props) => <li className="my-[0.2em]" {...props} />,
  a: (props) => <a className="text-accent underline" {...props} />,
  code: (props) => (
    <code className="rounded-[5px] bg-control px-[0.35em] py-[0.1em] font-mono text-[0.85em]" {...props} />
  ),
};

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cx("text-base leading-[1.6] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}>
      <ReactMarkdown components={components}>{children}</ReactMarkdown>
    </div>
  );
}
