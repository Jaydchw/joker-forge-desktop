import { decodeGifDataUrl, isGifDataUrl } from "@/lib/media/gif-decoder";

export interface AtlasPosition {
  x: number;
  y: number;
}

export interface AtlasAnimation {
  atlas: string;
  pos: AtlasPosition;
  frames: Array<AtlasPosition & { durationMs: number }>;
  loopCount: number | null;
}

export interface SpriteAtlasItem {
  id: string;
  orderValue: number;
  image: string;
  overlayImage?: string;
  objectKey?: string;
}

export interface SpriteAtlas {
  atlas1xDataUrl: string;
  atlas2xDataUrl: string;
  positionsById: Record<string, AtlasPosition>;
  soulPositionsById: Record<string, AtlasPosition>;
  animations: AtlasAnimation[];
}

const CARD_WIDTH = 71;
const CARD_HEIGHT = 95;
const MAX_ATLAS_FRAMES = 1024;
const MAX_TEXTURE_EDGE = 8192;

type PreparedImage = {
  frames: Array<CanvasImageSource | null>;
  delays: number[];
  loopCount: number | null;
};

const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Failed to build artwork: canvas is unavailable.");
  context.imageSmoothingEnabled = false;
  return { canvas, context };
};

const loadStaticImage = (src: string): Promise<HTMLImageElement | null> => new Promise((resolve) => {
  if (!src.trim()) { resolve(null); return; }
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => resolve(null);
  image.src = src;
});

async function prepareImage(src: string, remainingFrames: number): Promise<PreparedImage> {
  if (!isGifDataUrl(src)) {
    return { frames: [await loadStaticImage(src)], delays: [], loopCount: null };
  }
  const animation = decodeGifDataUrl(src);
  if (animation.frames.length > remainingFrames) {
    throw new Error(`There are too many animation frames. Each artwork collection supports up to ${MAX_ATLAS_FRAMES.toLocaleString()} frames; use shorter GIFs or fewer animated images.`);
  }
  const { canvas: source, context: sourceContext } = createCanvas(animation.width, animation.height);
  const frames: HTMLCanvasElement[] = [];
  for (const [index, frame] of animation.frames.entries()) {
    sourceContext.putImageData(new ImageData(new Uint8ClampedArray(frame.pixels), animation.width, animation.height), 0, 0);
    const width = Math.min(animation.width, CARD_WIDTH * 2);
    const height = Math.min(animation.height, CARD_HEIGHT * 2);
    const { canvas, context } = createCanvas(width, height);
    context.drawImage(source, 0, 0, width, height);
    frames.push(canvas);
    if (index > 0 && index % 16 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return { frames, delays: animation.frames.map((frame) => frame.delayMs), loopCount: animation.loopCount };
}

export async function buildSpriteAtlas(items: SpriteAtlasItem[], atlas: string): Promise<SpriteAtlas> {
  const sorted = [...items].sort((a, b) => a.orderValue - b.orderValue);
  const prepared: Array<{ item: SpriteAtlasItem; base: PreparedImage; overlay?: PreparedImage }> = [];
  let totalPositions = 0;
  for (const item of sorted) {
    try {
      const base = await prepareImage(item.image || "", MAX_ATLAS_FRAMES - totalPositions);
      totalPositions += base.frames.length;
      const overlay = item.overlayImage?.trim()
        ? await prepareImage(item.overlayImage, MAX_ATLAS_FRAMES - totalPositions)
        : undefined;
      totalPositions += overlay?.frames.length ?? 0;
      if (totalPositions > MAX_ATLAS_FRAMES) {
        throw new Error(`This artwork collection exceeds ${MAX_ATLAS_FRAMES.toLocaleString()} sprite frames. Use shorter GIFs or fewer animated images.`);
      }
      prepared.push({ item, base, overlay });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "The image could not be opened.";
      throw new Error(`${item.objectKey || item.id}: ${reason}`);
    }
  }

  const columns = Math.ceil(totalPositions / 10) * CARD_HEIGHT * 2 <= MAX_TEXTURE_EDGE
    ? 10 : Math.ceil(Math.sqrt(totalPositions * CARD_HEIGHT / CARD_WIDTH));
  const rows = Math.max(1, Math.ceil(totalPositions / columns));
  const outputs = [1, 2].map((scale) => ({
    ...createCanvas(columns * CARD_WIDTH * scale, rows * CARD_HEIGHT * scale), scale,
  }));
  if (outputs[1].canvas.width > MAX_TEXTURE_EDGE || outputs[1].canvas.height > MAX_TEXTURE_EDGE) {
    throw new Error("The animated artwork is too large to export. Use shorter GIFs or fewer animated images.");
  }
  const positionsById: Record<string, AtlasPosition> = {};
  const soulPositionsById: Record<string, AtlasPosition> = {};
  const animations: AtlasAnimation[] = [];
  let nextPosition = 0;
  const draw = (image: PreparedImage): AtlasPosition => {
    const positions = image.frames.map((frame, index) => {
      const position = { x: nextPosition % columns, y: Math.floor(nextPosition / columns) };
      nextPosition += 1;
      for (const { context, scale } of outputs) {
        if (frame) context.drawImage(frame, position.x * CARD_WIDTH * scale, position.y * CARD_HEIGHT * scale, CARD_WIDTH * scale, CARD_HEIGHT * scale);
      }
      return { ...position, durationMs: image.delays[index] ?? 100 };
    });
    const pos = { x: positions[0].x, y: positions[0].y };
    if (positions.length > 1) animations.push({ atlas, pos, frames: positions, loopCount: image.loopCount });
    return pos;
  };
  for (const { item, base, overlay } of prepared) {
    positionsById[item.id] = draw(base);
    if (overlay) soulPositionsById[item.id] = draw(overlay);
  }
  return {
    atlas1xDataUrl: outputs[0].canvas.toDataURL("image/png"),
    atlas2xDataUrl: outputs[1].canvas.toDataURL("image/png"),
    positionsById, soulPositionsById, animations,
  };
}
