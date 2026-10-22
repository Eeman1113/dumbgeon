import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE.name} — ${SITE.tagline}`,
    short_name: SITE.name,
    description: SITE.short,
    start_url: "./",
    scope: "./",
    display: "standalone",
    orientation: "any",
    background_color: "#000000",
    theme_color: "#000000",
    categories: ["games", "entertainment"],
    icons: [
      { src: "./icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
