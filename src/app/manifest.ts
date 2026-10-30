import type { MetadataRoute } from "next";

// Lets a phone add Stardust DS to its home screen like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Stardust DS",
    short_name: "Stardust",
    description: "Build your own universe from dictionaries.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#171717",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
