import { useEffect, useRef } from "react";

type YTPlayer = {
  loadVideoById: (id: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  setVolume: (v: number) => void;
  seekTo: (s: number, allow: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
};

declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: unknown) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}

function loadApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  return new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    if (!document.getElementById("yt-iframe-api")) {
      const s = document.createElement("script");
      s.id = "yt-iframe-api";
      s.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(s);
    }
  });
}

export function YouTubeAudio({
  videoId,
  playing,
  volume,
  onProgress,
  onEnded,
  unlockRef,
  seekRef,
  userRequestedPlay,
  onPlayStarted,
}: {
  videoId: string | null;
  playing: boolean;
  volume: number;
  /** Called every 500ms with current playback position */
  onProgress: (progress: { current: number; duration: number }) => void;
  onEnded: () => void;
  unlockRef?: { current: (() => void) | null };
  seekRef?: { current: ((seconds: number) => void) | null };
  userRequestedPlay?: boolean;
  onPlayStarted?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const currentId = useRef<string | null>(null);
  const readyRef = useRef(false);
  const pendingId = useRef<string | null>(null);
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;

  // Initialize YouTube IFrame Player once
  useEffect(() => {
    let cancelled = false;
    void loadApi().then(() => {
      if (cancelled || !hostRef.current || playerRef.current || !window.YT) return;
      playerRef.current = new window.YT.Player(hostRef.current, {
        height: "1",
        width: "1",
        playerVars: { autoplay: 0, controls: 0, playsinline: 1 },
        events: {
          onReady: () => {
            readyRef.current = true;
            const pending = pendingId.current;
            if (pending) {
              pendingId.current = null;
              try {
                playerRef.current?.loadVideoById(pending);
                playerRef.current?.playVideo();
                onPlayStarted?.();
              } catch {
                /* ignore */
              }
              return;
            }
            if ((playing || userRequestedPlay) && videoId) {
              playerRef.current?.playVideo();
              onPlayStarted?.();
            }
          },
          onStateChange: (e: { data: number }) => {
            if (e.data === 0) endedRef.current();
          },
        },
      });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expose unlock function for mobile gesture unlock
  useEffect(() => {
    if (!unlockRef) return;
    unlockRef.current = () => {
      try { playerRef.current?.playVideo(); } catch { /* ignore */ }
    };
    return () => { unlockRef.current = null; };
  }, [unlockRef]);

  // Expose seek function
  useEffect(() => {
    if (!seekRef) return;
    seekRef.current = (seconds: number) => {
      try { playerRef.current?.seekTo(seconds, true); } catch { /* ignore */ }
    };
    return () => { seekRef.current = null; };
  }, [seekRef]);

  // Load new video when videoId changes
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !videoId) return;
    if (currentId.current !== videoId) {
      currentId.current = videoId;
      if (!readyRef.current) {
        pendingId.current = videoId;
        return;
      }
      try {
        player.loadVideoById(videoId);
        if (playing || userRequestedPlay) {
          player.playVideo();
          onPlayStarted?.();
        }
      } catch {
        pendingId.current = videoId;
      }
    }
  }, [videoId, playing, userRequestedPlay, onPlayStarted]);

  // Sync play/pause state
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !videoId || currentId.current !== videoId || !readyRef.current) return;
    try {
      if (playing) { player.playVideo(); }
      else { player.pauseVideo(); }
    } catch { /* ignore */ }
  }, [playing, videoId]);

  // Poll for progress and volume updates
  useEffect(() => {
    const timer = window.setInterval(() => {
      const player = playerRef.current;
      if (!player || typeof player.getDuration !== "function") return;
      try {
        player.setVolume(volume);
        if (!playing) player.pauseVideo();
        onProgress({
          current: player.getCurrentTime() ?? 0,
          duration: player.getDuration() ?? 0,
        });
      } catch { /* ignore */ }
    }, 500);
    return () => window.clearInterval(timer);
  }, [playing, volume, onProgress]);

  return (
    <div className="pointer-events-none fixed -left-[9999px] top-0 h-px w-px overflow-hidden">
      <div ref={hostRef} />
    </div>
  );
}
