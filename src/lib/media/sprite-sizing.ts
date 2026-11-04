import type { FullSpriteSize } from "@/lib/core/types";
import { getImageDimensions } from "./image-processing-utils";

export const MAX_FULL_SPRITE_DIMENSION = 2048;

export function fullSpriteSize(width: number, height: number): FullSpriteSize {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error("The sprite must have a valid width and height.");
  }
  if (width > MAX_FULL_SPRITE_DIMENSION || height > MAX_FULL_SPRITE_DIMENSION) {
    throw new Error(`Full sprites must be ${MAX_FULL_SPRITE_DIMENSION} pixels or smaller in each direction.`);
  }
  return { width, height };
}

export async function getFullSpriteSize(
  image: string,
  overlayImage?: string,
  knownImageSize?: FullSpriteSize,
): Promise<FullSpriteSize> {
  if (!image.trim()) throw new Error("Upload a main sprite before choosing full sprite sizing.");
  const base = knownImageSize ?? await getImageDimensions(image);
  fullSpriteSize(base.width, base.height);
  const overlay = overlayImage?.trim() ? await getImageDimensions(overlayImage) : undefined;
  if (overlay) fullSpriteSize(overlay.width, overlay.height);
  return fullSpriteSize(
    Math.max(base.width, overlay?.width ?? 0),
    Math.max(base.height, overlay?.height ?? 0),
  );
}
