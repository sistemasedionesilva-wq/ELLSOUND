import { createServerFn } from "@tanstack/react-start";
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

export const searchTracks = createServerFn({ method: "GET" })
  .inputValidator((input: { query: string }) => ({
    query: String(input.query ?? "").slice(0, 120),
  }))
  .handler(async ({ data }) => {
    if (!data.query.trim()) return [] as Track[];
    return searchMusic(data.query, 30);
  });

export const getHomeShelves = createServerFn({ method: "GET" }).handler(async () => {
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
});

export const getTopTrending = createServerFn({ method: "GET" })
  .inputValidator((input: { limit?: number }) => ({
    limit: Number(input.limit ?? 20),
  }))
  .handler(async ({ data }) => {
    return itunesTopSongs(data.limit, "br");
  });

export const findYouTubeAudio = createServerFn({ method: "GET" })
  .inputValidator((input: { title: string; artist: string }) => ({
    title: String(input.title ?? "").slice(0, 120),
    artist: String(input.artist ?? "").slice(0, 120),
  }))
  .handler(async ({ data }) => {
    const videoId = await youtubeSearchVideoId(`${data.title} ${data.artist} audio`);
    return { videoId };
  });
