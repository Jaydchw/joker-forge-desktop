import type { FullSpriteSize, JokerData } from "@/lib/core/types";
import { getImageDimensions } from "@/lib/media/image-processing-utils";
import { buildSpriteAtlas, type AtlasPosition, type SpriteAtlas } from "./image-atlas";

export interface JokerArtwork {
  atlas: string;
  pos: AtlasPosition;
  soulPos?: AtlasPosition;
  fullSprite?: FullSpriteSize;
}

export interface FullSpriteAtlas {
  key: string;
  width: number;
  height: number;
  atlas: SpriteAtlas;
}

export interface JokerSpriteAtlases {
  normal: SpriteAtlas | null;
  fullAtlases: FullSpriteAtlas[];
  artworkById: Record<string, JokerArtwork>;
}

const checkSize = (size: FullSpriteSize): void => {
  if (!Number.isInteger(size.width) || !Number.isInteger(size.height)
    || size.width < 1 || size.height < 1 || size.width > 2048 || size.height > 2048) {
    throw new Error("Full sprites must be between 1 and 2048 pixels in each dimension.");
  }
};

export const fullSpriteAtlasKey = ({ width, height }: FullSpriteSize): string =>
  `CustomJokersFull_${width}x${height}`;

export async function getFullSpriteCanvas(item: Pick<JokerData, "image" | "overlayImage">): Promise<FullSpriteSize> {
  if (!item.image?.trim()) throw new Error("Upload a main image before using a full sprite.");
  const images = [item.image, item.overlayImage].filter((source): source is string => !!source?.trim());
  const dimensions = await Promise.all(images.map(getImageDimensions));
  dimensions.forEach(checkSize);
  const size = {
    width: Math.max(...dimensions.map((image) => image.width)),
    height: Math.max(...dimensions.map((image) => image.height)),
  };
  checkSize(size);
  return size;
}

export async function buildJokerSpriteAtlases(items: JokerData[]): Promise<JokerSpriteAtlases> {
  const sorted = [...items].sort((a, b) => a.orderValue - b.orderValue);
  const ordinary = sorted.filter((item) => !item.fullSprite);
  const groups = new Map<string, { size: FullSpriteSize; items: JokerData[] }>();
  for (const item of sorted) {
    if (!item.fullSprite) continue;
    try {
      const size = await getFullSpriteCanvas(item);
      const key = fullSpriteAtlasKey(size);
      const group = groups.get(key) ?? { size, items: [] };
      group.items.push(item);
      groups.set(key, group);
    } catch (error) {
      throw new Error(`${item.objectKey || item.id}: ${error instanceof Error ? error.message : "The full sprite could not be opened."}`);
    }
  }

  const normal = ordinary.length ? await buildSpriteAtlas(ordinary, "CustomJokers") : null;
  const artworkById: Record<string, JokerArtwork> = {};
  if (normal) {
    for (const item of ordinary) {
      artworkById[item.id] = {
        atlas: "CustomJokers", pos: normal.positionsById[item.id], soulPos: normal.soulPositionsById[item.id],
      };
    }
  }
  const fullAtlases: FullSpriteAtlas[] = [];
  for (const [key, { size, items: group }] of groups) {
    const atlas = await buildSpriteAtlas(group, key, { ...size, imageFit: "native" });
    fullAtlases.push({ key, ...size, atlas });
    for (const item of group) {
      artworkById[item.id] = {
        atlas: key, pos: atlas.positionsById[item.id], soulPos: atlas.soulPositionsById[item.id], fullSprite: size,
      };
    }
  }
  return { normal, fullAtlases, artworkById };
}
