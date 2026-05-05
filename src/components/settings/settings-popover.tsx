import { useEffect, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { open } from "@tauri-apps/plugin-dialog";
import {
  getExportDestinationMode,
  getConfirmDeleteEnabled,
  getBalatroAppdataPath,
  getBalatroGamePath,
  getJokerforgeExportAsJsonEnabled,
  getSplitLocalizationExportEnabled,
  resetProjectData,
  setBalatroAppdataPath,
  setBalatroGamePath,
  setConfirmDeleteEnabled,
  setExportDestinationMode,
  setJokerforgeExportAsJsonEnabled,
  setSplitLocalizationExportEnabled,
} from "@/lib/storage";
import { Gear, Monitor, FolderOpen } from "@phosphor-icons/react";

export function SettingsPopover() {
  const [scale, setScale] = useState("1");
  const [confirmDeletes, setConfirmDeletes] = useState(true);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [balatroAppdataPath, setBalatroAppdataPathState] = useState("");
  const [balatroGamePath, setBalatroGamePathState] = useState("");
  const [splitLocalizationExport, setSplitLocalizationExport] = useState(false);
  const [exportToBalatroMods, setExportToBalatroMods] = useState(false);
  const [exportJokerforgeAsJson, setExportJokerforgeAsJson] = useState(false);

  useEffect(() => {
    const storedScale = localStorage.getItem("app-ui-scale") || "1";
    setScale(storedScale);
    applyScale(storedScale);
    setConfirmDeletes(getConfirmDeleteEnabled());
    setBalatroAppdataPathState(getBalatroAppdataPath());
    setBalatroGamePathState(getBalatroGamePath());
    setSplitLocalizationExport(getSplitLocalizationExportEnabled());
    setExportToBalatroMods(getExportDestinationMode() === "balatro-mods");
    setExportJokerforgeAsJson(getJokerforgeExportAsJsonEnabled());
  }, []);

  const applyScale = (value: string) => {
    const root = document.documentElement;
    root.style.fontSize = `${parseFloat(value) * 16}px`;
    document.body.style.transform = "";
    document.body.style.width = "";
    document.body.style.height = "";
    document.body.style.transformOrigin = "";
  };

  const handleScaleChange = (value: string) => {
    setScale(value);
    localStorage.setItem("app-ui-scale", value);
    applyScale(value);
  };

  const handleConfirmToggle = (value: boolean) => {
    setConfirmDeletes(value);
    setConfirmDeleteEnabled(value);
  };

  const handleBalatroAppdataPathChange = (value: string) => {
    setBalatroAppdataPathState(value);
    setBalatroAppdataPath(value);
  };

  const handleBalatroGamePathChange = (value: string) => {
    setBalatroGamePathState(value);
    setBalatroGamePath(value);
  };

  const handleSplitLocalizationToggle = (value: boolean) => {
    setSplitLocalizationExport(value);
    setSplitLocalizationExportEnabled(value);
  };

  const handleExportDestinationToggle = (value: boolean) => {
    setExportToBalatroMods(value);
    setExportDestinationMode(value ? "balatro-mods" : "downloads");
  };

  const handleExportJokerforgeAsJsonToggle = (value: boolean) => {
    setExportJokerforgeAsJson(value);
    setJokerforgeExportAsJsonEnabled(value);
  };

  const handleBrowseBalatroAppdataPath = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Balatro AppData Folder",
    });
    if (typeof selected === "string") {
      handleBalatroAppdataPathChange(selected);
    }
  };

  const handleBrowseBalatroGamePath = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Balatro Game Folder",
    });
    if (typeof selected === "string") {
      handleBalatroGamePathChange(selected);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
        >
          <Gear className="h-5 w-5" weight="duotone" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96">
        <div className="grid gap-5">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Settings</h4>
            <p className="text-sm text-muted-foreground">
              Customize your application experience.
            </p>
          </div>
          <div className="grid gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Display
              </p>
              <div className="flex items-center justify-between">
                <Label htmlFor="ui-scale" className="flex items-center gap-2">
                  <Monitor className="h-4 w-4" />
                  UI Scaling
                </Label>
                <Select value={scale} onValueChange={handleScaleChange}>
                  <SelectTrigger id="ui-scale" className="w-35 h-9">
                    <SelectValue placeholder="Select scale" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.85">Small</SelectItem>
                    <SelectItem value="1">Medium</SelectItem>
                    <SelectItem value="1.25">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Safety
              </p>
              <div
                className="flex items-center justify-between cursor-pointer rounded-lg px-2 py-1 -mx-2"
                role="button"
                tabIndex={0}
                onClick={() => handleConfirmToggle(!confirmDeletes)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleConfirmToggle(!confirmDeletes);
                  }
                }}
              >
                <Label
                  htmlFor="confirm-deletes"
                  className="flex items-center gap-2"
                >
                  Confirm Deletes
                </Label>
                <Switch
                  id="confirm-deletes"
                  checked={confirmDeletes}
                  onCheckedChange={handleConfirmToggle}
                  className="cursor-pointer"
                  onClick={(event) => event.stopPropagation()}
                />
              </div>

              <div
                className="flex items-center justify-between cursor-pointer rounded-lg px-2 py-1 -mx-2"
                role="button"
                tabIndex={0}
                onClick={() =>
                  handleSplitLocalizationToggle(!splitLocalizationExport)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleSplitLocalizationToggle(!splitLocalizationExport);
                  }
                }}
              >
                <Label
                  htmlFor="split-localization-export"
                  className="flex items-center gap-2"
                >
                  Split Localization On Full Export
                </Label>
                <Switch
                  id="split-localization-export"
                  checked={splitLocalizationExport}
                  onCheckedChange={handleSplitLocalizationToggle}
                  className="cursor-pointer"
                  onClick={(event) => event.stopPropagation()}
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Paths
              </p>
              <p className="text-xs text-muted-foreground">
                AppData stores Mods; game folder stores Lovely `version.dll`.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  id="balatro-appdata-path"
                  value={balatroAppdataPath}
                  onChange={(event) =>
                    handleBalatroAppdataPathChange(event.target.value)
                  }
                  placeholder="C:\\Users\\<you>\\AppData\\Roaming\\Balatro"
                  className="h-9 text-xs font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 cursor-pointer"
                  onClick={handleBrowseBalatroAppdataPath}
                >
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="balatro-game-path"
                  value={balatroGamePath}
                  onChange={(event) =>
                    handleBalatroGamePathChange(event.target.value)
                  }
                  placeholder="D:\\SteamLibrary\\steamapps\\common\\Balatro"
                  className="h-9 text-xs font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 cursor-pointer"
                  onClick={handleBrowseBalatroGamePath}
                >
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </div>

              <div
                className="mt-2 flex items-center justify-between cursor-pointer rounded-lg px-2 py-1 -mx-2"
                role="button"
                tabIndex={0}
                onClick={() =>
                  handleExportDestinationToggle(!exportToBalatroMods)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleExportDestinationToggle(!exportToBalatroMods);
                  }
                }}
              >
                <div>
                  <Label
                    htmlFor="export-destination-toggle"
                    className="flex items-center gap-2"
                  >
                    Export To Balatro Mods Folder
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Off: Downloads folder. On: AppData Mods folder above.
                  </p>
                </div>
                <Switch
                  id="export-destination-toggle"
                  checked={exportToBalatroMods}
                  onCheckedChange={handleExportDestinationToggle}
                  className="cursor-pointer"
                  onClick={(event) => event.stopPropagation()}
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Import / Export
              </p>
              <div
                className="flex items-center justify-between cursor-pointer rounded-lg px-2 py-1 -mx-2"
                role="button"
                tabIndex={0}
                onClick={() =>
                  handleExportJokerforgeAsJsonToggle(!exportJokerforgeAsJson)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleExportJokerforgeAsJsonToggle(!exportJokerforgeAsJson);
                  }
                }}
              >
                <div>
                  <Label htmlFor="export-jokerforge-as-json">
                    Export .jokerforge As .json
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Off: .jokerforge (default). On: .json.
                  </p>
                </div>
                <Switch
                  id="export-jokerforge-as-json"
                  checked={exportJokerforgeAsJson}
                  onCheckedChange={handleExportJokerforgeAsJsonToggle}
                  className="cursor-pointer"
                  onClick={(event) => event.stopPropagation()}
                />
              </div>
            </div>

            <div className="space-y-2 border-t border-border/60 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Data
              </p>
              <Button
                variant="destructive"
                className="w-full cursor-pointer"
                onClick={() => setIsResetDialogOpen(true)}
              >
                Reset All Data
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
      <ConfirmDialog
        open={isResetDialogOpen}
        onOpenChange={setIsResetDialogOpen}
        title="Reset all project data?"
        description="This will permanently delete your saved project data and cannot be undone."
        confirmLabel="Reset Data"
        confirmVariant="destructive"
        onConfirm={() => {
          resetProjectData();
          setIsResetDialogOpen(false);
        }}
      />
    </Popover>
  );
}
