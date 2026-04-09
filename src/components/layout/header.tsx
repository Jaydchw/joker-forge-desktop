import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  FloppyDisk,
  Upload,
  Export,
  Sun,
  Moon,
  Gear,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { ExportSuccessDialog } from "@/components/layout/export-success-dialog";
import { UnsupportedRulesDialog } from "@/components/layout/unsupported-rules-dialog";
import {
  getBalatroInstallPath,
  getExportDestinationMode,
  getSplitLocalizationExportEnabled,
  getThemePreference,
  setThemePreference,
  useProjectData,
} from "@/lib/storage";
import { serializeJokerforgeV2 } from "@/lib/jokerforge/exporter";
import {
  exportModRust,
  type ExportModRustResult,
} from "@/lib/rust-codegen-export";
import { join } from "@tauri-apps/api/path";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { getUnsupportedRuleParts } from "@/lib/export-compiler-support";
import {
  applyThemeFromStorage,
  subscribeThemeChanges,
} from "../../lib/theme-manager";

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  const location = useLocation();
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    getThemePreference(),
  );
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportModRustResult | null>(
    null,
  );
  const [unsupportedParts, setUnsupportedParts] = useState<string[]>([]);
  const [showUnsupportedDialog, setShowUnsupportedDialog] = useState(false);
  const { data } = useProjectData();

  useEffect(() => {
    setThemePreference(theme);
    applyThemeFromStorage();
  }, [theme]);

  useEffect(() => {
    return subscribeThemeChanges(() => {
      setTheme(getThemePreference());
    });
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
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
      case "/vanilla-reforged/jokers":
        return "Vanilla Jokers";
      case "/vanilla-reforged/consumables":
        return "Vanilla Consumables";
      case "/vanilla-reforged/boosters":
        return "Vanilla Boosters";
      case "/vanilla-reforged/enhancements":
        return "Vanilla Enhancements";
      case "/vanilla-reforged/seals":
        return "Vanilla Seals";
      case "/vanilla-reforged/editions":
        return "Vanilla Editions";
      case "/vanilla-reforged/vouchers":
        return "Vanilla Vouchers";
      case "/vanilla-reforged/decks":
        return "Vanilla Decks";
      case "/settings":
        return "Settings";
      default:
        return "Joker Forge";
    }
  };

  const displayTitle = title || getPageTitle(location.pathname);

  const doExport = async () => {
    try {
      setIsExporting(true);
      const result = await exportModRust(
        data.metadata as any,
        data.jokers as any,
        data.consumables as any,
        data.vouchers as any,
        data.decks as any,
        data.enhancements as any,
        data.seals as any,
        data.editions as any,
        {
          useLocalizationFile: getSplitLocalizationExportEnabled(),
          destinationMode: getExportDestinationMode(),
          balatroModsPath: getBalatroInstallPath(),
        },
      );

      const jokerforgeBundlePath = await join(
        result.modFolderPath,
        `${data.metadata.id || "jokerforge-export"}.jokerforge`,
      );
      await writeTextFile(jokerforgeBundlePath, serializeJokerforgeV2(data));

      setExportResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/not\s+implemented/i.test(message)) {
        window.alert(
          "Mod export failed: some selected rules are not implemented yet.",
        );
        return;
      }
      window.alert(`Mod export failed: ${message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportMod = async () => {
    if (isExporting) return;

    const unsupported = new Set<string>([
      ...data.jokers.flatMap((item) =>
        getUnsupportedRuleParts(item.rules, "joker"),
      ),
      ...data.consumables.flatMap((item) =>
        getUnsupportedRuleParts(item.rules, "consumable"),
      ),
      ...data.vouchers.flatMap((item) =>
        getUnsupportedRuleParts(item.rules, "voucher"),
      ),
      ...data.decks.flatMap((item) =>
        getUnsupportedRuleParts(item.rules, "deck"),
      ),
      ...data.enhancements.flatMap((item) =>
        getUnsupportedRuleParts(item.rules, "card"),
      ),
    ]);

    if (unsupported.size > 0) {
      setUnsupportedParts(Array.from(unsupported));
      setShowUnsupportedDialog(true);
      return;
    }

    await doExport();
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3 bg-background/95 backdrop-blur-md border-b border-border transition-colors duration-300">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold tracking-tight text-foreground/80 pl-2">
            {displayTitle}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
          >
            <Link to="/settings" aria-label="Open settings">
              <Gear className="h-5 w-5" weight="duotone" />
            </Link>
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
            onClick={handleExportMod}
            disabled={isExporting}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm cursor-pointer"
          >
            <Export className="mr-2 h-4 w-4" />
            {isExporting ? "Exporting..." : "Export Mod"}
          </Button>
        </div>
      </header>

      <ExportSuccessDialog
        open={!!exportResult}
        onOpenChange={(open) => {
          if (!open) setExportResult(null);
        }}
        modFolderPath={exportResult?.modFolderPath ?? ""}
        fileCount={exportResult?.fileCount ?? 0}
      />

      <UnsupportedRulesDialog
        open={showUnsupportedDialog}
        onOpenChange={setShowUnsupportedDialog}
        unsupportedParts={unsupportedParts}
        onExportAnyway={doExport}
      />
    </>
  );
}
