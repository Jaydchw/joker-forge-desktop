import { dataDir, homeDir, join } from "@tauri-apps/api/path";
import {
  getBalatroAutofindAlertShown,
  getBalatroAutofindResult,
  getBalatroInstallPath,
  setBalatroAutofindAlertShown,
  setBalatroAutofindResult,
  setBalatroInstallPath,
} from "@/lib/storage";
import type { GlobalAlert } from "@/components/layout/global-alerts";

const normalizeWindowsSeparators = (value: string) => {
  if (!/^[a-zA-Z]:\\/.test(value)) return value;
  return value.replace(/\\{2,}/g, "\\");
};

const createAlertId = () =>
  `balatro-autofind-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const runBalatroAutofind = async (): Promise<GlobalAlert[]> => {
  const existingResult = getBalatroAutofindResult();
  const alertShown = getBalatroAutofindAlertShown();
  let storedPath = getBalatroInstallPath();

  console.debug("[balatro-autofind] start", {
    existingResult,
    alertShown,
    storedPath,
  });

  if (storedPath) {
    const normalizedStoredPath = normalizeWindowsSeparators(storedPath);
    if (normalizedStoredPath !== storedPath) {
      console.debug("[balatro-autofind] normalize stored path", {
        before: storedPath,
        after: normalizedStoredPath,
      });
      storedPath = normalizedStoredPath;
      setBalatroInstallPath(normalizedStoredPath);
    }
  }

  if (existingResult && alertShown) {
    if (existingResult === "success" && storedPath) {
      return [
        {
          id: createAlertId(),
          type: "success",
          title: "Balatro path detected",
          message: `Balatro path available\n${storedPath}`,
        },
      ];
    }
    return [];
  }

  if (existingResult && !alertShown) {
    setBalatroAutofindAlertShown(true);
    return [
      {
        id: createAlertId(),
        type: existingResult === "success" ? "success" : "danger",
        title:
          existingResult === "success"
            ? "Balatro path detected"
            : "Balatro path not available",
        message:
          existingResult === "success"
            ? `Balatro path was set earlier.${
                storedPath ? `\n${storedPath}` : ""
              }`
            : "Balatro path could not be determined earlier.",
      },
    ];
  }

  try {
    const data = await dataDir();
    const basePath = data || (await homeDir());
    const rawPath = normalizeWindowsSeparators(
      data
        ? await join(basePath, "Balatro")
        : await join(basePath, "AppData", "Roaming", "Balatro"),
    );
    console.debug("[balatro-autofind] resolved path", {
      basePath,
      usedDataDir: Boolean(data),
      rawPath,
    });
    setBalatroInstallPath(rawPath);
    setBalatroAutofindResult("success");

    if (!getBalatroAutofindAlertShown()) {
      setBalatroAutofindAlertShown(true);
    }
    return [
      {
        id: createAlertId(),
        type: "success",
        title: "Balatro path detected",
        message: `Default Balatro path set (not verified)\n${rawPath}`,
      },
    ];
  } catch {
    setBalatroAutofindResult("failure");
    if (!getBalatroAutofindAlertShown()) {
      setBalatroAutofindAlertShown(true);
      return [
        {
          id: createAlertId(),
          type: "danger",
          title: "Balatro path not available",
          message: "Unable to determine the default Balatro path.",
        },
      ];
    }
  }

  return [];
};
