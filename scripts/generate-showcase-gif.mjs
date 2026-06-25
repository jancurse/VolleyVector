// Regenerate docs/rotation-showcase.gif from the live landing-page rotation showcase.
//
// The showcase is the running app, not a static SVG: an SVG court plus HTML editor panels animated by
// JavaScript (requestAnimationFrame, Motion). Only a real browser renders it faithfully, so this drives
// system Chrome over the DevTools Protocol (Node's built-in WebSocket, no Playwright, no extra deps),
// captures cropped 2x frames of one loop, and encodes the GIF with system ffmpeg.
//
// Run with `npm run generate:showcase`. Requires:
//   - a running dev server at http://localhost:5173 (start `npm run dev` in another terminal)
//   - a Chrome binary (CHROME_BIN, or google-chrome on PATH) and ffmpeg on PATH
//
// When the showcase animation or layout changes, just rerun this. The crop is measured at runtime, so a
// layout change needs no edit here; only a change to the loop's length needs LOOP_MS below updated.
import { Buffer } from "node:buffer";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// ---- Config: edit if the showcase changes ----------------------------------
const APP_URL = "http://localhost:5173/";
const THEME = "dark"; // "dark" | "light", emulated via prefers-color-scheme
// Just above the 1040px court/editor stacking breakpoint (--breakpoint-court), so the board and its panel
// stay side by side at their narrowest two-column layout.
const VIEWPORT = { width: 1060, height: 1000 };
const CROP_MARGIN = 22; // CSS px of breathing room kept around the showcase, so nothing reads as cut off
const LOOP_MS = 28250; // one full loop of ROTATION_SCRIPT (sum of its beat durations)
const FPS = 24;
const OUT_WIDTH = 760; // final GIF width in px (matches the README's <img width>)
const COLORS = 128;
const SECTION_HEADING = "Optimise your rotations"; // the showcase section's <h2>
const OUT = join(ROOT, "docs/rotation-showcase.gif");
// ----------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  const candidates = [process.env.CHROME_BIN, "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"];

  for (const bin of candidates) {
    if (!bin) continue;
    try {
      execFileSync(bin, ["--version"], { stdio: "ignore" });

      return bin;
    } catch {
      // try the next candidate
    }
  }

  return null;
}

async function serverUp() {
  try {
    return (await fetch(APP_URL)).ok;
  } catch {
    return false;
  }
}

// A thin DevTools Protocol client over the page target's WebSocket: send() resolves on the matching
// response id; on(event) registers an event handler.
function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  const handlers = new Map();
  let nextId = 1;

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);

    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);

      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    } else if (msg.method && handlers.has(msg.method)) {
      for (const fn of [...handlers.get(msg.method)]) fn(msg.params);
    }
  };

  const ready = new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  const on = (method, fn) => {
    if (!handlers.has(method)) handlers.set(method, new Set());
    handlers.get(method).add(fn);
  };

  return {
    ready,
    on,
    once: (method) =>
      new Promise((resolve) => {
        const fn = (params) => {
          handlers.get(method).delete(fn);
          resolve(params);
        };

        on(method, fn);
      }),
    send: (method, params = {}, sessionId) => {
      const id = nextId++;
      const msg = { id, method, params };

      if (sessionId) msg.sessionId = sessionId;
      ws.send(JSON.stringify(msg));

      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    close: () => ws.close(),
  };
}

async function evalJSON(send, expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true });

  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);

  return r.result.value;
}

async function main() {
  const chrome = findChrome();

  if (!chrome) throw new Error("No Chrome binary found. Set CHROME_BIN or put google-chrome on PATH.");
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  } catch {
    throw new Error("ffmpeg not found on PATH.");
  }
  if (!(await serverUp())) {
    throw new Error(`No dev server at ${APP_URL}. Start it in another terminal with: npm run dev`);
  }

  const tmp = mkdtempSync(join(tmpdir(), "showcase-"));
  const userDir = join(tmp, "chrome");
  const proc = spawn(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--hide-scrollbars",
      "--force-color-profile=srgb",
      "--remote-debugging-port=0",
      `--user-data-dir=${userDir}`,
      `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  try {
    // Chrome picks a free port (=0) and writes it to DevToolsActivePort, so concurrent runs never collide.
    let port = null;

    for (let i = 0; i < 50 && !port; i++) {
      await sleep(100);
      try {
        port = readFileSync(join(userDir, "DevToolsActivePort"), "utf8").split("\n")[0].trim();
      } catch {
        // not written yet
      }
    }
    if (!port) throw new Error("Chrome did not report a debugging port.");

    const base = `http://127.0.0.1:${port}`;
    let pageTarget = null;

    for (let i = 0; i < 50 && !pageTarget; i++) {
      await sleep(100);
      try {
        pageTarget = (await (await fetch(`${base}/json`)).json()).find((t) => t.type === "page");
      } catch {
        // endpoint not ready yet
      }
    }
    if (!pageTarget) throw new Error("Chrome DevTools endpoint did not come up.");

    // Connect to the browser endpoint and attach to the page with a flat session: page commands such as
    // Page.captureScreenshot are unreliable over a bare page-target socket under --headless=new.
    const version = await (await fetch(`${base}/json/version`)).json();
    const cdp = connect(version.webSocketDebuggerUrl);

    await cdp.ready;

    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId: pageTarget.id, flatten: true });
    const send = (method, params) => cdp.send(method, params, sessionId);

    await send("Page.enable");
    await send("Runtime.enable");

    // Render retina-crisp frames at the chosen viewport.
    await send("Emulation.setDeviceMetricsOverride", {
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-color-scheme", value: THEME }],
    });

    // Block the dev auto-login token request so the logged-out landing (with the showcase) renders.
    cdp.on("Fetch.requestPaused", (p) => {
      void send("Fetch.failRequest", { requestId: p.requestId, errorReason: "Failed" });
    });
    await send("Fetch.enable", { patterns: [{ urlPattern: "*auth/v1/token*" }] });

    const loaded = cdp.once("Page.loadEventFired");

    await send("Page.navigate", { url: APP_URL });
    await loaded;

    // Wait (in real time) for the showcase to mount and its webfonts to load, then let the one-time
    // entrance animations finish, so capture starts from a settled state.
    const ready = `[...document.querySelectorAll('h2')].some(h => h.textContent.includes(${JSON.stringify(SECTION_HEADING)})) && document.fonts.status === 'loaded'`;

    for (let i = 0; i < 100; i++) {
      if (await evalJSON(send, ready)) break;
      await sleep(100);
    }
    await sleep(700);

    // Scroll the showcase to the top of the viewport (leaving the crop margin above it) so the screencast,
    // which only streams the visible viewport, captures it whole. Then measure its viewport-relative rect.
    const view = await evalJSON(
      send,
      `(() => {
        // Hide the sticky landing header so it cannot overlay the top of the crop once we scroll up.
        document.querySelector('header')?.style.setProperty('display', 'none', 'important');
        const section = [...document.querySelectorAll('section')]
          .find(s => s.querySelector('h2')?.textContent?.includes(${JSON.stringify(SECTION_HEADING)}));
        const root = section.querySelector('div').firstElementChild;
        window.scrollBy(0, root.getBoundingClientRect().top - ${CROP_MARGIN});
        const r = root.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, vw: innerWidth, vh: innerHeight };
      })()`
    );

    // The crop region within the viewport (showcase plus margin, clamped), expressed as fractions so it
    // maps onto whatever resolution the screencast streams at.
    const cx = Math.max(0, view.x - CROP_MARGIN);
    const cy = Math.max(0, view.y - CROP_MARGIN);
    const frac = {
      x: cx / view.vw,
      y: cy / view.vh,
      w: (Math.min(view.vw, view.x + view.width + CROP_MARGIN) - cx) / view.vw,
      h: (Math.min(view.vh, view.y + view.height + CROP_MARGIN) - cy) / view.vh,
    };

    // Stream the painted viewport: Chrome pushes frames as it paints (far faster than pulling a screenshot
    // per frame, which caps near 10fps), each with a real timestamp. The animation plays in real time, and
    // encoding resamples by these timestamps to a constant FPS, so playback speed matches the page exactly.
    // The loop is periodic (its end eases back to its start), so one period loops seamlessly.
    console.log(`Capturing ~${(LOOP_MS / 1000).toFixed(1)}s of animation...`);
    const name = (i) => join(tmp, `frame-${String(i).padStart(5, "0")}.jpg`);
    const buffers = [];
    const times = [];

    cdp.on("Page.screencastFrame", (p) => {
      buffers.push(Buffer.from(p.data, "base64"));
      times.push(p.metadata.timestamp);
      void send("Page.screencastFrameAck", { sessionId: p.sessionId });
    });
    await send("Page.startScreencast", {
      format: "jpeg",
      quality: 92,
      maxWidth: view.vw * 2,
      maxHeight: view.vh * 2,
      everyNthFrame: 1,
    });
    await sleep(LOOP_MS);
    await send("Page.stopScreencast");
    cdp.close();

    // Keep one period's worth of frames, timestamped from the first.
    const ms = times.map((t) => (t - times[0]) * 1000);
    let n = ms.findIndex((t) => t > LOOP_MS);

    if (n === -1) n = ms.length;
    buffers.slice(0, n).forEach((buf, i) => writeFileSync(name(i), buf));
    console.log(`Captured ${n} frames (${(n / (LOOP_MS / 1000)).toFixed(1)} fps), encoding...`);

    // A concat script giving each frame its real on-screen duration (the last fills out the period). The
    // fps filter then resamples to a constant rate without altering the motion's speed. The last file is
    // repeated because the concat demuxer drops the final entry's duration otherwise.
    const list = Array.from({ length: n }, (_, i) => {
      const dur = (i + 1 < n ? ms[i + 1] : LOOP_MS) - ms[i];

      return `file '${name(i)}'\nduration ${(dur / 1000).toFixed(4)}`;
    }).join("\n");

    writeFileSync(join(tmp, "list.txt"), `${list}\nfile '${name(n - 1)}'\n`);

    // Crop the streamed viewport to the showcase region (fractions x actual frame size), then resample.
    const [fw, fh] = execFileSync("ffprobe", [
      "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", name(0),
    ])
      .toString()
      .trim()
      .split("x")
      .map(Number);
    const crop = `crop=${Math.round(frac.w * fw)}:${Math.round(frac.h * fh)}:${Math.round(frac.x * fw)}:${Math.round(frac.y * fh)}`;

    // Two-pass palette for a clean GIF: generate an optimised palette, then map frames through it.
    const input = ["-f", "concat", "-safe", "0", "-i", join(tmp, "list.txt")];
    const vf = `${crop},fps=${FPS},scale=${OUT_WIDTH}:-1:flags=lanczos`;

    execFileSync(
      "ffmpeg",
      ["-y", ...input, "-vf", `${vf},palettegen=max_colors=${COLORS}:stats_mode=diff`, join(tmp, "pal.png")],
      { stdio: "ignore" }
    );
    execFileSync(
      "ffmpeg",
      [
        "-y",
        ...input,
        "-i",
        join(tmp, "pal.png"),
        "-lavfi",
        `${vf}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
        "-loop",
        "0",
        OUT,
      ],
      { stdio: "ignore" }
    );

    console.log(`Wrote ${OUT} (${(statSync(OUT).size / 1024 / 1024).toFixed(2)} MB)`);
  } finally {
    proc.kill("SIGKILL");
    rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
