import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DownloadSimple, Minus, Plus, X } from "@phosphor-icons/react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { downloadDir, join } from "@tauri-apps/api/path";
import { toPng } from "html-to-image";

interface ItemShowcaseDialogProps {
  open: boolean;
  title: string;
  fileNameBase: string;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export function ItemShowcaseDialog({
  open,
  title,
  fileNameBase,
  onOpenChange,
  children,
}: ItemShowcaseDialogProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const showcaseRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    active: boolean;
    pointerId: number | null;
    lastX: number;
    lastY: number;
  }>({
    active: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,
  });

  useEffect(() => {
    if (open) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setIsDragging(false);
      dragStateRef.current = {
        active: false,
        pointerId: null,
        lastX: 0,
        lastY: 0,
      };
    }
  }, [open, fileNameBase]);

  const clampZoom = (value: number) => Math.min(2.5, Math.max(0.6, value));

  const handleZoomOut = () => setZoom((prev) => clampZoom(prev - 0.1));
  const handleZoomIn = () => setZoom((prev) => clampZoom(prev + 0.1));

  const handleWheelZoom = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    setZoom((prev) => clampZoom(prev + direction * 0.1));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    dragStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState.active || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.lastX;
    const deltaY = event.clientY - dragState.lastY;

    dragStateRef.current.lastX = event.clientX;
    dragStateRef.current.lastY = event.clientY;

    setPan((prev) => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (dragState.pointerId === event.pointerId) {
      dragStateRef.current = {
        active: false,
        pointerId: null,
        lastX: 0,
        lastY: 0,
      };
      setIsDragging(false);
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleDownload = async () => {
    if (!showcaseRef.current) return;

    try {
      const filename = `${fileNameBase.replace(/[^a-z0-9]/gi, "_")}_showcase.png`;
      const dataUrl = await toPng(showcaseRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: "#1a1a2e",
        cacheBust: true,
      });

      try {
        const downloadsPath = await downloadDir();
        const defaultPath = await join(downloadsPath, filename);
        const target = await save({
          title: "Save Showcase Image",
          defaultPath,
          filters: [{ name: "PNG Image", extensions: ["png"] }],
        });

        if (!target || typeof target !== "string") {
          return;
        }

        const finalPath = target.toLowerCase().endsWith(".png")
          ? target
          : `${target}.png`;
        const imageBytes = new Uint8Array(
          await (await fetch(dataUrl)).arrayBuffer(),
        );
        await writeFile(finalPath, imageBytes);
      } catch {
        const link = document.createElement("a");
        link.download = filename;
        link.href = dataUrl;
        link.click();
      }
    } catch (error) {
      console.error("Failed to download showcase image:", error);
      window.alert("Failed to save image. Please try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="h-[90vh] w-[49vw]! max-w-none! overflow-hidden border-border/60 bg-card p-0"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
            <div>
              <h2 className="text-base font-semibold text-foreground sm:text-lg">
                {title}
              </h2>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Showcase preview
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="cursor-pointer"
                onClick={handleZoomOut}
                aria-label="Zoom out"
              >
                <Minus weight="bold" />
              </Button>
              <span className="min-w-14 text-center text-xs font-medium text-muted-foreground">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="secondary"
                size="sm"
                className="cursor-pointer"
                onClick={handleZoomIn}
                aria-label="Zoom in"
              >
                <Plus weight="bold" />
              </Button>

              <Button
                variant="secondary"
                size="sm"
                className="cursor-pointer"
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
              >
                Reset
              </Button>

              <Button
                variant="default"
                size="sm"
                className="cursor-pointer"
                onClick={handleDownload}
              >
                <DownloadSimple weight="bold" />
                Save Image
              </Button>

              <Button
                variant="ghost"
                size="icon-sm"
                className="cursor-pointer"
                onClick={() => onOpenChange(false)}
                aria-label="Close showcase"
              >
                <X weight="bold" />
              </Button>
            </div>
          </div>

          <div
            ref={showcaseRef}
            className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-8 sm:px-10"
            onWheel={handleWheelZoom}
            style={{
              backgroundImage: "url('/images/background.jpg')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              backgroundColor: "#1a1a2e",
            }}
          >
            <div className="absolute inset-0 bg-black/45" />

            <p className="absolute top-3 left-4 z-10 text-[11px] font-semibold tracking-wide text-white/85">
              made with jokerforge.jaydchw.com
            </p>

            <div
              className={`showcase-cost-theme relative z-10 flex items-center justify-center touch-none select-none ${
                isDragging
                  ? "cursor-grabbing"
                  : "cursor-grab transition-transform duration-150"
              }`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "center",
              }}
            >
              {children}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
