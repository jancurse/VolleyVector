import { useState } from "react";
import type { JSX } from "react";

import { Button } from "../../ui/Button";
import { FileButton } from "../../ui/FileButton";
import { Input } from "../../ui/Input";
import { CALLOUT_WARN } from "../../ui/styles";
import type { Player } from "../usePlayer";
import { extractYoutubeId } from "../youtube";
import { LOCKED_HINT } from "./locked";

type VideoSourceProps = {
  player: Player;
  youtubeUrl: string;
  onYoutubeUrl: (url: string) => void;
  /** A locked set keeps its video link. */
  locked: boolean;
};

/** Where the video comes from: a file on this computer, or a YouTube link kept with the set. */
export function VideoSource({ player, youtubeUrl, onYoutubeUrl, locked }: VideoSourceProps): JSX.Element {
  const [urlInput, setUrlInput] = useState(youtubeUrl);
  const [shownUrl, setShownUrl] = useState(youtubeUrl);
  const { source } = player;

  // A link set elsewhere (an import, the next set) replaces what the field shows.
  if (shownUrl !== youtubeUrl) {
    setShownUrl(youtubeUrl);
    setUrlInput(youtubeUrl);
  }

  const urlId = extractYoutubeId(urlInput);

  const loadUrl = () => {
    if (!urlId) return;

    onYoutubeUrl(urlInput.trim());
    player.loadYoutube(urlId);
    (document.activeElement as HTMLElement | null)?.blur();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <FileButton accept="video/*" onFiles={([file]) => player.loadFile(file)}>
          {source?.type === "file" ? source.name : "Load local video"}
        </FileButton>
        <form
          className="flex min-w-56 flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            loadUrl();
          }}
        >
          <Input
            aria-label="YouTube link"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="YouTube link"
            className="flex-1"
            disabled={locked}
            title={locked ? LOCKED_HINT : undefined}
          />
          <Button type="submit" variant="ghost" paired disabled={!urlId || locked}>
            Load
          </Button>
        </form>
      </div>
      {urlInput.trim() && !urlId && <p className={CALLOUT_WARN}>That isn’t a YouTube link.</p>}
    </div>
  );
}
