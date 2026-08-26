import { useEffect, useRef, useState } from "react";

const FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export type EqPreset = "Neutro" | "Grave" | "Vocal" | "Agudo" | "Eletrônica" | "Rock" | "Podcast";

export const EQ_PRESETS: Record<EqPreset, number[]> = {
  Neutro: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  Grave: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  Vocal: [-2, -1, 1, 3, 4, 4, 3, 1, -1, -2],
  Agudo: [-3, -2, -1, 0, 1, 2, 4, 6, 8, 8],
  Eletrônica: [5, 4, 1, 0, -1, 2, 1, 0, 4, 5],
  Rock: [4, 3, 2, 1, -1, -1, 0, 1, 3, 4],
  Podcast: [-4, -2, 0, 3, 4, 4, 4, 2, 0, -2],
};

export function useEqualizer(audioElement: HTMLAudioElement | null) {
  const [eqEnabled, setEqEnabled] = useState(false);
  const [currentPreset, setCurrentPreset] = useState<EqPreset>("Neutro");
  const [gains, setGains] = useState<number[]>([...EQ_PRESETS.Neutro]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const isConnectedRef = useRef(false);

  useEffect(() => {
    if (!audioElement) return;

    const setupEqualizer = () => {
      if (isConnectedRef.current) return;

      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return;

        const ctx = new AudioContextClass();
        audioCtxRef.current = ctx;

        // Cria a fonte a partir do elemento de audio local
        const source = ctx.createMediaElementSource(audioElement);
        let lastNode: AudioNode = source;

        // Encadeia os 10 filtros de frequência
        filtersRef.current = FREQUENCIES.map((freq, i) => {
          const filter = ctx.createBiquadFilter();
          filter.type = "peaking";
          filter.frequency.value = freq;
          filter.Q.value = 1.0;
          filter.gain.value = gains[i] ?? 0;

          lastNode.connect(filter);
          lastNode = filter;
          return filter;
        });

        // Conecta o último filtro na saída de áudio
        lastNode.connect(ctx.destination);
        isConnectedRef.current = true;
      } catch (err) {
        console.warn("Equalizador Web Audio não pode ser inicializado (origem já conectada):", err);
      }
    };

    // Inicia quando o áudio começar a tocar pelo elemento HTML5 local
    const onPlay = () => {
      setupEqualizer();
      if (audioCtxRef.current?.state === "suspended") {
        audioCtxRef.current.resume();
      }
    };

    audioElement.addEventListener("play", onPlay);
    return () => {
      audioElement.removeEventListener("play", onPlay);
    };
  }, [audioElement, gains, eqEnabled]);

  const updateGain = (index: number, val: number) => {
    const newGains = [...gains];
    newGains[index] = val;
    setGains(newGains);

    if (eqEnabled && filtersRef.current[index]) {
      filtersRef.current[index].gain.value = val;
    }
  };

  const toggleEq = (enabled: boolean) => {
    setEqEnabled(enabled);
    if (audioCtxRef.current?.state === "suspended") {
      audioCtxRef.current.resume();
    }

    filtersRef.current.forEach((filter, i) => {
      filter.gain.value = enabled ? (gains[i] ?? 0) : 0;
    });
  };

  const applyPreset = (preset: EqPreset) => {
    setCurrentPreset(preset);
    const presetGains = EQ_PRESETS[preset];
    setGains([...presetGains]);

    if (eqEnabled) {
      filtersRef.current.forEach((filter, i) => {
        filter.gain.value = presetGains[i] ?? 0;
      });
    }
  };

  return {
    eqEnabled,
    toggleEq,
    currentPreset,
    applyPreset,
    gains,
    updateGain,
  };
}
