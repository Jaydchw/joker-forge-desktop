import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GenericDialogColorPicker } from "@/components/ui/generic-dialog-color-picker";
import {
  THEME_FONT_OPTIONS,
  THEME_VARIABLE_GROUPS,
  type AppThemeDefinition,
  type ThemeFontFamily,
  type ThemeVariable,
} from "@/lib/theme-manager";
import { type ThemePreference } from "@/lib/storage";

interface ThemeEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draftTheme: AppThemeDefinition | null;
  themeEditorMode: ThemePreference;
  setThemeEditorMode: (mode: ThemePreference) => void;
  updateDraftColor: (key: ThemeVariable, value: string) => void;
  updateDraftUi: (key: "fontScale" | "radiusPx" | "fontFamily", value: number | ThemeFontFamily) => void;
}

export function ThemeEditorDialog({
  open,
  onOpenChange,
  draftTheme,
  themeEditorMode,
  setThemeEditorMode,
  updateDraftColor,
  updateDraftUi,
}: ThemeEditorDialogProps) {
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

  const editorPalette = themeEditorMode === "light" ? draftTheme.light : draftTheme.dark;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Theme: {draftTheme.name}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <Button
            variant={themeEditorMode === "light" ? "secondary" : "outline"}
            onClick={() => setThemeEditorMode("light")}
            className="cursor-pointer"
          >
            Light Palette
          </Button>
          <Button
            variant={themeEditorMode === "dark" ? "secondary" : "outline"}
            onClick={() => setThemeEditorMode("dark")}
            className="cursor-pointer"
          >
            Dark Palette
          </Button>
        </div>

        <div className="rounded-lg bg-muted/15 p-4 space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Theme UI Style
          </h4>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Global Font Scale</Label>
              <span className="text-xs font-mono text-muted-foreground">
                {Math.round((pendingFontScale ?? draftTheme.ui.fontScale) * 100)}%
              </span>
            </div>
            <Slider
              value={[Number((pendingFontScale ?? draftTheme.ui.fontScale).toFixed(2))]}
              min={0.8}
              max={1.6}
              step={0.01}
              onValueChange={(value) => {
                const next = value[0] ?? pendingFontScale ?? draftTheme.ui.fontScale;
                setPendingFontScale(Number(next.toFixed(2)));
              }}
              onValueCommit={(value) => {
                const next = value[0] ?? pendingFontScale ?? draftTheme.ui.fontScale;
                updateDraftUi("fontScale", Number(next.toFixed(2)));
              }}
              className="cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Global Border Radius</Label>
              <span className="text-xs font-mono text-muted-foreground">
                {draftTheme.ui.radiusPx.toFixed(1)}px
              </span>
            </div>
            <Slider
              value={[draftTheme.ui.radiusPx]}
              min={0}
              max={24}
              step={0.5}
              onValueChange={(value) => {
                const next = value[0] ?? draftTheme.ui.radiusPx;
                updateDraftUi("radiusPx", Number(next.toFixed(1)));
              }}
              className="cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Global App Font</Label>
            <Input
              value={fontSearch}
              onChange={(event) => setFontSearch(event.target.value)}
              placeholder="Search fonts..."
              className="h-9"
            />
            <Select
              value={draftTheme.ui.fontFamily}
              onValueChange={(value) => updateDraftUi("fontFamily", value as ThemeFontFamily)}
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
                {filteredFontOptions.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    No fonts found.
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-lg bg-muted/15 p-4 space-y-5">
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
                  {group.items.map((item) => (
                    <div key={item.key} className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{item.label}</Label>
                      <GenericDialogColorPicker
                        value={editorPalette[item.key]}
                        onChange={(value) => updateDraftColor(item.key, value)}
                        defaultColor={editorPalette[item.key]}
                        valueMode="with-hash"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
