import type { ProjectData } from "@/lib/services/storage";
import { normalizeProjectData } from "@/lib/jokerforge/legacy-transpiler";
import { save } from "@tauri-apps/plugin-dialog";
import { exists, writeTextFile } from "@tauri-apps/plugin-fs";
import { downloadDir, join } from "@tauri-apps/api/path";

export interface JokerforgeV2Export {
  format: "jokerforge";
  version: 2;
  exportedAt: string;
  project: ProjectData;
}

export const buildJokerforgeV2Export = (
  project: ProjectData,
): JokerforgeV2Export => {
  return {
    format: "jokerforge",
    version: 2,
    exportedAt: new Date().toISOString(),
    project: normalizeProjectData(project),
  };
};

export const serializeJokerforgeV2 = (project: ProjectData): string => {
  return JSON.stringify(buildJokerforgeV2Export(project), null, 2);
};

const sanitizeFilenameBase = (value: string): string => {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return cleaned || "jokerforge-export";
};

export const exportJokerforgeV2 = async (
  project: ProjectData,
  fileName?: string,
  extension: "jokerforge" | "json" = "jokerforge",
  options?: {
    saveMode?: "ask" | "downloads";
  },
): Promise<"downloaded" | "saved" | "cancelled"> => {
  const baseName =
    fileName ||
    sanitizeFilenameBase(
      project.metadata?.id || project.metadata?.name || "jokerforge-export",
    );

  const content = serializeJokerforgeV2(project);
  const fullName = `${baseName}.${extension}`;

  if (options?.saveMode === "downloads") {
    const downloadsPath = await downloadDir();
    if (!downloadsPath || !(await exists(downloadsPath))) {
      throw new Error("Unable to resolve Downloads folder for export.");
    }
    await writeTextFile(await join(downloadsPath, fullName), content);
    return "downloaded";
  }

  const targetPath = await save({
    title: "Export Joker Forge Project",
    defaultPath: fullName,
    filters: [
      {
        name: extension === "json" ? "JSON" : "Joker Forge",
        extensions: [extension],
      },
    ],
  });

  if (!targetPath) return "cancelled";
  await writeTextFile(targetPath, content);
  return "saved";
};
