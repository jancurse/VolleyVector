import type { ReactNode } from "react";
import { Tabs as BaseTabs } from "@base-ui/react/tabs";

import { cx } from "./styles";

// A tabs family styled as an underline tabset: the active tab is marked by a sliding accent indicator
// (Base UI's Tabs.Indicator) that follows the selected tab. The list and panels can be placed apart
// (the editor puts the list in a header and the panel in the body), so the parts are exported
// separately and share the Tabs context.
type TabsProps = {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
};

export function Tabs({ value, onValueChange, children, className }: TabsProps) {
  return (
    <BaseTabs.Root value={value} onValueChange={(next) => onValueChange(next as string)} className={className}>
      {children}
    </BaseTabs.Root>
  );
}

export function TabList({ children, ariaLabel }: { children: ReactNode; ariaLabel: string }) {
  return (
    <BaseTabs.List aria-label={ariaLabel} className="relative inline-flex gap-1.5 border-b border-border">
      {children}
      <BaseTabs.Indicator className="absolute bottom-0 left-[var(--active-tab-left)] h-0.5 w-[var(--active-tab-width)] rounded-pill bg-accent transition-[left,width] duration-200 ease-settle motion-reduce:transition-none" />
    </BaseTabs.List>
  );
}

export function Tab({ value, children }: { value: string; children: ReactNode }) {
  return (
    <BaseTabs.Tab
      value={value}
      className="cursor-pointer border-0 bg-transparent px-2 pt-1 pb-1.5 font-ui text-sm font-semibold text-text-dim transition-colors duration-150 ease-settle hover:text-text data-[selected]:text-text"
    >
      {children}
    </BaseTabs.Tab>
  );
}

export function TabPanel({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  return (
    <BaseTabs.Panel value={value} className={cx("outline-none", className)}>
      {children}
    </BaseTabs.Panel>
  );
}
