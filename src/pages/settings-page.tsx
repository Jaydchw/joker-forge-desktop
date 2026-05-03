import { useEffect, useMemo, useState } from "react";
import {
  FolderOpen,
  Gear,
  Moon,
  Palette,
  Sun,
  Trash,
  UploadSimple,
  DownloadSimple,
} from "@phosphor-icons/react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GenericDialogColorPicker } from "@/components/ui/generic-dialog-color-picker";
import { ThemeEditorDialog } from "@/components/theme/theme-editor-dialog";
import { invoke } from "@tauri-apps/api/core";
import {
  getBalatroInstallPath,
  getConfirmDeleteEnabled,
  getExportDestinationMode,
  getJokerforgeExportAsJsonEnabled,
  getSplitLocalizationExportEnabled,
  getThemePreference,
  resetProjectData,
  setBalatroInstallPath,
  setConfirmDeleteEnabled,
  setExportDestinationMode,
  setJokerforgeExportAsJsonEnabled,
  setSplitLocalizationExportEnabled,
  setThemePreference,
  type ThemePreference,
} from "@/lib/storage";
import {
  THEME_FONT_OPTIONS,
  THEME_VARIABLE_GROUPS,
  applyThemeFromStorage,
  createThemeFromBase,
  createThemeFromImported,
  deleteTheme,
  getActiveThemeId,
  getBuiltInTheme,
  getThemeLibrary,
  parseThemeFilePayload,
  resetThemeDefaults,
  setActiveThemeId,
  subscribeThemeChanges,
  toThemeFilePayload,
  updateTheme,
  type AppThemeDefinition,
  type ThemeFontFamily,
  type ThemeVariable,
} from "../lib/theme-manager";

const cloneTheme = (theme: AppThemeDefinition): AppThemeDefinition => ({
  ...theme,
  light: { ...theme.light },
  dark: { ...theme.dark },
  ui: { ...theme.ui },
});

const sanitizeFileName = (value: string) =>
  (value || "theme").replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "") ||
  "theme";

export default function SettingsPage() {
  const [confirmDeletes, setConfirmDeletes] = useState(true);
  const [balatroPath, setBalatroPath] = useState("");
  const [splitLocalizationExport, setSplitLocalizationExport] = useState(false);
  const [exportToBalatroMods, setExportToBalatroMods] = useState(false);
  const [exportJokerforgeAsJson, setExportJokerforgeAsJson] = useState(false);
  const [isResetDataDialogOpen, setIsResetDataDialogOpen] = useState(false);
  const [isResetThemesDialogOpen, setIsResetThemesDialogOpen] = useState(false);
  const [isThemeEditorOpen, setIsThemeEditorOpen] = useState(false);

  const [themeMode, setThemeMode] = useState<ThemePreference>("dark");
  const [themeEditorMode, setThemeEditorMode] =
    useState<ThemePreference>("dark");
  const [fontSearch, setFontSearch] = useState("");
  const [pendingFontScale, setPendingFontScale] = useState<number | null>(null);
  const [themes, setThemes] = useState<AppThemeDefinition[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState("");
  const [draftTheme, setDraftTheme] = useState<AppThemeDefinition | null>(null);

  const refreshThemes = (preferredThemeId?: string) => {
    const available = getThemeLibrary();
    const activeId = getActiveThemeId();
    const fallback = available[0]?.id || getBuiltInTheme().id;
    const targetId = preferredThemeId || selectedThemeId || activeId;
    const resolved = available.some((item) => item.id === targetId)
      ? targetId
      : fallback;

    setThemes(available);
    setSelectedThemeId(resolved);
    const selected =
      available.find((item) => item.id === resolved) || available[0];
    setDraftTheme(selected ? cloneTheme(selected) : null);
  };

  useEffect(() => {
    setConfirmDeletes(getConfirmDeleteEnabled());
    setBalatroPath(getBalatroInstallPath());
    setSplitLocalizationExport(getSplitLocalizationExportEnabled());
    setExportToBalatroMods(getExportDestinationMode() === "balatro-mods");
    setExportJokerforgeAsJson(getJokerforgeExportAsJsonEnabled());
    setThemeMode(getThemePreference());
    setThemeEditorMode(getThemePreference());
    refreshThemes();

    return subscribeThemeChanges(() => {
      setThemeMode(getThemePreference());
      refreshThemes(selectedThemeId);
    });
  }, [selectedThemeId]);

  const selectedTheme = useMemo(
    () => themes.find((item) => item.id === selectedThemeId) || null,
    [selectedThemeId, themes],
  );

  const filteredFontOptions = useMemo(() => {
    const query = fontSearch.trim().toLowerCase();
    if (!query) return THEME_FONT_OPTIONS;
    return THEME_FONT_OPTIONS.filter((option) =>
      option.label.toLowerCase().includes(query),
    );
  }, [fontSearch]);

  useEffect(() => {
    if (!draftTheme) return;
    setPendingFontScale(draftTheme.ui.fontScale);
  }, [draftTheme?.id, draftTheme?.ui.fontScale]);

  const handleBrowseBalatroPath = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Balatro Install Folder",
    });
    if (typeof selected === "string") {
      setBalatroPath(selected);
      setBalatroInstallPath(selected);
    }
  };

  const handleModeChange = (mode: ThemePreference) => {
    setThemeMode(mode);
    setThemePreference(mode);
    applyThemeFromStorage();
  };

  const handleThemeSelect = (themeId: string) => {
    setActiveThemeId(themeId);
    setSelectedThemeId(themeId);
    const found = themes.find((item) => item.id === themeId);
    setDraftTheme(found ? cloneTheme(found) : null);
  };

  const ensureEditableTheme = (
    baseTheme: AppThemeDefinition,
  ): AppThemeDefinition => {
    if (!selectedTheme?.builtIn && !baseTheme.builtIn) {
      return baseTheme;
    }

    const created = createThemeFromImported({
      name: `Copy of ${baseTheme.name}`,
      light: { ...baseTheme.light },
      dark: { ...baseTheme.dark },
      ui: { ...baseTheme.ui },
    });

    setActiveThemeId(created.id);
    refreshThemes(created.id);
    setSelectedThemeId(created.id);
    setDraftTheme(cloneTheme(created));
    return created;
  };

  const handleDraftNameChange = (name: string) => {
    if (!draftTheme) return;

    const editable = ensureEditableTheme(draftTheme);
    const saved = updateTheme({
      ...editable,
      name,
      builtIn: false,
    });

    refreshThemes(saved.id);
    setDraftTheme(cloneTheme(saved));
  };

  const updateDraftColor = (key: ThemeVariable, value: string) => {
    if (!draftTheme) return;
    const editable = ensureEditableTheme(draftTheme);

    const next: AppThemeDefinition =
      themeEditorMode === "light"
        ? {
            ...editable,
            light: {
              ...editable.light,
              [key]: value,
            },
          }
        : {
            ...editable,
            dark: {
              ...editable.dark,
              [key]: value,
            },
          };

    const saved = updateTheme({
      ...next,
      builtIn: false,
    });

    refreshThemes(saved.id);
    setDraftTheme(cloneTheme(saved));
  };

  const updateDraftUi = (
    key: "fontScale" | "radiusPx" | "fontFamily",
    value: number | ThemeFontFamily,
  ) => {
    if (!draftTheme) return;

    const editable = ensureEditableTheme(draftTheme);
    const saved = updateTheme({
      ...editable,
      ui: {
        ...editable.ui,
        [key]: value,
      },
      builtIn: false,
    });

    refreshThemes(saved.id);
    setDraftTheme(cloneTheme(saved));
  };

  const handleCreateThemeFromCurrent = () => {
    const base = draftTheme || selectedTheme || getBuiltInTheme();
    const created = createThemeFromBase(`Copy of ${base.name}`, base);
    refreshThemes(created.id);
    setSelectedThemeId(created.id);
    setDraftTheme(cloneTheme(created));
    setIsThemeEditorOpen(true);
  };

  const handleDeleteSelectedTheme = () => {
    if (!selectedTheme || selectedTheme.builtIn) return;
    deleteTheme(selectedTheme.id);
    refreshThemes();
  };

  const handleExportTheme = async () => {
    if (!draftTheme) return;
    const target = await save({
      title: "Export Theme",
      defaultPath: `${sanitizeFileName(draftTheme.name)}.jftheme`,
      filters: [{ name: "Joker Forge Theme", extensions: ["jftheme"] }],
    });

    if (!target) return;

    await writeTextFile(
      target,
      JSON.stringify(toThemeFilePayload(draftTheme), null, 2),
    );
  };

  const handleImportTheme = async () => {
    const selected = await open({
      title: "Import Theme",
      multiple: false,
      filters: [{ name: "Joker Forge Theme", extensions: ["jftheme"] }],
    });

    if (typeof selected !== "string") return;

    try {
      const raw = await readTextFile(selected);
      const parsed = parseThemeFilePayload(JSON.parse(raw));
      if (!parsed) {
        window.alert("That file is not a valid .jftheme file.");
        return;
      }

      const imported = createThemeFromImported(parsed);
      setActiveThemeId(imported.id);
      refreshThemes(imported.id);
      setSelectedThemeId(imported.id);
      setDraftTheme(cloneTheme(imported));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      window.alert(`Theme import failed: ${message}`);
    }
  };

  const handleResetThemes = () => {
    resetThemeDefaults();
    setThemeMode(getThemePreference());
    setThemeEditorMode(getThemePreference());
    refreshThemes(getBuiltInTheme().id);
  };

  const editorPalette =
    draftTheme && themeEditorMode === "light"
      ? draftTheme.light
      : draftTheme?.dark;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="rounded-xl bg-card/70 p-6">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Gear className="h-5 w-5" />
          Settings
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          App behavior, export options, and a full custom theme editor.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[400px_minmax(0,1fr)] items-start">
        <section className="space-y-6">
          <div className="rounded-xl bg-card/70 p-5 divide-y divide-border/60">
            <div className="pb-4">
              <h3 className="font-semibold">General</h3>
            </div>

            <div className="space-y-2 pt-4">
              <div className="flex items-center justify-between py-2">
                <Label htmlFor="confirm-deletes">Confirm Deletes</Label>
                <Switch
                  id="confirm-deletes"
                  checked={confirmDeletes}
                  onCheckedChange={(value) => {
                    setConfirmDeletes(value);
                    setConfirmDeleteEnabled(value);
                  }}
                  className="cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <Label htmlFor="split-localization-export">
                    Split Localization On Full Export
                  </Label>
                </div>
                <Switch
                  id="split-localization-export"
                  checked={splitLocalizationExport}
                  onCheckedChange={(value) => {
                    setSplitLocalizationExport(value);
                    setSplitLocalizationExportEnabled(value);
                  }}
                  className="cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <Label htmlFor="export-jokerforge-as-json">
                    Export .jokerforge As .json
                  </Label>
                </div>
                <Switch
                  id="export-jokerforge-as-json"
                  checked={exportJokerforgeAsJson}
                  onCheckedChange={(value) => {
                    setExportJokerforgeAsJson(value);
                    setJokerforgeExportAsJsonEnabled(value);
                  }}
                  className="cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-card/70 p-5 divide-y divide-border/60">
            <div className="pb-4">
              <h3 className="font-semibold">Balatro Path</h3>
            </div>

            <div className="pt-4 space-y-4">
              <div className="flex items-center gap-2">
                <Input
                  value={balatroPath}
                  onChange={(event) => {
                    const next = event.target.value;
                    setBalatroPath(next);
                    setBalatroInstallPath(next);
                  }}
                  placeholder="C:\\Users\\Jayd\\AppData\\Roaming\\Balatro\\mods"
                  className="h-9 font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 cursor-pointer"
                  onClick={handleBrowseBalatroPath}
                >
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <Label htmlFor="export-destination-toggle">
                    Export To Balatro Mods Folder
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Off: Downloads folder. On: Balatro mods folder above.
                  </p>
                </div>
                <Switch
                  id="export-destination-toggle"
                  checked={exportToBalatroMods}
                  onCheckedChange={(value) => {
                    setExportToBalatroMods(value);
                    setExportDestinationMode(
                      value ? "balatro-mods" : "downloads",
                    );
                  }}
                  className="cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-card/70 p-5 divide-y divide-border/60">
            <div className="pb-4">
              <h3 className="font-semibold">Data</h3>
            </div>
            <div className="pt-4">
              <Button
                variant="destructive"
                className="w-full cursor-pointer"
                onClick={() => setIsResetDataDialogOpen(true)}
              >
                Reset All Project Data
              </Button>
            </div>
          </div>

        </section>

        <section className="rounded-xl bg-card/70 p-5 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Theme Studio
              </h3>
              <p className="text-sm text-muted-foreground">
                Create and manage custom themes (.jftheme). Balatro-specific
                colors stay untouched.
              </p>
            </div>
            <div className="inline-flex rounded-lg border border-border overflow-hidden">
              <Button
                type="button"
                variant={themeMode === "light" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-none cursor-pointer"
                onClick={() => handleModeChange("light")}
              >
                <Sun className="mr-1.5 h-4 w-4" />
                Light
              </Button>
              <Button
                type="button"
                variant={themeMode === "dark" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-none cursor-pointer"
                onClick={() => handleModeChange("dark")}
              >
                <Moon className="mr-1.5 h-4 w-4" />
                Dark
              </Button>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] pt-5">
            <div className="space-y-2">
              <Select value={selectedThemeId} onValueChange={handleThemeSelect}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  {themes.map((theme) => (
                    <SelectItem key={theme.id} value={theme.id}>
                      {theme.name}
                      {theme.builtIn ? " [System]" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTheme?.builtIn && (
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  System Preset
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={handleCreateThemeFromCurrent}
              >
                New
              </Button>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto] pt-5">
            <Input
              value={draftTheme?.name || ""}
              onChange={(event) => handleDraftNameChange(event.target.value)}
              placeholder="Theme name"
              className="h-9"
            />

            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={handleCreateThemeFromCurrent}
              disabled={!draftTheme}
            >
              Duplicate Theme
            </Button>

            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={handleExportTheme}
              disabled={!draftTheme}
            >
              <DownloadSimple className="mr-1.5 h-4 w-4" />
              Export
            </Button>

            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={handleImportTheme}
            >
              <UploadSimple className="mr-1.5 h-4 w-4" />
              Import
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 pt-5">
            <Button
              type="button"
              className="cursor-pointer"
              onClick={() => setIsThemeEditorOpen(true)}
              disabled={!draftTheme}
            >
              Edit Selected Theme
            </Button>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={() => setIsResetThemesDialogOpen(true)}
            >
              Reset Themes To Default
            </Button>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer text-destructive"
              onClick={handleDeleteSelectedTheme}
              disabled={!selectedTheme || selectedTheme.builtIn}
            >
              <Trash className="mr-1.5 h-4 w-4" />
              Delete Theme
            </Button>
          </div>
        </section>
      </div>

      <section className="rounded-xl bg-card/70 p-5 divide-y divide-border/60">
        <div className="pb-4">
          <h3 className="font-semibold">Developer Tools</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Internal utilities and debugging features.
          </p>
        </div>
        <div className="pt-4 grid sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Button
            variant="outline"
            className="w-full cursor-pointer"
            onClick={() => window.dispatchEvent(new CustomEvent('show-github-star-dialog'))}
          >
            Show GitHub Star Dialog
          </Button>
          <Button
            variant="outline"
            className="w-full cursor-pointer"
            onClick={() => {
              localStorage.removeItem("hasDismissedGithubStar");
              window.alert("GitHub star preference cleared. The dialog can now appear again on launch.");
            }}
          >
            Clear GitHub Star Preference
          </Button>
          <Button
            variant="outline"
            className="w-full cursor-pointer"
            onClick={() => void invoke("open_devtools")}
          >
            Open DevTools
          </Button>
          <Button
            variant="outline"
            className="w-full cursor-pointer text-destructive"
            onClick={() => window.location.reload()}
          >
            Reload Window
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={isResetDataDialogOpen}
        onOpenChange={setIsResetDataDialogOpen}
        title="Reset all project data?"
        description="This permanently clears saved data and settings."
        confirmLabel="Reset Data"
        confirmVariant="destructive"
        onConfirm={() => {
          resetProjectData();
          setIsResetDataDialogOpen(false);
          window.location.reload();
        }}
      />

      <ConfirmDialog
        open={isResetThemesDialogOpen}
        onOpenChange={setIsResetThemesDialogOpen}
        title="Reset themes to default?"
        description="This removes all custom themes and restores the built-in default theme."
        confirmLabel="Reset Themes"
        confirmVariant="destructive"
        onConfirm={() => {
          handleResetThemes();
          setIsResetThemesDialogOpen(false);
        }}
      />

      <ThemeEditorDialog
        open={isThemeEditorOpen}
        onOpenChange={setIsThemeEditorOpen}
        draftTheme={draftTheme}
        themeEditorMode={themeEditorMode}
        setThemeEditorMode={setThemeEditorMode}
        updateDraftColor={updateDraftColor}
        updateDraftUi={updateDraftUi}
      />
    </div>
  );
}
