import * as React from "react";
import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/core/utils";

export interface SearchableSelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

interface SearchableSelectProps<T extends SearchableSelectOption> {
  options: readonly T[];
  value?: string | number;
  onValueChange: (value: string, option: T) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  "aria-label"?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "default";
}

const ROW_HEIGHT = 32;
const OVERSCAN = 5;

export function SearchableSelect<T extends SearchableSelectOption>({
  options,
  value,
  onValueChange,
  placeholder = "Select option",
  searchPlaceholder = "Search options…",
  emptyMessage = "No matching options",
  "aria-label": ariaLabel = placeholder,
  id,
  disabled,
  className,
  size = "sm",
}: SearchableSelectProps<T>) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [scrollTop, setScrollTop] = React.useState(0);
  const [viewportHeight, setViewportHeight] = React.useState(256);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const selectedOption = React.useMemo(
    () => options.find((option) => String(option.value) === String(value)),
    [options, value],
  );
  const filteredOptions = React.useMemo(() => {
    const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return options;
    return options.filter((option) => {
      const searchable = `${option.label} ${option.value}`.toLocaleLowerCase();
      return words.every((word) => searchable.includes(word));
    });
  }, [options, query]);
  const virtualized = filteredOptions.length > 80;

  React.useLayoutEffect(() => {
    const list = listRef.current;
    if (!open || !list) return;
    const measure = () => setViewportHeight(list.clientHeight || 256);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [open, virtualized, filteredOptions.length]);

  React.useLayoutEffect(() => {
    const list = listRef.current;
    if (!open || !list || highlightedIndex < 0) return;
    const top = highlightedIndex * ROW_HEIGHT;
    const bottom = top + ROW_HEIGHT;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = bottom - list.clientHeight;
    }
    setScrollTop(list.scrollTop);
  }, [open, highlightedIndex]);

  const start = virtualized
    ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
    : 0;
  const end = virtualized
    ? Math.min(filteredOptions.length, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN)
    : filteredOptions.length;
  const visibleIndices = Array.from({ length: Math.max(0, end - start) }, (_, i) => start + i);
  if (virtualized && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length
    && (highlightedIndex < start || highlightedIndex >= end)) {
    visibleIndices.push(highlightedIndex);
  }

  return (
    <Combobox.Root<T>
      items={options}
      filteredItems={filteredOptions}
      filter={null}
      virtualized
      value={selectedOption ?? null}
      inputValue={query}
      open={open}
      disabled={disabled}
      autoHighlight
      isItemEqualToValue={(item, selected) => String(item.value) === String(selected.value)}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        setQuery("");
        setScrollTop(0);
        setHighlightedIndex(-1);
      }}
      onInputValueChange={(nextQuery) => {
        setQuery(nextQuery);
        setScrollTop(0);
        if (listRef.current) listRef.current.scrollTop = 0;
      }}
      onItemHighlighted={(_, details) => setHighlightedIndex(details.index)}
      onValueChange={(option) => {
        if (option && !option.disabled) onValueChange(String(option.value), option);
      }}
    >
      <Combobox.Trigger
        id={id}
        aria-label={ariaLabel}
        data-slot="searchable-select-trigger"
        data-size={size}
        className={cn(
          "group flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border-2 border-border bg-card px-3 py-2 text-sm shadow-xs outline-none transition-all hover:border-primary/50 hover:bg-accent/50 focus-visible:border-primary/50 focus-visible:ring-4 focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8",
          className,
        )}
      >
        <span className={cn("truncate", !selectedOption && (value === undefined || value === "") && "text-muted-foreground")}>
          {selectedOption?.label ?? (value !== undefined && value !== "" ? String(value) : placeholder)}
        </span>
        <ChevronDown className="size-4 shrink-0 opacity-50" />
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner align="start" sideOffset={4} className="isolate z-120">
          <Combobox.Popup
            aria-label={ariaLabel}
            initialFocus={inputRef}
            className="flex max-h-(--available-height) w-(--anchor-width) min-w-48 max-w-(--available-width) flex-col overflow-hidden rounded-xl border-2 border-border bg-popover text-popover-foreground shadow-xl outline-none"
          >
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <Combobox.Input
                ref={inputRef}
                aria-label={`Search ${ariaLabel.toLocaleLowerCase()}`}
                placeholder={searchPlaceholder}
                className="h-full min-w-0 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Combobox.Empty className={filteredOptions.length ? "hidden" : "px-3 py-5 text-center text-sm text-muted-foreground"}>
              {emptyMessage}
            </Combobox.Empty>
            <Combobox.List
              ref={listRef}
              className="min-h-0 overflow-y-auto overscroll-contain"
              style={{ height: Math.min(256, filteredOptions.length * ROW_HEIGHT) }}
              onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
            >
              <div className="relative" style={{ height: filteredOptions.length * ROW_HEIGHT }}>
                {visibleIndices.map((index) => {
                  const option = filteredOptions[index];
                  return (
                    <Combobox.Item
                      key={String(option.value)}
                      value={option}
                      index={index}
                      disabled={option.disabled}
                      aria-setsize={filteredOptions.length}
                      aria-posinset={index + 1}
                      className="absolute inset-x-0 flex cursor-default items-center gap-2 px-3 text-sm outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-50"
                      style={{ top: index * ROW_HEIGHT, height: ROW_HEIGHT }}
                    >
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      <Combobox.ItemIndicator><Check className="size-4 shrink-0" /></Combobox.ItemIndicator>
                    </Combobox.Item>
                  );
                })}
              </div>
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
