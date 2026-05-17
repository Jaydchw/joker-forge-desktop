import type { ProjectData } from "@/lib/services/storage";
import { normalizeProjectData } from "@/lib/jokerforge/legacy-transpiler";
import { save } from "@tauri-apps/plugin-dialog";
import { exists, mkdir, writeTextFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";

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
    saveMode?: "ask" | "downloads" | "balatro-mods";
    balatroAppdataPath?: string;
  },
): Promise<"downloaded" | "saved" | "saved-mods" | "cancelled"> => {
  const baseName =
    fileName ||
    sanitizeFilenameBase(
      project.metadata?.id || project.metadata?.name || "jokerforge-export",
    );

  const content = serializeJokerforgeV2(project);
  const fullName = `${baseName}.${extension}`;

  if (options?.saveMode === "downloads") {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = fullName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
    return "downloaded";
  }

  if (options?.saveMode === "balatro-mods") {
    const appdataPath = (options.balatroAppdataPath || "").trim();
    if (!appdataPath) {
      throw new Error("Balatro AppData path is not set.");
    }

    const modsDir = await join(appdataPath, "Mods");
    if (!(await exists(modsDir))) {
      await mkdir(modsDir, { recursive: true });
    }

    const targetPath = await join(modsDir, fullName);
    await writeTextFile(targetPath, content);
    return "saved-mods";
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
