import { useEffect, useRef, useState, useCallback } from 'react';

interface NativeAudioPlayerProps {
  src: string | null;
  playing: boolean;
  volume: number;
  onProgress: (current: number, duration: number) => void;
  onEnded: () => void;
  onPlayStarted?: () => void;
  onError?: (error: Error) => void;
}

export function NativeAudioPlayer({
  src,
  playing,
  volume,
  onProgress,
  onEnded,
  onPlayStarted,
  onError
}: NativeAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const [duration, setDuration] = useState(0);
  const playPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!src) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.load();
      }
      return;
    }

    if (!audioRef.current) {
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.preload = 'metadata';
      audioRef.current = audio;

      audio.addEventListener('loadedmetadata', () => {
        setDuration(audio.duration || 0);
      });

      audio.addEventListener('ended', () => {
        onEnded();
      });

      audio.addEventListener('error', (e) => {
        const error = new Error(`Audio error: ${audio.error?.code || 'unknown'}`);
        onError?.(error);
      });

      audio.addEventListener('waiting', () => {
        // buffering
      });

      audio.addEventListener('canplay', () => {
        if (playing) {
          playPromiseRef.current = audio.play().catch(() => {});
        }
      });
    }

    const audio = audioRef.current;

    if (audio.src !== src) {
      audio.src = src;
      audio.load();
    }

    audio.volume = volume / 100;

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      playPromiseRef.current = audio.play().then(() => {
        onPlayStarted?.();
      }).catch((err) => {
        if (err.name !== 'AbortError') {
          console.warn('Play failed:', err);
        }
      });
    } else {
      audio.pause();
    }
  }, [playing, onPlayStarted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = volume / 100;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      progressIntervalRef.current = window.setInterval(() => {
        onProgress({ current: audio.currentTime, duration: audio.duration || 0 });
      }, 500);
    } else {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [playing, onProgress]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (audio && !isNaN(seconds)) {
      audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || seconds));
    }
  }, []);

  const getCurrentTime = useCallback(() => {
    return audioRef.current?.currentTime || 0;
  }, []);

  const getDuration = useCallback(() => {
    return audioRef.current?.duration || duration;
  }, [duration]);

  return null;
}