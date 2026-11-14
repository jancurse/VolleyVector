import type { ComponentPropsWithoutRef, JSX } from "react";

import { cx, LINK } from "./styles";

type ExternalLinkProps = Omit<ComponentPropsWithoutRef<"a">, "target" | "rel"> & {
  href: string;
  /** `inherit` keeps the surrounding text's colour; the link then shows only on hover. */
  tone?: "accent" | "inherit";
};

/** A link out of the app (a video, an exported page), opened in a new tab. */
export function ExternalLink({ tone = "accent", className, ...props }: ExternalLinkProps): JSX.Element {
  return <a target="_blank" rel="noopener noreferrer" className={cx(LINK[tone], className)} {...props} />;
}
