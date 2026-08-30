import fs from "node:fs";
import path from "node:path";

const candidates = [
  ".vercel/output/static/assets",
  "dist/client/assets",
];
const assetsDir = candidates.find((p) => fs.existsSync(p));

if (!assetsDir) {
  console.error("Assets directory not found. Looked in:", candidates);
  process.exit(1);
}

const rootIndex = path.resolve("index.html");
if (!fs.existsSync(rootIndex)) {
  console.error("Root index.html not found:", rootIndex);
  process.exit(1);
}

const files = fs.readdirSync(assetsDir);
const mainJs = files.find((f) => /^index-.*\.js$/.test(f)) ?? files.find((f) => /^dist-.*\.js$/.test(f));
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

fs.writeFileSync(rootIndex, html, "utf8");
console.log("Updated template:", rootIndex, "with bundle:", mainJs);
