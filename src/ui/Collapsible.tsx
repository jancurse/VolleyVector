import type { ReactNode } from "react";
import { Collapsible as BaseCollapsible } from "@base-ui/react/collapsible";

// Disclosure for a tree node: the caret is the trigger (correct aria-expanded), the panel holds the
// children. The caret rotates open and is labelled for screen readers.
export function Collapsible({
  defaultOpen = true,
  children,
  className,
}: {
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <BaseCollapsible.Root defaultOpen={defaultOpen} className={className}>
      {children}
    </BaseCollapsible.Root>
  );
}

export function CollapsibleCaret({ label }: { label: string }) {
  return (
    <BaseCollapsible.Trigger
      aria-label={label}
      className="grid h-7 w-5 flex-none cursor-pointer place-items-center border-0 bg-transparent text-text-dim transition-[transform,color] duration-200 ease-settle hover:text-text data-[panel-open]:rotate-90"
    >
      <svg viewBox="0 0 24 24" width={12} height={12} aria-hidden="true">
        <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
      </svg>
    </BaseCollapsible.Trigger>
  );
}

export function CollapsiblePanel({ children, className }: { children: ReactNode; className?: string }) {
  return <BaseCollapsible.Panel className={className}>{children}</BaseCollapsible.Panel>;
}
