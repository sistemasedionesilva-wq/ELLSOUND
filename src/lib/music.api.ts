import {
  FALLBACK_SHELVES,
  HOME_SHELVES,
  itunes,
  searchMusic,
  youtubeSearchVideoId,
  itunesTopSongs,
  type Track,
} from "./music.shared";

export type { Track };

export type YouTubeAudioResult = {
  videoId: string | null;
  reason?: "not-found" | "search-failed";
};

export async function searchTracks(input: { query: string }): Promise<Track[]> {
  const query = String(input?.query ?? "").slice(0, 120);
  if (!query.trim()) return [] as Track[];
  return searchMusic(query, 30);
}

export async function getHomeShelves(): Promise<{ title: string; tracks: Track[] }[]> {
  const data = await Promise.allSettled(
    HOME_SHELVES.map(async (s, index) => {
      const tracks = await itunes(s.term, 12);
      return {
        title: s.title,
        tracks: tracks.length > 0 ? tracks : (FALLBACK_SHELVES[index]?.tracks ?? []),
      };
    }),
  );
  return data
    .map((result, index) =>
      result.status === "fulfilled" ? result.value : FALLBACK_SHELVES[index],
    )
    .filter((s): s is NonNullable<typeof s> => Boolean(s?.tracks.length));
}

export async function getTopTrending(input: { limit?: number } = {}): Promise<Track[]> {
  const limit = Number(input.limit ?? 20);
  return itunesTopSongs(limit, "br");
}

function sanitizeQuery(input: string): string {
  return String(input ?? "")
    .replace(/\s*\((?:feat\.?|featuring)\s+[^)]+\)/gi, "")
    .replace(/\s*\[[^\]]+\]/g, "")
    .replace(/[\\/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function findYouTubeAudio(input: { title: string; artist: string }): Promise<YouTubeAudioResult> {
  const rawTitle = String(input?.title ?? "");
  const rawArtist = String(input?.artist ?? "");
  const title = sanitizeQuery(rawTitle).slice(0, 100);
  const artist = sanitizeQuery(rawArtist).slice(0, 100);
  if (!title) return { videoId: null, reason: "not-found" };

  const queries = [
    `${title} ${artist}`.trim(),
    `${title} ${artist} lyrics`.trim(),
    `${title} ${artist} official`.trim(),
    title,
  ].filter((q, i, arr) => q && arr.indexOf(q) === i);

  try {
    for (const q of queries) {
      const videoId = await youtubeSearchVideoId(q);
      if (videoId) return { videoId };
    }
    return { videoId: null, reason: "not-found" };
  } catch (err) {
    console.warn("[findYouTubeAudio] failed:", err);
    return { videoId: null, reason: "search-failed" };
  }
}