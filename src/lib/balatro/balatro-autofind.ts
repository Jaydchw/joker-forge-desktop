import {
  getBalatroAppdataPath,
  getBalatroGamePath,
  getBalatroInstallPath,
  setExportDestinationMode,
  setBalatroAutofindResult,
  setBalatroAppdataPath,
  setBalatroGamePath,
} from "@/lib/services/storage";
import { autoFindBalatroPaths } from "@/lib/balatro/balatro-mod-setup";
import type { GlobalAlert } from "@/components/layout/global-alerts";

const createAlertId = () =>
  `balatro-autofind-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const runBalatroAutofind = async (): Promise<GlobalAlert[]> => {
  try {
    const storedAppdata = getBalatroAppdataPath().trim();
    const storedGame = getBalatroGamePath().trim();
    const legacyPath = getBalatroInstallPath().trim();
    const detected = await autoFindBalatroPaths({
      configuredAppdataPath: storedAppdata,
      configuredGamePath: storedGame,
      legacyPath,
    });

    if (detected.appdataPath) {
      setBalatroAppdataPath(detected.appdataPath);
    }
    if (detected.gamePath) {
      setBalatroGamePath(detected.gamePath);
    }

    const hasAppdata = Boolean(detected.appdataPath);
    const hasGame = Boolean(detected.gamePath);
    setExportDestinationMode(hasAppdata ? "balatro-mods" : "downloads");

    if (hasAppdata && hasGame) {
      setBalatroAutofindResult("success");
      return [];
    }

    setBalatroAutofindResult("failure");
    const missingParts: string[] = [];
    if (!hasAppdata) missingParts.push("AppData folder");
    if (!hasGame) missingParts.push("game folder");

    return [
      {
        id: createAlertId(),
        type: "danger",
        title: "Balatro paths not fully configured",
        message: `Could not auto-find: ${missingParts.join(" and ")}.\nSet both paths in Settings -> Paths.`,
      },
    ];
  } catch {
    setBalatroAutofindResult("failure");
    return [
      {
        id: createAlertId(),
        type: "danger",
        title: "Balatro path auto-find failed",
        message: "Unable to determine Balatro AppData and/or game folder.",
      },
    ];
  }
};
