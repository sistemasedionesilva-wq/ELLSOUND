import fs from "node:fs";
import path from "node:path";

if (process.env.VERCEL || process.env.VERCEL_ENV) {
  console.log("Skipping postbuild on Vercel (Nitro handles HTML rendering).");
  process.exit(0);
}

const distDir = path.resolve("dist/client");
const assetsDir = path.join(distDir, "assets");

if (!fs.existsSync(assetsDir)) {
  console.error("Assets directory not found:", assetsDir);
  process.exit(1);
}

const files = fs.readdirSync(assetsDir);
const mainJs = files.find((f) => /^index-.*\.js$/.test(f));
const css = files.find((f) => f.endsWith(".css"));

if (!mainJs) {
  console.error("Main JS bundle not found in assets");
  process.exit(1);
}

const html = `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ELL MUSIC — Player de Música</title>
    <meta name="description" content="Player de música premium com áudio do YouTube e músicas do seu aparelho." />
    <meta name="theme-color" content="#e84036" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="ELL MUSIC" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" sizes="180x180" />
    <link rel="icon" href="/icons/icon-192.png" type="image/png" sizes="192x192" />
    <link rel="icon" href="/icons/icon-512.png" type="image/png" sizes="512x512" />
    <link rel="icon" href="/icons/maskable-512.png" type="image/png" sizes="512x512" purpose="maskable" />
    ${css ? `<link rel="stylesheet" crossorigin href="/assets/${css}">` : ""}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" crossorigin src="/assets/${mainJs}"></script>
  </body>
</html>
`;

const outPath = path.join(distDir, "index.html");
fs.writeFileSync(outPath, html, "utf8");
console.log("Generated:", outPath, "with bundle:", mainJs);
