export type Track = {
  id: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  previewUrl: string | null;
  durationMs: number;
};

type ItunesResult = {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackTimeMillis?: number;
};

type DeezerResult = {
  id?: number;
  title?: string;
  duration?: number;
  preview?: string;
  artist?: { name?: string };
  album?: { title?: string; cover_xl?: string; cover_big?: string };
};

type ItunesRssEntry = {
  id?: { attributes?: { "im:id"?: string } };
  "im:name"?: { label?: string };
  "im:artist"?: { label?: string };
  "im:image"?: Array<{ label?: string }>;
  "im:collection"?: { "im:name"?: { label?: string } };
  link?: ItunesLink[];
};

type ItunesLink = {
  attributes?: { type?: string; href?: string };
};

function mapTracks(results: ItunesResult[]): Track[] {
  return results
    .filter((r) => {
      const valid = !!(r.trackId && r.trackName && r.artistName);
      if (!valid) {
        console.warn("iTunes result filtered out:", JSON.stringify(r).slice(0, 100));
      }
      return valid;
    })
    .map((r) => ({
      id: String(r.trackId),
      title: r.trackName as string,
      artist: r.artistName as string,
      album: r.collectionName ?? "",
      artwork: (r.artworkUrl100 ?? "").replace("100x100bb", "600x600bb"),
      previewUrl: r.previewUrl ?? null,
      durationMs: r.trackTimeMillis ?? 0,
    }));
}

export async function itunes(term: string, limit: number, country = "BR"): Promise<Track[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
    term,
  )}&media=music&entity=song&country=${country}&limit=${limit}`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
          Accept: "application/json, text/javascript",
        },
      });
      if (!res.ok) continue;

      const json = (await res.json()) as { results?: ItunesResult[] };
      const rawResults = json.results ?? [];
      const tracks = mapTracks(rawResults);
      if (tracks.length === 0 && rawResults.length > 0) {
        console.error(
          `iTunes returned ${rawResults.length} results but 0 were valid for "${term}"`,
        );
      }
      return tracks;
    } catch (err) {
      console.error(`iTunes fetch failed for ${term} (attempt ${attempt + 1}):`, err);
      // A Apple pode falhar de forma transitória; a próxima iteração tenta novamente.
    } finally {
      clearTimeout(timeout);
    }
  }

  return [];
}

async function deezer(term: string, limit: number): Promise<Track[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const res = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(term)}&limit=${limit}`,
      { signal: controller.signal, headers: { Accept: "application/json" } },
    );
    if (!res.ok) return [];

    const json = (await res.json()) as { data?: DeezerResult[] };
    return (json.data ?? [])
      .filter((result) => result.id && result.title && result.artist?.name)
      .map((result) => ({
        id: `deezer-${result.id}`,
        title: result.title ?? "",
        artist: result.artist?.name ?? "",
        album: result.album?.title ?? "",
        artwork: result.album?.cover_xl ?? result.album?.cover_big ?? "",
        previewUrl: result.preview ?? null,
        durationMs: (result.duration ?? 0) * 1_000,
      }));
  } catch (error) {
    console.error(`Deezer fetch failed for ${term}:`, error);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export const HOME_SHELVES = [
  { title: "Novidades para você", term: "top hits 2026" },
  { title: "Sua descoberta semanal", term: "indie pop" },
  { title: "Batidas urbanas", term: "hip hop brasil" },
  { title: "Relax lofi", term: "lofi chill" },
];

const fallbackTrack = (
  id: string,
  title: string,
  artist: string,
  album: string,
  artwork: string,
  durationMs: number,
): Track => ({ id, title, artist, album, artwork, previewUrl: null, durationMs });

export const FALLBACK_SHELVES: Array<{ title: string; tracks: Track[] }> = [
  {
    title: "Novidades para você",
    tracks: [
      fallbackTrack(
        "1537830816",
        "Melhor Eu Ir / Ligando os Fatos",
        "Grupo Menos É Mais",
        "Churrasquinho Menos É Mais",
        "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/94/48/46/94484633-e4b4-a4a3-e6ce-5ede9850157c/7891430505479.jpg/600x600bb.jpg",
        521088,
      ),
      fallbackTrack(
        "1444873502",
        "Ela Só Quer Paz",
        "Projota",
        "Ela Só Quer Paz",
        "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/e2/5a/0b/e25a0b57-394f-73b3-075c-c5e3caceb3e0/16UMGIM00516.rgb.jpg/600x600bb.jpg",
        174382,
      ),
    ],
  },
  {
    title: "Sua descoberta semanal",
    tracks: [
      fallbackTrack(
        "6787085075",
        "Raumschiff",
        "Kasane Teto & Birgitta Kroon",
        "Gläsernes Herz",
        "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/07/19/0e/07190e5b-bc75-7886-33fa-b51bfac4ea14/cover.jpg/600x600bb.jpg",
        168295,
      ),
      fallbackTrack(
        "6787085061",
        "Atemlos",
        "Kasane Teto & Birgitta Kroon",
        "Gläsernes Herz",
        "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/07/19/0e/07190e5b-bc75-7886-33fa-b51bfac4ea14/cover.jpg/600x600bb.jpg",
        200688,
      ),
    ],
  },
  {
    title: "Batidas urbanas",
    tracks: [
      fallbackTrack(
        "1737490891",
        "Poesia Acústica 13",
        "Pineapple StormTV",
        "Poesia Acústica 13",
        "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/d6/be/0f/d6be0f27-8bbe-a11c-b5f6-931d2771deee/198391599217.jpg/600x600bb.jpg",
        628125,
      ),
      fallbackTrack(
        "1444873502-urban",
        "Ela Só Quer Paz",
        "Projota",
        "Ela Só Quer Paz",
        "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/e2/5a/0b/e25a0b57-394f-73b3-075c-c5e3caceb3e0/16UMGIM00516.rgb.jpg/600x600bb.jpg",
        174382,
      ),
    ],
  },
  {
    title: "Relax lofi",
    tracks: [
      fallbackTrack(
        "6795055870",
        "Coffee Break — Lo-Fi Chill Cafe",
        "FM STAR",
        "Summer Lofi Vibes",
        "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/e2/22/15/e2221528-175d-fc90-7351-8ac3225bc6ae/4550758973027_cover.jpg/600x600bb.jpg",
        166272,
      ),
      fallbackTrack(
        "6795077261",
        "Coffee Break — Summer Study",
        "FM STAR",
        "Cafe Lofi Music",
        "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/c0/b6/cf/c0b6cf25-3e89-a331-1f51-66ceaf656134/4550758972945_cover.jpg/600x600bb.jpg",
        166272,
      ),
    ],
  },
];

export async function searchMusic(term: string, limit = 30): Promise<Track[]> {
  const [brazilResults, internationalResults, deezerResults] = await Promise.allSettled([
    itunes(term, limit, "BR"),
    itunes(term, limit, "US"),
    deezer(term, limit),
  ]);

  if (brazilResults.status === "fulfilled" && brazilResults.value.length > 0) return brazilResults.value;
  if (internationalResults.status === "fulfilled" && internationalResults.value.length > 0) return internationalResults.value;
  if (deezerResults.status === "fulfilled" && deezerResults.value.length > 0) return deezerResults.value;

  const normalized = term.trim().toLocaleLowerCase("pt-BR");
  const fallback = FALLBACK_SHELVES.flatMap((shelf) => shelf.tracks);
  const matching = fallback.filter((track) =>
    `${track.title} ${track.artist} ${track.album}`.toLocaleLowerCase("pt-BR").includes(normalized),
  );

  return matching;
}

export async function itunesTopSongs(limit = 20, country = "br"): Promise<Track[]> {
  const url = `https://itunes.apple.com/${country}/rss/topsongs/limit=${limit}/json`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const entries = data.feed?.entry ?? [];
    if (entries.length === 0) throw new Error("No entries in iTunes feed");
    const tracks = entries.map((entry: ItunesRssEntry) => {
      const id = entry.id?.attributes?.["im:id"] || Math.random().toString(36).slice(2);
      const title = entry["im:name"]?.label || "";
      const artist = entry["im:artist"]?.label || "";
      const artwork = (
        entry["im:image"]?.[2]?.label ||
        entry["im:image"]?.[0]?.label ||
        ""
      ).replace("170x170bb", "600x600bb");
      const previewLink =
        entry.link?.find((l: ItunesLink) => l.attributes?.type === "audio/x-m4a") ||
        entry.link?.[0];
      const previewUrl = previewLink?.attributes?.href || null;
      return {
        id,
        title,
        artist,
        album: entry["im:collection"]?.["im:name"]?.label || "",
        artwork,
        previewUrl,
        durationMs: 30000,
      };
    });
    if (tracks.length === 0) throw new Error("No valid tracks parsed");
    return tracks;
  } catch (error) {
    console.error("Failed to fetch iTunes top songs:", error);
    // Return fallback trending tracks so UI never shows empty
    const fallback = FALLBACK_SHELVES.flatMap((s) => s.tracks);
    if (fallback.length > 0) return fallback.slice(0, limit);
    // Ultimate fallback - static popular tracks
    return [
      {
        id: "fallback-1",
        title: "As It Was",
        artist: "Harry Styles",
        album: "Harry's House",
        artwork:
          "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/5c/6c/8f/5c6c8f5a-8b3a-4f5a-8c5a-5c6c8f5a8b3a/cover.jpg/600x600bb.jpg",
        previewUrl: null,
        durationMs: 168000,
      },
      {
        id: "fallback-2",
        title: "Flowers",
        artist: "Miley Cyrus",
        album: "Endless Summer Vacation",
        artwork:
          "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/7a/8b/9c/7a8b9c7a-8b9c-7a8b-9c7a-8b9c7a8b9c7a/cover.jpg/600x600bb.jpg",
        previewUrl: null,
        durationMs: 197000,
      },
      {
        id: "fallback-3",
        title: "Anti-Hero",
        artist: "Taylor Swift",
        album: "Midnights",
        artwork:
          "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/3d/4e/5f/3d4e5f3d-4e5f-3d4e-5f3d-4e5f3d4e5f3d/cover.jpg/600x600bb.jpg",
        previewUrl: null,
        durationMs: 200000,
      },
    ].slice(0, limit);
  }
}

export async function youtubeSearchVideoId(q: string): Promise<string | null> {
  try {
    const base = (import.meta as any)?.env?.VITE_BACKEND_URL || "";
    const url = `${base}/api/youtube-search?q=${encodeURIComponent(q)}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("[youtubeSearchVideoId] non-OK status:", res.status);
      return null;
    }
    const data = await res.json();
    const first = data?.results?.[0];
    if (first?.videoId) return first.videoId as string;
    console.warn("[youtubeSearchVideoId] no results in response");
    return null;
  } catch (err) {
    console.warn("[youtubeSearchVideoId] fetch failed:", (err as Error)?.message ?? err);
    return null;
  }
}
