declare module "gifenc" {
  type Palette = number[][];
  type Format = "rgb565" | "rgb444" | "rgba4444";

  export function quantize(
    pixels: Uint8Array | Uint8ClampedArray,
    colors: number,
    options?: { format?: Format },
  ): Palette;

  export function applyPalette(
    pixels: Uint8Array | Uint8ClampedArray,
    palette: Palette,
    format?: Format,
  ): Uint8Array;

  export function GIFEncoder(): {
    writeFrame(indices: Uint8Array, width: number, height: number, options: {
      palette: Palette;
      delay?: number;
      repeat?: number;
      transparent?: boolean;
      transparentIndex?: number;
      dispose?: number;
    }): void;
    finish(): void;
    bytes(): Uint8Array;
  };
}
