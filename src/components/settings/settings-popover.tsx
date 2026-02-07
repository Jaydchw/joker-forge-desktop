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
  getConfirmDeleteEnabled,
  getBalatroInstallPath,
  resetProjectData,
  setBalatroInstallPath,
  setConfirmDeleteEnabled,
} from "@/lib/storage";
import { Gear, Monitor, FolderOpen } from "@phosphor-icons/react";

export function SettingsPopover() {
  const [scale, setScale] = useState("1");
  const [confirmDeletes, setConfirmDeletes] = useState(true);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [balatroPath, setBalatroPath] = useState("");

  useEffect(() => {
    const storedScale = localStorage.getItem("app-ui-scale") || "1";
    setScale(storedScale);
    applyScale(storedScale);
    setConfirmDeletes(getConfirmDeleteEnabled());
    setBalatroPath(getBalatroInstallPath());
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

  const handleBalatroPathChange = (value: string) => {
    setBalatroPath(value);
    setBalatroInstallPath(value);
  };

  const handleBrowseBalatroPath = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Balatro Install Folder",
    });
    if (typeof selected === "string") {
      handleBalatroPathChange(selected);
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
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Paths
              </p>
              <p className="text-xs text-muted-foreground">
                This is the Balatro AppData folder (Roaming).
              </p>
              <div className="flex items-center gap-2">
                <Input
                  id="balatro-path"
                  value={balatroPath}
                  onChange={(event) =>
                    handleBalatroPathChange(event.target.value)
                  }
                  placeholder="C:\\Users\\Jayd\\AppData\\Roaming\\Balatro"
                  className="h-9 text-xs font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 cursor-pointer"
                  onClick={handleBrowseBalatroPath}
                >
                  <FolderOpen className="h-4 w-4" />
                </Button>
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
