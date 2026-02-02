import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const appWindow = getCurrentWindow();

  useEffect(() => {
    const checkMaximized = async () => {
      setIsMaximized(await appWindow.isMaximized());
    };

    checkMaximized();

    const unlisten = appWindow.listen("tauri://resize", checkMaximized);
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

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
        <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
          Joker Forge
        </span>
      </div>

      <div className="flex items-center h-full">
        <button
          onClick={() => appWindow.minimize()}
          className="h-full w-12 flex items-center justify-center hover:bg-accent hover:text-accent-foreground transition-colors focus:outline-none"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          onClick={() => appWindow.toggleMaximize()}
          className="h-full w-12 flex items-center justify-center hover:bg-accent hover:text-accent-foreground transition-colors focus:outline-none"
        >
          {isMaximized ? (
            <Copy className="h-3.5 w-3.5 rotate-90" />
          ) : (
            <Square className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          onClick={() => appWindow.close()}
          className="h-full w-12 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors focus:outline-none"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
