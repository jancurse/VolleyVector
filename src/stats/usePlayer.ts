import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentPropsWithRef, RefCallback } from "react";

/** The parts of the YouTube iframe player API the app uses. */
type YtPlayer = {
  getCurrentTime?: () => number;
  getDuration?: () => number;
  playVideo?: () => void;
  pauseVideo?: () => void;
  seekTo?: (seconds: number, allowSeekAhead: boolean) => void;
  setPlaybackRate?: (rate: number) => void;
  destroy?: () => void;
};

type YtEvent<T = unknown> = { target: YtPlayer; data: T };

type YtApi = {
  Player: new (
    host: HTMLElement,
    options: {
      videoId: string;
      width: string;
      height: string;
      playerVars: Record<string, number>;
      events: {
        onReady: (e: YtEvent) => void;
        onStateChange: (e: YtEvent<number>) => void;
        onPlaybackRateChange: (e: YtEvent<number>) => void;
      };
    }
  ) => YtPlayer;
};

// Declaration merging adds the YouTube API's globals to Window, so this one stays an interface.
declare global {
  interface Window {
    YT?: YtApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export type VideoSource = { type: "file"; url: string; name: string } | { type: "youtube"; id: string };

export const FRAME = 1 / 30;

let ytApi: Promise<YtApi> | null = null;

function loadYoutubeApi(): Promise<YtApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);

  ytApi ??= new Promise((resolve) => {
    window.onYouTubeIframeAPIReady = () => window.YT && resolve(window.YT);

    const tag = document.createElement("script");

    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });

  return ytApi;
}

/** The controls and state of the video, without the element refs (which belong to the stage). */
export type Player = {
  source: VideoSource | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  rate: number;
  loadFile: (file: File) => void;
  loadYoutube: (id: string) => void;
  getTime: () => number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (t: number) => void;
  seekBy: (dt: number) => void;
  setRate: (r: number) => void;
};

/**
 * What the video stage mounts: a local <video> (its ref and events), and the host the YouTube player fills. Both
 * refs are callbacks, so a stage mounted afresh (the layout changed around it) gets its video back where it was.
 */
export type PlayerStage = {
  videoRef: RefCallback<HTMLVideoElement>;
  videoEvents: Omit<ComponentPropsWithRef<"video">, "ref">;
  ytHostRef: RefCallback<HTMLDivElement>;
};

/**
 * One interface over a local <video> element and the YouTube iframe player, so the rest of the app never
 * has to branch on the source type. Returns the controls and, apart, the refs the stage mounts. With `trackTime`
 * off, `currentTime` does not follow a playing YouTube video (the highlights read `getTime()` instead), which
 * spares a render five times a second.
 */
export function usePlayer(initialYoutubeId: string | null = null, trackTime = true): [Player, PlayerStage] {
  const [source, setSource] = useState<VideoSource | null>(() =>
    initialYoutubeId ? { type: "youtube", id: initialYoutubeId } : null
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRateState] = useState(1);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ytRef = useRef<YtPlayer | null>(null);
  const [ytHost, setYtHost] = useState<HTMLDivElement | null>(null);
  // Where the video was and how fast it played, for a stage that mounts afresh.
  const resume = useRef({ source: "", time: 0, rate: 1 });

  // --- YouTube lifecycle -------------------------------------------------
  const youtubeId = source?.type === "youtube" ? source.id : null;

  useEffect(() => {
    const wrapper = ytHost;

    if (!youtubeId || !wrapper) return;

    const from = resume.current.source === youtubeId ? resume.current : null;

    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | undefined;

    loadYoutubeApi().then((YT) => {
      if (cancelled) return;
      // YT replaces the element it is given; keep that element out of React's tree.
      const host = document.createElement("div");

      wrapper.appendChild(host);
      ytRef.current = new YT.Player(host, {
        videoId: youtubeId,
        width: "100%",
        height: "100%",
        // Our own controls replace YouTube's; the iframe sits behind a click shield.
        playerVars: {
          controls: 0,
          modestbranding: 1,
          rel: 0,
          disablekb: 1,
          playsinline: 1,
          ...(from && { start: Math.floor(from.time) }),
        },
        events: {
          onReady: (e) => {
            setDuration(e.target.getDuration?.() || 0);
            if (from) e.target.setPlaybackRate?.(from.rate);
          },
          onStateChange: (e) => {
            setIsPlaying(e.data === 1);
            const d = e.target.getDuration?.();

            if (d) setDuration(d);
          },
          onPlaybackRateChange: (e) => {
            resume.current.rate = e.data;
            setRateState(e.data);
          },
        },
      });
      // YouTube reports no time updates, so `currentTime` follows by asking; skipped when nothing shows it.
      if (trackTime)
        poll = setInterval(() => {
          const t = ytRef.current?.getCurrentTime?.();

          if (typeof t === "number") setCurrentTime(t);
        }, 200);
    });

    return () => {
      cancelled = true;
      clearInterval(poll);

      const at = ytRef.current?.getCurrentTime?.();

      if (typeof at === "number") resume.current = { ...resume.current, source: youtubeId, time: at };
      ytRef.current?.destroy?.();
      ytRef.current = null;
      wrapper.innerHTML = "";
    };
  }, [youtubeId, ytHost, trackTime]);

  // A local <video> mounted afresh starts where the last one stopped.
  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;

    if (!el) return setIsPlaying(false);
    if (resume.current.source !== el.src) return;

    el.currentTime = resume.current.time;
    el.playbackRate = resume.current.rate;
  }, []);

  // Clicking the YouTube iframe moves keyboard focus into it, which swallows
  // our shortcuts. Hand focus straight back to the page.
  useEffect(() => {
    const onBlur = () =>
      setTimeout(() => {
        const el = document.activeElement;

        if (el instanceof HTMLIFrameElement) {
          el.blur();
          window.focus();
        }
      }, 0);

    window.addEventListener("blur", onBlur);

    return () => window.removeEventListener("blur", onBlur);
  }, []);

  // Release object URLs for local files when they are replaced.
  useEffect(() => {
    if (source?.type !== "file") return;

    return () => URL.revokeObjectURL(source.url);
  }, [source]);

  // --- Loading -----------------------------------------------------------
  const reset = () => {
    resume.current = { source: "", time: 0, rate: 1 };
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setRateState(1);
  };

  const loadFile = useCallback((file: File) => {
    reset();
    setSource({ type: "file", url: URL.createObjectURL(file), name: file.name });
  }, []);

  const loadYoutube = useCallback((id: string) => {
    reset();
    setSource({ type: "youtube", id });
  }, []);

  // --- Controls ----------------------------------------------------------
  const getTime = useCallback((): number => {
    if (videoRef.current) return videoRef.current.currentTime;
    const t = ytRef.current?.getCurrentTime?.();

    return typeof t === "number" ? t : 0;
  }, []);

  const play = useCallback(() => {
    if (videoRef.current) void videoRef.current.play();
    else ytRef.current?.playVideo?.();
  }, []);

  const pause = useCallback(() => {
    if (videoRef.current) videoRef.current.pause();
    else ytRef.current?.pauseVideo?.();
  }, []);

  const seek = useCallback((t: number) => {
    const d = videoRef.current?.duration || ytRef.current?.getDuration?.() || Infinity;
    const clamped = Math.min(Math.max(t, 0), d);

    if (videoRef.current) videoRef.current.currentTime = clamped;
    else ytRef.current?.seekTo?.(clamped, true);
    setCurrentTime(clamped);
  }, []);

  const seekBy = useCallback((dt: number) => seek(getTime() + dt), [seek, getTime]);

  const setRate = useCallback((r: number) => {
    if (videoRef.current) videoRef.current.playbackRate = r;
    else ytRef.current?.setPlaybackRate?.(r);
    setRateState(r);
  }, []);

  /** Events to spread on the <video> element for local files. */
  const videoEvents = {
    onTimeUpdate: () => {
      const el = videoRef.current;

      if (el) resume.current = { ...resume.current, source: el.src, time: el.currentTime };
      setCurrentTime(el?.currentTime ?? 0);
    },
    onLoadedMetadata: () => setDuration(videoRef.current?.duration ?? 0),
    onPlay: () => setIsPlaying(true),
    onPause: () => setIsPlaying(false),
    onEnded: () => setIsPlaying(false),
    onRateChange: () => {
      resume.current.rate = videoRef.current?.playbackRate ?? 1;
      setRateState(videoRef.current?.playbackRate ?? 1);
    },
  };

  return [
    {
      source,
      isPlaying,
      currentTime,
      duration,
      rate,
      loadFile,
      loadYoutube,
      getTime,
      play,
      pause,
      toggle: () => (isPlaying ? pause() : play()),
      seek,
      seekBy,
      setRate,
    },
    { videoRef: attachVideo, videoEvents, ytHostRef: setYtHost },
  ];
}
