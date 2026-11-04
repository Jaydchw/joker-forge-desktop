import { decompressFrame } from "gifuct-js";
import { applyPalette, GIFEncoder, quantize } from "gifenc";

export type GifFrame = {
  pixels: Uint8ClampedArray;
  delayMs: number;
};

export type DecodedGif = {
  width: number;
  height: number;
  frames: GifFrame[];
  loopCount: number | null;
};

export const GIF_LIMITS = {
  bytes: 20 * 1024 * 1024,
  dimension: 2048,
  frames: 300,
  outputPixels: 32 * 1024 * 1024,
} as const;

type Color = [number, number, number];
type ImageFrame = Parameters<typeof decompressFrame>[0];
type GifPatch = {
  frame: ImageFrame;
  delayMs: number;
  disposal: number;
  transparent: boolean;
};

const invalidGif = () => new Error("This GIF is damaged or uses invalid image data. Try exporting it again.");

function validateDimensions(width: number, height: number, count: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw invalidGif();
  if (width > GIF_LIMITS.dimension || height > GIF_LIMITS.dimension) {
    throw new Error(`GIF dimensions must be ${GIF_LIMITS.dimension} pixels or smaller.`);
  }
  if (count > GIF_LIMITS.frames) throw new Error(`GIFs can contain up to ${GIF_LIMITS.frames} frames.`);
  if (width * height * count > GIF_LIMITS.outputPixels) {
    throw new Error("This GIF has too many decoded pixels. Reduce its dimensions or frame count.");
  }
}

function readGif(data: Uint8Array) {
  if (data.byteLength > GIF_LIMITS.bytes) throw new Error("GIF files must be 20 MB or smaller.");
  let offset = 0;
  const take = (length: number) => {
    if (offset + length > data.length) throw invalidGif();
    const result = data.subarray(offset, offset + length);
    offset += length;
    return result;
  };
  const byte = () => take(1)[0];
  const word = () => { const value = take(2); return value[0] | (value[1] << 8); };
  const text = (length: number) => String.fromCharCode(...take(length));
  const subBlocks = () => {
    const chunks: Uint8Array[] = [];
    let length = 0;
    for (let size = byte(); size; size = byte()) {
      chunks.push(take(size));
      length += size;
    }
    const output = new Uint8Array(length);
    let at = 0;
    for (const chunk of chunks) { output.set(chunk, at); at += chunk.length; }
    return output;
  };
  const palette = (packed: number): Color[] => {
    if (!(packed & 0x80)) return [];
    const count = 1 << ((packed & 7) + 1);
    const values = take(count * 3);
    return Array.from({ length: count }, (_, i) => [values[i * 3], values[i * 3 + 1], values[i * 3 + 2]]);
  };

  const signature = text(6);
  if (signature !== "GIF89a" && signature !== "GIF87a") throw invalidGif();
  const width = word();
  const height = word();
  validateDimensions(width, height, 0);
  const packed = byte();
  const backgroundIndex = byte();
  byte(); // Pixel aspect ratio does not change the source pixel grid.
  const colors = palette(packed);
  const patches: GifPatch[] = [];
  let loopCount: number | null = null;
  let control: { delay: number; disposal: number; transparent: boolean; index: number } | undefined;

  while (offset < data.length) {
    const block = byte();
    if (block === 0x3b) {
      if (!patches.length) throw new Error("This GIF does not contain any image frames.");
      return { width, height, colors, background: colors[backgroundIndex], patches, loopCount };
    }
    if (block === 0x21) {
      const label = byte();
      if (label === 0xf9) {
        if (byte() !== 4) throw invalidGif();
        const flags = byte();
        const delay = word();
        const index = byte();
        if (byte() !== 0) throw invalidGif();
        const disposal = (flags >> 2) & 7;
        if (disposal > 3) throw new Error("This GIF uses an unsupported frame disposal method.");
        control = { delay, disposal, transparent: Boolean(flags & 1), index };
      } else if (label === 0xff) {
        const application = text(byte());
        const value = subBlocks();
        if (application === "NETSCAPE2.0" || application === "ANIMEXTS1.0") {
          if (value.length < 3 || value[0] !== 1) throw invalidGif();
          loopCount = value[1] | (value[2] << 8);
        }
      } else if (label === 0x01) {
        throw new Error("GIF text frames are not supported. Export the animation as image frames.");
      } else {
        subBlocks();
      }
      continue;
    }
    if (block !== 0x2c) throw invalidGif();
    const left = word();
    const top = word();
    const frameWidth = word();
    const frameHeight = word();
    if (frameWidth < 1 || frameHeight < 1 || left + frameWidth > width || top + frameHeight > height) throw invalidGif();
    validateDimensions(width, height, patches.length + 1);
    const descriptor = byte();
    const localColors = palette(descriptor);
    if (!localColors.length && !colors.length) throw invalidGif();
    const minCodeSize = byte();
    if (minCodeSize < 2 || minCodeSize > 8) throw invalidGif();
    const blocks = subBlocks();
    if (!blocks.length) throw invalidGif();
    const settings = control ?? { delay: 0, disposal: 0, transparent: false, index: 0 };
    const frame = {
      gce: {
        byteSize: 4, codes: [0x21, 0xf9], delay: settings.delay, terminator: 0,
        transparentColorIndex: settings.index,
        extras: { userInput: false, transparentColorGiven: settings.transparent, future: 0, disposal: settings.disposal },
      },
      image: {
        code: 0x2c,
        descriptor: {
          top, left, width: frameWidth, height: frameHeight,
          lct: { exists: Boolean(descriptor & 0x80), interlaced: Boolean(descriptor & 0x40), future: 0, size: descriptor & 7, sort: Boolean(descriptor & 0x20) },
        },
        lct: localColors,
        data: { minCodeSize, blocks: blocks as unknown as number[] },
      },
    };
    patches.push({ frame, delayMs: settings.delay ? settings.delay * 10 : 100, disposal: settings.disposal, transparent: settings.transparent });
    control = undefined;
  }
  throw invalidGif();
}

export function decodeGif(buffer: ArrayBuffer): DecodedGif {
  const gif = readGif(new Uint8Array(buffer));
  let pixels = new Uint8ClampedArray(gif.width * gif.height * 4);
  const fill = (rect: { left: number; top: number; width: number; height: number }, transparent: boolean) => {
    const color = !transparent && gif.background ? [...gif.background, 255] : [0, 0, 0, 0];
    for (let y = rect.top; y < rect.top + rect.height; y++) {
      for (let x = rect.left; x < rect.left + rect.width; x++) pixels.set(color, (y * gif.width + x) * 4);
    }
  };
  fill({ left: 0, top: 0, width: gif.width, height: gif.height }, gif.patches[0].transparent);
  const frames: GifFrame[] = [];
  let previous: GifPatch | undefined;
  let restore: Uint8ClampedArray | undefined;
  for (const patch of gif.patches) {
    if (previous?.disposal === 2) fill(previous.frame.image.descriptor, previous.transparent);
    else if (previous?.disposal === 3 && restore) pixels = restore;
    restore = patch.disposal === 3 ? pixels.slice() : undefined;
    const decoded = decompressFrame(patch.frame, gif.colors, true);
    const { width, height, left, top } = decoded.dims;
    if (decoded.patch.length !== width * height * 4
      || decoded.pixels.some((index) => index >= decoded.colorTable.length && index !== decoded.transparentIndex)) throw invalidGif();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const source = (y * width + x) * 4;
        if (decoded.patch[source + 3]) {
          pixels.set(decoded.patch.subarray(source, source + 4), ((top + y) * gif.width + left + x) * 4);
        }
      }
    }
    frames.push({ pixels: pixels.slice(), delayMs: patch.delayMs });
    previous = patch;
  }
  return { width: gif.width, height: gif.height, frames, loopCount: gif.loopCount };
}

export function isGifDataUrl(source: string): boolean {
  const comma = source.indexOf(",");
  if (!source.startsWith("data:") || comma < 0) return false;
  try {
    const prefix = /;base64(?:;|$)/i.test(source.slice(0, comma))
      ? atob(source.slice(comma + 1, comma + 25).replace(/\s/g, "").slice(0, 8))
      : decodeURIComponent(source.slice(comma + 1, comma + 25)).slice(0, 6);
    return prefix.startsWith("GIF89a") || prefix.startsWith("GIF87a");
  } catch { return false; }
}

export function decodeGifDataUrl(source: string): DecodedGif {
  const comma = source.indexOf(",");
  if (!source.startsWith("data:") || comma < 0) throw invalidGif();
  const encoded = source.slice(comma + 1);
  const base64 = /;base64(?:;|$)/i.test(source.slice(0, comma));
  if (encoded.length > GIF_LIMITS.bytes * (base64 ? 4 / 3 : 3) + 4) throw new Error("GIF files must be 20 MB or smaller.");
  let raw: string;
  try { raw = base64 ? atob(encoded) : decodeURIComponent(encoded); }
  catch { throw invalidGif(); }
  const bytes = Uint8Array.from(raw, (value) => value.charCodeAt(0));
  return decodeGif(bytes.buffer);
}

export function encodeGif(animation: DecodedGif): string {
  const { width, height, frames, loopCount } = animation;
  validateDimensions(width, height, frames.length);
  if (!frames.length) throw new Error("The animation does not contain any frames.");
  if (loopCount !== null && (!Number.isInteger(loopCount) || loopCount < 0 || loopCount > 65535)) throw invalidGif();
  for (const frame of frames) {
    if (frame.pixels.length !== width * height * 4 || !Number.isFinite(frame.delayMs) || frame.delayMs <= 0 || frame.delayMs > 655350) throw invalidGif();
  }
  const hasTransparency = frames.some((frame) => {
    for (let i = 3; i < frame.pixels.length; i += 4) if (frame.pixels[i] < 128) return true;
    return false;
  });
  const encoder = GIFEncoder();
  for (const frame of frames) {
    const colors: Color[] = [];
    const colorIndices = new Map<number, number>();
    const maxColors = hasTransparency ? 255 : 256;
    let opaqueCount = 0;
    for (let i = 0; i < frame.pixels.length; i += 4) {
      if (frame.pixels[i + 3] < 128) continue;
      opaqueCount++;
      const key = (frame.pixels[i] << 16) | (frame.pixels[i + 1] << 8) | frame.pixels[i + 2];
      if (!colorIndices.has(key) && colors.length <= maxColors) {
        colorIndices.set(key, colors.length);
        colors.push([frame.pixels[i], frame.pixels[i + 1], frame.pixels[i + 2]]);
      }
    }
    let palette = colors;
    let indices = new Uint8Array(width * height);
    if (colors.length > maxColors) {
      const opaque = new Uint8ClampedArray(opaqueCount * 4);
      let at = 0;
      for (let i = 0; i < frame.pixels.length; i += 4) {
        if (frame.pixels[i + 3] >= 128) { opaque.set(frame.pixels.subarray(i, i + 4), at); opaque[at + 3] = 255; at += 4; }
      }
      palette = quantize(opaque, maxColors, { format: "rgb565" })
        .map((color): Color => [color[0], color[1], color[2]]);
      const source = frame.pixels.byteOffset || frame.pixels.byteLength !== frame.pixels.buffer.byteLength
        ? frame.pixels.slice() : frame.pixels;
      indices = applyPalette(source, palette, "rgb565");
    }
    const shift = hasTransparency ? 1 : 0;
    for (let i = 0; i < width * height; i++) {
      const p = i * 4;
      if (frame.pixels[p + 3] < 128) indices[i] = 0;
      else if (colors.length <= maxColors) {
        const key = (frame.pixels[p] << 16) | (frame.pixels[p + 1] << 8) | frame.pixels[p + 2];
        indices[i] = colorIndices.get(key)! + shift;
      } else indices[i] += shift;
    }
    if (hasTransparency) palette = [[0, 0, 0], ...palette];
    if (!palette.length) palette = [[0, 0, 0]];
    encoder.writeFrame(indices, width, height, {
      palette, delay: frame.delayMs, repeat: loopCount ?? -1,
      transparent: hasTransparency, transparentIndex: 0, dispose: 2,
    });
  }
  encoder.finish();
  const bytes = encoder.bytes();
  if (bytes.length > GIF_LIMITS.bytes) throw new Error("The processed GIF is larger than 20 MB. Reduce its dimensions or frame count.");
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 0x8000) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 0x8000)));
  return `data:image/gif;base64,${btoa(chunks.join(""))}`;
}
