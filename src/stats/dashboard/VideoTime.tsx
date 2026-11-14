import type { JSX } from "react";

import { ExternalLink } from "../../ui/ExternalLink";
import { youtubeAt } from "../clips";
import { formatTime } from "../exporters";

/** A moment's video time, linking to YouTube a few seconds before it (the link survives in the PDF). */
export function VideoTime({ videoId, time }: { videoId: string | null; time: number }): JSX.Element {
  const sec = Math.round(time);

  return videoId ? (
    <ExternalLink href={youtubeAt(videoId, sec - 3)}>{formatTime(sec)}</ExternalLink>
  ) : (
    <>{formatTime(sec)}</>
  );
}
