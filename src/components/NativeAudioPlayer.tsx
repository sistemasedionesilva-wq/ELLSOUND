import { useEffect, useRef, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { NativeAudio } from '@capacitor-community/native-audio';

interface NativeAudioPlayerProps {
  src: string | null;
  playing: boolean;
  volume: number;
  onProgress: (progress: { current: number; duration: number }) => void;
  onEnded: () => void;
  onPlayStarted?: () => void;
  onError?: (error: Error) => void;
}

const ASSET_ID = 'ellmusic_stream';

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
  const isNative = Capacitor.isNativePlatform();
  const nativeInitializedRef = useRef(false);

  useEffect(() => {
    if (!src) {
      if (isNative) {
        stopNativeAudio();
      } else if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.load();
      }
      return;
    }

    if (isNative) {
      initializeNativeAudio(src);
    } else {
      initializeWebAudio(src);
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [src]);

  const initializeNativeAudio = async (src: string) => {
    try {
      if (!nativeInitializedRef.current) {
        await (NativeAudio.configure as any)({
          focus: true,
          background: true,
          backgroundPlayback: true,
          showNotification: true,
        });
        nativeInitializedRef.current = true;
      }

      await NativeAudio.preload({
        assetId: ASSET_ID,
        assetPath: src,
        audioChannelNum: 1,
        isUrl: true,
      });

      const durationResult = await NativeAudio.getDuration({ assetId: ASSET_ID });
      setDuration(durationResult.duration || 0);

      if (playing) {
        await NativeAudio.play({ assetId: ASSET_ID });
        onPlayStarted?.();
      }
    } catch (err) {
      console.error('Native audio init error:', err);
      onError?.(err as Error);
    }
  };

  const initializeWebAudio = (src: string) => {
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
          playPromiseRef.current = audio.play().catch(() => { });
        }
      });
    }

    const audio = audioRef.current;

    if (audio.src !== src) {
      audio.src = src;
      audio.load();
    }

    audio.volume = volume / 100;
  };

  const stopNativeAudio = async () => {
    try {
      await NativeAudio.stop({ assetId: ASSET_ID });
      await NativeAudio.unload({ assetId: ASSET_ID });
      nativeInitializedRef.current = false;
    } catch (err) {
      console.warn('Native audio stop error:', err);
    }
  };

  useEffect(() => {
    if (isNative) {
      if (playing) {
        NativeAudio.play({ assetId: ASSET_ID }).then(() => {
          onPlayStarted?.();
        }).catch((err) => {
          if ((err as Error).name !== 'AbortError') {
            console.warn('Native play failed:', err);
          }
        });
      } else {
        NativeAudio.pause({ assetId: ASSET_ID });
      }
    } else {
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
    }
  }, [playing, onPlayStarted, isNative]);

  useEffect(() => {
    if (isNative) {
      NativeAudio.setVolume({ assetId: ASSET_ID, volume: volume / 100 });
    } else {
      const audio = audioRef.current;
      if (!audio) return;
      audio.volume = volume / 100;
    }
  }, [volume, isNative]);

  useEffect(() => {
    if (playing) {
      progressIntervalRef.current = window.setInterval(async () => {
        if (isNative) {
          try {
            const [currentResult, durationResult] = await Promise.all([
              NativeAudio.getCurrentTime({ assetId: ASSET_ID }),
              NativeAudio.getDuration({ assetId: ASSET_ID }),
            ]);
            onProgress({
              current: currentResult.currentTime || 0,
              duration: durationResult.duration || 0
            });
          } catch (err) {
            console.warn('Native progress error:', err);
          }
        } else {
          const audio = audioRef.current;
          if (audio) {
            onProgress({ current: audio.currentTime, duration: audio.duration || 0 });
          }
        }
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
  }, [playing, onProgress, isNative]);

  const seek = useCallback((seconds: number) => {
    if (isNative) {
      (NativeAudio as any).seek({ assetId: ASSET_ID, time: seconds });
    } else {
      const audio = audioRef.current;
      if (audio && !isNaN(seconds)) {
        audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || seconds));
      }
    }
  }, [isNative]);

  const getCurrentTime = useCallback(async () => {
    if (isNative) {
      try {
        const result = await NativeAudio.getCurrentTime({ assetId: ASSET_ID });
        return result.currentTime || 0;
      } catch {
        return 0;
      }
    }
    return audioRef.current?.currentTime || 0;
  }, [isNative]);

  const getDuration = useCallback(async () => {
    if (isNative) {
      try {
        const result = await NativeAudio.getDuration({ assetId: ASSET_ID });
        return result.duration || 0;
      } catch {
        return duration;
      }
    }
    return audioRef.current?.duration || duration;
  }, [isNative, duration]);

  return null;
}