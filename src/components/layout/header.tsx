import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { FloppyDisk, Upload, Export, Sun, Moon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { SettingsPopover } from "@/components/settings/settings-popover";

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  const location = useLocation();
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

  const getPageTitle = (pathname: string) => {
    switch (pathname) {
      case "/":
        return "Overview";
      case "/metadata":
        return "Mod Metadata";
      case "/jokers":
        return "Jokers";
      case "/consumables":
        return "Consumables";
      case "/vouchers":
        return "Vouchers";
      case "/decks":
        return "Decks";
      case "/enhancements":
        return "Enhancements";
      case "/seals":
        return "Seals";
      case "/editions":
        return "Editions";
      case "/boosters":
        return "Boosters";
      case "/sounds":
        return "Sounds";
      default:
        return "Joker Forge";
    }
  };

  const displayTitle = title || getPageTitle(location.pathname);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3 bg-background/95 backdrop-blur-md border-b border-border transition-colors duration-300">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold tracking-tight text-foreground/80 pl-2">
          {displayTitle}
        </h2>
      </div>

      <div className="flex items-center gap-2">
        <SettingsPopover />
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
