import { useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { importJokerforgeFromText } from "@/lib/jokerforge/importer";
import {
  parseTemplateBundleText,
  useTemplateStore,
} from "@/lib/content/templates";
import {
  createThemeFromImported,
  parseThemeFilePayload,
} from "@/lib/app/theme-manager";
import { pushGlobalAlert } from "@/lib/app/global-alerts-bus";
import { useProjectData } from "@/lib/services/storage";

const FILE_OPEN_EVENT = "jokerforge-file-open";
const SUPPORTED_EXTENSIONS = new Set(["jokerforge", "jftemplate", "jftheme"]);

const getFileName = (path: string): string => {
  const normalized = path.replace(/\\/g, "/");
  return normalized.split("/").pop() || path;
};

const getExtension = (path: string): string => {
  const fileName = getFileName(path);
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex < 0) return "";
  return fileName.slice(dotIndex + 1).toLowerCase();
};

const uniqueSupportedPaths = (paths: unknown): string[] => {
  if (!Array.isArray(paths)) return [];
  const seen = new Set<string>();
  return paths
    .filter((path): path is string => typeof path === "string" && path.trim().length > 0)
    .filter((path) => SUPPORTED_EXTENSIONS.has(getExtension(path)))
    .filter((path) => {
      const key = path.trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

export function FileAssociationListener() {
  const { isHydrating: isProjectHydrating, importProject } = useProjectData();
  const {
    isHydrating: isTemplateHydrating,
    upsertImportedTemplates,
  } = useTemplateStore();
  const pendingPathsRef = useRef<string[]>([]);
  const isProcessingRef = useRef(false);

  const processPath = useCallback(
    async (path: string) => {
      const extension = getExtension(path);
      const fileName = getFileName(path);
      const raw = await invoke<string>("read_associated_file", { path });

      if (extension === "jokerforge") {
        const result = importJokerforgeFromText(raw);
        importProject(result.project);
        const sourceLabel = result.source === "legacy" ? "legacy" : "v2";
        pushGlobalAlert({
          type: "success",
          title: "Import Complete",
          message: `Imported ${fileName} (${sourceLabel} format).`,
        });
        return;
      }

      if (extension === "jftemplate") {
        const imported = parseTemplateBundleText(raw);
        const count = upsertImportedTemplates(imported);
        pushGlobalAlert({
          type: "success",
          title: "Templates Imported",
          message: `Imported ${count} template${count === 1 ? "" : "s"} from ${fileName}.`,
        });
        return;
      }

      if (extension === "jftheme") {
        const parsed = parseThemeFilePayload(JSON.parse(raw));
        if (!parsed) {
          throw new Error("That file is not a valid .jftheme file.");
        }
        const imported = createThemeFromImported(parsed);
        pushGlobalAlert({
          type: "success",
          title: "Theme Imported",
          message: `Imported theme "${imported.name}" from ${fileName}.`,
        });
      }
    },
    [importProject, upsertImportedTemplates],
  );

  const processPendingPaths = useCallback(async () => {
    if (isProjectHydrating || isTemplateHydrating || isProcessingRef.current) {
      return;
    }

    isProcessingRef.current = true;
    try {
      while (pendingPathsRef.current.length > 0) {
        const path = pendingPathsRef.current.shift();
        if (!path) continue;
        try {
          await processPath(path);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown import error.";
          pushGlobalAlert({
            type: "danger",
            title: "Import Failed",
            message: `${getFileName(path)}: ${message}`,
          });
        }
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [isProjectHydrating, isTemplateHydrating, processPath]);

  const enqueuePaths = useCallback(
    (paths: unknown) => {
      const nextPaths = uniqueSupportedPaths(paths);
      if (nextPaths.length === 0) return;
      pendingPathsRef.current.push(...nextPaths);
      void processPendingPaths();
    },
    [processPendingPaths],
  );

  useEffect(() => {
    void processPendingPaths();
  }, [processPendingPaths]);

  useEffect(() => {
    let isMounted = true;

    void invoke<string[]>("take_pending_file_open_paths")
      .then((paths) => {
        if (isMounted) enqueuePaths(paths);
      })
      .catch((error) => {
        console.warn("Failed to read pending file-open paths", error);
      });

    const unlistenPromise = listen<string[]>(FILE_OPEN_EVENT, (event) => {
      enqueuePaths(event.payload);
    });

    return () => {
      isMounted = false;
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [enqueuePaths]);

  return null;
}
