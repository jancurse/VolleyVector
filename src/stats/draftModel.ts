/**
 * A model's draft made from the browser, with the coach's own Gemini key. The key is never stored and goes only to
 * Google, in a header. Two passes: the rallies of the whole stretch at 1 frame a second, then every rally on its own
 * at 2 frames a second for who serves it and when.
 *
 * A rally's call can also list every touch inside the rally (`touches`). The tracker does not use that: about 3 in 10
 * of the touches it gives our side are not ours and a quarter of ours are missing, so correcting them costs more than
 * marking by hand.
 */

import { parseDraft, readTime, sceneText, SKILL_TEXT } from "./setDraft";
import type { ModelDraft } from "./setDraft";
import type { MatchMeta } from "./types";
import { extractYoutubeId } from "./youtube";

const API = "https://generativelanguage.googleapis.com/v1beta/interactions";
const MODEL = "gemini-4-hydrogen";
/** USD per million tokens. Thinking is billed as output. */
const PRICE = { input: 1.5, output: 7.5 };
/** How much of the video a rally's call shows around the rally, in seconds. */
const BEFORE = 3;
const AFTER = 2;
const PARALLEL = 8;
/** More rallies than one set holds: the stretch is more than a set, and a call each would cost too much. */
const MAX_RALLIES = 70;
const RETRIES = 4;

const RALLIES_PROMPT = `This is a video of one set of an amateur indoor volleyball match, filmed by a fixed camera.

List every rally in the video. A rally starts with a serve (a player behind an end line hits the ball over the net) and ends when the ball goes dead (it lands, is hit out or into the net, or the referee stops play).

Rules:
- One serve per rally. After a serve, the next serve can only come after that rally has ended.
- Players lining up, the server fetching, bouncing or holding the ball, and the server walking to the end line are NOT a serve. Report the serve at the moment the ball is hit.
- The camera may not show one end line. If the server is out of the picture, use the moment the ball flies in from that side.
- A rally can last a minute and cross the net many times. Hits from the back of the court during a rally are not serves.
- Between rallies there are 10 to 30 seconds of walking, celebrating or a time-out. A ball thrown or rolled back is not a rally.
- A set has 30 to 50 rallies. Go through the whole video to its last second and do not skip any.
- If a rally is already in play when the video starts, give its serve as null. If one is still in play when it ends, give its end as null.

Give every time as MM:SS from the start of the video.
Answer with JSON only, no other text: {"rallies": [{"serve": "MM:SS" or null, "end": "MM:SS" or null}, ...]}`;

const servePrompt = (meta: Pick<MatchMeta, "ourHalf" | "videoTurn">): string =>
  `This is a short video of one rally from an amateur indoor volleyball match, filmed by a fixed camera. It starts a few seconds before the serve and ends just after the ball goes dead.
${sceneText(meta)}

Say which side serves, and when the serve is hit.

Rules:
- A serve is a player behind an end line hitting the ball over the net. Give the moment the ball is hit.
- The camera may not show one end line. If the server is out of the picture, the serve is the moment the ball flies in from that side.
- If the video holds no serve and no play, answer with "serving": null.

Give the time in seconds from the start of this video, with one decimal.
Answer with JSON only, no other text:
{"serving": "us" or "them", "serve": seconds}`;

const contactsPrompt = (meta: Pick<MatchMeta, "ourHalf" | "videoTurn">): string =>
  `This is a short video of one rally from an amateur indoor volleyball match, filmed by a fixed camera. It starts a few seconds before the serve and ends just after the ball goes dead.
${sceneText(meta)}

Say which side serves, and list every touch of the ball by either team, in order.

Rules:
- The first touch is the serve, by the side that serves. The camera may not show one end line: if the server is out of the picture, the serve is the moment the ball flies in from that side.
- A team has at most three touches before the ball must cross the net, not counting a block.
- List a touch only if a player plays the ball. The ball landing on the floor is not a touch.
- Give the time of each touch at the moment of contact.
- If the video holds no serve and no play, answer with an empty list of touches and "serving": null.

${SKILL_TEXT}

Give every time in seconds from the start of this video, with one decimal.
Answer with JSON only, no other text:
{"serving": "us" or "them", "touches": [[seconds, "us" or "them", skill], ...]}`;

type Interaction = {
  status?: string;
  steps?: { type?: string; content?: { text?: string }[] }[];
  usage?: Record<string, number | undefined>;
  error?: { message?: string };
};

export type ModelProgress = { done: number; total: number };

type ModelRun = {
  rallies: number;
  /** Rallies that came back with the side that serves. */
  served: number;
  /** What the calls cost at list prices, in US dollars. */
  cost: number;
};

type RunOptions = {
  key: string;
  /** The set's YouTube link. */
  url: string;
  meta: Pick<MatchMeta, "ourHalf" | "videoTurn">;
  /** The stretch of the video that holds the set, in seconds. The whole video when absent. */
  from?: number;
  to?: number;
  signal?: AbortSignal;
  onProgress?: (progress: ModelProgress) => void;
  /** List every touch inside a rally, not only its serve. Not used: see the note at the top. */
  touches?: boolean;
  /** Called with each rally as its call comes back, in the order they finish. */
  onRally?: (rally: ModelDraft) => void;
};

const wait = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);

    const stop = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", stop);
      resolve();
    }, ms);

    signal?.addEventListener("abort", stop, { once: true });
  });

/** One call on a stretch of the video. Retries while the service is busy. */
async function ask(
  { key, url, signal }: RunOptions,
  text: string,
  fps: number,
  thinking: string | null,
  start?: number,
  end?: number
): Promise<Interaction> {
  const body = {
    model: MODEL,
    input: [
      {
        type: "video",
        uri: `https://www.youtube.com/watch?v=${extractYoutubeId(url)}`,
        resolution: "low",
        processing: {
          type: "static",
          fps,
          ...(start !== undefined && { start_offset: `${start}s` }),
          ...(end !== undefined && { end_offset: `${end}s` }),
        },
      },
      { type: "text", text },
    ],
    ...(thinking && { generation_config: { thinking_level: thinking } }),
  };

  for (let attempt = 0; ; attempt++) {
    const response = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal,
    });
    const answer = (await response.json().catch(() => ({}))) as Interaction;

    if (response.ok) return answer;
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === RETRIES)
      throw new Error(answer.error?.message ?? `Google answered with status ${response.status}.`);
    await wait(10_000 * (attempt + 1), signal);
  }
}

/** The JSON object in a model's answer, or nothing when it holds none that parses. */
function answerOf(answer: Interaction): Record<string, unknown> {
  const text = (answer.steps ?? [])
    .filter((s) => s.type === "model_output")
    .flatMap((s) => s.content ?? [])
    .map((c) => c.text ?? "")
    .join("");

  try {
    return JSON.parse(/\{[\s\S]*\}/.exec(text)?.[0] ?? "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

const costOf = ({ usage = {} }: Interaction): number =>
  (((usage.total_input_tokens ?? 0) + (usage.total_tool_use_tokens ?? 0)) * PRICE.input +
    ((usage.total_output_tokens ?? 0) + (usage.total_thought_tokens ?? 0)) * PRICE.output) /
  1e6;

/** Each rally's serve and end, in seconds of the stretch that was sent. */
function spansOf(answer: Interaction): [number, number][] {
  const { rallies } = answerOf(answer);
  const found = (Array.isArray(rallies) ? rallies : []).map((r) => (r ?? {}) as { serve?: unknown; end?: unknown });
  const times = (list: unknown[]) => list.map(readTime).filter((t): t is number => t !== null);
  const serves = times(found.map((r) => r.serve)).sort((a, b) => a - b);
  const ends = times(found.map((r) => r.end)).sort((a, b) => a - b);

  return serves.map((serve, i) => {
    const next = serves[i + 1] ?? serve + 60;

    return [serve, ends.find((e) => serve < e && e < next) ?? Math.min(serve + 30, next - 3)];
  });
}

/** Ask the model for a draft of the set's video: its rallies, then who serves each and when. */
export async function runModel(options: RunOptions): Promise<ModelRun> {
  const { meta, from = 0, to, onProgress, onRally } = options;
  const ranged = from > 0 || to !== undefined;
  const first = await ask(options, RALLIES_PROMPT, 1, null, ranged ? from : undefined, to);
  const spans = spansOf(first)
    .map(([serve, end]) => [serve + from, end + from] as const)
    .filter(([serve]) => to === undefined || serve <= to);

  if (spans.length > MAX_RALLIES)
    throw new Error(
      `The AI found ${spans.length} rallies, more than one set holds. Give the times where the set starts and ends.`
    );
  const prompt = options.touches ? contactsPrompt(meta) : servePrompt(meta);
  let next = 0;
  let done = 0;
  let served = 0;
  let cost = costOf(first);

  onProgress?.({ done, total: spans.length });

  const worker = async () => {
    while (next < spans.length) {
      const i = next++;
      const [serve, end] = spans[i]!;
      const start = Math.max(0, serve - BEFORE);
      let got: Record<string, unknown> = {};

      try {
        const answer = await ask(options, prompt, 2, "low", start, end + AFTER);

        cost += costOf(answer);
        got = answerOf(answer);
      } catch (e) {
        if (options.signal?.aborted) throw e;
      }

      const round = (t: number) => Math.round(t * 10) / 10;
      const side = got.serving === "us" || got.serving === "them";
      // A serve-only answer holds no touches: it names the server and places the serve more exactly.
      const touches = options.touches
        ? Array.isArray(got.touches)
          ? (got.touches as unknown[])
          : null
        : side
          ? []
          : null;
      const hit = options.touches ? null : readTime(got.serve);

      const rally = parseDraft(
        JSON.stringify({
          rallies: [
            {
              start: hit !== null && side ? Math.min(round(hit + start), end) : serve,
              end,
              serving: got.serving ?? null,
              contacts: (touches ?? []).flatMap((t) => {
                const time = Array.isArray(t) ? readTime(t[0]) : null;

                return Array.isArray(t) && time !== null ? [[round(time + start), t[1], t[2]]] : [];
              }),
            },
          ],
        })
      );

      if (rally.ok) {
        if (side) served++;
        onRally?.(rally.draft);
      }
      onProgress?.({ done: ++done, total: spans.length });
    }
  };

  await Promise.all(Array.from({ length: Math.min(PARALLEL, spans.length) }, worker));

  return { rallies: spans.length, served, cost };
}
