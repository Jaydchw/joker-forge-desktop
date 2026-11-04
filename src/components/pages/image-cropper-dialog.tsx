import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowCounterClockwise,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
} from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/core/utils";
import {
  BALATRO_CARD_IMAGE_HEIGHT,
  BALATRO_CARD_IMAGE_WIDTH,
  loadImageElement,
} from "@/lib/media/image-processing-utils";
import {
  decodeGifDataUrl,
  encodeGif,
  isGifDataUrl,
  type DecodedGif,
} from "@/lib/media/gif-decoder";

type ImageCropperDialogProps = {
  open: boolean;
  imageSrc: string | null;
  decodedGif?: DecodedGif;
  onOpenChange: (open: boolean) => void;
  onApply: (dataUrl: string) => void;
};

type SourceImage = {
  element: HTMLImageElement | HTMLCanvasElement;
  width: number;
  height: number;
  animation?: DecodedGif;
};

type CropState = {
  zoom: number;
  offsetX: number;
  offsetY: number;
};

const PREVIEW_SCALE = 5;
const PREVIEW_WIDTH = BALATRO_CARD_IMAGE_WIDTH * PREVIEW_SCALE;
const PREVIEW_HEIGHT = BALATRO_CARD_IMAGE_HEIGHT * PREVIEW_SCALE;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.15;
const DEFAULT_CROP: CropState = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
};

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value));
};

const getCoverScale = (image: SourceImage) => {
  return Math.max(
    BALATRO_CARD_IMAGE_WIDTH / image.width,
    BALATRO_CARD_IMAGE_HEIGHT / image.height,
  );
};

const getRenderedSize = (image: SourceImage, zoom: number) => {
  const scale = getCoverScale(image) * zoom;
  return {
    width: image.width * scale,
    height: image.height * scale,
  };
};

const getOffsetBounds = (image: SourceImage, zoom: number) => {
  const rendered = getRenderedSize(image, zoom);
  return {
    x:
      rendered.width >= BALATRO_CARD_IMAGE_WIDTH
        ? (rendered.width - BALATRO_CARD_IMAGE_WIDTH) / 2
        : (BALATRO_CARD_IMAGE_WIDTH - rendered.width) / 2,
    y:
      rendered.height >= BALATRO_CARD_IMAGE_HEIGHT
        ? (rendered.height - BALATRO_CARD_IMAGE_HEIGHT) / 2
        : (BALATRO_CARD_IMAGE_HEIGHT - rendered.height) / 2,
  };
};

const normalizeCrop = (image: SourceImage, crop: CropState): CropState => {
  const bounds = getOffsetBounds(image, crop.zoom);
  return {
    zoom: clamp(crop.zoom, MIN_ZOOM, MAX_ZOOM),
    offsetX: clamp(crop.offsetX, -bounds.x, bounds.x),
    offsetY: clamp(crop.offsetY, -bounds.y, bounds.y),
  };
};

const drawCrop = (
  canvas: HTMLCanvasElement,
  source: SourceImage,
  crop: CropState,
): boolean => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  canvas.width = BALATRO_CARD_IMAGE_WIDTH;
  canvas.height = BALATRO_CARD_IMAGE_HEIGHT;
  const coverScale = getCoverScale(source) * crop.zoom;
  const drawWidth = source.width * coverScale;
  const drawHeight = source.height * coverScale;
  const drawX = BALATRO_CARD_IMAGE_WIDTH / 2 - drawWidth / 2 + crop.offsetX;
  const drawY = BALATRO_CARD_IMAGE_HEIGHT / 2 - drawHeight / 2 + crop.offsetY;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, BALATRO_CARD_IMAGE_WIDTH, BALATRO_CARD_IMAGE_HEIGHT);
  ctx.drawImage(source.element, drawX, drawY, drawWidth, drawHeight);
  return true;
};

const allowPaint = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export function ImageCropperDialog({
  open,
  imageSrc,
  decodedGif,
  onOpenChange,
  onApply,
}: ImageCropperDialogProps) {
  const [sourceImage, setSourceImage] = useState<SourceImage | null>(null);
  const [crop, setCrop] = useState<CropState>(DEFAULT_CROP);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRevisionRef = useRef(0);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{
    pointerX: number;
    pointerY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  useEffect(() => {
    const revision = ++requestRevisionRef.current;
    setSourceImage(null);
    setError(null);
    setIsApplying(false);
    setIsLoading(false);
    if (!open || !imageSrc) {
      setCrop(DEFAULT_CROP);
      return;
    }

    setIsLoading(true);
    void (async () => {
      await allowPaint();
      if (requestRevisionRef.current !== revision) return;
      const animation = decodedGif ?? (isGifDataUrl(imageSrc) ? decodeGifDataUrl(imageSrc) : undefined);
      let source: SourceImage;
      if (animation) {
        const element = document.createElement("canvas");
        element.width = animation.width;
        element.height = animation.height;
        const context = element.getContext("2d");
        if (!context) throw new Error("This image could not be prepared for cropping.");
        const imageData = context.createImageData(animation.width, animation.height);
        imageData.data.set(animation.frames[0].pixels);
        context.putImageData(imageData, 0, 0);
        source = { element, width: animation.width, height: animation.height, animation };
      } else {
        const element = await loadImageElement(imageSrc);
        source = { element, width: element.width, height: element.height };
      }
      if (requestRevisionRef.current !== revision) return;
      setSourceImage(source);
      setCrop(DEFAULT_CROP);
    })()
      .catch((loadError) => {
        if (requestRevisionRef.current !== revision) return;
        console.error("Failed to load image for cropping", loadError);
        setSourceImage(null);
        setError(loadError instanceof Error ? loadError.message : "This image could not be opened.");
      })
      .finally(() => {
        if (requestRevisionRef.current === revision) setIsLoading(false);
      });

    return () => {
      requestRevisionRef.current += 1;
    };
  }, [decodedGif, imageSrc, open]);

  const drawCroppedImage = useCallback(
    (canvas: HTMLCanvasElement): boolean => sourceImage ? drawCrop(canvas, sourceImage, crop) : false,
    [crop, sourceImage],
  );
  const drawCroppedImageRef = useRef(drawCroppedImage);
  useEffect(() => {
    drawCroppedImageRef.current = drawCroppedImage;
    if (previewCanvasRef.current) drawCroppedImage(previewCanvasRef.current);
  }, [drawCroppedImage]);

  useEffect(() => {
    if (!open || !sourceImage?.animation || !(sourceImage.element instanceof HTMLCanvasElement)) return;
    const { animation, element } = sourceImage;
    const context = element.getContext("2d");
    if (!context) return;
    const imageData = context.createImageData(animation.width, animation.height);
    const duration = animation.frames.reduce((sum, frame) => sum + frame.delayMs, 0);
    const passes = animation.loopCount === 0 ? Infinity : (animation.loopCount ?? 0) + 1;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let elapsed = 0;
    let lastTime = 0;
    let currentFrame = -1;
    let request = 0;
    let stopped = false;
    const renderFrame = (index: number) => {
      if (currentFrame === index) return;
      currentFrame = index;
      imageData.data.set(animation.frames[index].pixels);
      context.putImageData(imageData, 0, 0);
      if (previewCanvasRef.current) drawCroppedImageRef.current(previewCanvasRef.current);
    };
    const tick = (timestamp: number) => {
      if (stopped) return;
      if (lastTime) elapsed += timestamp - lastTime;
      lastTime = timestamp;
      if (elapsed >= duration * passes) {
        renderFrame(animation.frames.length - 1);
        return;
      }
      let at = elapsed % duration;
      let index = 0;
      while (index < animation.frames.length - 1 && at >= animation.frames[index].delayMs) {
        at -= animation.frames[index].delayMs;
        index += 1;
      }
      renderFrame(index);
      request = requestAnimationFrame(tick);
    };
    const updateAnimation = () => {
      cancelAnimationFrame(request);
      lastTime = 0;
      if (motion.matches) {
        elapsed = 0;
        renderFrame(0);
      } else if (!document.hidden && !stopped) {
        request = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", updateAnimation);
    motion.addEventListener("change", updateAnimation);
    updateAnimation();
    return () => {
      stopped = true;
      cancelAnimationFrame(request);
      document.removeEventListener("visibilitychange", updateAnimation);
      motion.removeEventListener("change", updateAnimation);
    };
  }, [open, sourceImage]);

  const updateCrop = useCallback(
    (nextCrop: CropState) => {
      if (!sourceImage) {
        setCrop(nextCrop);
        return;
      }
      setCrop(normalizeCrop(sourceImage, nextCrop));
    },
    [sourceImage],
  );

  const changeZoom = useCallback(
    (delta: number) => {
      updateCrop({
        ...crop,
        zoom: clamp(crop.zoom + delta, MIN_ZOOM, MAX_ZOOM),
      });
    },
    [crop, updateCrop],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!dragRef.current || isApplying) return;
      updateCrop({
        ...crop,
        offsetX:
          dragRef.current.offsetX +
          (event.clientX - dragRef.current.pointerX) / PREVIEW_SCALE,
        offsetY:
          dragRef.current.offsetY +
          (event.clientY - dragRef.current.pointerY) / PREVIEW_SCALE,
      });
    },
    [crop, isApplying, updateCrop],
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp, isDragging]);

  const handleApply = async () => {
    if (!sourceImage || isApplying) return;
    const revision = requestRevisionRef.current;
    setIsApplying(true);
    setError(null);
    try {
      await allowPaint();
      if (requestRevisionRef.current !== revision) return;
      const canvas = document.createElement("canvas");
      if (sourceImage.animation) {
        const animation = sourceImage.animation;
        const sourceCanvas = document.createElement("canvas");
        sourceCanvas.width = animation.width;
        sourceCanvas.height = animation.height;
        const sourceContext = sourceCanvas.getContext("2d");
        if (!sourceContext) throw new Error("This animation could not be cropped.");
        const sourceData = sourceContext.createImageData(animation.width, animation.height);
        const frames: DecodedGif["frames"] = [];
        for (let index = 0; index < animation.frames.length; index += 1) {
          const frame = animation.frames[index];
          sourceData.data.set(frame.pixels);
          sourceContext.putImageData(sourceData, 0, 0);
          if (!drawCrop(canvas, { ...sourceImage, element: sourceCanvas }, crop)) {
            throw new Error("This animation could not be cropped.");
          }
          const output = canvas.getContext("2d");
          if (!output) throw new Error("This animation could not be cropped.");
          frames.push({
            pixels: output.getImageData(0, 0, BALATRO_CARD_IMAGE_WIDTH, BALATRO_CARD_IMAGE_HEIGHT).data,
            delayMs: frame.delayMs,
          });
          if (index % 16 === 15) {
            await allowPaint();
            if (requestRevisionRef.current !== revision) return;
          }
        }
        const result = encodeGif({
          width: BALATRO_CARD_IMAGE_WIDTH,
          height: BALATRO_CARD_IMAGE_HEIGHT,
          frames,
          loopCount: animation.loopCount,
        });
        if (requestRevisionRef.current === revision) onApply(result);
      } else {
        if (!drawCroppedImage(canvas)) throw new Error("This image could not be cropped.");
        if (requestRevisionRef.current === revision) onApply(canvas.toDataURL("image/png"));
      }
    } catch (applyError) {
      if (requestRevisionRef.current === revision) {
        setError(applyError instanceof Error ? applyError.message : "This image could not be cropped.");
      }
    } finally {
      if (requestRevisionRef.current === revision) setIsApplying(false);
    }
  };

  const resetCrop = () => {
    setCrop(DEFAULT_CROP);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!isApplying) onOpenChange(nextOpen); }}>
      <DialogContent
        className="max-w-[calc(100vw-2rem)] border-0 bg-transparent p-0 shadow-none sm:max-w-3xl"
        showCloseButton={false}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <div className="flex min-h-[min(760px,calc(100vh-4rem))] flex-col items-center justify-center gap-6 p-8">
          <DialogHeader className="items-center gap-1 text-center">
            <DialogTitle className="text-2xl font-black tracking-tight">
              Crop Image
            </DialogTitle>
            {sourceImage?.animation && (
              <p className="text-xs text-muted-foreground">
                Animated GIF · {sourceImage.animation.frames.length} frames. This crop applies to every frame.
              </p>
            )}
          </DialogHeader>

          <div className="flex flex-1 items-center justify-center">
            <div
              className={cn(
                "relative overflow-hidden border-2 border-primary bg-black/90 shadow-[0_20px_80px_rgba(0,0,0,0.45)] touch-none",
                isDragging ? "cursor-grabbing" : "cursor-grab",
              )}
              style={{
                width: PREVIEW_WIDTH * 1.2,
                height: PREVIEW_HEIGHT * 1.2,
              }}
              onPointerDown={(event) => {
                if (!sourceImage || isApplying) return;
                dragRef.current = {
                  pointerX: event.clientX,
                  pointerY: event.clientY,
                  offsetX: crop.offsetX,
                  offsetY: crop.offsetY,
                };
                setIsDragging(true);
              }}
              onWheel={(event) => {
                event.preventDefault();
                if (!isApplying) changeZoom(event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
              }}
              >
              <canvas
                ref={previewCanvasRef}
                className="block size-full [image-rendering:pixelated]"
                width={BALATRO_CARD_IMAGE_WIDTH}
                height={BALATRO_CARD_IMAGE_HEIGHT}
              />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.16)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.16)_1px,transparent_1px)] bg-size-[25%_20%]" />
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 px-4 py-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="cursor-pointer rounded-full"
                onClick={() => changeZoom(-ZOOM_STEP)}
                disabled={!sourceImage || isApplying || crop.zoom <= MIN_ZOOM}
              >
                <MagnifyingGlassMinus className="h-4 w-4" />
              </Button>
              <span className="w-14 text-center font-mono text-xs text-muted-foreground">
                {Math.round(crop.zoom * 100)}%
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="cursor-pointer rounded-full"
                onClick={() => changeZoom(ZOOM_STEP)}
                disabled={!sourceImage || isApplying || crop.zoom >= MAX_ZOOM}
              >
                <MagnifyingGlassPlus className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="cursor-pointer rounded-full"
                onClick={resetCrop}
                disabled={!sourceImage || isApplying}
              >
                <ArrowCounterClockwise className="h-4 w-4" />
              </Button>
            </div>

          {(isLoading || isApplying) && (
            <p role="status" className="text-sm text-muted-foreground">
              {isApplying ? sourceImage?.animation ? "Cropping animation…" : "Cropping image…" : "Preparing image…"}
            </p>
          )}
          {error && <p role="alert" className="max-w-lg text-center text-sm text-destructive">{error}</p>}

          <DialogFooter className="w-full justify-center gap-3 sm:justify-center">
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer bg-background/70 backdrop-blur hover:bg-background"
              disabled={isApplying}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="cursor-pointer px-8 shadow-lg"
              disabled={!sourceImage || isApplying || isLoading}
              onClick={() => void handleApply()}
            >
              {isApplying ? "Applying…" : "Apply Crop"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
