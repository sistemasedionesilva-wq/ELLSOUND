import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Home,
  Search,
  Library,
  Heart,
  ListMusic,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Loader2,
  Music2,
  Plus,
  Repeat,
  Shuffle,
  Trash2,
  X,
  LogIn,
  LogOut,
  User as UserIcon,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Music,
  Sparkles,
  Zap,
  Headphones,
  Mic,
  History,
  Coffee,
  TrendingUp,
  FolderOpen,
  Smartphone,
  ShieldCheck,
  Lock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { YouTubeAudio } from "@/components/YouTubeAudio";
import { NativeAudioPlayer } from "@/components/NativeAudioPlayer";
import {
  findYouTubeAudio,
  getHomeShelves,
  searchTracks,
  getTopTrending,
  type Track,
} from "@/lib/music.functions";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { toast, Toaster } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useEqualizer, type EqPreset } from "@/hooks/useEqualizer";
import {
  saveLocalFile,
  getLocalFile,
  deleteLocalFile,
  LOCAL_ARTWORK,
  LOCAL_TRACK_PREFIX,
} from "@/lib/localTrackStore";
import { fetchProfile, touchLogin, isSubscriptionDenied, type Profile } from "@/lib/profile";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ELL MUSIC — Player de Música" },
      {
        name: "description",
        content: "Player de música premium com áudio do YouTube e músicas do seu aparelho.",
      },
    ],
  }),
  component: Index,
});

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Card de música ajustado
function TrackCard({
  track,
  onPlay,
  isLiked,
  onLikeToggle,
  onAddToPlaylist,
}: {
  track: Track;
  onPlay: (t: Track) => void;
  isLiked: boolean;
  onLikeToggle: (e: React.MouseEvent) => void;
  onAddToPlaylist: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="group w-[150px] sm:w-[172px] shrink-0 rounded-2xl bg-card-gradient p-3 text-left transition-all duration-300 hover:bg-gradient-to-br from-primary/10 to-primary/5 flex flex-col relative border border-border/50 hover:border-primary/30">
      <div className="relative mb-3 overflow-hidden rounded-xl aspect-square bg-muted/50">
        {track.artwork ? (
          <img
            src={track.artwork}
            alt={track.title}
            loading="lazy"
            className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
            <Music className="size-8 text-primary/60" />
          </div>
        )}

        {/* Play Overlay */}
        <button
          onClick={() => onPlay(track)}
          className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow transform scale-90 group-hover:scale-100 transition-transform duration-300">
            <Play className="size-5 fill-current translate-x-[1px]" />
          </span>
        </button>

        {/* Hover Actions */}
        <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
          <button
            onClick={onLikeToggle}
            className={`flex size-8 items-center justify-center rounded-full backdrop-blur-md transition-all active:scale-95 ${
              isLiked
                ? "bg-destructive/20 text-destructive hover:bg-destructive/30"
                : "bg-black/60 text-white hover:bg-black/80"
            }`}
          >
            <Heart className={`size-4 ${isLiked ? "fill-current" : ""}`} />
          </button>

          <button
            onClick={onAddToPlaylist}
            className="flex size-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-all hover:bg-black/80 active:scale-95"
          >
            <Plus className="size-4" />
          </button>
        </div>

      </div>
      <p className="truncate text-sm font-semibold text-foreground">{track.title}</p>
      <p className="truncate text-xs text-muted-foreground mt-1">{track.artist}      </p>
    </div>
  );
}

function Index() {
  const homeFn = useServerFn(getHomeShelves);
  const searchFn = useServerFn(searchTracks);
  const audioFn = useServerFn(findYouTubeAudio);
  const trendingFn = useServerFn(getTopTrending);

  // States
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [volume, setVolume] = useState(80);
  const [progress, setProgress] = useState({ current: 0, duration: 0 });
  const [seekValue, setSeekValue] = useState<number | null>(null);
  const [userRequestedPlay, setUserRequestedPlay] = useState(false);

  const unlockRef = useRef<(() => void) | null>(null);
  const seekRef = useRef<((seconds: number) => void) | null>(null);

  // Navegação: tabs Início, Buscar, Favoritos, Biblioteca
  const [currentTab, setCurrentTab] = useState<
    "home" | "search" | "favorites" | "library" | "musicas"
  >("home");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [currentGenre, setCurrentGenre] = useState<string>("Todos");

  // Recently Played - loaded from localStorage
  const [recentlyPlayed, setRecentlyPlayed] = useState<Track[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("ellsound_recently_played");
    if (stored) {
      try {
        setRecentlyPlayed(JSON.parse(stored));
      } catch {
        setRecentlyPlayed([]);
      }
    }
  }, []);

  const addToRecentlyPlayed = useCallback((track: Track) => {
    setRecentlyPlayed((prev) => {
      const filtered = prev.filter((t) => t.id !== track.id);
      const updated = [track, ...filtered].slice(0, 10);
      localStorage.setItem("ellsound_recently_played", JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Player Fullscreen (Mobile)
  const [fullscreenPlayer, setFullscreenPlayer] = useState(false);
  const [showEqModal, setShowEqModal] = useState(false);
  const [showQueueModal, setShowQueueModal] = useState(false);

  // Instalação PWA (Android/Desktop: prompt nativo; iOS: instruções)
  type InstallPromptEvent = Event & { prompt: () => Promise<void> };
  const [installEvt, setInstallEvt] = useState<InstallPromptEvent | null>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (installEvt) {
      try {
        await installEvt.prompt();
      } finally {
        setInstallEvt(null);
      }
      return;
    }
    const isIos =
      /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (isIos) {
      toast.info("No iPhone/iPad: toque em Compartilhar e depois em \"Adicionar à Tela de Início\"");
    } else {
      toast.info("Para instalar, abra o menu do navegador e escolha \"Instalar aplicativo\"");
    }
  };

  // Reprodutor de músicas locais (aparelho)
  type LocalTrack = {
    id: string;
    title: string;
    artist: string;
    fileName: string;
    url: string;
    size: number;
  };
  const [localTracks, setLocalTracks] = useState<LocalTrack[]>([]);
  const [localSrc, setLocalSrc] = useState<string | null>(null);
  const [playerSource, setPlayerSource] = useState<"youtube" | "local" | "native">("youtube");
  const [nativeAudioSrc, setNativeAudioSrc] = useState<string | null>(null);
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  // Fila de reprodução local (pode vir da aba Músicas ou dos Favoritos/Playlists)
  const [localQueue, setLocalQueue] = useState<LocalTrack[]>([]);
  const [localPos, setLocalPos] = useState(-1);
  const localCurrent = localPos >= 0 ? (localQueue[localPos] ?? null) : null;
  // Arquivos da sessão atual (evita reler do IndexedDB)
  const localFilesRef = useRef<Map<string, File>>(new Map());
  const lastLocalUrlRef = useRef<string | null>(null);

  // Modos de reprodução: repetir faixa atual e ordem aleatória
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);

  // Equalizer Hook
  const { eqEnabled, toggleEq, currentPreset, applyPreset, gains, updateGain } = useEqualizer(null);

  // Modais adicionais
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
  const [playlistName, setPlaylistName] = useState("");
  const [playlistDescription, setPlaylistDescription] = useState("");
  const [trackToAddToPlaylist, setTrackToAddToPlaylist] = useState<Track | null>(null);

  // User state
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Monitorar Autenticação
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Carrega perfil (plano/assinatura) e registra o acesso
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !user) return;
    let touched = false;
    void fetchProfile(supabase, user.id).then((p) => {
      setProfile(p);
      if (p && !touched) {
        touched = true;
        void touchLogin(supabase, user.id);
      }
    });
  }, [user?.id]);

  // Sync Search
  useEffect(() => {
    const trimmed = term.trim();
    const id = setTimeout(() => {
      setSubmitted(trimmed);
      if (trimmed.length > 0) {
        setCurrentTab("search");
      }
    }, 400);
    return () => clearTimeout(id);
  }, [term]);

  // Queries
  const home = useQuery({ queryKey: ["home"], queryFn: () => homeFn({}) });
  const results = useQuery({
    queryKey: ["search", submitted],
    queryFn: () => searchFn({ data: { query: submitted } }),
    enabled: submitted.trim().length > 0,
  });

  // Em alta agora - iTunes RSS
  const trending = useQuery({
    queryKey: ["trending"],
    queryFn: () => trendingFn({ data: { limit: 20 } }),
  });

  // Músicas Curtidas (Favoritos)
  const likedSongsQuery = useQuery({
    queryKey: ["likedSongs", user?.id],
    queryFn: async () => {
      if (!isSupabaseConfigured) {
        const local = localStorage.getItem("ellsound_likes");
        return local ? (JSON.parse(local) as Track[]) : [];
      }
      if (!user) return [];
      const { data, error } = await supabase
        .from("liked_songs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((item) => ({
        id: item.track_id,
        title: item.title,
        artist: item.artist,
        album: item.album || "",
        artwork: item.artwork || "",
        previewUrl: item.preview_url || null,
        durationMs: item.duration_ms || 0,
      })) as Track[];
    },
  });

  // Playlists
  const playlistsQuery = useQuery({
    queryKey: ["playlists", user?.id],
    queryFn: async () => {
      if (!isSupabaseConfigured) {
        const local = localStorage.getItem("ellsound_playlists");
        return local ? JSON.parse(local) : [];
      }
      if (!user) return [];
      const { data, error } = await supabase
        .from("playlists")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const playlistTracksQuery = useQuery({
    queryKey: ["playlistTracks", selectedPlaylistId],
    queryFn: async () => {
      if (!selectedPlaylistId) return [];
      if (!isSupabaseConfigured) {
        const local = localStorage.getItem(`ellsound_playlist_tracks_${selectedPlaylistId}`);
        return local ? (JSON.parse(local) as Track[]) : [];
      }
      const { data, error } = await supabase
        .from("playlist_tracks")
        .select("*")
        .eq("playlist_id", selectedPlaylistId)
        .order("added_at", { ascending: true });
      if (error) throw error;
      return (data || []).map((item) => ({
        id: item.track_id,
        title: item.title,
        artist: item.artist,
        album: item.album || "",
        artwork: item.artwork || "",
        previewUrl: item.preview_url || null,
        durationMs: item.duration_ms || 0,
      })) as Track[];
    },
    enabled: !!selectedPlaylistId,
  });

  // Ref para skip — quebra referência circular com setupMediaSession
  const skipRef = useRef<(delta: number) => void>(() => {});

  // Media Session para rodar em segundo plano
  const setupMediaSession = useCallback((track: Track) => {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album || "ELL MUSIC",
        artwork: [{ src: track.artwork || "", sizes: "512x512", type: "image/jpeg" }],
      });
      navigator.mediaSession.setActionHandler("play", () => setPlaying(true));
      navigator.mediaSession.setActionHandler("pause", () => setPlaying(false));
      navigator.mediaSession.setActionHandler("previoustrack", () => skipRef.current(-1));
      navigator.mediaSession.setActionHandler("nexttrack", () => skipRef.current(1));
    }
  }, []);

  // Mutations
  const toggleLikeMutation = useMutation({
    mutationFn: async (track: Track) => {
      const isLiked = (likedSongsQuery.data || []).some((t) => t.id === track.id);
      if (!isSupabaseConfigured) {
        const local = localStorage.getItem("ellsound_likes");
        let list: Track[] = local ? JSON.parse(local) : [];
        if (isLiked) {
          list = list.filter((t) => t.id !== track.id);
          toast.success("Removida dos Favoritos");
        } else {
          list.push(track);
          toast.success("Adicionada aos Favoritos");
        }
        localStorage.setItem("ellsound_likes", JSON.stringify(list));
        return;
      }
      if (!user) {
        setShowAuthModal(true);
        throw new Error("Faça login para salvar favoritos");
      }
      if (isLiked) {
        await supabase.from("liked_songs").delete().eq("user_id", user.id).eq("track_id", track.id);
        toast.success("Removida dos Favoritos");
      } else {
        await supabase.from("liked_songs").insert({
          user_id: user.id,
          track_id: track.id,
          title: track.title,
          artist: track.artist,
          album: track.album,
          artwork: track.artwork,
          preview_url: track.previewUrl,
          duration_ms: track.durationMs,
        });
        toast.success("Adicionada aos Favoritos");
      }
    },
    onSuccess: () => likedSongsQuery.refetch(),
  });

  const createPlaylistMutation = useMutation({
    mutationFn: async ({ name, desc }: { name: string; desc: string }) => {
      if (!name.trim()) throw new Error("Nome obrigatório");
      if (!isSupabaseConfigured) {
        const local = localStorage.getItem("ellsound_playlists");
        const list = local ? JSON.parse(local) : [];
        const newP = {
          id: `local-${Math.random().toString(36).slice(2)}`,
          name,
          description: desc,
        };
        list.push(newP);
        localStorage.setItem("ellsound_playlists", JSON.stringify(list));
        return newP;
      }
      const { data, error } = await supabase
        .from("playlists")
        .insert({ user_id: user.id, name, description: desc })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      playlistsQuery.refetch();
      setShowCreatePlaylistModal(false);
      setPlaylistName("");
      setPlaylistDescription("");
      toast.success("Playlist criada!");
    },
  });

  const addTrackToPlaylistMutation = useMutation({
    mutationFn: async ({ playlistId, track }: { playlistId: string; track: Track }) => {
      if (!isSupabaseConfigured) {
        const local = localStorage.getItem(`ellsound_playlist_tracks_${playlistId}`);
        const list: Track[] = local ? JSON.parse(local) : [];
        if (list.some((t) => t.id === track.id)) throw new Error("Música já existente");
        list.push(track);
        localStorage.setItem(`ellsound_playlist_tracks_${playlistId}`, JSON.stringify(list));
        return;
      }
      const { error } = await supabase.from("playlist_tracks").insert({
        playlist_id: playlistId,
        track_id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        artwork: track.artwork,
        preview_url: track.previewUrl,
        duration_ms: track.durationMs,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      playlistTracksQuery.refetch();
      setTrackToAddToPlaylist(null);
      toast.success("Adicionada à playlist");
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao adicionar"),
  });

  // Playback Control
  const current = queue[index] ?? null;

  // Faixa ativa no player (YouTube, nativo ou arquivo local do aparelho)
  const activeLocal = playerSource === "local";
  const activeNative = playerSource === "native";
  const activeTrack: { id: string; title: string; artist: string; artwork?: string } | null =
    activeLocal ? localCurrent : current;
  const activeSkip = (delta: number) => (activeLocal ? localSkip(delta) : skip(delta));

  const play = useCallback(
    async (track: Track, list?: Track[]) => {
      // Faixa salva do aparelho: toca pelo arquivo em vez do YouTube
      if (track.id.startsWith(LOCAL_TRACK_PREFIX)) {
        setUserRequestedPlay(true);
        const found = await playLocalById(track.id);
        if (!found) {
          toast.error(
            "Arquivo não encontrado no aparelho. Adicione a pasta novamente na aba Músicas.",
          );
        }
        return;
      }
      // Mark that user explicitly requested playback (for YouTube gesture unlock)
      setUserRequestedPlay(true);
      setPlayerSource("native");
      addToRecentlyPlayed(track);
      const nextQueue = list ?? [track];
      setQueue(nextQueue);
      setIndex(
        Math.max(
          0,
          nextQueue.findIndex((t) => t.id === track.id),
        ),
      );

      setVideoId(null);
      setPlaying(false);
      setProgress({ current: 0, duration: 0 });

      // Try native backend stream first
      const backendUrl = import.meta.env.VITE_STREAM_BACKEND_URL || 'https://ellmusic-stream.onrender.com';
      const streamUrl = `${backendUrl}/api/stream/${track.id}`;
      setNativeAudioSrc(streamUrl);
      setPlaying(true);
      setupMediaSession(track);

      // Fallback to YouTube iframe if native fails
      audioFn({ data: { title: track.title, artist: track.artist } }).then((res) => {
        if (res.videoId) {
          setVideoId(res.videoId);
        }
      });
    },
    [audioFn, setupMediaSession, addToRecentlyPlayed],
  );

  const skip = useCallback(
    (delta: number) => {
      if (queue.length === 0) return;
      let next: number;
      if (shuffleEnabled && queue.length > 1) {
        do {
          next = Math.floor(Math.random() * queue.length);
        } while (next === index);
      } else {
        next = (index + delta + queue.length) % queue.length;
      }
      const track = queue[next];
      if (track) play(track, queue);
    },
    [index, queue, play, shuffleEnabled],
  );

  // Manter ref atualizado
  useEffect(() => {
    skipRef.current = skip;
  }, [skip]);

  const handleAudioEnded = () => {
    if (repeatEnabled) {
      if (seekRef.current) {
        seekRef.current(0);
      }
      return;
    }
    skip(1);
  };

  // Wake Lock - impede tela desligar durante reprodução
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function requestWakeLock() {
      if (!playing || cancelled) {
        if (wakeLockRef.current) {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
        }
        return;
      }
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
          wakeLockRef.current.addEventListener("release", () => {
            wakeLockRef.current = null;
          });
        }
      } catch (err) {
        console.warn("Wake Lock falhou:", err);
      }
    }
    requestWakeLock();
    return () => {
      cancelled = true;
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
  }, [playing]);

  // Media Session position state (seek bar na lock screen)
  useEffect(() => {
    if (!("mediaSession" in navigator) || !playing) return;
    const updatePosition = () => {
      navigator.mediaSession.setPositionState({
        duration: progress.duration || 0,
        playbackRate: 1,
        position: progress.current || 0,
      });
    };
    const timer = setInterval(updatePosition, 1000);
    updatePosition();
    return () => clearInterval(timer);
  }, [playing, progress]);

  // Visibility change - tenta retomar playback ao voltar do background
  useEffect(() => {
    if (!playing) return;
    function onVisibilityChange() {
      if (document.visibilityState === "visible" && videoId && seekRef.current) {
        // Pequeno delay para o player reconectar
        setTimeout(() => {
          if (seekRef.current) {
            seekRef.current(progress.current || 0);
          }
        }, 100);
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [playing, videoId, progress.current]);

  // ===== Músicas locais (aparelho) =====
  const scanLocalFiles = (files: FileList | File[]) => {
    const audios = Array.from(files).filter(
      (f) =>
        f.type.startsWith("audio/") ||
        /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|weba|webm)$/i.test(f.name),
    );
    if (audios.length === 0) {
      toast.error("Nenhum arquivo de áudio encontrado");
      return;
    }
    const mapped: LocalTrack[] = audios.map((f) => {
      const base = f.name.replace(/\.[^.]+$/, "").replace(/_/g, " ").trim();
      const parts = base.split(/\s+-\s+/);
      const firstPart = parts[0] ?? "";
      const id = `${LOCAL_TRACK_PREFIX}${f.name}:${f.size}`;
      localFilesRef.current.set(id, f);
      return {
        id,
        title: parts.length > 1 ? parts.slice(1).join(" - ") : base,
        artist: parts.length > 1 ? firstPart : "Do meu aparelho",
        fileName: f.name,
        url: URL.createObjectURL(f),
        size: f.size,
      };
    });
    setLocalTracks((prev) => [
      ...prev,
      ...mapped.filter((m) => !prev.some((p) => p.id === m.id)),
    ]);
    toast.success(`${mapped.length} música(s) encontrada(s) no aparelho`);
  };

  const startLocalPlayback = (track: LocalTrack, list: LocalTrack[]) => {
    const pos = Math.max(
      0,
      list.findIndex((t) => t.id === track.id),
    );
    // Para o player do YouTube
    setVideoId(null);
    setQueue([]);
    setUserRequestedPlay(false);
    setProgress({ current: 0, duration: 0 });
    // Inicia a faixa local
    if (lastLocalUrlRef.current && lastLocalUrlRef.current !== track.url) {
      URL.revokeObjectURL(lastLocalUrlRef.current);
    }
    lastLocalUrlRef.current = track.url;
    setPlayerSource("local");
    setLocalQueue(list);
    setLocalPos(pos);
    setLocalSrc(track.url);
    setPlaying(true);
  };

  const playLocal = (track: LocalTrack, list?: LocalTrack[]) => {
    startLocalPlayback(track, list && list.length > 0 ? list : localTracks);
  };

  // Toca uma faixa local vinda dos Favoritos/Playlist, resolvendo o arquivo salvo
  const playLocalById = async (id: string): Promise<LocalTrack | null> => {
    let file = localFilesRef.current.get(id) ?? null;
    if (!file) {
      const stored = await getLocalFile(id);
      if (!stored) return null;
      file = stored.file;
      localFilesRef.current.set(id, file);
    }
    const base = file.name.replace(/\.[^.]+$/, "").replace(/_/g, " ").trim();
    const parts = base.split(/\s+-\s+/);
    const firstPart = parts[0] ?? "";
    const track: LocalTrack = {
      id,
      title: parts.length > 1 ? parts.slice(1).join(" - ") : base,
      artist: parts.length > 1 ? firstPart : "Do meu aparelho",
      fileName: file.name,
      url: URL.createObjectURL(file),
      size: file.size,
    };
    startLocalPlayback(track, [track]);
    return track;
  };

  const localSkip = (delta: number) => {
    if (localQueue.length === 0) return;
    let next: number;
    if (shuffleEnabled && localQueue.length > 1) {
      do {
        next = Math.floor(Math.random() * localQueue.length);
      } while (next === localPos);
    } else {
      next = (localPos + delta + localQueue.length) % localQueue.length;
    }
    const t = localQueue[next];
    if (t) startLocalPlayback(t, localQueue);
  };

  const removeLocalTrack = (id: string) => {
    const removed = localTracks.find((t) => t.id === id);
    if (!removed) return;
    void deleteLocalFile(id);
    URL.revokeObjectURL(removed.url);
    const wasCurrent = playerSource === "local" && localCurrent?.id === id;
    setLocalTracks(localTracks.filter((t) => t.id !== id));
    if (wasCurrent) {
      setPlaying(false);
      setLocalSrc(null);
      setLocalQueue([]);
      setLocalPos(-1);
      setProgress({ current: 0, duration: 0 });
      setFullscreenPlayer(false);
    }
    toast.info(`"${removed.title}" removida da lista`);
  };

  const clearLocalTracks = () => {
    if (localTracks.length === 0) return;
    if (playerSource === "local") setPlaying(false);
    localTracks.forEach((t) => {
      URL.revokeObjectURL(t.url);
      void deleteLocalFile(t.id);
    });
    setLocalTracks([]);
    setLocalSrc(null);
    setLocalQueue([]);
    setLocalPos(-1);
    setProgress({ current: 0, duration: 0 });
    setFullscreenPlayer(false);
    toast.info("Lista de músicas do aparelho limpa");
  };

  const handleLocalEnded = () => {
    if (repeatEnabled && localAudioRef.current) {
      localAudioRef.current.currentTime = 0;
      void localAudioRef.current.play();
      return;
    }
    localSkip(1);
  };

  // Converte faixa local para o formato Track (compatível com favoritos/playlists)
  const localToTrack = (t: { id: string; title: string; artist: string }): Track => ({
    id: t.id,
    title: t.title,
    artist: t.artist,
    album: "Do meu aparelho",
    artwork: LOCAL_ARTWORK,
    previewUrl: null,
    durationMs: 0,
  });

  // Garante que o arquivo da música local está salvo (IndexedDB) antes de curtir/adicionar
  const ensureLocalSaved = async (t: { id: string; title: string; artist: string }) => {
    if (!t.id.startsWith(LOCAL_TRACK_PREFIX)) return;
    const file = localFilesRef.current.get(t.id);
    if (!file) return;
    try {
      await saveLocalFile(t.id, { file, title: t.title, artist: t.artist });
    } catch {
      /* armazenamento indisponível */
    }
  };

  // Sincroniza play/pause do áudio local com o estado global
  useEffect(() => {
    const el = localAudioRef.current;
    if (!el) return;
    if (playerSource !== "local") {
      el.pause();
      return;
    }
    if (playing) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [playing, playerSource, localSrc]);

  // Volume global também controla o áudio local
  useEffect(() => {
    if (localAudioRef.current) localAudioRef.current.volume = volume / 100;
  }, [volume]);

  // Filtragem de Categorias (Home Gêneros) - usa busca para filtrar por gênero real
  const [genreSearchResults, setGenreSearchResults] = useState<Track[]>([]);
  const [isGenreSearchLoading, setIsGenreSearchLoading] = useState(false);

  useEffect(() => {
    if (currentGenre === "Todos") {
      setGenreSearchResults([]);
      return;
    }

    let cancelled = false;
    setIsGenreSearchLoading(true);

    searchFn({ data: { query: currentGenre } })
      .then((tracks) => {
        if (!cancelled) {
          setGenreSearchResults(tracks);
          setIsGenreSearchLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGenreSearchResults([]);
          setIsGenreSearchLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentGenre, searchFn]);

  const filteredHomeTracks = useMemo(() => {
    if (currentGenre === "Todos") {
      return trending.data ?? [];
    }
    return genreSearchResults;
  }, [trending.data, currentGenre, genreSearchResults]);

  const greeting = useMemo(() => {
    const r = new Date().getHours();
    if (r < 12) return "Bom dia";
    if (r < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

  // Visual helper for empty states
  const EmptyState = ({
    icon: Icon,
    title,
    description,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
  }) => (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Icon className="size-8 text-primary" />
      </div>
      <p className="text-lg font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
    </div>
  );

  // Auth Handler
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      toast.error("Supabase indisponível. Configurando credenciais...");
      return;
    }
    setAuthLoading(true);
    try {
      if (authMode === "login") {
        await supabase.auth.signInWithPassword({ email, password });
        toast.success("Login com sucesso");
      } else {
        await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName } },
        });
        toast.success("Cadastro efetuado");
      }
      setShowAuthModal(false);
    } catch (err: Error) {
      toast.error(err.message || "Erro de login");
    } finally {
      setAuthLoading(false);
    }
  };

  const showMiniPlayer = activeTrack && !fullscreenPlayer;

  // Paywall: assinatura expirada, revogada ou usuário bloqueado
  const accessDenied =
    isSupabaseConfigured && !!user && !!profile && isSubscriptionDenied(profile);

  if (accessDenied) {
    return (
      <div className="min-h-[100dvh] bg-background text-foreground font-sans flex items-center justify-center p-4">
        <Toaster theme="dark" position="bottom-right" richColors />
        <div className="max-w-sm w-full rounded-3xl glass p-6 border border-border/30 text-center space-y-4">
          <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
            <Lock className="size-6 text-primary" />
          </div>
          <h1 className="text-lg font-bold">Assinatura necessária</h1>
          {profile?.place_name ? (
            <p className="text-xs text-muted-foreground">Local: {profile.place_name}</p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {profile?.blocked
              ? "Sua conta está bloqueada. Entre em contato com o administrador."
              : "Sua assinatura expirou. Renove para continuar ouvindo músicas sem interrupções."}
          </p>
          <div className="rounded-xl bg-accent/40 p-3 text-xs text-muted-foreground space-y-1">
            <p>Fale conosco para renovar:</p>
            <p className="text-foreground font-semibold">contato@ellsound.app</p>
          </div>
          <Button
            onClick={() => {
              void supabase.auth.signOut();
              window.location.href = "/";
            }}
            variant="outline"
            className="rounded-full text-xs border-border/30 glass hover:bg-accent/50"
          >
            Sair da conta
          </Button>
        </div>
      </div>
    );
  }

  const selectedPlaylist = (playlistsQuery.data || []).find(
    (p: { id: string }) => p.id === selectedPlaylistId,
  );

  return (
    <div className="flex h-[100dvh] flex-col bg-background text-foreground font-sans overflow-hidden select-none">
      <Toaster theme="dark" position="bottom-right" richColors />

      {/* Native Audio Player (Backend Stream) - Background Audio Support */}
      {playerSource === "native" && nativeAudioSrc && (
        <NativeAudioPlayer
          src={nativeAudioSrc}
          playing={playing}
          volume={volume}
          onProgress={({ current, duration }) => setProgress({ current, duration })}
          onEnded={handleAudioEnded}
          onPlayStarted={() => setUserRequestedPlay(false)}
          onError={(err) => {
            console.error('Native audio error:', err);
            toast.error('Erro no player nativo, tentando YouTube...');
            setPlayerSource("youtube");
            setNativeAudioSrc(null);
          }}
        />
      )}

      {/* YouTube Audio Player (Fallback) - MUST be rendered for playback to work */}
      {playerSource === "youtube" && videoId && (
        <YouTubeAudio
          videoId={videoId}
          playing={playing}
          volume={volume}
          onProgress={({ current, duration }) => setProgress({ current, duration })}
          onEnded={handleAudioEnded}
          unlockRef={unlockRef}
          seekRef={seekRef}
          userRequestedPlay={userRequestedPlay}
          onPlayStarted={() => setUserRequestedPlay(false)}
        />
      )}

      {/* Áudio local (arquivos do aparelho) */}
      <audio
        ref={localAudioRef}
        src={localSrc ?? undefined}
        onTimeUpdate={(e) => {
          if (playerSource !== "local") return;
          const el = e.currentTarget;
          setProgress({ current: el.currentTime, duration: el.duration || 0 });
        }}
        onEnded={handleLocalEnded}
        className="hidden"
      />

      <div
        className={`flex min-h-0 flex-1 gap-2 p-2 ${
          showMiniPlayer ? "pb-36 md:pb-28 lg:pb-24" : ""
        }`}
      >
        {/* Desktop Sidebar (Hide on Mobile) */}
        <aside className="hidden md:flex w-68 shrink-0 flex-col gap-2 mt-14">
          <div className="rounded-2xl glass p-5 border-border/30">
            <div className="flex items-center gap-2">
              <div className="size-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-glow">
                <Headphones className="size-5 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-bold tracking-wider bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
                ELL MUSIC
              </h1>
            </div>
          </div>
          <button
            onClick={handleInstallClick}
            className="flex w-full items-center justify-center gap-2 rounded-2xl glass px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-primary hover:bg-accent/50 transition-all border border-border/30"
          >
            <Smartphone className="size-4" />
            Instalar aplicativo
          </button>
          {profile?.role === "admin" && (
            <Link
              to="/admin"
              className="flex w-full items-center justify-center gap-2 rounded-2xl glass px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-primary hover:bg-accent/50 transition-all border border-border/30"
            >
              <ShieldCheck className="size-4" />
              Painel Admin
            </Link>
          )}
          <nav className="flex-1 rounded-2xl glass p-3 text-sm flex flex-col justify-between border-border/30 pb-24 md:pb-0 overflow-y-auto">
            <div className="space-y-1">
              {[
                { icon: Home, label: "Início", tab: "home" as const },
                { icon: Search, label: "Buscar", tab: "search" as const },
                { icon: Heart, label: "Favoritos", tab: "favorites" as const },
                { icon: FolderOpen, label: "Músicas", tab: "musicas" as const },
                { icon: Library, label: "Biblioteca", tab: "library" as const },
              ].map(({ icon: Icon, label, tab }) => (
                <button
                  key={label}
                  onClick={() => {
                    setCurrentTab(tab);
                    setSelectedPlaylistId(null);
                    setFullscreenPlayer(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition-all duration-200 ${
                    currentTab === tab
                      ? "bg-primary/15 text-primary shadow-[0_0_0_1px]_theme(colors.primary/30)"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`}
                >
                  <Icon className="size-4.5" />
                  {label}
                </button>
              ))}
            </div>
            <div className="pt-4 border-t border-border/30">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">
                SUA BIBLIOTECA
              </div>
              <button
                onClick={() => setShowCreatePlaylistModal(true)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
              >
                <Plus className="size-4" />
                Criar Playlist
              </button>
            </div>
          </nav>
        </aside>

        {/* Top Header - Fixed at very top of viewport, solid background */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-player-gradient px-4 sm:px-6 py-3 border-b border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {currentTab === "home" && (
              <span className="md:hidden text-lg font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
                ELL MUSIC
              </span>
            )}
          </div>

          <div className="flex-1 max-w-md mx-4">
            <form onSubmit={(e) => e.preventDefault()} className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                type="search"
                placeholder="Artistas, faixas e mais..."
                className="rounded-full border-none bg-accent/50 pl-9 text-xs text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary focus:bg-accent transition-all"
              />
            </form>
          </div>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  className="rounded-full glass hover:bg-accent/50 border-border/30 text-foreground flex items-center gap-2"
                >
                  <span className="size-6 bg-primary/20 text-primary rounded-full flex items-center justify-center font-bold text-xs uppercase">
                    {user.email[0]}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="glass border-border/30 text-foreground">
                {profile?.role === "admin" && (
                  <DropdownMenuItem
                    onClick={() => (window.location.href = "/admin")}
                    className="text-xs hover:bg-accent/50"
                  >
                    Painel Admin
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => setCurrentTab("library")}
                  className="text-xs hover:bg-accent/50"
                >
                  Biblioteca
                </DropdownMenuItem>
                <DropdownMenuSeparator className="border-border/30" />
                <DropdownMenuItem
                  onClick={() => supabase.auth.signOut()}
                  className="text-xs text-destructive hover:bg-accent/50"
                >
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              onClick={() => setShowAuthModal(true)}
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs shadow-glow transition-all"
            >
              Entrar
            </Button>
          )}
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-6 space-y-6 pt-20 pb-24 relative z-10">
            {/* TAB: HOME */}
            {currentTab === "home" && (
              <div className="space-y-8 animate-in fade-in duration-500">
                {/* Hero Greeting Section */}
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-transparent rounded-3xl blur-2xl" />
                  <div className="relative p-6 sm:p-8 rounded-3xl glass border border-border/30">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">
                          {greeting}
                        </p>
                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground flex items-center gap-3">
                          <span className="relative">
                            <Sparkles className="size-8 text-primary" />
                            <span className="absolute -bottom-1 -right-1 size-3 bg-primary/30 rounded-full blur" />
                          </span>
                          <span className="bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
                            Em alta agora
                          </span>
                        </h1>
                        <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                          Descubra as músicas mais tocadas do momento
                        </p>
                      </div>
                      <div className="hidden sm:block">
                        <div className="size-24 sm:size-32 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
                          <Music className="size-12 sm:size-16 text-primary/60" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recently Played Section */}
                {recentlyPlayed.length > 0 && (
                  <section className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                          <History className="size-5 text-purple-400" />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-foreground">
                            Ouvidas recentemente
                          </h2>
                          <p className="text-xs text-muted-foreground">Continue de onde parou</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                      {recentlyPlayed.slice(0, 6).map((t, idx) => (
                        <TrackCard
                          key={t.id}
                          track={t}
                          onPlay={() => play(t, recentlyPlayed)}
                          isLiked={(likedSongsQuery.data || []).some((l) => l.id === t.id)}
                          onLikeToggle={(e) => {
                            e.stopPropagation();
                            toggleLikeMutation.mutate(t);
                          }}
                          onAddToPlaylist={(e) => {
                            e.stopPropagation();
                            setTrackToAddToPlaylist(t);
                          }}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Genre/Category Section */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                        <Mic className="size-5 text-emerald-400" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-foreground">Explorar por gênero</h2>
                        <p className="text-xs text-muted-foreground">
                          Encontre seu estilo favorito
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2 scroll-area">
                    {[
                      { id: "Todos", label: "Todos", icon: Music },
                      { id: "Electronic", label: "Eletrônica", icon: Zap },
                      { id: "Hip-Hop / Rap", label: "Hip-Hop/Rap", icon: Mic },
                      { id: "Pop", label: "Pop", icon: Sparkles },
                      { id: "Rock", label: "Rock", icon: Headphones },
                      { id: "Lofi", label: "Lofi/Chill", icon: Coffee },
                    ].map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        onClick={() => setCurrentGenre(id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all duration-300 ${
                          currentGenre === id
                            ? "bg-primary text-primary-foreground shadow-glow border border-primary/30"
                            : "glass text-muted-foreground hover:text-foreground hover:bg-accent/50 hover:border-border/50 border border-border/30"
                        }`}
                      >
                        <Icon className="size-4 flex-shrink-0" />
                        <span className="text-sm font-semibold">{label}</span>
                      </button>
                    ))}
                  </div>
                </section>

                {/* Top Hits Section */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                        <TrendingUp className="size-5 text-orange-400" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-foreground">
                          {currentGenre === "Todos" ? "Top 20 em alta" : `Top ${currentGenre}`}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                          As mais tocadas{" "}
                          {currentGenre !== "Todos"
                            ? `em ${currentGenre.toLowerCase()}`
                            : "no Brasil"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 animate-in fade-in duration-500">
                    {trending.isLoading ? (
                      <div className="col-span-full pt-10 text-center text-muted-foreground text-xs flex items-center justify-center gap-2">
                        <Loader2 className="animate-spin text-primary size-4" />
                        Carregando músicas em alta...
                      </div>
                    ) : filteredHomeTracks.length === 0 ? (
                      <EmptyState
                        icon={Music}
                        title="Nenhuma música encontrada"
                        description="Tente outro gênero ou verifique sua conexão"
                      />
                    ) : (
                      filteredHomeTracks.map((t, idx) => (
                        <TrackCard
                          key={t.id}
                          track={t}
                          onPlay={() => play(t, filteredHomeTracks)}
                          isLiked={(likedSongsQuery.data || []).some((l) => l.id === t.id)}
                          onLikeToggle={(e) => {
                            e.stopPropagation();
                            toggleLikeMutation.mutate(t);
                          }}
                          onAddToPlaylist={(e) => {
                            e.stopPropagation();
                            setTrackToAddToPlaylist(t);
                          }}
                        />
                      ))
                    )}
                  </div>
                </section>
              </div>
            )}

            {/* TAB: BUSCAR */}
            {currentTab === "search" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex items-center gap-2">
                  <Search className="size-5 text-primary" />
                  <h2 className="text-xl font-bold text-foreground">Resultados da busca</h2>
                </div>
                {results.isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-primary size-6" />
                  </div>
                ) : (results.data ?? []).length === 0 ? (
                  <EmptyState
                    icon={Search}
                    title="Nenhum resultado"
                    description="Digite no campo acima para pesquisar artistas, faixas e álbuns"
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {results.data?.map((t) => (
                      <TrackCard
                        key={t.id}
                        track={t}
                        onPlay={() => play(t, results.data)}
                        isLiked={(likedSongsQuery.data || []).some((l) => l.id === t.id)}
                        onLikeToggle={(e) => {
                          e.stopPropagation();
                          toggleLikeMutation.mutate(t);
                        }}
                        onAddToPlaylist={(e) => {
                          e.stopPropagation();
                          setTrackToAddToPlaylist(t);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: FAVORITOS */}
            {currentTab === "favorites" && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="flex items-center gap-2">
                  <div className="size-9 rounded-xl bg-destructive/10 flex items-center justify-center">
                    <Heart className="size-5 text-destructive fill-current" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">Favoritos</h2>
                </div>
                <div className="space-y-1">
                  {(likedSongsQuery.data || []).map((t, idx) => (
                    <div
                      key={t.id}
                      onClick={() => play(t, likedSongsQuery.data)}
                      className="flex items-center justify-between p-3 rounded-xl glass hover:bg-accent/50 cursor-pointer transition-all border border-border/30"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-5 text-right font-medium">
                          {idx + 1}
                        </span>
                        <img
                          src={t.artwork}
                          className="size-10 rounded-lg object-cover shadow-md"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {t.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{t.artist}</p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLikeMutation.mutate(t);
                        }}
                        className="text-destructive hover:scale-110 transition-transform p-1"
                      >
                        <Heart className="size-4.5 fill-current" />
                      </button>
                    </div>
                  ))}
                  {(likedSongsQuery.data || []).length === 0 && (
                    <EmptyState
                      icon={Heart}
                      title="Nenhuma música favorita ainda"
                      description="Toque no coração em qualquer faixa para adicioná-la aos favoritos"
                    />
                  )}
                </div>
              </div>
            )}

            {/* TAB: MÚSICAS LOCAIS (APARELHO) */}
            {currentTab === "musicas" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) scanLocalFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <input
                  ref={(el) => {
                    folderInputRef.current = el;
                    if (el) {
                      el.setAttribute("webkitdirectory", "");
                      el.setAttribute("directory", "");
                    }
                  }}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) scanLocalFiles(e.target.files);
                    e.target.value = "";
                  }}
                />

                <div className="flex items-center gap-2">
                  <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <FolderOpen className="size-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Músicas do aparelho</h2>
                    <p className="text-xs text-muted-foreground">
                      Reproduza os arquivos de áudio salvos no seu dispositivo
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs rounded-full shadow-glow transition-all"
                  >
                    + Escolher arquivos
                  </Button>
                  <Button
                    onClick={() => folderInputRef.current?.click()}
                    variant="outline"
                    className="text-xs rounded-full border-border/30 glass hover:bg-accent/50 transition-all"
                  >
                    Escolher pasta
                  </Button>
                  {localTracks.length > 0 && (
                    <Button
                      onClick={clearLocalTracks}
                      variant="outline"
                      className="text-xs rounded-full border-destructive/30 text-destructive hover:bg-destructive/10 transition-all"
                    >
                      <Trash2 className="size-3.5 mr-1" />
                      Limpar tudo
                    </Button>
                  )}
                </div>

                {/* Lista de arquivos encontrados */}
                <div className="space-y-1">
                  {localTracks.map((t, idx) => {
                    const isCurrent = playerSource === "local" && localCurrent?.id === t.id;
                    return (
                      <div
                        key={t.id}
                        onClick={() => playLocal(t, localTracks)}
                        className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${
                          isCurrent
                            ? "glass bg-primary/10 border-primary/30"
                            : "glass hover:bg-accent/50 border-border/30"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs text-muted-foreground w-5 text-right font-medium">
                            {idx + 1}
                          </span>
                          <div className="size-10 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center flex-shrink-0">
                            <Music className="size-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p
                              className={`text-sm font-semibold truncate ${
                                isCurrent ? "text-primary" : "text-foreground"
                              }`}
                            >
                              {t.title}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {t.artist} · {(t.size / 1048576).toFixed(1)} MB
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isCurrent ? (
                            playing ? (
                              <Pause className="size-4.5 text-primary" />
                            ) : (
                              <Play className="size-4.5 text-primary" />
                            )
                          ) : (
                            <Play className="size-4.5 text-muted-foreground" />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeLocalTrack(t.id);
                            }}
                            title="Remover da lista"
                            className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-full hover:bg-destructive/10"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {localTracks.length === 0 && (
                    <EmptyState
                      icon={FolderOpen}
                      title="Nenhuma música carregada ainda"
                      description='Toque em "Escolher pasta" ou "Escolher arquivos" para encontrar as músicas do seu aparelho'
                    />
                  )}
                </div>

                <p className="text-xs text-muted-foreground/60">
                  Dica: nos arquivos, nomes no formato "Artista - Música" são reconhecidos
                  automaticamente.
                </p>
              </div>
            )}

            {/* TAB: BIBLIOTECA (PLAYLISTS & DOWNLOADS) */}
            {currentTab === "library" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                {selectedPlaylistId ? (
                  <>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedPlaylistId(null)}
                        className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-full hover:bg-accent/50"
                      >
                        <ChevronLeft className="size-5" />
                      </button>
                      <div className="min-w-0">
                        <h2 className="text-xl font-bold text-foreground truncate">
                          {selectedPlaylist?.name ?? "Playlist"}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                          {(playlistTracksQuery.data || []).length}{" "}
                          {(playlistTracksQuery.data || []).length === 1 ? "música" : "músicas"}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {(playlistTracksQuery.data || []).map((t, idx) => (
                        <div
                          key={t.id}
                          onClick={() => play(t, playlistTracksQuery.data)}
                          className="flex items-center justify-between p-3 rounded-xl glass hover:bg-accent/50 cursor-pointer transition-all border border-border/30"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground w-5 text-right font-medium">
                              {idx + 1}
                            </span>
                            <img
                              src={t.artwork}
                              className="size-10 rounded-lg object-cover shadow-md"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">
                                {t.title}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">{t.artist}</p>
                            </div>
                          </div>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!selectedPlaylistId) return;
                              if (!isSupabaseConfigured) {
                                const local = localStorage.getItem(
                                  `ellsound_playlist_tracks_${selectedPlaylistId}`,
                                );
                                const list: Track[] = local ? JSON.parse(local) : [];
                                localStorage.setItem(
                                  `ellsound_playlist_tracks_${selectedPlaylistId}`,
                                  JSON.stringify(list.filter((x) => x.id !== t.id)),
                                );
                              } else {
                                await supabase
                                  .from("playlist_tracks")
                                  .delete()
                                  .eq("playlist_id", selectedPlaylistId)
                                  .eq("track_id", t.id);
                              }
                              playlistTracksQuery.refetch();
                              toast.info(`"${t.title}" removida da playlist`);
                            }}
                            className="text-muted-foreground hover:text-destructive text-xs px-2 py-1 rounded transition-colors"
                          >
                            Remover
                          </button>
                        </div>
                      ))}
                      {(playlistTracksQuery.data || []).length === 0 && (
                        <EmptyState
                          icon={ListMusic}
                          title="Playlist vazia"
                          description="Adicione músicas pelo botão + no player ou nos cards de música"
                        />
                      )}
                    </div>
                  </>
                ) : (
                <>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Library className="size-5 text-primary" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground">Sua Biblioteca</h2>
                  </div>
                  <Button
                    onClick={() => setShowCreatePlaylistModal(true)}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs rounded-full shadow-glow transition-all"
                  >
                    + Criar Playlist
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Playlist Cards */}
                  {(playlistsQuery.data || []).map(
                    (p: { id: string; name: string; description: string | null }) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedPlaylistId(p.id);
                          setCurrentTab("library");
                        }}
                        className="p-4 rounded-2xl glass hover:bg-accent/50 cursor-pointer transition-all border border-border/30 group"
                      >
                        <div className="flex items-start gap-3">
                          <div className="size-12 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center flex-shrink-0">
                            <ListMusic className="size-6 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-sm text-foreground truncate">{p.name}</p>
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {p.description || "Playlist sem descrição"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                  {(playlistsQuery.data || []).length === 0 && (
                    <EmptyState
                      icon={Plus}
                      title="Nenhuma playlist criada"
                      description="Crie sua primeira playlist para organizar suas músicas favoritas"
                    />
                  )}
                </div>
                </>
                )}
              </div>
            )}
          </div>
        </main>

      {/* Bottom Navigation Bar - At bottom on mobile */}
      <div className="fixed bottom-0 left-0 right-0 bg-player-gradient border-t border-border/30 flex justify-around py-1.5 z-40 md:hidden">
        {[
          { icon: Home, label: "Início", tab: "home" as const },
          { icon: Search, label: "Buscar", tab: "search" as const },
          { icon: Heart, label: "Favoritos", tab: "favorites" as const },
          { icon: FolderOpen, label: "Músicas", tab: "musicas" as const },
          { icon: Library, label: "Biblioteca", tab: "library" as const },
        ].map(({ icon: Icon, label, tab }) => (
          <button
            key={label}
            onClick={() => {
              setCurrentTab(tab);
              setSelectedPlaylistId(null);
              setFullscreenPlayer(false);
            }}
            className={`flex flex-col items-center gap-1 text-[10px] items-center justify-center w-20 transition-all duration-200 ${
              currentTab === tab ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-5.5" />
            <span className="font-medium">{label}</span>
          </button>
        ))}
      </div>

      {/* Instalação PWA — aparece quando o navegador permite o prompt nativo */}
      {installEvt && (
        <button
          onClick={handleInstallClick}
          className="fixed right-3 bottom-[130px] md:bottom-28 z-[45] flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2.5 text-xs font-bold shadow-glow active:scale-95 transition-transform"
        >
          <Smartphone className="size-4" />
          Instalar app
        </button>
      )}

      {/* Mini Player - Above bottom nav on mobile (only when playing) */}
      {showMiniPlayer && (
        <div
          className={`fixed left-0 right-0 bg-player-gradient border-t border-border/30 transition-all duration-500 ease-in-out z-50 shadow-player ${
            "bottom-[56px] h-[64px] flex items-center justify-between px-3 md:bottom-0 md:h-24 md:px-6 lg:h-20 lg:px-6"
          }`}
          onClick={() => {
            if (!fullscreenPlayer && activeTrack) setFullscreenPlayer(true);
          }}
>
          <>
                {/* Mobile Layout */}
                <div className="md:hidden flex flex-col gap-0 min-w-0 flex-1">
                  {/* Progress Bar at Top */}
                  <div className="w-full h-1.5 bg-muted rounded-t-lg overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-100 ease-out"
                      style={{
                        width:
                          progress.duration > 0
                            ? `${(progress.current / progress.duration) * 100}%`
                            : "0%",
                      }}
                    />
                  </div>
                  {/* Track Info + Controls */}
                  <div className="flex items-center justify-between gap-2 min-w-0 px-2 py-1.5">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="relative size-10 flex-shrink-0">
                        <div className="relative size-full">
                          {activeTrack.artwork ? (
                            <img
                              src={activeTrack.artwork}
                              className={`size-full rounded-lg object-cover shadow-lg transition-all duration-500 ${
                                playing ? "animate-spin-cd" : "animate-spin-cd-paused"
                              }`}
                              style={{ animationPlayState: playing ? "running" : "paused" }}
                            />
                          ) : (
                            <div className="size-full rounded-lg bg-gradient-to-br from-primary/40 to-primary/10 flex items-center justify-center shadow-lg">
                              <Music className="size-4 text-primary" />
                            </div>
                          )}
                          <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary/20 via-transparent to-primary/10 pointer-events-none" />
                          {playing && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
                              <div className="flex gap-0.5 items-end h-3">
                                {[1, 2, 3].map((idx) => (
                                  <span
                                    key={idx}
                                    className="w-0.5 bg-primary rounded-full animate-pulse"
                                    style={{
                                      height: `${30 + idx * 15}%`,
                                      animationDuration: `${0.3 + idx * 0.1}s`,
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-foreground">
                          {activeTrack.title}
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {activeTrack.artist}
                        </p>
                      </div>
                    </div>
                    {/* Controls on Right */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => activeSkip(-1)}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-full hover:bg-accent/50"
                      >
                        <SkipBack className="size-4 fill-current" />
                      </button>
                      <button
                        onClick={() => setPlaying(!playing)}
                        className="size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-player hover:scale-105 active:scale-95 transition-transform"
                      >
                        {playing ? (
                          <Pause className="size-4 fill-current" />
                        ) : (
                          <Play className="size-4 fill-current translate-x-[1px]" />
                        )}
                      </button>
                      <button
                        onClick={() => activeSkip(1)}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-full hover:bg-accent/50"
                      >
                        <SkipForward className="size-4 fill-current" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Desktop Layout - Spotify style */}
                <div className="hidden md:flex md:flex-1 md:items-center md:justify-between md:gap-6">
                  {/* Track Info */}
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="relative size-14 flex-shrink-0">
                      <div className="relative size-full">
                        {activeTrack.artwork ? (
                          <img
                            src={activeTrack.artwork}
                            className={`size-full rounded-lg object-cover shadow-xl transition-all duration-500 ${
                              playing ? "animate-spin-cd" : "animate-spin-cd-paused"
                            }`}
                            style={{ animationPlayState: playing ? "running" : "paused" }}
                          />
                        ) : (
                          <div className="size-full rounded-lg bg-gradient-to-br from-primary/40 to-primary/10 flex items-center justify-center shadow-xl">
                            <Music className="size-6 text-primary" />
                          </div>
                        )}
                        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary/20 via-transparent to-primary/10 pointer-events-none" />
                        {playing && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
                            <div className="flex gap-0.5 items-end h-5">
                              {[1, 2, 3].map((idx) => (
                                <span
                                  key={idx}
                                  className="w-0.5 bg-primary rounded-full animate-pulse"
                                  style={{
                                    height: `${30 + idx * 15}%`,
                                    animationDuration: `${0.3 + idx * 0.1}s`,
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-foreground">
                        {activeTrack.title}
                      </p>
                      <p className="truncate text-sm text-muted-foreground mt-0.5">
                        {activeTrack.artist}
                      </p>
                    </div>
                  </div>

                  {/* Player Controls */}
                  <div className="flex flex-col items-center gap-2 flex-1 max-w-md">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => activeSkip(-1)}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-accent/50"
                      >
                        <SkipBack className="size-5 fill-current" />
                      </button>
                      <button
                        onClick={() => setPlaying(!playing)}
                        className="size-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-player hover:scale-105 active:scale-95 transition-transform"
                      >
                        {playing ? (
                          <Pause className="size-6 fill-current" />
                        ) : (
                          <Play className="size-6 fill-current translate-x-[1px]" />
                        )}
                      </button>
                      <button
                        onClick={() => activeSkip(1)}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-accent/50"
                      >
                        <SkipForward className="size-5 fill-current" />
                      </button>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full flex items-center gap-2 text-xs text-muted-foreground font-mono">
                      <span className="w-10 text-right">{formatTime(progress.current)}</span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-100 ease-out"
                          style={{
                            width:
                              progress.duration > 0
                                ? `${(progress.current / progress.duration) * 100}%`
                                : "0%",
                          }}
                        />
                      </div>
                      <span className="w-10">{formatTime(progress.duration)}</span>
                    </div>
                  </div>

                  {/* Volume & Extra Controls */}
                  <div className="flex items-center gap-3 flex-1 justify-end">
                    <button
                      onClick={() => setVolume((v) => (v > 0 ? 0 : 80))}
                      className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-accent/50"
                    >
                      <Volume2 className="size-5" />
                    </button>
                    <Slider
                      value={[volume]}
                      max={100}
                      step={1}
                      className="w-24 [&_[role=slider]]:size-3 bg-primary/20 [&_[role=slider]]:bg-primary [&_[role=slider]]:shadow-glow"
                      onValueChange={(v) => setVolume(v[0] ?? 80)}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowQueueModal(true);
                      }}
                      className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-accent/50"
                    >
                      <ListMusic className="size-5" />
                    </button>
                  </div>
                </div>
              </>
            </div>
          )}
          {fullscreenPlayer && activeTrack && (
          <div className="fixed inset-0 z-[60] bg-player-gradient overflow-y-auto px-4 sm:px-6 py-3 flex flex-col justify-between animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between mt-2">
              <button
                onClick={() => setFullscreenPlayer(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                <ChevronDown className="size-6" />
              </button>
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                TOCANDO AGORA
              </span>
              <button
                onClick={async () => {
                  if (!activeTrack) return;
                  if (activeLocal) {
                    await ensureLocalSaved(activeTrack);
                    setTrackToAddToPlaylist(localToTrack(activeTrack));
                  } else if (current) {
                    setTrackToAddToPlaylist(current);
                  }
                }}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                <Plus className="size-6" />
              </button>
            </div>

            {/* Artwork Container */}
            <div className="my-auto py-2 flex flex-col items-center">
              <div className="relative aspect-square w-full max-w-[280px] sm:max-w-[320px] rounded-2xl overflow-hidden shadow-player bg-muted animate-float">
                <div className="absolute inset-0 flex items-center justify-center">
                  {activeTrack.artwork ? (
                    <img
                      src={activeTrack.artwork}
                      className="w-full h-full object-cover transition-all duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/40 to-primary/10 flex items-center justify-center">
                      <Music className="size-20 text-primary" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-primary/10 pointer-events-none" />
                </div>

                {/* Vinyl/CD effect - inner circle */}
                {/* Sound Wave Indicator (Bottom Left) */}
                {playing && (
                  <div className="absolute bottom-4 left-4 flex gap-0.5 items-end h-5 z-20">
                    {[1, 2, 3, 4].map((idx) => (
                      <span
                        key={idx}
                        className="w-1 bg-primary rounded-full animate-pulse"
                        style={{
                          height: `${30 + idx * 18}%`,
                          animationDuration: `${0.4 + idx * 0.15}s`,
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* Glow overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-primary/20 via-transparent to-transparent pointer-events-none" />
              </div>
            </div>

            {/* Metadata & Favorite */}
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="min-w-0 text-center">
                <p className="text-xl sm:text-2xl font-bold text-foreground truncate">
                  {activeTrack.title}
                </p>
                <p className="text-sm text-muted-foreground mt-1 truncate">{activeTrack.artist}</p>
              </div>
              <button
                onClick={async () => {
                  if (!activeTrack) return;
                  if (activeLocal) {
                    await ensureLocalSaved(activeTrack);
                    toggleLikeMutation.mutate(localToTrack(activeTrack));
                  } else if (current) {
                    toggleLikeMutation.mutate(current);
                  }
                }}
                className={`size-12 flex items-center justify-center rounded-full transition-all ${
                  (likedSongsQuery.data || []).some((t) => t.id === activeTrack.id)
                    ? "bg-primary/20 text-primary"
                    : "bg-accent/50 text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Heart
                  className={`size-6 ${(likedSongsQuery.data || []).some((t) => t.id === activeTrack.id) ? "fill-current" : ""}`}
                />
              </button>
            </div>

            {/* Progress Slider */}
            <div className="space-y-1 mb-4 px-2">
              <Slider
                value={[progress.duration ? (progress.current / progress.duration) * 100 : 0]}
                max={100}
                step={0.1}
                disabled={!progress.duration}
                className="[&_[role=slider]]:size-3 bg-primary/20 [&_[role=slider]]:bg-primary [&_[role=slider]]:shadow-glow"
                onValueChange={(v) => {
                  const pct = v[0] ?? 0;
                  if (!progress.duration) return;
                  const seconds = (pct / 100) * progress.duration;
                  if (activeLocal) {
                    const el = localAudioRef.current;
                    if (el) el.currentTime = seconds;
                  } else if (seekRef.current) {
                    seekRef.current(seconds);
                  }
                  setProgress((p) => ({ ...p, current: seconds }));
                }}
              />
              <div className="flex justify-between text-xs text-muted-foreground font-mono">
                <span>{formatTime(progress.current)}</span>
                <span>{formatTime(progress.duration)}</span>
              </div>
            </div>

            {/* Player Row Control */}
            <div className="flex items-center justify-center gap-6 px-6 mb-8">
              <button
                onClick={() => {
                  const next = !shuffleEnabled;
                  setShuffleEnabled(next);
                  toast.info(next ? "Ordem aleatória ativada" : "Ordem aleatória desativada");
                }}
                className={`transition-colors p-2 rounded-full hover:bg-accent/50 ${
                  shuffleEnabled
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Ordem aleatória"
              >
                <Shuffle className="size-5" />
              </button>
              <button
                onClick={() => activeSkip(-1)}
                className="text-foreground hover:text-primary transition-colors p-2 rounded-full hover:bg-accent/50"
              >
                <SkipBack className="size-7 fill-current" />
              </button>
              <button
                onClick={() => setPlaying(!playing)}
                className="size-18 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-player transition-transform hover:scale-105 active:scale-95"
              >
                {playing ? (
                  <Pause className="size-8 fill-current" />
                ) : (
                  <Play className="size-8 fill-current translate-x-[2px]" />
                )}
              </button>
              <button
                onClick={() => activeSkip(1)}
                className="text-foreground hover:text-primary transition-colors p-2 rounded-full hover:bg-accent/50"
              >
                <SkipForward className="size-7 fill-current" />
              </button>
              <button
                onClick={() => {
                  const next = !repeatEnabled;
                  setRepeatEnabled(next);
                  toast.info(next ? "Repetir ativado" : "Repetir desativado");
                }}
                className={`relative transition-colors p-2 rounded-full hover:bg-accent/50 ${
                  repeatEnabled ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
                title="Repetir música"
              >
                <Repeat className="size-5" />
                {repeatEnabled && (
                  <span className="absolute bottom-1 right-1 size-1.5 bg-primary rounded-full" />
                )}
              </button>
            </div>

            {/* Bottom Quick-Action Buttons (Queue / Equalizer) */}
            <div className="flex justify-center gap-4 mb-4">
              <button
                onClick={() => setShowQueueModal(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-full glass text-sm font-semibold shadow border border-border/30 active:scale-95 transition-transform hover:bg-accent/50"
              >
                <ListMusic className="size-4 text-primary" />
                <span>Fila</span>
              </button>
              <button
                onClick={() => setShowEqModal(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-full glass text-sm font-semibold shadow border border-border/30 active:scale-95 transition-transform hover:bg-accent/50"
              >
                <Zap className="size-4 text-primary" />
                <span>Equalizador</span>
              </button>
            </div>
          </div>
        )}
      
      {/* EQUALIZER MODAL */}
      {showEqModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl glass p-6 relative shadow-player border border-border/30 animate-in scale-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-md font-bold text-foreground flex items-center gap-2">
                <Zap className="size-5 text-primary" />
                Equalizador
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleEq(!eqEnabled)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    eqEnabled
                      ? "bg-primary text-primary-foreground shadow-glow"
                      : "bg-accent/50 text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {eqEnabled ? "Ligado" : "Desligado"}
                </button>
                <button
                  onClick={() => setShowEqModal(false)}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-accent/50 transition-colors"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-4 gap-2 mt-6">
              {(
                ["Neutro", "Grave", "Vocal", "Agudo", "Eletrônica", "Rock", "Podcast"] as EqPreset[]
              ).map((preset) => (
                <button
                  key={preset}
                  onClick={() => applyPreset(preset)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold text-center truncate transition-all ${
                    currentPreset === preset
                      ? "bg-primary/20 text-primary border border-primary/30 shadow-[0_0_0_1px]_theme(colors.primary/30)"
                      : "bg-accent/50 text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Sliders Container (Vertical range controls) */}
            <div className="flex h-40 justify-between items-center mt-6 px-2">
              {gains.map((gainVal, idx) => (
                <div key={idx} className="flex flex-col items-center h-full justify-between">
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {gainVal > 0 ? `+${gainVal}dB` : `${gainVal}dB`}
                  </span>
                  <div className="h-28 w-2 bg-muted rounded-full relative flex items-center justify-center group">
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="1"
                      value={gainVal}
                      disabled={!eqEnabled}
                      className="absolute accent-primary h-28 w-2 cursor-pointer transform -rotate-180 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ writingMode: "vertical-lr" }}
                      onChange={(e) => updateGain(idx, Number(e.target.value))}
                    />
                    <div
                      className="absolute bottom-0 w-2 bg-primary/20 rounded-full transition-all"
                      style={{ height: `${((gainVal + 12) / 24) * 100}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground/60 font-mono mt-1">
                    {[32, 64, 125, 250, 500, "1k", "2k", "4k", "8k", "16k"][idx]}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-xs text-center text-muted-foreground/60 mt-6">
              Ajuste as frequências (Hz) para moldar o som
            </p>
          </div>
        </div>
      )}

      {/* QUEUE MODAL */}
      {showQueueModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200"
          onClick={() => setShowQueueModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl glass p-5 relative shadow-player border border-border/30 animate-in scale-in duration-300 flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-md font-bold text-foreground flex items-center gap-2">
                <ListMusic className="size-5 text-primary" />
                Fila de reprodução
              </h3>
              <button
                onClick={() => setShowQueueModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-accent/50 transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Now Playing */}
            {current && (
              <>
                <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-2">
                  Tocando agora
                </p>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/30 mb-4">
                  <img src={current.artwork} className="size-10 rounded-lg object-cover shadow-md" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-primary truncate">{current.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{current.artist}</p>
                  </div>
                </div>
              </>
            )}

            {/* Up Next */}
            <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-2">
              A seguir ({queue.length - index - 1 > 0 ? queue.length - index - 1 : 0})
            </p>
            <div className="space-y-1 overflow-y-auto flex-1 min-h-0 pr-1">
              {queue.slice(index + 1).map((t, i) => (
                <div
                  key={`${t.id}-${i}`}
                  onClick={() => {
                    play(t, queue);
                    setShowQueueModal(false);
                  }}
                  title="Tocar agora — as próximas continuam depois desta"
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent/50 cursor-pointer transition-all"
                >
                  <span className="text-xs text-muted-foreground w-5 text-right font-medium">
                    {i + 1}
                  </span>
                  <img src={t.artwork} className="size-10 rounded-lg object-cover shadow-md" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.artist}</p>
                  </div>
                  <Play className="size-4 text-muted-foreground flex-shrink-0" />
                </div>
              ))}
              {queue.length - index - 1 <= 0 && (
                <EmptyState
                  icon={ListMusic}
                  title="Fila vazia"
                  description="Toque uma playlist ou álbum para montar a sequência de músicas"
                />
              )}
            </div>

            <p className="text-xs text-center text-muted-foreground/60 mt-4 pt-3 border-t border-border/30">
              Toque em uma música para ouvi-la agora; o restante da fila continua depois dela
            </p>
          </div>
        </div>
      )}

      {/* AUTH MODAL */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl glass p-6 relative shadow-player border border-border/30 animate-in scale-in duration-300">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-accent/50 transition-colors"
            >
              <X className="size-5" />
            </button>
            <div className="text-center mb-6">
              <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Headphones className="size-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground">
                {authMode === "login" ? "Bem-vindo ao ELL MUSIC" : "Crie sua conta"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {authMode === "login"
                  ? "Entre para acessar suas playlists e favoritos"
                  : "Cadastre-se para salvar suas músicas favoritas"}
              </p>
            </div>
            <form onSubmit={handleAuthSubmit} className="space-y-3 mt-4">
              {authMode === "register" && (
                <Input
                  placeholder="Nome"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-accent/50 border-border/30 text-sm"
                />
              )}
              <Input
                type="email"
                placeholder="E-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-accent/50 border-border/30 text-sm"
              />
              <Input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-accent/50 border-border/30 text-sm"
              />
              <Button
                type="submit"
                disabled={authLoading}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-full text-sm shadow-glow transition-all mt-2"
              >
                {authLoading ? "Aguarde..." : authMode === "login" ? "Entrar" : "Criar Conta"}
              </Button>
            </form>
            <button
              onClick={() => setAuthMode((m) => (m === "login" ? "register" : "login"))}
              className="text-sm text-primary mt-4 hover:underline block w-full"
            >
              {authMode === "login" ? "Não possui conta? Cadastre-se" : "Já sou cadastrado"}
            </button>
          </div>
        </div>
      )}

      {/* CRIAR PLAYLIST MODAL */}
      {showCreatePlaylistModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl glass p-6 relative shadow-player border border-border/30 animate-in scale-in duration-300">
            <button
              onClick={() => setShowCreatePlaylistModal(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-accent/50 transition-colors"
            >
              <X className="size-5" />
            </button>
            <div className="text-center mb-4">
              <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Plus className="size-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Criar Playlist</h3>
              <p className="text-sm text-muted-foreground mt-1">Organize suas músicas favoritas</p>
            </div>
            <div className="space-y-3 mt-4">
              <Input
                placeholder="Título da playlist"
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                className="bg-accent/50 border-border/30 text-sm"
              />
              <Input
                placeholder="Descrição (opcional)"
                value={playlistDescription}
                onChange={(e) => setPlaylistDescription(e.target.value)}
                className="bg-accent/50 border-border/30 text-sm"
              />
              <Button
                onClick={() =>
                  createPlaylistMutation.mutate({ name: playlistName, desc: playlistDescription })
                }
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-full text-sm shadow-glow transition-all"
              >
                Criar Playlist
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* SELECIONAR PLAYLIST */}
      {trackToAddToPlaylist && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl glass p-6 relative shadow-player border border-border/30 animate-in scale-in duration-300">
            <button
              onClick={() => setTrackToAddToPlaylist(null)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-accent/50 transition-colors"
            >
              <X className="size-5" />
            </button>
            <h3 className="text-sm font-bold truncate text-foreground mb-4">
              Adicionar a playlist
            </h3>
            <div className="mt-2 space-y-1 max-h-56 overflow-y-auto scroll-area">
              {(playlistsQuery.data || []).map(
                (p: { id: string; name: string; description: string | null }) => (
                  <button
                    key={p.id}
                    onClick={() =>
                      addTrackToPlaylistMutation.mutate({
                        playlistId: p.id,
                        track: trackToAddToPlaylist,
                      })
                    }
                    className="w-full text-left p-3 rounded-xl glass hover:bg-accent/50 text-sm transition-all border border-border/30 flex items-center gap-3"
                  >
                    <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <ListMusic className="size-4 text-primary" />
                    </div>
                    <span className="truncate font-medium text-foreground">{p.name}</span>
                  </button>
                ),
              )}
              {(playlistsQuery.data || []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma playlist criada ainda
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
