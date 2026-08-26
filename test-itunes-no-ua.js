async function test() {
  const term = "top hits 2026";
  const limit = 12;
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&country=BR&limit=${limit}`;
  console.log("Fetching:", url);
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json, text/javascript",
      },
    });
    console.log("Status:", res.status);
    console.log("OK:", res.ok);
    const text = await res.text();
    console.log("Response (first 200 chars):", text.slice(0, 200));
  } catch (e) {
    console.error("Error:", e);
  }
}
test();
