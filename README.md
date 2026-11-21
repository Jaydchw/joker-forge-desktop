# Joker Forge (Desktop)

Joker Forge is a desktop app for building Balatro mod content.

This project uses:
- Tauri (Rust backend + desktop packaging)
- React + TypeScript (UI)

## What It Does

- Create and manage mod data through a desktop UI
- Export generated content for your mod workflow
- Run as a native desktop app on Windows, Linux, and macOS

**Joker Forge and Joker Forge Desktop developers have used AI coding tools to assist with development. This is a disclaimer**


## Downloads

- Nightly builds are published on the GitHub Releases page for this repository.
- Nightly tags look like: `nightly-<base>-nightly.<YYYYMMDD>.<run_number>`

## Project Links

- Tauri docs: https://tauri.app/start/
- Tauri v2 docs: https://v2.tauri.app/
- React docs: https://react.dev/
- TypeScript docs: https://www.typescriptlang.org/docs/
- GitHub Actions docs: https://docs.github.com/actions

## Local Development

Requirements:
- Node.js 20+
- Rust toolchain
- Tauri prerequisites for your OS

Install dependencies:

```bash
npm ci
```

Run the Vite dev server only (no Tauri):

```bash
npm run dev
```

Run the full desktop app in dev mode:

```bash
# Stable channel
npm run stable

# Nightly channel
npm run nightly
```

These commands prepare the app identity and version for the selected channel before launching Tauri dev.

## Building

Build a production desktop installer:

```bash
# Stable channel
npm run build-stable

# Nightly channel
npm run build-nightly
```

Both commands automatically prepare the correct channel identity and version before invoking `tauri build`. The nightly build uses a `-nightly.local` version suffix. In CI, the nightly version is injected via the `RELEASE_VERSION` environment variable.

For Linux packages, run `npm ci`, prepare the desired channel, then build with `npx tauri build --bundles appimage,deb`. Linux releases use Tauri CLI 2.12.1, which fixes AppImage display-library conflicts with newer Mesa drivers. Use Ubuntu 22.04 as the build baseline; building on a newer distribution can raise the minimum required glibc version. See the [upstream packaging fix](https://github.com/tauri-apps/tauri/pull/16062) and [Tauri's AppImage guidance](https://v2.tauri.app/distribute/appimage/).

Before distributing an AppImage, inspect it with:

```bash
python3 scripts/check-linux-appimage.py src-tauri/target/release/bundle/appimage/*.AppImage
```

The check extracts the package without FUSE and rejects bundled `libwayland-client` copies that can conflict with the host graphics drivers. Nightly Linux builds also check that the app opens a window and stays running for 15 seconds under Xvfb, saving the startup log. This catches early exits; it does not replace testing rendering and interaction on Fedora/Bazzite and a real Wayland desktop.

## Terminal Code Generation Command

You can compile one item payload to Lua directly from terminal:

```bash
npm run codegen:item -- --json '<payload-json>'
```

or

```bash
npm run codegen:item -- --json-file ./payload.json
```

Payload shape:

```json
{
  "itemType": "joker",
  "itemData": {},
  "modPrefix": "mod",
  "includeLocTxt": true,
  "pos": { "x": 0, "y": 0 },
  "soulPos": { "x": 0, "y": 0 },
  "globalUserVariables": []
}
```

- `itemType` supports: `joker`, `consumable`, `voucher`, `deck`, `enhancement`, `seal`, `edition`
- `itemData` must match the normal item data shape used by the app for that item type
- `pos`, `soulPos`, and `globalUserVariables` are optional

## Versioning

- Global app version lives in `app-version.json` — this is the single source of truth.
- `npm run prepare:stable` / `npm run prepare:nightly` sync the version from `app-version.json` into:
  - `package.json`
  - `src-tauri/tauri.conf.json`
  - `src-tauri/Cargo.toml`
  - `src/generated/release-channel.ts`

## Release Channels

| Channel | Product name | App identifier | Version suffix |
|---------|-------------|----------------|----------------|
| Stable  | Joker Forge | `com.jaydchw.joker-forge-desktop` | none |
| Nightly | Joker Forge Nightly | `com.jaydchw.joker-forge-desktop.nightly` | `-nightly.<YYYYMMDD>.<run>` |

Stable and nightly install side-by-side as separate apps.

## App Updates

- Stable builds offer published stable releases only; beta/RC releases and nightlies are excluded.
- Nightly builds offer published nightly prereleases. Version comparison chooses the newest eligible version.
- Windows downloads the matching NSIS installer from this repository, checks its size and SHA256 digest when GitHub supplies them, and verifies the saved file again before installation. Updates wait for pending project and template-library saves, then restart the app after a successful installation.
- Close all stable, nightly, and development copies before a manual Windows installation or uninstallation; older published uninstallers may force-close running copies. Automatic updates refuse to proceed while another copy is open, and installers/uninstallers built from this version require running copies to be closed. Automatic installation uses NSIS update mode to retain the existing installation path and shortcuts.
- Linux and macOS use **Download Update** to open the official release page. Download the package for your computer, close Joker Forge, and follow its normal installation steps.
- Failed downloads or saves keep the app open and offer a retry or manual download.

## Nightly Releases

- Workflow file: `.github/workflows/nightly-release.yml`
- Trigger: every push to `main`
- Builds: Windows (NSIS) + Linux (AppImage + DEB) + macOS (unsigned DMG)
- Publishes a GitHub prerelease with commit messages since the previous nightly
- Retention: keeps the latest 14 nightly releases, older ones are auto-deleted
