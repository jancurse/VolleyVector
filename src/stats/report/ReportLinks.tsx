import type { JSX } from "react";

import { DASH_CARD, DASH_CARD_TITLE, MUTED } from "../../ui/styles";
import type { ReportSet } from "../types";
import { reportStats, setLabel, youtubeLinks } from "./statsAnalyzer";
import { ExternalLink } from "../../ui/ExternalLink";

const capitalise = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Every recorded moment as a link into its set's video: by player and action, then the opponent's errors. */
export function ReportLinks({ sets }: { sets: readonly ReportSet[] }): JSX.Element | null {
  const multi = sets.length > 1;
  const perSet = sets
    .filter((s) => s.meta.youtubeUrl)
    .map((s) => ({
      label: setLabel(s, sets.indexOf(s)),
      links: youtubeLinks(reportStats(s.rallies), s.meta.youtubeUrl),
    }));

  if (!sets.some((s) => s.meta.youtubeUrl)) return null;

  return (
    <section aria-label="YouTube links" className={DASH_CARD} data-report-section data-report-text>
      <h3 className={DASH_CARD_TITLE}>YouTube links</h3>
      {perSet.map(({ label, links }) => (
        <div key={label} className="flex flex-col gap-2">
          {multi && <h4 className="m-0 font-display text-display-xs font-bold">{label}</h4>}
          {!links ? (
            <p className={MUTED}>This set’s video link isn’t a YouTube link.</p>
          ) : (
            <>
              {links.players.map(({ player, actions }) => (
                <div key={player} className="flex flex-col gap-1">
                  <h5 className="m-0 text-sm font-semibold">{player}</h5>
                  {actions.map(({ stat, links: urls }) => (
                    <div key={stat} className="pl-3">
                      <p className="m-0 text-xs font-semibold text-text-dim">{capitalise(stat)}</p>
                      <ul className="m-0 list-none p-0 pl-3 text-xs">
                        {urls.map((url) => (
                          <li key={url}>
                            <ExternalLink href={url} className="break-all">
                              {url}
                            </ExternalLink>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ))}
              {links.opponentErrors.length > 0 && (
                <div className="flex flex-col gap-1">
                  <h5 className="m-0 text-sm font-semibold">Opponent errors</h5>
                  <ul className="m-0 list-none p-0 pl-3 text-xs">
                    {links.opponentErrors.map(({ label: error, link }) => (
                      <li key={link}>
                        {error}:{" "}
                        <ExternalLink href={link} className="break-all">
                          {link}
                        </ExternalLink>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </section>
  );
}
