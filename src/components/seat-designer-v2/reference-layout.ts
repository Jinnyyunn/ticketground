import type { Point } from "@/types/seat-chart";

type Size = { readonly width: number; readonly height: number };

export function fitReferenceAsset(
  source: Size,
  available: Size,
  origin: Point,
): Point & Size {
  const scale = Math.min(available.width / source.width, available.height / source.height);
  const width = Math.round(source.width * scale);
  const height = Math.round(source.height * scale);
  return {
    x: Math.round(origin.x + (available.width - width) / 2),
    y: Math.round(origin.y + (available.height - height) / 2),
    width,
    height,
  };
}
