import { useCallback, useMemo } from "react";
import { Palette } from "@phosphor-icons/react";
import { ArrowsClockwise, Minus, Plus } from "@phosphor-icons/react";
import { HexColorPicker } from "react-colorful";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";

export interface GenericDialogColorPickerProps {
  value?: string;
  onChange: (value: string) => void;
  defaultColor?: string;
  valueMode?: "with-hash" | "without-hash";
  placeholder?: string;
  showBadgePreview?: boolean;
}

const normalizeColorHex = (
  value: string | undefined,
  fallback = "#666666",
): string => {
  const fallbackHex = fallback.replace("#", "").replace(/[^0-9a-fA-F]/g, "");
  const source = (value || "").replace("#", "").replace(/[^0-9a-fA-F]/g, "");
  const resolved = (source || fallbackHex || "666666")
    .slice(0, 6)
    .padEnd(6, "0");
  return `#${resolved.toUpperCase()}`;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const hexToRgb = (hex: string) => {
  const normalized = normalizeColorHex(hex);
  const raw = normalized.replace("#", "");
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
  };
};

const rgbToHex = (r: number, g: number, b: number) => {
  const toHex = (channel: number) =>
    clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
};

const rgbToHsl = (r: number, g: number, b: number) => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));

    switch (max) {
      case rn:
        h = ((gn - bn) / delta) % 6;
        break;
      case gn:
        h = (bn - rn) / delta + 2;
        break;
      default:
        h = (rn - gn) / delta + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
};

const hslToRgb = (h: number, s: number, l: number) => {
  const hn = ((h % 360) + 360) % 360;
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;

  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = ln - c / 2;

  let rn = 0;
  let gn = 0;
  let bn = 0;

  if (hn < 60) {
    rn = c;
    gn = x;
  } else if (hn < 120) {
    rn = x;
    gn = c;
  } else if (hn < 180) {
    gn = c;
    bn = x;
  } else if (hn < 240) {
    gn = x;
    bn = c;
  } else if (hn < 300) {
    rn = x;
    bn = c;
  } else {
    rn = c;
    bn = x;
  }

  return {
    r: Math.round((rn + m) * 255),
    g: Math.round((gn + m) * 255),
    b: Math.round((bn + m) * 255),
  };
};


export function GenericDialogColorPicker({
  value,
  onChange,
  defaultColor = "#666666",
  valueMode = "with-hash",
  placeholder = "#666666",
  showBadgePreview = true,
}: GenericDialogColorPickerProps) {
  const normalized = normalizeColorHex(value, defaultColor);
  const rgb = useMemo(() => hexToRgb(normalized), [normalized]);
  const hsl = useMemo(() => rgbToHsl(rgb.r, rgb.g, rgb.b), [rgb.r, rgb.g, rgb.b]);

  const applyHex = useCallback(
    (next: string) => {
      const normalizedNext = normalizeColorHex(next, defaultColor);
      onChange(
        valueMode === "without-hash"
          ? normalizedNext.replace("#", "")
          : normalizedNext,
      );
    },
    [defaultColor, onChange, valueMode],
  );

  const updateRgbChannel = useCallback(
    (channel: "r" | "g" | "b", next: number) => {
      const merged = {
        r: rgb.r,
        g: rgb.g,
        b: rgb.b,
        [channel]: clamp(next, 0, 255),
      };
      applyHex(rgbToHex(merged.r, merged.g, merged.b));
    },
    [applyHex, rgb.b, rgb.g, rgb.r],
  );

  const updateHslChannel = useCallback(
    (channel: "h" | "s" | "l", next: number) => {
      const merged = {
        h: hsl.h,
        s: hsl.s,
        l: hsl.l,
        [channel]:
          channel === "h" ? clamp(next, 0, 360) : clamp(next, 0, 100),
      };
      const converted = hslToRgb(merged.h, merged.s, merged.l);
      applyHex(rgbToHex(converted.r, converted.g, converted.b));
    },
    [applyHex, hsl.h, hsl.l, hsl.s],
  );

  const nudgeLightness = useCallback(
    (delta: number) => {
      const nextL = clamp(hsl.l + delta, 0, 100);
      const converted = hslToRgb(hsl.h, hsl.s, nextL);
      applyHex(rgbToHex(converted.r, converted.g, converted.b));
    },
    [applyHex, hsl.h, hsl.l, hsl.s],
  );

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
      <div className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-3">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="group relative h-12 w-12 rounded-lg border-2 border-background shadow-sm cursor-pointer transition-transform hover:scale-[1.03]"
              style={{ backgroundColor: normalized }}
              aria-label="Open color picker"
              title="Open color picker"
            >
              <span className="absolute inset-0 rounded-md bg-black/0 group-hover:bg-black/10 transition-colors" />
              <Palette className="absolute right-1.5 bottom-1.5 h-3.5 w-3.5 text-white/90 drop-shadow" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-lg space-y-4 p-4 [&_.react-colorful]:w-full [&_.react-colorful__saturation]:rounded-md [&_.react-colorful__hue]:h-4 [&_.react-colorful__hue]:mt-3 [&_.react-colorful__hue]:rounded"
          >
            <HexColorPicker
              color={normalized}
              onChange={applyHex}
              style={{ width: "100%", height: 300 }}
            />

            <div
              className={`grid items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 ${
                showBadgePreview
                  ? "grid-cols-[10rem_minmax(0,1fr)_auto]"
                  : "grid-cols-[10rem_auto]"
              }`}
            >
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Current Color</p>
                <p className="font-mono text-sm">{normalized}</p>
              </div>

              {showBadgePreview ? (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Badge Preview</p>
                  <div className="rounded-md border border-black/15 px-3 py-1.5 text-center text-xs font-bold tracking-wide shadow-sm" style={{ backgroundColor: normalized, color: "#FFFFFF" }}>
                    BADGE
                  </div>
                </div>
              ) : null}

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => nudgeLightness(-6)}
                  className="h-8 w-8 p-0 cursor-pointer"
                  title="Darker"
                  aria-label="Darker"
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => nudgeLightness(6)}
                  className="h-8 w-8 p-0 cursor-pointer"
                  title="Lighter"
                  aria-label="Lighter"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => applyHex(defaultColor)}
                  className="h-8 px-2 cursor-pointer"
                >
                  <ArrowsClockwise className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 rounded-lg border border-border/50 p-3">
                <p className="text-[11px] font-semibold text-muted-foreground">RGB</p>
                {([
                  ["R", "r", rgb.r],
                  ["G", "g", rgb.g],
                  ["B", "b", rgb.b],
                ] as const).map(([label, key, current]) => (
                  <div key={key} className="grid grid-cols-[1.25rem_minmax(0,1fr)_2.5rem] items-center gap-2">
                    <span className="text-[11px] font-mono text-muted-foreground">{label}</span>
                    <Slider
                      value={[current]}
                      min={0}
                      max={255}
                      step={1}
                      onValueChange={(val) =>
                        updateRgbChannel(key, val[0] ?? current)
                      }
                      className="w-full"
                    />
                    <span className="text-[11px] font-mono text-muted-foreground text-right tabular-nums">{current}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2 rounded-lg border border-border/50 p-3">
                <p className="text-[11px] font-semibold text-muted-foreground">HSL</p>
                {([
                  ["H", "h", hsl.h, 360],
                  ["S", "s", hsl.s, 100],
                  ["L", "l", hsl.l, 100],
                ] as const).map(([label, key, current, max]) => (
                  <div key={key} className="grid grid-cols-[1.25rem_minmax(0,1fr)_2.75rem] items-center gap-2">
                    <span className="text-[11px] font-mono text-muted-foreground">{label}</span>
                    <Slider
                      value={[current]}
                      min={0}
                      max={max}
                      step={1}
                      onValueChange={(val) =>
                        updateHslChannel(key, val[0] ?? current)
                      }
                      className="w-full"
                    />
                    <span className="text-[11px] font-mono text-muted-foreground text-right tabular-nums">{current}</span>
                  </div>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="space-y-1.5">
          <Input
            value={normalized}
            onChange={(event) => applyHex(event.target.value)}
            placeholder={placeholder}
            className="h-9 font-mono uppercase tracking-wide"
          />
          <p className="text-[11px] text-muted-foreground">Click color to edit.</p>
        </div>
      </div>
    </div>
  );
}
