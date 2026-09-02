import { createFileRoute } from "@tanstack/react-router";

const GOOGLE_API_KEY = process.env.YOUTUBE_API_KEY || "";

export const Route = createFileRoute("/api/youtube-search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const q = (url.searchParams.get("q") ?? "").slice(0, 120);

        const headers = {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=60",
          "Content-Type": "application/json",
        };

        if (!q.trim()) {
          return new Response(JSON.stringify({ error: "Missing q" }), { status: 400, headers });
        }
        if (!GOOGLE_API_KEY) {
          return new Response(JSON.stringify({ error: "YOUTUBE_API_KEY not configured" }), { status: 500, headers });
        }

        const yt = new URL("https://www.googleapis.com/youtube/v3/search");
        yt.searchParams.set("part", "snippet");
        yt.searchParams.set("type", "video");
        yt.searchParams.set("maxResults", "10");
        yt.searchParams.set("q", q);
        yt.searchParams.set("key", GOOGLE_API_KEY);
        yt.searchParams.set("relevanceLanguage", "pt");
        yt.searchParams.set("regionCode", "BR");

        try {
          const r = await fetch(yt.toString());
          if (!r.ok) {
            const text = await r.text();
            console.error("[youtube-search] upstream", r.status, text);
            return new Response(JSON.stringify({ error: "YouTube API error" }), { status: 502, headers });
          }
          const data = await r.json();
          const results = (data.items || [])
            .map((it: any) => ({
              videoId: it.id?.videoId,
              title: it.snippet?.title,
              artist: it.snippet?.channelTitle || "Unknown",
              thumbnail: it.snippet?.thumbnails?.high?.url || it.snippet?.thumbnails?.default?.url,
            }))
            .filter((v: any) => v.videoId);
          if (results.length === 0) {
            console.warn("[youtube-search] empty results for q=", q);
          }
          return new Response(JSON.stringify({ query: q, results }), { status: 200, headers });
        } catch (err) {
          console.error("[youtube-search] failed", err);
          return new Response(JSON.stringify({ error: "Search failed" }), { status: 500, headers });
        }
      },
    },
  },
});
