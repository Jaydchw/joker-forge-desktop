import { type ComponentType, useEffect, useMemo, useState } from "react";
import {
  Info,
  FolderOpen,
  Gear,
  Moon,
  Palette,
  Sun,
  Trash,
  UploadSimple,
  DownloadSimple,
  Wrench,
  Database,
  Folder,
  Sliders,
  ArrowsCounterClockwise,
} from "@phosphor-icons/react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Slider } from "@/components/ui/slider";
import { invoke } from "@tauri-apps/api/core";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getBalatroInstallPath,
  getAutoOpenNewItemDialogEnabled,
  getJokerforgeAutoSaveDownloadsEnabled,
  getConfirmDeleteEnabled,
  getExportDestinationMode,
  getJokerforgeExportAsJsonEnabled,
  getSplitLocalizationExportEnabled,
  getThemePreference,
  resetProjectData,
  setBalatroInstallPath,
  setAutoOpenNewItemDialogEnabled,
  setJokerforgeAutoSaveDownloadsEnabled,
  setConfirmDeleteEnabled,
  setExportDestinationMode,
  setJokerforgeExportAsJsonEnabled,
  setSplitLocalizationExportEnabled,
  setThemePreference,
  type ThemePreference,
} from "@/lib/storage";
import {
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
  THEME_FONT_OPTIONS,
  THEME_VARIABLE_GROUPS,
  THEME_VARIABLE_USAGE,
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

type SettingsCategory = "general" | "paths" | "theme" | "dev" | "data";

function ThemeEditorFields({
  draftTheme,
  themeEditorMode,
  updateDraftColor,
  updateDraftUi,
}: {
  draftTheme: AppThemeDefinition | null;
  themeEditorMode: ThemePreference;
  updateDraftColor: (key: ThemeVariable, value: string) => void;
  updateDraftUi: (
    key: "fontScale" | "radiusPx" | "fontFamily",
    value: number | ThemeFontFamily,
  ) => void;
}) {
  const [fontSearch, setFontSearch] = useState("");
  const [pendingFontScale, setPendingFontScale] = useState<number | null>(null);

  const filteredFontOptions = useMemo(() => {
    const query = fontSearch.trim().toLowerCase();
    if (!query) return THEME_FONT_OPTIONS;
    return THEME_FONT_OPTIONS.filter((option) =>
      option.label.toLowerCase().includes(query),
    );
  }, [fontSearch]);

  if (!draftTheme) return null;

  const editorPalette =
    themeEditorMode === "light" ? draftTheme.light : draftTheme.dark;
  const radiusDisplay = Number(draftTheme.ui.radiusPx.toFixed(1));

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Theme UI Style
        </h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">
              Global Font Scale
            </Label>
          </div>
          <Slider
            value={[
              Number((pendingFontScale ?? draftTheme.ui.fontScale).toFixed(2)),
            ]}
            min={0.8}
            max={1.6}
            step={0.01}
            onValueChange={(value) => {
              const next =
                value[0] ?? pendingFontScale ?? draftTheme.ui.fontScale;
              setPendingFontScale(Number(next.toFixed(2)));
            }}
            onValueCommit={(value) => {
              const next =
                value[0] ?? pendingFontScale ?? draftTheme.ui.fontScale;
              updateDraftUi("fontScale", Number(next.toFixed(2)));
            }}
            showValueInput
            valueSuffix="%"
            valueInputAriaLabel="Global font scale percent"
            valueFormatter={(value) => String(Math.round(value * 100))}
            valueParser={(raw) => {
              if (!raw.trim()) return null;
              const parsed = Number(raw);
              if (!Number.isFinite(parsed)) return null;
              return Number((parsed / 100).toFixed(2));
            }}
            onInlineValueCommit={(next) =>
              updateDraftUi("fontScale", Number(next.toFixed(2)))
            }
            className="cursor-pointer"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">
              Global Border Radius
            </Label>
          </div>
          <Slider
            value={[radiusDisplay]}
            min={0}
            max={24}
            step={0.5}
            onValueChange={(value) => {
              const next = value[0] ?? radiusDisplay;
              updateDraftUi("radiusPx", Number(next.toFixed(1)));
            }}
            showValueInput
            valueSuffix="px"
            valueInputAriaLabel="Global border radius value"
            valueFormatter={(value) => value.toFixed(1)}
            valueParser={(raw) => {
              if (!raw.trim()) return null;
              const parsed = Number(raw);
              return Number.isFinite(parsed) ? parsed : null;
            }}
            onInlineValueCommit={(next) =>
              updateDraftUi("radiusPx", Number(next.toFixed(1)))
            }
            minLabel="No border"
            maxLabel="Full"
            className="cursor-pointer"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Global App Font
          </Label>
          <Input
            value={fontSearch}
            onChange={(event) => setFontSearch(event.target.value)}
            placeholder="Search fonts..."
            className="h-9"
          />
          <Select
            value={draftTheme.ui.fontFamily}
            onValueChange={(value) =>
              updateDraftUi("fontFamily", value as ThemeFontFamily)
            }
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="Select app font" />
            </SelectTrigger>
            <SelectContent>
              {filteredFontOptions.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-5">
        <div className="text-sm text-muted-foreground">
          Editing {themeEditorMode === "light" ? "Light" : "Dark"} palette for{" "}
          <span className="text-foreground font-medium">{draftTheme.name}</span>
        </div>
        {editorPalette &&
          THEME_VARIABLE_GROUPS.map((group) => (
            <div key={group.heading} className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.heading}
              </h4>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {group.items.map((item) => {
                  const usage = THEME_VARIABLE_USAGE[item.key] ?? [
                    "General UI elements",
                  ];
                  return (
                    <div key={item.key} className="space-y-1.5">
                      <div className="flex items-center gap-1">
                        <Label className="text-xs text-muted-foreground">
                          {item.label}
                        </Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex h-4 w-4 items-center justify-center text-muted-foreground transition hover:text-foreground"
                              aria-label={`Where ${item.label} is used`}
                            >
                              <Info className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            className="max-w-[240px] space-y-1"
                          >
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-background/80">
                              Used for
                            </div>
                            <ul className="list-disc space-y-0.5 pl-4">
                              {usage.map((entry) => (
                                <li key={entry}>{entry}</li>
                              ))}
                            </ul>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <GenericDialogColorPicker
                        value={editorPalette[item.key]}
                        onChange={(value) => updateDraftColor(item.key, value)}
                        defaultColor={editorPalette[item.key]}
                        valueMode="with-hash"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [activeCategory, setActiveCategory] =
    useState<SettingsCategory>("general");

  const [confirmDeletes, setConfirmDeletes] = useState(true);
  const [balatroPath, setBalatroPath] = useState("");
  const [splitLocalizationExport, setSplitLocalizationExport] = useState(false);
  const [exportToBalatroMods, setExportToBalatroMods] = useState(false);
  const [exportJokerforgeAsJson, setExportJokerforgeAsJson] = useState(false);
  const [autoSaveToDownloads, setAutoSaveToDownloads] = useState(false);
  const [autoOpenNewItemDialog, setAutoOpenNewItemDialog] = useState(true);
  const [isResetDataDialogOpen, setIsResetDataDialogOpen] = useState(false);
  const [isResetThemesDialogOpen, setIsResetThemesDialogOpen] = useState(false);

  const [themeMode, setThemeMode] = useState<ThemePreference>("dark");
  const [themeEditorMode, setThemeEditorMode] =
    useState<ThemePreference>("dark");
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
    setAutoSaveToDownloads(getJokerforgeAutoSaveDownloadsEnabled());
    setAutoOpenNewItemDialog(getAutoOpenNewItemDialogEnabled());
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

  const categories: Array<{
    id: SettingsCategory;
    label: string;
    icon: ComponentType<{ className?: string }>;
  }> = [
    { id: "general", label: "General", icon: Sliders },
    { id: "paths", label: "Paths", icon: Folder },
    { id: "theme", label: "Theme", icon: Palette },
    { id: "dev", label: "Developer", icon: Wrench },
    { id: "data", label: "Data", icon: Database },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="space-y-1 border-b border-border/60 pb-4">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Gear className="h-5 w-5" />
          Settings
        </div>
        <p className="text-sm text-muted-foreground">
          App behavior, export options, and theme management.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] items-start">
        <aside className="lg:sticky lg:top-4">
          <nav className="space-y-1">
            {categories.map((category) => {
              const Icon = category.icon;
              const active = category.id === activeCategory;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActiveCategory(category.id)}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-3 text-left transition hover:bg-muted/30"
                >
                  <Icon
                    className={`h-4 w-4 ${active ? "text-foreground" : "text-muted-foreground"}`}
                  />
                  <span
                    className={active ? "font-medium" : "text-muted-foreground"}
                  >
                    {category.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0">
          {activeCategory === "general" && (
            <div className="space-y-4">
              <div className="px-1 py-2 border-b border-border/60">
                <h3 className="font-semibold flex items-center gap-2">
                  <Sliders className="h-4 w-4" />
                  General
                </h3>
              </div>

              <div className="space-y-2 px-1 py-1">
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
                  <Label htmlFor="split-localization-export">
                    Split Localization On Full Export
                  </Label>
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
                  <Label htmlFor="export-jokerforge-as-json">
                    Export .jokerforge As .json
                  </Label>
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

                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label htmlFor="auto-open-new-item-dialog">
                      Auto-open New Item Dialog
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Automatically opens the item editor after creating a new
                      item.
                    </p>
                  </div>
                  <Switch
                    id="auto-open-new-item-dialog"
                    checked={autoOpenNewItemDialog}
                    onCheckedChange={(value) => {
                      setAutoOpenNewItemDialog(value);
                      setAutoOpenNewItemDialogEnabled(value);
                    }}
                    className="cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label htmlFor="auto-save-downloads">
                      Auto-save Exports To Downloads
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Off: ask where to save each export. On: save directly to
                      Downloads.
                    </p>
                  </div>
                  <Switch
                    id="auto-save-downloads"
                    checked={autoSaveToDownloads}
                    onCheckedChange={(value) => {
                      setAutoSaveToDownloads(value);
                      setJokerforgeAutoSaveDownloadsEnabled(value);
                    }}
                    className="cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {activeCategory === "paths" && (
            <div className="space-y-4">
              <div className="px-1 py-2 border-b border-border/60">
                <h3 className="font-semibold flex items-center gap-2">
                  <Folder className="h-4 w-4" />
                  Balatro Path
                </h3>
              </div>

              <div className="space-y-4 px-1 py-1">
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
          )}

          {activeCategory === "theme" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3 px-1 py-2 border-b border-border/60">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Theme Studio
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Create and manage custom themes (.jftheme).
                  </p>
                </div>
                <div className="inline-flex overflow-hidden rounded-lg border border-border">
                  <Button
                    type="button"
                    variant={themeMode === "light" ? "secondary" : "ghost"}
                    size="sm"
                    className="rounded-none cursor-pointer data-[active=true]:bg-amber-200/40 data-[active=true]:text-foreground"
                    data-active={themeEditorMode === "light"}
                    onClick={() => {
                      handleModeChange("light");
                      setThemeEditorMode("light");
                    }}
                  >
                    <Sun className="mr-1.5 h-4 w-4" />
                    Light
                  </Button>
                  <Button
                    type="button"
                    variant={themeMode === "dark" ? "secondary" : "ghost"}
                    size="sm"
                    className="rounded-none cursor-pointer data-[active=true]:bg-sky-200/30 data-[active=true]:text-foreground"
                    data-active={themeEditorMode === "dark"}
                    onClick={() => {
                      handleModeChange("dark");
                      setThemeEditorMode("dark");
                    }}
                  >
                    <Moon className="mr-1.5 h-4 w-4" />
                    Dark
                  </Button>
                </div>
              </div>

              <div className="space-y-5 px-1 py-1">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="space-y-2">
                    <Select
                      value={selectedThemeId}
                      onValueChange={handleThemeSelect}
                    >
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

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 cursor-pointer"
                    onClick={handleCreateThemeFromCurrent}
                  >
                    New
                  </Button>
                </div>

                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto_auto]">
                  <Input
                    value={draftTheme?.name || ""}
                    onChange={(event) =>
                      handleDraftNameChange(event.target.value)
                    }
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="cursor-pointer"
                        onClick={() => setIsResetThemesDialogOpen(true)}
                        aria-label="Reset themes to default"
                      >
                        <ArrowsCounterClockwise className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reset themes to default</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="cursor-pointer text-destructive"
                        onClick={handleDeleteSelectedTheme}
                        disabled={!selectedTheme || selectedTheme.builtIn}
                        aria-label="Delete theme"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete selected theme</TooltipContent>
                  </Tooltip>
                </div>

                <ThemeEditorFields
                  draftTheme={draftTheme}
                  themeEditorMode={themeEditorMode}
                  updateDraftColor={updateDraftColor}
                  updateDraftUi={updateDraftUi}
                />
              </div>
            </div>
          )}

          {activeCategory === "dev" && (
            <div className="space-y-4">
              <div className="px-1 py-2 border-b border-border/60">
                <h3 className="font-semibold flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Developer Tools
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Internal utilities and debugging features.
                </p>
              </div>

              <div className="grid gap-4 px-1 py-1 sm:grid-cols-2 md:grid-cols-4">
                <Button
                  variant="outline"
                  className="w-full cursor-pointer"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("show-github-star-dialog"),
                    )
                  }
                >
                  Show GitHub Star Dialog
                </Button>
                <Button
                  variant="outline"
                  className="w-full cursor-pointer"
                  onClick={() => {
                    localStorage.removeItem("hasDismissedGithubStar");
                    window.alert(
                      "GitHub star preference cleared. The dialog can now appear again on launch.",
                    );
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
            </div>
          )}

          {activeCategory === "data" && (
            <div className="space-y-4">
              <div className="px-1 py-2 border-b border-border/60">
                <h3 className="font-semibold flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Data
                </h3>
              </div>
              <div className="px-1 py-1">
                <Button
                  variant="destructive"
                  className="w-full cursor-pointer"
                  onClick={() => setIsResetDataDialogOpen(true)}
                >
                  Reset All Project Data
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>

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
    </div>
  );
}
