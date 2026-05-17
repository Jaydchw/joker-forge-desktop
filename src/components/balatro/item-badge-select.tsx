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

const SOFT_LIGHT_SURFACE = "#f5f7fb";

const VANILLA_SET_COLORS: Record<string, string> = {
  Tarot: "#b26cbb",
  Planet: "#13afce",
  Spectral: "#4584fa",
};

function normalizeHex(value: string | undefined): string | null {
  if (!value) return null;
  const clean = value.replace("#", "").replace(/[^0-9a-fA-F]/g, "");
  if (!clean) return null;
  const normalized = clean.slice(0, 6).padEnd(6, "0");
  return `#${normalized}`;
}

function isDarkHexColor(hex: string): boolean {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return false;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.38;
}

function getSetColor(
  setOption: ReturnType<typeof getAllConsumableSets>[number] | undefined,
): string {
  if (!setOption) return "#666666";
  if (setOption.isCustom) {
    return normalizeHex(setOption.customData.primary_colour) || "#666666";
  }
  return VANILLA_SET_COLORS[setOption.value] || "#666666";
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
  const currentColor = currentOption?.color || "#666666";
  const currentIsDark = isDarkHexColor(currentColor);
  const currentSurface = currentIsDark
    ? SOFT_LIGHT_SURFACE
    : `${currentColor}20`;
  const triggerShadow = currentIsDark
    ? "inset 0 0 0 1px rgba(255,255,255,0.85), 0 1px 2px rgba(15,23,42,0.08)"
    : undefined;
  const placeholder = kind === "rarity" ? "Select Rarity" : "Select Set";

  const triggerClass = cn(
    "h-8 font-bold uppercase tracking-wider border-2 transition-colors focus:ring-0 focus:ring-offset-0 bg-popover!",
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
          borderColor: currentColor,
          color: currentColor,
          backgroundColor: currentSurface,
          boxShadow: triggerShadow,
        }}
      >
        {currentOption?.label || (kind === "rarity" ? "Common" : "Tarot")}
      </div>
    );
  }

  return (
    <Select value={normalizedValue} onValueChange={onChange}>
      <SelectTrigger
        className={triggerClass}
        style={{
          borderColor: currentColor,
          color: currentColor,
          backgroundColor: currentSurface,
          boxShadow: triggerShadow,
        }}
      >
        <SelectValue
          placeholder={placeholder}
          style={{
            color: currentColor,
            backgroundColor: currentSurface,
            borderRadius: 6,
            paddingInline: 2,
          }}
        />
      </SelectTrigger>
      <SelectContent className="border-none bg-popover p-2 shadow-xl">
        {options.map((option) => {
          const isDark = isDarkHexColor(option.color);
          const surface = isDark ? SOFT_LIGHT_SURFACE : `${option.color}20`;
          return (
            <SelectItem
              key={option.key}
              value={option.value}
              className="font-bold uppercase tracking-wider cursor-pointer my-2 border-2 transition-all hover:scale-105 focus:scale-105 focus:bg-transparent"
              style={{
                borderColor: option.color,
                color: option.color,
                backgroundColor: surface,
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
