import { useEffect, useMemo, useState } from "react";
import { X } from "@phosphor-icons/react";

type KeybindInputProps = {
  value: string;
  onChange: (next: string) => void;
};

const normalizeKey = (raw: string): string => {
  const key = raw.toLowerCase();
  if (key === "escape") return "esc";
  if (key === "backspace") return "delete";
  if (key === " ") return "space";
  return key;
};

const isModifierOnly = (key: string): boolean =>
  key === "control" || key === "meta" || key === "alt" || key === "shift";

const toShortcut = (event: KeyboardEvent): string => {
  const key = normalizeKey(event.key);
  if (isModifierOnly(key)) return "";

  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push("ctrl");
  if (event.altKey) parts.push("alt");
  if (event.shiftKey) parts.push("shift");
  parts.push(key);
  return parts.join("+");
};

const formatForDisplay = (shortcut: string): string =>
  shortcut
    .split("+")
    .filter(Boolean)
    .map((part) =>
      part.length <= 1 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1),
    )
    .join(" + ");

export default function KeybindInput({ value, onChange }: KeybindInputProps) {
  const [isListening, setIsListening] = useState(false);
  const displayValue = useMemo(() => formatForDisplay(value), [value]);

  useEffect(() => {
    if (!isListening) return;

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const shortcut = toShortcut(event);
      if (shortcut) {
        onChange(shortcut);
        setIsListening(false);
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isListening, onChange]);

  return (
    <div className="flex h-9 items-center rounded-md border border-input bg-transparent">
      <button
        type="button"
        onClick={() => setIsListening(true)}
        className="h-full min-w-0 flex-1 px-3 text-left text-xs font-mono transition hover:bg-muted/30"
      >
        {isListening ? "Press keys..." : displayValue || "Not Set"}
      </button>
      <div className="h-5 w-px bg-border" />
      <button
        type="button"
        className="inline-flex h-full w-9 items-center justify-center text-muted-foreground transition hover:bg-muted/30 hover:text-foreground"
        onClick={() => onChange("")}
        aria-label="Clear keybind"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
