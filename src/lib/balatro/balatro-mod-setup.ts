import { invoke } from "@tauri-apps/api/core";

export interface AutoDetectedBalatroPaths {
  appdataPath: string | null;
  gamePath: string | null;
}

export interface BalatroSetupResult {
  appdataPath: string;
  gamePath: string;
  modsPath: string;
}

export const autoFindBalatroPaths = async (options?: {
  configuredAppdataPath?: string;
  configuredGamePath?: string;
  legacyPath?: string;
}): Promise<AutoDetectedBalatroPaths> => {
  return invoke<AutoDetectedBalatroPaths>("auto_find_balatro_paths", {
    configuredAppdataPath: options?.configuredAppdataPath ?? null,
    configuredGamePath: options?.configuredGamePath ?? null,
    legacyPath: options?.legacyPath ?? null,
  });
};

export const ensureBalatroModSetup = async (options?: {
  appdataPath?: string;
  gamePath?: string;
  legacyPath?: string;
}): Promise<BalatroSetupResult> => {
  return invoke<BalatroSetupResult>("ensure_balatro_mod_setup", {
    appdataPath: options?.appdataPath ?? null,
    gamePath: options?.gamePath ?? null,
    legacyPath: options?.legacyPath ?? null,
  });
};
