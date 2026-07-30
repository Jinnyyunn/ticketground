import type { ImageProps } from "next/image";
import { featuredShow } from "./home-content";

export const homeFeaturedImagePolicy = {
  alt: "",
  fetchPriority: "high",
  fill: true,
  loading: "eager",
  sizes: "(min-width: 768px) 56vw, 100vw",
  src: featuredShow.poster,
  unoptimized: featuredShow.poster.endsWith(".gif"),
} satisfies ImageProps;
