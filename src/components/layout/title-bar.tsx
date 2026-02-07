import { useState, useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { getVersion } from "@tauri-apps/api/app";
import {
  Minus,
  Square,
  X,
  Copy,
  ArrowsOut,
  ArrowsIn,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useModName } from "@/lib/storage";

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [appVersion, setAppVersion] = useState("");
  const f11LockRef = useRef(false);
  const f11UnlockTimeoutRef = useRef<number | null>(null);
  const appWindow = getCurrentWindow();
  const modName = useModName();

  useEffect(() => {
    const init = async () => {
      try {
        setIsMaximized(await appWindow.isMaximized());
      } catch (e) {}
      try {
        setIsFullscreen(await appWindow.isFullscreen());
      } catch (e) {}
      try {
        const v = await getVersion();
        setAppVersion(v);
      } catch (e) {
        setAppVersion("2.0.0");
      }
    };

    init();

    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      try {
        unlisten = await appWindow.listen("tauri://resize", async () => {
          try {
            setIsMaximized(await appWindow.isMaximized());
          } catch (e) {}
          try {
            setIsFullscreen(await appWindow.isFullscreen());
          } catch (e) {}
        });
      } catch (e) {}
    };

    setupListener();

    const setupShortcut = async () => {
      try {
        await register("F11", async () => {
          if (f11LockRef.current) return;
          f11LockRef.current = true;
          if (f11UnlockTimeoutRef.current) {
            window.clearTimeout(f11UnlockTimeoutRef.current);
          }
          f11UnlockTimeoutRef.current = window.setTimeout(() => {
            f11LockRef.current = false;
            f11UnlockTimeoutRef.current = null;
          }, 250);
          try {
            const next = !(await appWindow.isFullscreen());
            await appWindow.setFullscreen(next);
            setIsFullscreen(next);
          } catch (e) {}
        });
      } catch (e) {}
    };

    setupShortcut();

    return () => {
      if (unlisten) unlisten();
      try {
        unregister("F11");
      } catch (e) {}
      if (f11UnlockTimeoutRef.current) {
        window.clearTimeout(f11UnlockTimeoutRef.current);
        f11UnlockTimeoutRef.current = null;
      }
      f11LockRef.current = false;
    };
  }, []);

  const handleMinimize = async () => {
    try {
      await appWindow.minimize();
    } catch (e) {}
  };

  const handleMaximize = async () => {
    try {
      await appWindow.toggleMaximize();
    } catch (e) {}
  };

  const handleFullscreen = async () => {
    try {
      const next = !isFullscreen;
      await appWindow.setFullscreen(next);
      setIsFullscreen(next);
    } catch (e) {}
  };

  const handleClose = async () => {
    try {
      await appWindow.close();
    } catch (e) {}
  };

  return (
    <div
      data-tauri-drag-region
      className={cn(
        "h-9 flex items-center justify-between fixed top-0 left-0 right-0 z-50",
        "bg-background/95 backdrop-blur-md border-b border-border",
        "select-none transition-colors duration-300",
      )}
    >
      <div
        className="flex items-center gap-2 px-4 pointer-events-none"
        data-tauri-drag-region
      >
        <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase flex items-center gap-1.5">
          Joker Forge
          <span className="bg-primary/10 text-primary px-1.5 rounded text-[10px] tracking-normal">
            v{appVersion}
          </span>
        </span>
      </div>

      <div
        className="absolute left-1/2 -translate-x-1/2 pointer-events-none flex items-center justify-center"
        data-tauri-drag-region
      >
        <span className="text-xs font-medium text-foreground/70">
          {modName}
        </span>
      </div>

      <div className="flex items-center h-full">
        <button
          onClick={handleFullscreen}
          className="h-full w-12 flex items-center justify-center hover:bg-accent hover:text-accent-foreground transition-colors focus:outline-none cursor-pointer"
        >
          {isFullscreen ? (
            <ArrowsIn className="h-4 w-4" weight="bold" />
          ) : (
            <ArrowsOut className="h-4 w-4" weight="bold" />
          )}
        </button>
        <button
          onClick={handleMinimize}
          className="h-full w-12 flex items-center justify-center hover:bg-accent hover:text-accent-foreground transition-colors focus:outline-none cursor-pointer"
        >
          <Minus className="h-4 w-4" weight="bold" />
        </button>
        <button
          onClick={handleMaximize}
          className="h-full w-12 flex items-center justify-center hover:bg-accent hover:text-accent-foreground transition-colors focus:outline-none cursor-pointer"
        >
          {isMaximized ? (
            <Copy className="h-3.5 w-3.5 rotate-90" weight="bold" />
          ) : (
            <Square className="h-3.5 w-3.5" weight="bold" />
          )}
        </button>
        <button
          onClick={handleClose}
          className="h-full w-12 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors focus:outline-none cursor-pointer"
        >
          <X className="h-4 w-4" weight="bold" />
        </button>
      </div>
    </div>
  );
}
