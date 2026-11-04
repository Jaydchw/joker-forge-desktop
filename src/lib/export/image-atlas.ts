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

export interface SpriteAtlasOptions {
  width?: number;
  height?: number;
  imageFit?: "stretch" | "native";
}

const CARD_WIDTH = 71;
const CARD_HEIGHT = 95;
const MAX_ATLAS_FRAMES = 1024;
const MAX_TEXTURE_EDGE = 8192;
const MAX_TEXTURE_PIXELS = 32 * 1024 * 1024;

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

async function prepareImage(
  src: string,
  remainingFrames: number,
  width: number,
  height: number,
  native: boolean,
): Promise<PreparedImage> {
  if (!isGifDataUrl(src)) {
    const image = await loadStaticImage(src);
    if (native && !image) throw new Error("The full sprite could not be opened. Upload the image again.");
    return { frames: [image], delays: [], loopCount: null };
  }
  const animation = decodeGifDataUrl(src);
  if (animation.frames.length > remainingFrames) {
    throw new Error(`There are too many animation frames. Each artwork collection supports up to ${MAX_ATLAS_FRAMES.toLocaleString()} frames; use shorter GIFs or fewer animated images.`);
  }
  const { canvas: source, context: sourceContext } = createCanvas(animation.width, animation.height);
  const frames: HTMLCanvasElement[] = [];
  for (const [index, frame] of animation.frames.entries()) {
    sourceContext.putImageData(new ImageData(new Uint8ClampedArray(frame.pixels), animation.width, animation.height), 0, 0);
    const frameWidth = native ? animation.width : Math.min(animation.width, width * 2);
    const frameHeight = native ? animation.height : Math.min(animation.height, height * 2);
    const { canvas, context } = createCanvas(frameWidth, frameHeight);
    context.drawImage(source, 0, 0, frameWidth, frameHeight);
    frames.push(canvas);
    if (index > 0 && index % 16 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return { frames, delays: animation.frames.map((frame) => frame.delayMs), loopCount: animation.loopCount };
}

export async function buildSpriteAtlas(
  items: SpriteAtlasItem[],
  atlas: string,
  options: SpriteAtlasOptions = {},
): Promise<SpriteAtlas> {
  const width = options.width ?? CARD_WIDTH;
  const height = options.height ?? CARD_HEIGHT;
  const native = options.imageFit === "native";
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1
    || width > 2048 || height > 2048) {
    throw new Error("Sprite dimensions must be whole pixels between 1 and 2048.");
  }
  const sorted = [...items].sort((a, b) => a.orderValue - b.orderValue);
  const prepared: Array<{ item: SpriteAtlasItem; base: PreparedImage; overlay?: PreparedImage }> = [];
  let totalPositions = 0;
  for (const item of sorted) {
    try {
      const base = await prepareImage(item.image || "", MAX_ATLAS_FRAMES - totalPositions, width, height, native);
      totalPositions += base.frames.length;
      const overlay = item.overlayImage?.trim()
        ? await prepareImage(item.overlayImage, MAX_ATLAS_FRAMES - totalPositions, width, height, native)
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

  const maxColumns = Math.floor(MAX_TEXTURE_EDGE / (width * 2));
  const maxRows = Math.floor(MAX_TEXTURE_EDGE / (height * 2));
  const minimumColumns = Math.max(1, Math.ceil(totalPositions / maxRows));
  const preferredColumns = Math.ceil(totalPositions / 10) * height * 2 <= MAX_TEXTURE_EDGE
    ? 10 : Math.ceil(Math.sqrt(totalPositions * height / width));
  let columns = Math.min(maxColumns, Math.max(minimumColumns, preferredColumns));
  if (native) {
    let bestAspect = Infinity;
    let bestCells = Infinity;
    columns = 0;
    for (let candidate = minimumColumns; candidate <= Math.min(maxColumns, Math.max(1, totalPositions)); candidate++) {
      const candidateRows = Math.max(1, Math.ceil(totalPositions / candidate));
      const cells = candidate * candidateRows;
      if (candidateRows > maxRows || cells * width * height * 4 > MAX_TEXTURE_PIXELS) continue;
      const aspect = Math.abs(Math.log(candidate * width / (candidateRows * height)));
      if (aspect < bestAspect || (aspect === bestAspect && cells < bestCells)) {
        columns = candidate;
        bestAspect = aspect;
        bestCells = cells;
      }
    }
  }
  if (!columns) {
    throw new Error("This artwork is too large to export. Use smaller sprites, shorter GIFs, or fewer animated images.");
  }
  const rows = Math.max(1, Math.ceil(totalPositions / columns));
  if (columns < minimumColumns || columns * width * 2 > MAX_TEXTURE_EDGE
    || rows * height * 2 > MAX_TEXTURE_EDGE || columns * rows * width * height * 4 > MAX_TEXTURE_PIXELS) {
    throw new Error("This artwork is too large to export. Use smaller sprites, shorter GIFs, or fewer animated images.");
  }
  const outputs = [1, 2].map((scale) => ({
    ...createCanvas(columns * width * scale, rows * height * scale), scale,
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
        if (!frame) continue;
        if (native) {
          const image = frame as HTMLCanvasElement | HTMLImageElement;
          if (image.width > width || image.height > height) {
            throw new Error("The full sprite is larger than its export canvas. Upload the image again.");
          }
          const offsetX = Math.floor((width - image.width) / 2);
          const offsetY = Math.floor((height - image.height) / 2);
          context.drawImage(frame, (position.x * width + offsetX) * scale, (position.y * height + offsetY) * scale, image.width * scale, image.height * scale);
        } else {
          context.drawImage(frame, position.x * width * scale, position.y * height * scale, width * scale, height * scale);
        }
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
