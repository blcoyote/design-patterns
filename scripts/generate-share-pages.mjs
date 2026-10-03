import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { createServer } from "vite";

const projectRoot = process.cwd();
const distDirectory = resolve(projectRoot, "dist");
const server = await createServer({
  configFile: false,
  root: projectRoot,
  resolve: { alias: { "@": resolve(projectRoot, "src") } },
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true },
  appType: "custom",
  logLevel: "error",
});

function escapeAttribute(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function replaceMeta(html, attribute, key, content) {
  const pattern = new RegExp(`<meta\\s+${attribute}="${key}"[^>]*>`);
  if (!pattern.test(html)) throw new Error(`Missing ${attribute}=${key} in index.html`);
  return html.replace(
    pattern,
    `<meta ${attribute}="${key}" content="${escapeAttribute(content)}" />`,
  );
}

try {
  const { SITE_NAME, seoSharePages } = await server.ssrLoadModule(
    "/src/lib/seoPages.ts",
  );
  const template = await readFile(resolve(distDirectory, "index.html"), "utf8");

  for (const page of seoSharePages) {
    const pageTitle = `${page.title} | ${SITE_NAME}`;
    const description = page.description.replace(/\s+/g, " ").trim();
    const excerpt =
      description.length > 160
        ? `${description.slice(0, 157).trimEnd()}...`
        : description;
    const outputFile = resolve(
      distDirectory,
      "share",
      page.sharePath.replace(/^\/share\//, ""),
    );
    const assetPrefix = `${relative(dirname(outputFile), distDirectory)
      .split(sep)
      .join("/")}/`;
    let html = template.replace(/<title>[^<]*<\/title>/, `<title>${escapeAttribute(pageTitle)}</title>`);

    html = replaceMeta(html, "name", "description", excerpt);
    html = replaceMeta(html, "property", "og:title", pageTitle);
    html = replaceMeta(html, "property", "og:description", excerpt);
    html = replaceMeta(html, "name", "twitter:title", pageTitle);
    html = replaceMeta(html, "name", "twitter:description", excerpt);
    html = html.replaceAll('="./assets/', `="${assetPrefix}assets/`);
    html = html.replaceAll('="./favicon.svg"', `="${assetPrefix}favicon.svg"`);

    const routeBootstrap = `<script>if (!window.location.hash) window.location.hash = ${JSON.stringify(page.route)};</script>`;
    html = html.replace("</head>", `${routeBootstrap}</head>`);
    await mkdir(dirname(outputFile), { recursive: true });
    await writeFile(outputFile, html);
  }

  console.log(`Generated ${seoSharePages.length} crawler-readable share pages.`);
} finally {
  await server.close();
}