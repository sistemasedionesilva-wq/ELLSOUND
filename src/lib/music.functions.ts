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

export async function findYouTubeAudio(input: { title: string; artist: string }): Promise<{ videoId: string | null }> {
  const title = String(input?.title ?? "").slice(0, 120);
  const artist = String(input?.artist ?? "").slice(0, 120);
  const videoId = await youtubeSearchVideoId(`${title} ${artist} audio`);
  return { videoId };
}
