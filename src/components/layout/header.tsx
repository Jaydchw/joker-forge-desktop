import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  DownloadSimple,
  Upload,
  Export,
  Sun,
  Moon,
  Gear,
  Heart,
  CaretDown,
  Package,
  X,
  BookBookmark,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { ExportSuccessDialog } from "@/components/layout/export-success-dialog";
import { UnsupportedRulesDialog } from "@/components/layout/unsupported-rules-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  getBalatroAppdataPath,
  getBalatroGamePath,
  getExportDestinationMode,
  getBypassUnsupportedRulesDialogEnabled,
  getJokerforgeExportSaveMode,
  getJokerforgeExportAsJsonEnabled,
  getSplitLocalizationExportEnabled,
  getThemePreference,
  setBalatroAppdataPath,
  setBalatroGamePath,
  setThemePreference,
  useProjectData,
  type ProjectData,
} from "@/lib/storage";
import { exportJokerforgeV2, serializeJokerforgeV2 } from "@/lib/jokerforge/exporter";
import { importJokerforgeFromText } from "@/lib/jokerforge/importer";
import {
  exportModRust, type ExportModRustResult
} from "@/lib/rust-codegen-export";
import { join } from "@tauri-apps/api/path";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { getUnsupportedRuleParts } from "@/lib/export-compiler-support";
import {
  applyThemeFromStorage,
  subscribeThemeChanges,
} from "../../lib/theme-manager";
import { AnimatePresence, motion } from "framer-motion";
import { pushGlobalAlert } from "@/lib/global-alerts-bus";
import { ensureBalatroModSetup } from "@/lib/balatro-mod-setup";
import type { PreExportIssue } from "@/lib/pre-export-checks";
import type { NavigationTarget } from "@/lib/navigation-target";
import { toast } from "sonner";
import { useTemplateStore } from "@/lib/templates";
import { TemplateLibraryDialog } from "@/components/templates/template-library-dialog";

interface HeaderProps {
  title?: string;
}
const LAUNCH_GAME_ON_EXPORT_KEY = "joker_forge_launch_game_on_export";

type DeletableIssueTarget = {
  path: string;
  itemId: string;
};

export function Header({ title }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    getThemePreference(),
  );
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportModRustResult | null>(
    null,
  );
  const [unsupportedParts, setUnsupportedParts] = useState<string[]>([]);
  const [showUnsupportedDialog, setShowUnsupportedDialog] = useState(false);
  const [isDeleteProblematicConfirmOpen, setIsDeleteProblematicConfirmOpen] =
    useState(false);
  const [problematicTargetsToDelete, setProblematicTargetsToDelete] = useState<
    DeletableIssueTarget[]
  >([]);
  const [problematicIssueCount, setProblematicIssueCount] = useState(0);
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [isTemplateLibraryOpen, setIsTemplateLibraryOpen] = useState(false);
  const preExportToastIdRef = useRef<string | number | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const {
    data,
    projects,
    currentProjectId,
    switchProject,
    importProject,
    updateJokers,
    updateConsumables,
    updateVouchers,
    updateDecks,
    updateEnhancements,
    updateSeals,
    updateEditions,
    updateBoosters,
    updateRarities,
    updateConsumableSets,
    updateSounds,
  } = useProjectData();
  const {
    templates,
    deleteTemplates,
    upsertImportedTemplates,
    updateTemplateName,
    updateItemTemplate,
    duplicateTemplate,
  } =
    useTemplateStore();

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
      case "/acknowledgements":
        return "Acknowledgements";
      default:
        return "Joker Forge";
    }
  };

  const displayTitle = title || getPageTitle(location.pathname);

  const applyImportedProject = (
    project: ReturnType<typeof importJokerforgeFromText>["project"],
  ) => {
    importProject(project as ProjectData);
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const fileText = await file.text();
      const result = importJokerforgeFromText(fileText);
      applyImportedProject(result.project);
      const sourceLabel = result.source === "legacy" ? "legacy" : "v2";
      pushGlobalAlert({
        type: "success",
        title: "Import Complete",
        message: `Imported ${file.name} (${sourceLabel} format).`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown import error.";
      pushGlobalAlert({
        type: "danger",
        title: "Import Failed",
        message,
      });
    } finally {
      event.target.value = "";
    }
  };

  const handleProjectExportClick = async () => {
    try {
      const extension = getJokerforgeExportAsJsonEnabled()
        ? "json"
        : "jokerforge";
      const result = await exportJokerforgeV2(data, undefined, extension, {
        saveMode: getJokerforgeExportSaveMode(),
        balatroAppdataPath: getBalatroAppdataPath(),
      });
      if (result === "cancelled") return;
      if (
        window.localStorage.getItem(LAUNCH_GAME_ON_EXPORT_KEY) === "true" &&
        getBalatroGamePath().trim()
      ) {
        await invoke("launch_or_relaunch_balatro", {
          gamePath: getBalatroGamePath(),
        });
      }
      pushGlobalAlert({
        type: "success",
        title: "Export Complete",
        message:
          result === "downloaded"
            ? `Downloaded .${extension} file.`
            : result === "saved-mods"
              ? `Saved .${extension} file to Balatro Mods folder.`
            : `Saved .${extension} file.`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown export error.";
      pushGlobalAlert({
        type: "danger",
        title: "Export Failed",
        message,
      });
    }
  };

  const doExport = async () => {
    try {
      setIsExporting(true);

      const configuredAppdataPath = getBalatroAppdataPath().trim();
      const configuredGamePath = getBalatroGamePath().trim();
      let destinationMode = getExportDestinationMode();
      let balatroModsPath = "";

      if (destinationMode === "balatro-mods") {
        const setupResult = await ensureBalatroModSetup({
          appdataPath: configuredAppdataPath,
          gamePath: configuredGamePath,
          legacyPath: configuredAppdataPath,
        });
        setBalatroAppdataPath(setupResult.appdataPath);
        setBalatroGamePath(setupResult.gamePath);
        balatroModsPath = setupResult.modsPath;
      }

      const result = await exportModRust(
        data.metadata as any,
        data.rarities as any,
        data.consumableSets as any,
        data.jokers as any,
        data.consumables as any,
        data.vouchers as any,
        data.decks as any,
        data.enhancements as any,
        data.seals as any,
        data.editions as any,
        {
          useLocalizationFile: getSplitLocalizationExportEnabled(),
          destinationMode,
          balatroModsPath,
          overwriteExistingModFolder: true,
        },
      );

      const jokerforgeBundlePath = await join(
        result.modFolderPath,
        `${data.metadata.id || "jokerforge-export"}.jokerforge`,
      );
      await writeTextFile(jokerforgeBundlePath, serializeJokerforgeV2(data));

      if (
        window.localStorage.getItem(LAUNCH_GAME_ON_EXPORT_KEY) === "true" &&
        getBalatroGamePath().trim()
      ) {
        await invoke("launch_or_relaunch_balatro", {
          gamePath: getBalatroGamePath(),
        });
      }

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

  const navigateToTarget = (target: NavigationTarget) => {
    const params = new URLSearchParams();
    if (target.itemId) {
      params.set("activityItemId", target.itemId);
    }
    if (target.editor) {
      params.set("activityEditor", target.editor);
    }
    const query = params.toString();
    navigate(query ? `${target.path}?${query}` : target.path);
  };

  const getDeletableTargetsFromIssues = (
    issues: PreExportIssue[],
  ): DeletableIssueTarget[] => {
    const deletablePaths = new Set([
      "/jokers",
      "/consumables",
      "/vouchers",
      "/decks",
      "/enhancements",
      "/seals",
      "/editions",
      "/boosters",
      "/rarities",
      "/consumable-sets",
      "/sounds",
    ]);
    const deduped = new Map<string, DeletableIssueTarget>();

    issues.forEach((issue) => {
      const target = issue.target;
      if (!target?.path || !target.itemId) return;
      if (!deletablePaths.has(target.path)) return;
      const dedupeKey = `${target.path}::${target.itemId}`;
      if (deduped.has(dedupeKey)) return;
      deduped.set(dedupeKey, { path: target.path, itemId: target.itemId });
    });

    return Array.from(deduped.values());
  };

  const showPreExportIssuesToast = (issues: PreExportIssue[]) => {
    const deletableTargets = getDeletableTargetsFromIssues(issues);
    setProblematicTargetsToDelete(deletableTargets);
    setProblematicIssueCount(issues.length);

    if (preExportToastIdRef.current !== null) {
      toast.dismiss(preExportToastIdRef.current);
    }

    const nextToastId = toast.custom(
      (toastId) => (
        <div className="w-[min(580px,calc(100vw-2rem))] rounded-lg border border-amber-300/30 bg-zinc-950 text-white shadow-xl">
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Pre-export checks failed</p>
                <p className="mt-1 text-xs text-white/70">
                  Fix these before exporting. Click any bullet to jump there.
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0 cursor-pointer text-white/70 hover:bg-white/10 hover:text-white"
                onClick={() => toast.dismiss(toastId)}
                aria-label="Dismiss validation toast"
                title="Dismiss"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <ul className="mt-3 max-h-64 list-disc space-y-2 overflow-y-auto pl-5 pr-1 text-xs">
              {issues.map((issue) => (
                <li key={issue.id}>
                  <button
                    type="button"
                    className="cursor-pointer text-left underline decoration-white/35 underline-offset-2 hover:text-white"
                    onClick={() => {
                      if (issue.target) {
                        navigateToTarget(issue.target);
                      }
                      toast.dismiss(toastId);
                    }}
                  >
                    {issue.message}
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-end gap-2">
              {deletableTargets.length > 0 ? (
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8 cursor-pointer"
                  onClick={() => {
                    setIsDeleteProblematicConfirmOpen(true);
                    toast.dismiss(toastId);
                  }}
                  aria-label="Delete all problematic items"
                  title="Delete all problematic items"
                >
                  Delete All Problematic Items
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ),
      {
        duration: 120000,
        onDismiss: () => {
          if (preExportToastIdRef.current === nextToastId) {
            preExportToastIdRef.current = null;
          }
        },
      },
    );

    preExportToastIdRef.current = nextToastId;
  };

  const handleDeleteProblematicItems = () => {
    const idsByPath = new Map<string, Set<string>>();
    problematicTargetsToDelete.forEach(({ path, itemId }) => {
      const ids = idsByPath.get(path) || new Set<string>();
      ids.add(itemId);
      idsByPath.set(path, ids);
    });

    let removed = 0;

    const countRemoved = <T extends { id: string }>(
      items: T[],
      ids: Set<string> | undefined,
      updater: (next: T[]) => void,
    ) => {
      if (!ids || ids.size === 0) return;
      const next = items.filter((item) => !ids.has(item.id));
      removed += items.length - next.length;
      updater(next);
    };

    countRemoved(data.jokers, idsByPath.get("/jokers"), updateJokers);
    countRemoved(
      data.consumables,
      idsByPath.get("/consumables"),
      updateConsumables,
    );
    countRemoved(data.vouchers, idsByPath.get("/vouchers"), updateVouchers);
    countRemoved(data.decks, idsByPath.get("/decks"), updateDecks);
    countRemoved(
      data.enhancements,
      idsByPath.get("/enhancements"),
      updateEnhancements,
    );
    countRemoved(data.seals, idsByPath.get("/seals"), updateSeals);
    countRemoved(data.editions, idsByPath.get("/editions"), updateEditions);
    countRemoved(data.boosters, idsByPath.get("/boosters"), updateBoosters);
    countRemoved(data.rarities, idsByPath.get("/rarities"), updateRarities);
    countRemoved(
      data.consumableSets,
      idsByPath.get("/consumable-sets"),
      updateConsumableSets,
    );
    countRemoved(data.sounds, idsByPath.get("/sounds"), updateSounds);

    setIsDeleteProblematicConfirmOpen(false);
    setProblematicTargetsToDelete([]);
    if (preExportToastIdRef.current !== null) {
      toast.dismiss(preExportToastIdRef.current);
      preExportToastIdRef.current = null;
    }

    if (removed > 0) {
      pushGlobalAlert({
        type: "caution",
        title: "Problematic Items Deleted",
        message: `Deleted ${removed} item${removed === 1 ? "" : "s"}. Run Export Mod again.`,
      });
    }
  };

  const handleExportMod = async () => {
    if (isExporting) return;

    let issues: PreExportIssue[] = [];
    try {
      // Keep validation strictly export-triggered: no startup/background checks.
      const { runPreExportChecks } = await import("@/lib/pre-export-checks");
      issues = runPreExportChecks(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[pre-export-checks] Failed to run checks", message);
      pushGlobalAlert({
        type: "danger",
        title: "Validation Error",
        message:
          "Pre-export checks failed to run. Export is blocked until this is resolved. Please restart the app and try again.",
      });
      return;
    }

    if (issues.length > 0) {
      showPreExportIssuesToast(issues);
      return;
    }

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

    if (unsupported.size > 0 && !getBypassUnsupportedRulesDialogEnabled()) {
      setUnsupportedParts(Array.from(unsupported));
      setShowUnsupportedDialog(true);
      return;
    }

    await doExport();
  };

  return (
    <>
      <header className="sticky top-0 z-30 grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 py-3 bg-background/95 backdrop-blur-md border-b border-border transition-colors duration-300">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold tracking-tight text-foreground/80 pl-2">
            {displayTitle}
          </h2>
        </div>

        <div className="relative flex items-center justify-center">
          <button
            type="button"
            onClick={() => setIsProjectMenuOpen((value) => !value)}
            className="flex h-9 items-center gap-2 rounded-md border border-border/60 bg-background/70 px-4 text-sm font-semibold text-foreground/80 transition hover:text-foreground hover:border-primary/40 cursor-pointer"
          >
            <Package className="h-4 w-4 text-primary" weight="fill" />
            <span className="max-w-[200px] truncate">
              {projects.find((proj) => proj.id === currentProjectId)?.name ??
                "Project"}
            </span>
            <CaretDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${isProjectMenuOpen ? "rotate-180" : ""}`}
            />
          </button>

          <AnimatePresence>
            {isProjectMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full mt-2 w-72 rounded-xl border border-border bg-card shadow-lg overflow-hidden z-40"
              >
                <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Switch Project
                </div>
                <div className="max-h-64 overflow-auto">
                  {projects.map((proj) => (
                    <button
                      key={proj.id}
                      type="button"
                      onClick={() => {
                        switchProject(proj.id);
                        setIsProjectMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left text-sm text-foreground/80 hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
                    >
                      <span
                        className={`truncate ${proj.id === currentProjectId ? "text-primary" : ""}`}
                      >
                        {proj.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        v{proj.version}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
          >
            <a
              href="https://ko-fi.com/jaydchw"
              target="_blank"
              rel="noreferrer"
            >
              <Heart className="h-4 w-4 text-balatro-red" weight="fill" />
              Donate
            </a>
          </Button>
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
            onClick={() => setIsTemplateLibraryOpen(true)}
            className="text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
          >
            <BookBookmark className="mr-2 h-4 w-4" />
            Templates
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleImportClick}
            className="text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
          >
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleProjectExportClick}
            className="text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
          >
            <DownloadSimple className="mr-2 h-4 w-4" />
            Export
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
      <ConfirmDialog
        open={isDeleteProblematicConfirmOpen}
        onOpenChange={setIsDeleteProblematicConfirmOpen}
        title="Delete all problematic items?"
        description={`This will delete ${problematicTargetsToDelete.length} item${problematicTargetsToDelete.length === 1 ? "" : "s"} linked to ${problematicIssueCount} pre-export issue${problematicIssueCount === 1 ? "" : "s"}. This cannot be undone.`}
        confirmLabel="Delete Items"
        confirmVariant="destructive"
        onConfirm={handleDeleteProblematicItems}
      />
      <input
        ref={importInputRef}
        type="file"
        accept=".jokerforge,.json,application/json"
        className="hidden"
        onChange={handleImportFileChange}
      />
      <TemplateLibraryDialog
        open={isTemplateLibraryOpen}
        onOpenChange={setIsTemplateLibraryOpen}
        templates={templates}
        onDeleteTemplates={deleteTemplates}
        onImportTemplates={upsertImportedTemplates}
        onUpdateTemplateName={updateTemplateName}
        onUpdateItemTemplate={updateItemTemplate}
        onDuplicateTemplate={duplicateTemplate}
      />
    </>
  );
}
