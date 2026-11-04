import { useLayoutEffect, useRef, useState } from "react";
import type { FullSpriteSize } from "@/lib/core/types";
import { cn } from "@/lib/core/utils";

function SpriteLayer({ source, size, alt }: { source: string; size: FullSpriteSize; alt: string }) {
  const [natural, setNatural] = useState<{ source: string; width: number; height: number }>();
  const loaded = natural?.source === source;
  return <img
    src={source}
    alt={alt}
    draggable="false"
    decoding="async"
    onLoad={(event) => setNatural({ source, width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
    className="absolute [image-rendering:pixelated]"
    style={{ width: loaded ? `${natural.width / size.width * 100}%` : undefined,
      height: loaded ? `${natural.height / size.height * 100}%` : undefined,
      left: loaded ? `${Math.floor((size.width - natural.width) / 2) / size.width * 100}%` : undefined,
      top: loaded ? `${Math.floor((size.height - natural.height) / 2) / size.height * 100}%` : undefined,
      visibility: loaded ? "visible" : "hidden", maxWidth: "none" }}
  />;
}

export function FullSpriteImage({ image, overlayImage, size, alt, className, fit: fitMode = "contain" }: {
  image: string;
  overlayImage?: string;
  size: FullSpriteSize;
  alt: string;
  className?: string;
  fit?: "contain" | "fill";
}) {
  const container = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(0);
  useLayoutEffect(() => {
    if (!container.current || fitMode === "fill") return;
    const element = container.current;
    const update = () => setFit(Math.min(element.clientWidth / size.width, element.clientHeight / size.height));
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [fitMode, size.width, size.height]);
  return <div ref={container} className={cn("relative flex items-center justify-center", className)}>
    <div className="relative shrink-0" style={fitMode === "fill" ? { width: "100%", height: "100%" } : { width: size.width * fit, height: size.height * fit }}>
      <SpriteLayer source={image} size={size} alt={alt} />
      {overlayImage && <SpriteLayer source={overlayImage} size={size} alt="" />}
    </div>
  </div>;
}
