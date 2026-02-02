import { useState, useEffect } from "react";
import {
  FloppyDisk,
  Upload,
  Export,
  Sun,
  Moon,
  Gear,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  title?: string;
}

export function Header({ title = "Joker Forge" }: HeaderProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(isDark ? "dark" : "light");
    if (isDark) {
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3 bg-background/95 backdrop-blur-md border-b border-border transition-colors duration-300">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold tracking-tight text-foreground/80 pl-2">
          {title}
        </h2>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
        >
          <Gear className="h-5 w-5" weight="duotone" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="text-muted-foreground hover:text-foreground hover:bg-accent mr-2 cursor-pointer"
        >
          {theme === "light" ? (
            <Sun className="h-5 w-5" weight="duotone" />
          ) : (
            <Moon className="h-5 w-5" weight="duotone" />
          )}
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
        >
          <FloppyDisk className="mr-2 h-4 w-4" />
          Save
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
        >
          <Upload className="mr-2 h-4 w-4" />
          Load
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button
          size="sm"
          className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm cursor-pointer"
        >
          <Export className="mr-2 h-4 w-4" />
          Export Mod
        </Button>
      </div>
    </header>
  );
}
