const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const packageFile = path.join(root, "package.json");
const tauriConfigFile = path.join(root, "src-tauri", "tauri.conf.json");
const cargoTomlFile = path.join(root, "src-tauri", "Cargo.toml");
const releaseChannelFile = path.join(
  root,
  "src",
  "generated",
  "release-channel.ts",
);

const args = process.argv.slice(2);

const getArg = (name) => {
  const index = args.findIndex((value) => value === `--${name}`);
  if (index === -1 || index + 1 >= args.length) return null;
  return args[index + 1];
};

const channel = getArg("channel") || "stable";

if (channel !== "stable" && channel !== "nightly") {
  throw new Error("--channel must be 'stable' or 'nightly'");
}

function resolveVersion() {
  const fromArg = getArg("version");
  if (fromArg) return fromArg;

  const fromEnv = process.env.RELEASE_VERSION?.trim();
  if (fromEnv) return fromEnv;

  const { version: baseVersion } = JSON.parse(
    fs.readFileSync(path.join(root, "app-version.json"), "utf8"),
  );
  return channel === "nightly" ? `${baseVersion}-nightly.local` : baseVersion;
}

const version = resolveVersion();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function writeReleaseChannel(channelName) {
  const channelFileContents = `export const RELEASE_CHANNEL: "stable" | "nightly" = "${channelName}";\n`;
  fs.mkdirSync(path.dirname(releaseChannelFile), { recursive: true });
  fs.writeFileSync(releaseChannelFile, channelFileContents, "utf8");
}

const pkg = readJson(packageFile);
pkg.version = version;
writeJson(packageFile, pkg);

const tauri = readJson(tauriConfigFile);
tauri.version = version;
tauri.app = tauri.app || {};
tauri.app.windows = Array.isArray(tauri.app.windows) ? tauri.app.windows : [];

if (tauri.app.windows.length > 0) {
  tauri.app.windows = tauri.app.windows.map((windowConfig) => ({
    ...windowConfig,
    title: channel === "nightly" ? "Joker Forge Nightly" : "Joker Forge",
  }));
}

if (channel === "nightly") {
  tauri.productName = "Joker Forge Nightly";
  tauri.identifier = "com.jaydchw.joker-forge-desktop.nightly";
} else {
  tauri.productName = "Joker Forge";
  tauri.identifier = "com.jaydchw.joker-forge-desktop";
}

writeJson(tauriConfigFile, tauri);

const cargoContents = fs.readFileSync(cargoTomlFile, "utf8");
const nextCargo = cargoContents.replace(
  /(\[package\][\s\S]*?\nversion\s*=\s*")([^"]+)(")/,
  `$1${version}$3`,
);
fs.writeFileSync(cargoTomlFile, nextCargo, "utf8");
writeReleaseChannel(channel);

console.log(`Prepared ${channel} release config at version ${version}`);
