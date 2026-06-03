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

type ImageCropperDialogProps = {
  open: boolean;
  imageSrc: string | null;
  onOpenChange: (open: boolean) => void;
  onApply: (dataUrl: string) => void;
};

type SourceImage = {
  element: HTMLImageElement;
  width: number;
  height: number;
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

export function ImageCropperDialog({
  open,
  imageSrc,
  onOpenChange,
  onApply,
}: ImageCropperDialogProps) {
  const [sourceImage, setSourceImage] = useState<SourceImage | null>(null);
  const [crop, setCrop] = useState<CropState>(DEFAULT_CROP);
  const [isDragging, setIsDragging] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{
    pointerX: number;
    pointerY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  useEffect(() => {
    if (!open || !imageSrc) {
      setSourceImage(null);
      setCrop(DEFAULT_CROP);
      return;
    }

    let isMounted = true;
    void loadImageElement(imageSrc)
      .then((element) => {
        if (!isMounted) return;
        setSourceImage({
          element,
          width: element.width,
          height: element.height,
        });
        setCrop(DEFAULT_CROP);
      })
      .catch((error) => {
        console.error("Failed to load image for cropping", error);
        if (isMounted) {
          setSourceImage(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [imageSrc, open]);

  const drawCroppedImage = useCallback(
    (canvas: HTMLCanvasElement): boolean => {
      if (!sourceImage) return false;
      const ctx = canvas.getContext("2d");
      if (!ctx) return false;

      canvas.width = BALATRO_CARD_IMAGE_WIDTH;
      canvas.height = BALATRO_CARD_IMAGE_HEIGHT;

      const coverScale = getCoverScale(sourceImage) * crop.zoom;
      const drawWidth = sourceImage.width * coverScale;
      const drawHeight = sourceImage.height * coverScale;
      const drawX =
        BALATRO_CARD_IMAGE_WIDTH / 2 - drawWidth / 2 + crop.offsetX;
      const drawY =
        BALATRO_CARD_IMAGE_HEIGHT / 2 - drawHeight / 2 + crop.offsetY;

      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, BALATRO_CARD_IMAGE_WIDTH, BALATRO_CARD_IMAGE_HEIGHT);
      ctx.drawImage(sourceImage.element, drawX, drawY, drawWidth, drawHeight);
      return true;
    },
    [crop.offsetX, crop.offsetY, crop.zoom, sourceImage],
  );

  useEffect(() => {
    if (!previewCanvasRef.current) return;
    drawCroppedImage(previewCanvasRef.current);
  }, [drawCroppedImage]);

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
      if (!dragRef.current) return;
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
    [crop, updateCrop],
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

  const handleApply = () => {
    if (!sourceImage) return;

    const canvas = document.createElement("canvas");
    if (!drawCroppedImage(canvas)) return;
    onApply(canvas.toDataURL("image/png"));
  };

  const resetCrop = () => {
    setCrop(DEFAULT_CROP);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                if (!sourceImage) return;
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
                changeZoom(event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
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
                disabled={!sourceImage || crop.zoom <= MIN_ZOOM}
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
                disabled={!sourceImage || crop.zoom >= MAX_ZOOM}
              >
                <MagnifyingGlassPlus className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="cursor-pointer rounded-full"
                onClick={resetCrop}
                disabled={!sourceImage}
              >
                <ArrowCounterClockwise className="h-4 w-4" />
              </Button>
            </div>

          <DialogFooter className="w-full justify-center gap-3 sm:justify-center">
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer bg-background/70 backdrop-blur hover:bg-background"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="cursor-pointer px-8 shadow-lg"
              disabled={!sourceImage}
              onClick={handleApply}
            >
              Apply Crop
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
