/**
 * The game is entirely client-side — the model runs in the browser and there
 * is no server — so it exports to static files and can live on GitHub Pages.
 *
 * Project Pages are served from a subpath (/dumbgeon), which has to be baked
 * in at build time. It is applied only in CI so `next dev` still serves at /.
 */
const isPages = process.env.GITHUB_PAGES === "true";
const repo = "dumbgeon";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  reactStrictMode: true,
  basePath: isPages ? `/${repo}` : "",
  assetPrefix: isPages ? `/${repo}/` : "",
  images: { unoptimized: true },
  // Pages serves /path/ as /path/index.html.
  trailingSlash: true,
};

export default nextConfig;
