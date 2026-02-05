import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getVersion } from "@tauri-apps/api/app";
import { Minus, Square, X, Copy } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useModName } from "@/lib/storage";

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [appVersion, setAppVersion] = useState("");
  const appWindow = getCurrentWindow();
  const modName = useModName();

  useEffect(() => {
    const init = async () => {
      try {
        setIsMaximized(await appWindow.isMaximized());
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
        });
      } catch (e) {}
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
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
