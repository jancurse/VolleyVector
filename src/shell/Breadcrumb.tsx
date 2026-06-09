import { Fragment } from "react";
import type { JSX } from "react";
import { ChevronRight, Ellipsis } from "lucide-react";

import type { Route } from "../routing/route";
import { IconButton } from "../ui/IconButton";
import { Menu, MenuItem } from "../ui/Menu";
import { cx } from "../ui/styles";
import { collapseCrumbs } from "./breadcrumb";
import type { Crumb } from "./breadcrumb";

// The top bar's path trail. Earlier crumbs link back up the hierarchy; the last is the current page and
// reads as plain text. A long trail folds its middle behind an ellipsis menu, so the head (space) and
// tail (current page) stay legible; each crumb additionally truncates when space is tight.
type BreadcrumbProps = {
  crumbs: Crumb[];
  onNavigate: (route: Route) => void;
  className?: string;
};

const LINK =
  "max-w-[16ch] truncate rounded-sm font-ui text-sm font-medium text-text-dim transition-colors duration-150 ease-settle hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function Breadcrumb({ crumbs, onNavigate, className }: BreadcrumbProps): JSX.Element {
  const items = collapseCrumbs(crumbs);

  return (
    <nav aria-label="Breadcrumb" className={cx("flex min-w-0 items-center gap-1.5", className)}>
      {items.map((item, index) => {
        const last = index === items.length - 1;

        return (
          <Fragment key={index}>
            {index > 0 && <ChevronRight size={13} aria-hidden="true" className="flex-none text-text-dim/70" />}
            {item.kind === "collapsed" ? (
              <Menu
                align="start"
                trigger={
                  <IconButton variant="plain" size="sm" aria-label="More pages" tooltip={null}>
                    <Ellipsis size={15} aria-hidden="true" />
                  </IconButton>
                }
              >
                {item.hidden.map((crumb, hiddenIndex) => (
                  <MenuItem key={hiddenIndex} onClick={() => onNavigate(crumb.route)}>
                    {crumb.label}
                  </MenuItem>
                ))}
              </Menu>
            ) : last ? (
              <span aria-current="page" className="max-w-[24ch] truncate font-ui text-sm font-semibold text-text">
                {item.crumb.label}
              </span>
            ) : (
              <button type="button" className={LINK} onClick={() => onNavigate(item.crumb.route)}>
                {item.crumb.label}
              </button>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
