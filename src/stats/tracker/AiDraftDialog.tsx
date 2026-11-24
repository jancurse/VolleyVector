import { useState } from "react";
import type { JSX } from "react";
import { CircleHelp, Sparkles } from "lucide-react";

import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { ExternalLink } from "../../ui/ExternalLink";
import { Field } from "../../ui/Field";
import { IconButton } from "../../ui/IconButton";
import { Input } from "../../ui/Input";
import { Select } from "../../ui/Select";
import { CALLOUT_NOTE, CALLOUT_WARN, cx } from "../../ui/styles";
import { formatTime } from "../exporters";
import { readTime } from "../setDraft";
import type { MatchMeta } from "../types";
import { extractYoutubeId } from "../youtube";

type AiDraftDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meta: MatchMeta;
  /** A run is under way: it cannot be started twice. */
  running: boolean;
  /** Why the last run stopped, when it failed. */
  error: string | null;
  /** Where the video is now, in seconds. */
  videoTime: () => number;
  onMeta: (meta: Partial<MatchMeta>) => void;
  /** Start the run on the stretch from `from` to `to` (the video's end when absent), in seconds. */
  onStart: (key: string, from: number, to: number | undefined) => void;
};

const HALVES = [
  { value: "", label: "Choose…" },
  { value: "near", label: "Near the camera" },
  { value: "far", label: "Far from the camera" },
];

const HELP_HEADING = "m-0 font-semibold text-text";
const HELP_LIST = "m-0 flex list-disc flex-col gap-1 pl-5";

/** How to get a key and keep it from costing more than meant. */
function KeyHelp(): JSX.Element {
  return (
    <div className={cx(CALLOUT_NOTE, "flex flex-col gap-2")}>
      <p className={HELP_HEADING}>Get a key</p>
      <ul className={HELP_LIST}>
        <li>
          Create one in <ExternalLink href="https://aistudio.google.com/apikey">Google AI Studio</ExternalLink>.
        </li>
        <li>Turn on billing for its project. Google charges for every draft.</li>
      </ul>
      <p className={HELP_HEADING}>Protect it</p>
      <ul className={HELP_LIST}>
        <li>
          In the Google Cloud console, under APIs &amp; Services, Credentials, restrict the key to the Generative
          Language API and to the website volleyvector.app.
        </li>
        <li>Set a budget alert on the project, or pay with prepaid credit, which is all the key can use up.</li>
      </ul>
      <p className={HELP_HEADING}>What VolleyVector does with it</p>
      <ul className={HELP_LIST}>
        <li>It is never stored. It stays on this page until you leave the set.</li>
        <li>It is sent only to Google.</li>
      </ul>
      <p className="m-0 text-xs">
        You use your key at your own risk. VolleyVector is not liable for what Google charges you, and does not
        guarantee that a draft is complete or correct.
      </p>
    </div>
  );
}

/** What a model needs to draft the set from its video: the coach's key, our half, and where the set starts and ends. */
export function AiDraftDialog({
  open,
  onOpenChange,
  meta,
  running,
  error,
  videoTime,
  onMeta,
  onStart,
}: AiDraftDialogProps): JSX.Element {
  const [key, setKey] = useState("");
  const [help, setHelp] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const start = from.trim() ? readTime(from) : 0;
  const end = to.trim() ? readTime(to) : undefined;
  const missing = !extractYoutubeId(meta.youtubeUrl)
    ? "The set needs a YouTube link. A video file on this computer cannot be sent."
    : !key.trim()
      ? "Paste your Gemini API key."
      : !meta.ourHalf
        ? "Choose our half."
        : start === null || end === null || (end !== undefined && end <= (start ?? 0))
          ? "Give the times as MM:SS, the end after the start."
          : running
            ? "A run is under way."
            : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Draft with AI">
      <p className="m-0 text-sm text-text-dim">
        A model watches the set and finds its rallies: when each serve is hit, who serves, and when the rally ends. You
        jump from serve to serve and record the touches.
      </p>
      <div className="flex items-end gap-1">
        <Field label="Gemini API key" className="flex-1">
          {/* A text field drawn as dots, not a password field: a browser offers to save what a password field holds. */}
          <Input
            autoComplete="off"
            spellCheck={false}
            className="[-webkit-text-security:disc]"
            value={key}
            placeholder="Paste your key. It is not stored."
            onChange={(e) => setKey(e.target.value)}
          />
        </Field>
        <IconButton
          variant="plain"
          aria-label="About the Gemini API key"
          aria-expanded={help}
          onClick={() => setHelp(!help)}
        >
          <CircleHelp size={16} aria-hidden="true" />
        </IconButton>
      </div>
      {help && <KeyHelp />}
      <Field label="Our half of the court">
        <Select
          ariaLabel="Our half of the court"
          value={meta.ourHalf ?? ""}
          onValueChange={(v) => onMeta({ ourHalf: v === "near" || v === "far" ? v : undefined })}
          options={HALVES}
        />
      </Field>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Set starts at" className="w-28">
          <Input value={from} placeholder="0:00" onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Button variant="ghost" paired onClick={() => setFrom(formatTime(videoTime()))}>
          Use current video time
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Set ends at" className="w-28">
          <Input value={to} placeholder="the end" onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Button variant="ghost" paired onClick={() => setTo(formatTime(videoTime()))}>
          Use current video time
        </Button>
      </div>
      {error && <p className={CALLOUT_WARN}>{error}</p>}
      <p className="m-0 text-sm text-text-dim">
        About $0.60 for one set, billed by Google to your key. It takes a few minutes, and you can keep working
        meanwhile.
      </p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {missing && <p className="m-0 mr-auto text-sm text-text-dim">{missing}</p>}
        <Button variant="ghost" paired onClick={() => onOpenChange(false)}>
          Close
        </Button>
        <Button
          disabled={!!missing}
          onClick={() => {
            onStart(key.trim(), start ?? 0, end ?? undefined);
            onOpenChange(false);
          }}
        >
          <Sparkles size={15} aria-hidden="true" /> Start
        </Button>
      </div>
    </Dialog>
  );
}
