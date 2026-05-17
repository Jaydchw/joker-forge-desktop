import { getVersion } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { valid, gt } from "semver";
import { RELEASE_CHANNEL } from "@/generated/release-channel";

type ReleaseChannel = "stable" | "nightly";
type Platform = "windows" | "linux" | "unsupported";

interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  name: string;
  tag_name: string;
  html_url: string;
  prerelease: boolean;
  draft: boolean;
  assets: GitHubReleaseAsset[];
}

const REPO_OWNER = "Jaydchw";
const REPO_NAME = "joker-forge-desktop";
const API_BASE = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;

const isNightlyVersion = (version: string) => version.includes("-nightly.");
const isNightlyTag = (value: string) => /^nightly-/i.test(value);
const isNightlyNamedRelease = (release: GitHubRelease) =>
  isNightlyTag(release.tag_name) || /nightly/i.test(release.name);

const UPDATE_CHECK_DEV_OVERRIDE =
  import.meta.env.VITE_ENABLE_UPDATE_CHECK_IN_DEV === "true";
const UPDATE_TEST_CHANNEL =
  import.meta.env.VITE_UPDATE_TEST_CHANNEL === "nightly" ||
  import.meta.env.VITE_UPDATE_TEST_CHANNEL === "stable"
    ? (import.meta.env.VITE_UPDATE_TEST_CHANNEL as ReleaseChannel)
    : null;
const UPDATE_TEST_CURRENT_VERSION =
  import.meta.env.VITE_UPDATE_TEST_CURRENT_VERSION?.trim() || null;

let hasCheckedForUpdateOnLaunch = false;

const getCurrentPlatform = (): Platform => {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("windows")) return "windows";
  if (ua.includes("linux")) return "linux";
  return "unsupported";
};

const normalizeVersion = (value: string): string | null => {
  const withoutNightlyPrefix = value.replace(/^nightly-/, "");
  const withoutVPrefix = withoutNightlyPrefix.replace(/^v/, "");
  // Ensure `.local` is considered older than any timestamp
  const noLocal = withoutVPrefix.replace(/\.local$/, ".0");
  const fixedLeadingZeros = noLocal
    .split(".")
    .map((part) =>
      /^[0-9]+$/.test(part) ? parseInt(part, 10).toString() : part,
    )
    .join(".");
  return valid(fixedLeadingZeros);
};

const parseReleaseVersion = (release: GitHubRelease): string | null => {
  const tagVersion = normalizeVersion(release.tag_name);
  if (tagVersion) return tagVersion;
  return normalizeVersion(release.name);
};

const selectInstallerAsset = (
  release: GitHubRelease,
  platform: Platform,
): GitHubReleaseAsset | null => {
  if (platform === "windows") {
    return release.assets.find((asset) => /\.exe$/i.test(asset.name)) ?? null;
  }

  if (platform === "linux") {
    return (
      release.assets.find((asset) => /\.AppImage$/i.test(asset.name)) ??
      release.assets.find((asset) => /\.deb$/i.test(asset.name)) ??
      null
    );
  }

  return null;
};

const getReleasesPage = async (): Promise<GitHubRelease[] | null> => {
  const response = await fetch(`${API_BASE}/releases?per_page=50`, {
    headers: { Accept: "application/vnd.github+json" },
  });

  if (!response.ok) {
    console.warn("[release-updater] GitHub releases request failed", {
      status: response.status,
    });
    return null;
  }

  return (await response.json()) as GitHubRelease[];
};

const getLatestStableRelease = async (): Promise<GitHubRelease | null> => {
  const releases = await getReleasesPage();
  if (!releases) return null;

  return (
    releases.find(
      (release) => !release.draft && !isNightlyNamedRelease(release),
    ) ?? null
  );
};

const getLatestNightlyRelease = async (): Promise<GitHubRelease | null> => {
  const releases = await getReleasesPage();
  if (!releases) return null;

  return (
    releases.find(
      (release) =>
        !release.draft && release.prerelease && isNightlyTag(release.tag_name),
    ) ?? null
  );
};

const getLatestReleaseForChannel = async (
  channel: ReleaseChannel,
): Promise<GitHubRelease | null> => {
  return channel === "nightly"
    ? getLatestNightlyRelease()
    : getLatestStableRelease();
};

export const performUpdate = async (asset: GitHubReleaseAsset) => {
  const localPath = await invoke<string>("download_release_asset", {
    url: asset.browser_download_url,
    fileName: asset.name,
  });
  
  await invoke("install_update_and_restart", {
    installerPath: localPath,
  });

  try {
    await getCurrentWindow().close();
  } catch {
    // If closing fails, installer is still launched so this is non-fatal.
  }
};

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  channel: string;
  asset: GitHubReleaseAsset;
}

type UpdateListener = (info: UpdateInfo) => void;
const listeners = new Set<UpdateListener>();

export const onUpdateAvailable = (listener: UpdateListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const checkForReleaseUpdateOnLaunch = async () => {
  console.log("[release-updater] checkForReleaseUpdateOnLaunch called", {
    hasCheckedAlready: hasCheckedForUpdateOnLaunch,
    isDev: import.meta.env.DEV,
    devOverride: UPDATE_CHECK_DEV_OVERRIDE,
    releaseChannel: RELEASE_CHANNEL,
    testChannel: UPDATE_TEST_CHANNEL,
    testVersion: UPDATE_TEST_CURRENT_VERSION,
  });

  if (hasCheckedForUpdateOnLaunch) {
    console.log("[release-updater] Already checked on this launch, skipping");
    return;
  }
  hasCheckedForUpdateOnLaunch = true;

  if (import.meta.env.DEV && !UPDATE_CHECK_DEV_OVERRIDE) {
    console.log("[release-updater] Skipping update check in dev mode (set VITE_ENABLE_UPDATE_CHECK_IN_DEV=true to override)");
    return;
  }

  try {
    const resolvedCurrentVersion =
      UPDATE_TEST_CURRENT_VERSION ?? (await getVersion());
    console.log("[release-updater] Current version resolved", { resolvedCurrentVersion });

    const channel: ReleaseChannel =
      UPDATE_TEST_CHANNEL ??
      (RELEASE_CHANNEL === "nightly" || isNightlyVersion(resolvedCurrentVersion)
        ? "nightly"
        : "stable");
    console.log("[release-updater] Using channel", { channel });

    console.log("[release-updater] Fetching latest release...");
    const latestRelease = await getLatestReleaseForChannel(channel);
    if (!latestRelease) {
      console.info("[release-updater] No candidate release found", {
        channel,
      });
      return;
    }
    console.log("[release-updater] Latest release fetched", {
      tag: latestRelease.tag_name,
      name: latestRelease.name,
      prerelease: latestRelease.prerelease,
      assetCount: latestRelease.assets.length,
      assets: latestRelease.assets.map((a) => a.name),
    });

    const currentNormalized = normalizeVersion(resolvedCurrentVersion);
    const latestNormalized = parseReleaseVersion(latestRelease);
    console.log("[release-updater] Version comparison", {
      currentNormalized,
      latestNormalized,
    });
    if (!currentNormalized || !latestNormalized) {
      console.warn("[release-updater] Could not normalize versions", {
        currentVersion: resolvedCurrentVersion,
        latestTag: latestRelease.tag_name,
        latestName: latestRelease.name,
      });
      return;
    }

    if (!gt(latestNormalized, currentNormalized)) {
      console.info("[release-updater] Already up to date", {
        channel,
        currentNormalized,
        latestNormalized,
      });
      return;
    }

    console.log("[release-updater] Update available!", { currentNormalized, latestNormalized });

    const platform = getCurrentPlatform();
    console.log("[release-updater] Detected platform", { platform });
    const installerAsset = selectInstallerAsset(latestRelease, platform);
    console.log("[release-updater] Installer asset selected", { installerAsset: installerAsset?.name ?? null });

    if (!installerAsset) {
      window.alert(
        `Update found (${latestNormalized}), but no installer was found for your platform.`,
      );
      return;
    }

    const updateInfo: UpdateInfo = {
      currentVersion: resolvedCurrentVersion,
      latestVersion: latestNormalized,
      channel,
      asset: installerAsset,
    };

    if (listeners.size > 0) {
      listeners.forEach((listener) => listener(updateInfo));
    } else {
      console.warn("[release-updater] No listeners registered for update UI.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[release-updater] Update check failed", message);
  }
};
