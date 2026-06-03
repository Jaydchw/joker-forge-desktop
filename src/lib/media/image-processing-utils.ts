export const BALATRO_CARD_IMAGE_WIDTH = 71;
export const BALATRO_CARD_IMAGE_HEIGHT = 95;
export const BALATRO_CARD_IMAGE_OUTPUT_SCALE = 2;
export const BALATRO_CARD_IMAGE_OUTPUT_WIDTH =
  BALATRO_CARD_IMAGE_WIDTH * BALATRO_CARD_IMAGE_OUTPUT_SCALE;
export const BALATRO_CARD_IMAGE_OUTPUT_HEIGHT =
  BALATRO_CARD_IMAGE_HEIGHT * BALATRO_CARD_IMAGE_OUTPUT_SCALE;

export type LoadedImageDimensions = {
  width: number;
  height: number;
};

export const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result;
      if (typeof src !== "string") {
        reject(new Error("Failed to read image file"));
        return;
      }
      resolve(src);
    };
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
};

export const loadImageElement = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
};

export const getImageDimensions = async (
  src: string,
): Promise<LoadedImageDimensions> => {
  const img = await loadImageElement(src);
  return {
    width: img.width,
    height: img.height,
  };
};

export const isBalatroCardAspectRatio = (
  dimensions: LoadedImageDimensions,
) => {
  return (
    dimensions.width * BALATRO_CARD_IMAGE_HEIGHT ===
    dimensions.height * BALATRO_CARD_IMAGE_WIDTH
  );
};

export const isBalatroCardImageSize = (dimensions: LoadedImageDimensions) => {
  return (
    dimensions.width === BALATRO_CARD_IMAGE_WIDTH &&
    dimensions.height === BALATRO_CARD_IMAGE_HEIGHT
  );
};

export const normalizeBalatroCardImageSource = async (
  src: string,
): Promise<string> => {
  const img = await loadImageElement(src);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = BALATRO_CARD_IMAGE_WIDTH;
  canvas.height = BALATRO_CARD_IMAGE_HEIGHT;

  if (!ctx) {
    throw new Error("Canvas context failed");
  }

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    img,
    0,
    0,
    BALATRO_CARD_IMAGE_WIDTH,
    BALATRO_CARD_IMAGE_HEIGHT,
  );
  return canvas.toDataURL("image/png");
};

export const processBalatroCardImage = async (file: File): Promise<string> => {
  const src = await readFileAsDataUrl(file);
  const dimensions = await getImageDimensions(src);

  if (!isBalatroCardImageSize(dimensions)) {
    return src;
  }

  return normalizeBalatroCardImageSource(src);
};
