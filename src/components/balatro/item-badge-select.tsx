import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getAllConsumableSets,
  getAllRarities,
  getRarityBadgeColor,
} from "@/lib/balatro/balatro-utils";
import { cn } from "@/lib/core/utils";

interface ItemBadgeSelectProps {
  kind: "rarity" | "set";
  value: string | number;
  onChange?: (value: string) => void;
  className?: string;
  interactive?: boolean;
}

const VANILLA_SET_COLORS: Record<string, string> = {
  Tarot: "#b26cbb",
  Planet: "#13afce",
  Spectral: "#4584fa",
};

const DEFAULT_BADGE_COLOR = "#666666";
const BADGE_SURFACE_TARGET = "#070a0d";

type RgbColor = { r: number; g: number; b: number };
type BadgePalette = {
  background: string;
  border: string;
  foreground: string;
};

function normalizeHex(value: string | undefined): string | null {
  if (!value) return null;
  const clean = value.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return `#${clean
      .split("")
      .map((character) => character.repeat(2))
      .join("")}`.toLowerCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return `#${clean.toLowerCase()}`;
  }
  return null;
}

function hexToRgb(hex: string): RgbColor {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function rgbToHex({ r, g, b }: RgbColor): string {
  const channel = (value: number) =>
    Math.round(value).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function relativeLuminance(color: RgbColor): number {
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(color.r) +
    0.7152 * channel(color.g) +
    0.0722 * channel(color.b)
  );
}

function contrastRatio(first: RgbColor, second: RgbColor): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

function mixColor(color: RgbColor, target: RgbColor, amount: number): RgbColor {
  return {
    r: color.r + (target.r - color.r) * amount,
    g: color.g + (target.g - color.g) * amount,
    b: color.b + (target.b - color.b) * amount,
  };
}

function getBadgePalette(rawColor: string | undefined): BadgePalette {
  const mainColor = normalizeHex(rawColor) || DEFAULT_BADGE_COLOR;
  const mainRgb = hexToRgb(mainColor);
  const surfaceTarget = hexToRgb(BADGE_SURFACE_TARGET);
  const backgroundRgb = mixColor(mainRgb, surfaceTarget, 0.78);
  const background = rgbToHex(backgroundRgb);

  // Preserve the configured color unless it is too dark to remain readable on
  // its darkened surface. Near-black colors are lifted toward white just enough
  // to meet normal-text contrast while retaining their neutral character.
  let accentRgb = mainRgb;
  let lift = 0;
  const white = hexToRgb("#ffffff");
  while (contrastRatio(backgroundRgb, accentRgb) < 4.5 && lift < 1) {
    lift = Math.min(1, lift + 0.05);
    accentRgb = mixColor(mainRgb, white, lift);
  }
  const accent = rgbToHex(accentRgb);

  return { background, border: accent, foreground: accent };
}

function getSetColor(
  setOption: ReturnType<typeof getAllConsumableSets>[number] | undefined,
): string {
  if (!setOption) return DEFAULT_BADGE_COLOR;
  if (setOption.isCustom) {
    return (
      normalizeHex(setOption.customData.primary_colour) || DEFAULT_BADGE_COLOR
    );
  }
  return VANILLA_SET_COLORS[setOption.value] || DEFAULT_BADGE_COLOR;
}

export function ItemBadgeSelect({
  kind,
  value,
  onChange,
  className,
  interactive = true,
}: ItemBadgeSelectProps) {
  const normalizedValue = String(value ?? "");

  const options =
    kind === "rarity"
      ? getAllRarities().map((rarity) => ({
          key: rarity.key,
          value: rarity.value.toString(),
          label: rarity.label,
          color: getRarityBadgeColor(rarity.value),
        }))
      : getAllConsumableSets().map((setOption) => ({
          key: setOption.key,
          value: setOption.value,
          label: setOption.label,
          color: getSetColor(setOption),
        }));

  const currentOption =
    options.find((option) => option.value === normalizedValue) || options[0];
  const currentPalette = getBadgePalette(currentOption?.color);
  const placeholder = kind === "rarity" ? "Select Rarity" : "Select Set";

  const triggerClass = cn(
    "h-8 border-[3px] font-bold uppercase tracking-wider outline-none transition-[filter] focus-visible:!ring-0 focus-visible:!ring-offset-0",
    interactive ? "cursor-pointer" : "cursor-default",
    className,
  );

  if (!interactive || !onChange) {
    return (
      <div
        className={cn(
          triggerClass,
          "inline-flex min-w-36 items-center justify-center rounded-md px-3",
        )}
        style={{
          borderColor: currentPalette.border,
          color: currentPalette.foreground,
          backgroundColor: currentPalette.background,
          boxShadow: "none",
        }}
      >
        {currentOption?.label || (kind === "rarity" ? "Common" : "Tarot")}
      </div>
    );
  }

  return (
    <Select value={normalizedValue} onValueChange={onChange}>
      <SelectTrigger
        showChevron={false}
        className={triggerClass}
        style={{
          borderColor: currentPalette.border,
          color: currentPalette.foreground,
          backgroundColor: currentPalette.background,
          boxShadow: "none",
        }}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="border-none bg-popover p-2 shadow-xl">
        {options.map((option) => {
          const palette = getBadgePalette(option.color);
          return (
            <SelectItem
              key={option.key}
              value={option.value}
              className="my-1 cursor-pointer border-[3px] font-bold uppercase tracking-wider transition-[filter,box-shadow] hover:brightness-110 focus:brightness-110 focus:ring-0 [&_[data-slot=select-item-indicator]_svg]:!text-current"
              style={{
                borderColor: palette.border,
                color: palette.foreground,
                backgroundColor: palette.background,
              }}
            >
              {option.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
