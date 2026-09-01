import { spawn } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const outDir = join(root, ".output/public");
const base = process.env.NITRO_APP_BASE_URL || "/";

function spawnVite() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/with-app-env.mjs", "vite", "build"], {
      stdio: "inherit",
      env: process.env,
      cwd: root,
    });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

function isUsefulHtml(file) {
  if (!existsSync(file) || !statSync(file).isFile()) return false;
  if (statSync(file).size < 200) return false;
  return /<html/i.test(readFileSync(file, "utf8"));
}

function findAsset(prefix, ext) {
  const dir = join(outDir, "assets");
  if (!existsSync(dir)) return "";
  return readdirSync(dir).find((name) => name.startsWith(prefix) && name.endsWith(ext)) || "";
}

function withBase(path) {
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${prefix}${String(path).replace(/^\/+/, "")}`;
}

function fallbackHtml() {
  const js = findAsset("index-", ".js");
  const css = findAsset("styles-", ".css");
  if (!js) throw new Error("Falta el bundle cliente (assets/index-*.js)");
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
<title>IASPOR</title>
<meta name="theme-color" content="#020617"/>
<meta name="description" content="Busca esquemas eléctricos y manuales de automatismos de puertas en tus PDFs y en la web."/>
<link rel="icon" type="image/svg+xml" href="${withBase("favicon.svg")}"/>
${css ? `<link rel="stylesheet" href="${withBase(`assets/${css}`)}"/>` : ""}
<link rel="manifest" href="${withBase("__grok/manifest.webmanifest")}"/>
<link rel="apple-touch-icon" href="${withBase("__grok/icon-180.png")}"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Audiowide&family=Oxanium:wght@400;500;600;700&family=Share+Tech+Mono&display=swap"/>
</head>
<body>
<script type="module" src="${withBase(`assets/${js}`)}"></script>
</body>
</html>
`;
}

async function renderSsrHtml() {
  const ssrPath = join(root, "node_modules/.nitro/vite/services/ssr/index.js");
  if (!existsSync(ssrPath)) return "";
  const mod = await import(pathToFileURL(ssrPath).href);
  const server = mod.default;
  if (!server?.fetch) return "";
  const url = new URL(base, "https://kingericI9ta.github.io").href;
  const res = await server.fetch(
    new Request(url, {
      headers: {
        accept: "text/html",
        "X-TSS_SHELL": "true",
      },
    }),
  );
  const html = await res.text();
  console.log(`[build-pages] SSR ${res.status} ${html.length} bytes`);
  return html;
}

function writeManifest() {
  const start = base.endsWith("/") ? base : `${base}/`;
  mkdirSync(join(outDir, "__grok"), { recursive: true });
  writeFileSync(
    join(outDir, "__grok/manifest.webmanifest"),
    JSON.stringify(
      {
        name: "IASPOR",
        short_name: "IASPOR",
        id: start,
        start_url: start,
        scope: start,
        display: "standalone",
        background_color: "#020617",
        theme_color: "#020617",
        icons: [
          {
            src: withBase("icon-512.png"),
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: withBase("icon-192.png"),
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: withBase("__grok/icon-180.png"),
            sizes: "180x180",
            type: "image/png",
          },
        ],
      },
      null,
      2,
    ),
  );
}

function publishHtml(html) {
  mkdirSync(outDir, { recursive: true });
  const indexHtml = join(outDir, "index.html");
  writeFileSync(indexHtml, html);
  copyFileSync(indexHtml, join(outDir, "404.html"));
  writeFileSync(join(outDir, ".nojekyll"), "");
  const stray = join(outDir, "index");
  if (existsSync(stray) && statSync(stray).isFile()) unlinkSync(stray);
}

const viteCode = await spawnVite();
console.log(`[build-pages] vite exit ${viteCode}`);
if (viteCode !== 0) {
  console.error("[build-pages] vite falló; no se publica una copia vieja");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
const clientDir = join(root, "dist/client");
if (existsSync(clientDir)) {
  cpSync(clientDir, outDir, { recursive: true });
}
if (existsSync(join(root, "public/sw.js"))) {
  copyFileSync(join(root, "public/sw.js"), join(outDir, "sw.js"));
}

let html = "";
for (const candidate of [
  join(outDir, "_shell.html"),
  join(clientDir, "_shell.html"),
  join(outDir, "index.html"),
]) {
  if (isUsefulHtml(candidate)) {
    html = readFileSync(candidate, "utf8");
    console.log(`[build-pages] usando ${candidate}`);
    break;
  }
}

if (!html) {
  try {
    const ssr = await renderSsrHtml();
    if (ssr && /<html/i.test(ssr) && ssr.length > 200) html = ssr;
  } catch (err) {
    console.warn("[build-pages] SSR no disponible:", err);
  }
}

if (!html) html = fallbackHtml();

if (!/<script/i.test(html)) {
  const js = findAsset("index-", ".js");
  if (js) {
    html = html.replace(
      /<\/body>/i,
      `<script type="module" src="${withBase(`assets/${js}`)}"></script></body>`,
    );
  }
}

const buildId = Date.now().toString(36);
html = html.replace(
  /<head>/i,
  `<head>\n<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate"/>\n<meta name="iaspor-build" content="${buildId}"/>`,
);
if (!html.includes("serviceWorker.register")) {
  html = html.replace(
    /<\/body>/i,
    `<script>if("serviceWorker"in navigator){navigator.serviceWorker.register("${withBase("sw.js")}?v=${buildId}").catch(function(){})}</script></body>`,
  );
}

publishHtml(html);
writeManifest();

if (existsSync(join(outDir, "sw.js"))) {
  const sw = readFileSync(join(outDir, "sw.js"), "utf8").replace(
    /const BUILD = "[^"]*"/,
    `const BUILD = "${buildId}"`,
  );
  writeFileSync(join(outDir, "sw.js"), sw);
}

if (process.env.NITRO_PRESET === "github_pages" && process.env.SKIP_FAAC_SNAPSHOT !== "1") {
  try {
    const { snapshotFaacDrawings } = await import("./snapshot-faac-drawings.mjs");
    await snapshotFaacDrawings(outDir);
  } catch (err) {
    console.warn("[build-pages] despieces FAAC no empaquetados:", err);
  }
}

if (!isUsefulHtml(join(outDir, "index.html"))) {
  console.error("[build-pages] index.html vacío");
  process.exit(1);
}

console.log("[build-pages] publicado", join(outDir, "index.html"));
process.exit(0);
