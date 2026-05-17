import { getIdentifier, getName, getVersion } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { RELEASE_CHANNEL } from "@/generated/release-channel";

export const detectNightlyChannel = async (
  source = "unknown",
): Promise<boolean> => {
  const fromGeneratedChannel = RELEASE_CHANNEL === "nightly";
  const appWindow = getCurrentWindow();

  const [identifier, version, appName, windowTitle] = await Promise.all([
    getIdentifier().catch(() => ""),
    getVersion().catch(() => ""),
    getName().catch(() => ""),
    appWindow.title().catch(() => ""),
  ]);

  const isNightly =
    fromGeneratedChannel ||
    /\.nightly$/i.test(identifier) ||
    version.includes("-nightly.") ||
    /nightly/i.test(appName) ||
    /nightly/i.test(windowTitle);

  console.log("[nightly-detect]", {
    source,
    generatedChannel: RELEASE_CHANNEL,
    fromGeneratedChannel,
    identifier,
    version,
    appName,
    windowTitle,
    isNightly,
  });

  return isNightly;
};
