import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { Input } from "@/components/ui/input";

import { cn } from "@/lib/utils";

type SliderProps = React.ComponentProps<typeof SliderPrimitive.Root> & {
  variant?: "simple" | "enhanced";
  showValueInput?: boolean;
  valueInputAriaLabel?: string;
  valueSuffix?: string;
  minLabel?: string;
  maxLabel?: string;
  valueFormatter?: (value: number) => string;
  valueParser?: (raw: string) => number | null;
  onInlineValueCommit?: (value: number) => void;
};

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  onValueChange,
  variant,
  showValueInput = false,
  valueInputAriaLabel = "Slider value",
  valueSuffix,
  minLabel,
  maxLabel,
  valueFormatter,
  valueParser,
  onInlineValueCommit,
  ...props
}: SliderProps) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min],
    [value, defaultValue, min],
  );
  const primaryValue = _values[0] ?? min;
  const [draftValue, setDraftValue] = React.useState<string | null>(null);
  const hasEnhancedOptions =
    showValueInput ||
    valueSuffix !== undefined ||
    minLabel !== undefined ||
    maxLabel !== undefined ||
    valueFormatter !== undefined ||
    valueParser !== undefined ||
    onInlineValueCommit !== undefined;
  const useEnhancedVariant =
    variant === "enhanced" || (variant !== "simple" && hasEnhancedOptions);

  const formatValue = React.useCallback(
    (next: number) => (valueFormatter ? valueFormatter(next) : String(next)),
    [valueFormatter],
  );

  const parseValue = React.useCallback(
    (raw: string): number | null => {
      if (valueParser) return valueParser(raw);
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : null;
    },
    [valueParser],
  );

  const commitInlineValue = React.useCallback(() => {
    if (draftValue === null) return;
    const parsed = parseValue(draftValue.trim());
    setDraftValue(null);
    if (parsed === null) return;
    const clamped = Math.min(max, Math.max(min, parsed));
    if (onInlineValueCommit) {
      onInlineValueCommit(clamped);
      return;
    }
    if (onValueChange) {
      const nextValues = [..._values];
      nextValues[0] = clamped;
      onValueChange(nextValues);
    }
  }, [
    draftValue,
    max,
    min,
    onInlineValueCommit,
    onValueChange,
    parseValue,
    _values,
  ]);

  const renderedValue = draftValue ?? formatValue(primaryValue);

  const sliderRoot = (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      onValueChange={onValueChange}
      className={cn(
        "relative flex w-full touch-none items-center select-none cursor-pointer data-disabled:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          "bg-muted relative grow overflow-hidden rounded-full cursor-pointer data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5",
        )}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            "bg-primary absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full",
          )}
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className="border-primary ring-ring/50 block size-4 shrink-0 rounded-full border bg-white shadow-sm cursor-pointer transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  );

  if (!useEnhancedVariant) {
    return sliderRoot;
  }

  return (
    <div className="space-y-1">
      {showValueInput && (
        <div className="flex justify-end">
          <div className="flex items-center text-xs font-mono text-muted-foreground">
            <Input
              type="number"
              value={renderedValue}
              onChange={(event) => setDraftValue(event.target.value)}
              onFocus={() => setDraftValue(formatValue(primaryValue))}
              onBlur={commitInlineValue}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  (event.currentTarget as HTMLInputElement).blur();
                }
              }}
              className="h-auto w-10 border-0 !bg-transparent dark:!bg-transparent p-0 text-right font-mono text-xs text-muted-foreground shadow-none focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label={valueInputAriaLabel}
            />
            {valueSuffix ? <span>{valueSuffix}</span> : null}
          </div>
        </div>
      )}
      {sliderRoot}
      {(minLabel || maxLabel) && (
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{minLabel ?? ""}</span>
          <span>{maxLabel ?? ""}</span>
        </div>
      )}
    </div>
  );
}

export { Slider };
