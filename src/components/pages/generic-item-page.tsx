import {
  useState,
  useMemo,
  useEffect,
  useDeferredValue,
  useTransition,
  useRef,
  ReactNode,
  memo,
} from "react";
import {
  Plus,
  MagnifyingGlass,
  ArrowsDownUp,
  Funnel,
  SquaresFour,
  X,
  CaretDown,
  Rows,
  Club,
  Diamond,
  Heart,
  Spade,
  ProhibitInset,
} from "@phosphor-icons/react";
import IconButton from "@/components/ui/icon-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/core/utils";
import { fuzzyMatch, getMatchScore } from "@/lib/core/search";
import { getRandomEmptyStateFlavor } from "@/lib/app/empty-state-flavor";
import { motion } from "framer-motion";
import {
  type AceSelection,
  DEFAULT_ACE_SELECTION,
} from "@/lib/balatro/card-preview-utils";

const ESTIMATED_REGULAR_ROW_HEIGHT = 384;
const VIRTUAL_OVERSCAN_ROWS = 2;

type ColumnMode = "auto" | "1" | "2" | "3";

const getItemKeyForSearch = (item: unknown): string | null => {
  if (!item || typeof item !== "object") return null;
  const candidate =
    (item as Record<string, unknown>).key ??
    (item as Record<string, unknown>).objectKey;
  return typeof candidate === "string" ? candidate : null;
};

export interface SortOption<T> {
  label: string;
  value: string;
  sortFn: (a: T, b: T) => number;
}

export interface FilterOption<T> {
  id: string;
  label: string;
  options: { label: string; value: any }[];
  predicate: (item: T, value: any) => boolean;
}

interface GenericItemPageProps<T> {
  title: string;
  subtitle?: string;
  items: T[];
  searchProps?: {
    placeholder?: string;
    searchFn: (item: T, term: string) => boolean;
  };
  sortOptions: SortOption<T>[];
  defaultSort?: string;
  filterOptions?: FilterOption<T>[];
  onAddNew?: () => void;
  onAddFromTemplate?: () => void;
  addNewLabel?: string;
  addFromTemplateLabel?: string;
  renderCard: (item: T, context: GenericItemPageRenderContext) => ReactNode;
  renderCompactCard?: (item: T, context: GenericItemPageRenderContext) => ReactNode;
  headerContent?: ReactNode;
  reforged?: boolean;
  isLoading?: boolean;
  defaultViewMode?: "regular" | "compact";
  defaultColumnMode?: ColumnMode;
  defaultCompactSize?: number;
  aceSelectorMode?: "none" | "enhancement" | "seal" | "enhancement_or_seal";
  defaultAceSelection?: AceSelection;
}

export interface GenericItemPageRenderContext {
  selectedAce: AceSelection;
}

interface CardRendererProps {
  item: { id: string };
  viewMode: "regular" | "compact";
  renderCard: (item: any) => ReactNode;
  renderCompactCard?: (item: any) => ReactNode;
}

const CardRenderer = memo(
  function CardRendererInner({
    item,
    viewMode,
    renderCard,
    renderCompactCard,
  }: CardRendererProps) {
    return (
      <>
        {viewMode === "compact" && renderCompactCard
          ? renderCompactCard(item)
          : renderCard(item)}
      </>
    );
  },
  (prev: CardRendererProps, next: CardRendererProps) =>
    prev.item === next.item &&
    prev.viewMode === next.viewMode &&
    prev.renderCard === next.renderCard &&
    prev.renderCompactCard === next.renderCompactCard,
);

function GenericItemPageInternal<T extends { id: string }>({
  title,
  subtitle,
  items,
  searchProps,
  sortOptions,
  defaultSort,
  filterOptions,
  onAddNew,
  onAddFromTemplate,
  addNewLabel = "Add New Item",
  addFromTemplateLabel = "Create from Template",
  renderCard,
  renderCompactCard,
  headerContent,
  reforged = false,
  isLoading = false,
  defaultViewMode = "regular",
  defaultColumnMode = "auto",
  defaultCompactSize = 140,
  aceSelectorMode = "none",
  defaultAceSelection = DEFAULT_ACE_SELECTION,
}: GenericItemPageProps<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [currentSort, setCurrentSort] = useState(
    defaultSort || sortOptions[0]?.value,
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [isXlLayout, setIsXlLayout] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1280 : true,
  );
  const storageKeyBase = `jokerforge-${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;

  const [prevTitle, setPrevTitle] = useState(title);

  const [viewMode, setViewMode] = useState<"regular" | "compact">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`${storageKeyBase}-view-mode`);
      if (saved === "regular" || saved === "compact") return saved;
    }
    return defaultViewMode;
  });

  const [columnMode, setColumnMode] = useState<ColumnMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`${storageKeyBase}-column-mode`);
      if (saved === "auto" || saved === "1" || saved === "2" || saved === "3")
        return saved as ColumnMode;
    }
    return defaultColumnMode;
  });

  const [compactCardSizeIndex, setCompactCardSizeIndex] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(
        `${storageKeyBase}-compact-size-index`,
      );
      if (saved) return parseInt(saved, 10);
    }
    // 5 steps: 1=80, 2=120, 3=160, 4=200, 5=240. Default 140 -> maps closely to 3 (160) or 2 (120).
    return Math.max(
      1,
      Math.min(5, Math.round((defaultCompactSize - 80) / 40) + 1),
    );
  });
  const [selectedAce, setSelectedAce] = useState<AceSelection>(
    defaultAceSelection,
  );

  useEffect(() => {
    if (title === prevTitle) return;

    setPrevTitle(title);
    if (typeof window === "undefined") return;

    const savedViewMode = localStorage.getItem(`${storageKeyBase}-view-mode`);
    setViewMode(
      savedViewMode === "regular" || savedViewMode === "compact"
        ? savedViewMode
        : defaultViewMode,
    );

    const savedColumnMode = localStorage.getItem(
      `${storageKeyBase}-column-mode`,
    );
    setColumnMode(
      savedColumnMode === "auto" ||
        savedColumnMode === "1" ||
        savedColumnMode === "2" ||
        savedColumnMode === "3"
        ? (savedColumnMode as ColumnMode)
        : defaultColumnMode,
    );

    const savedCompactSizeIndex = localStorage.getItem(
      `${storageKeyBase}-compact-size-index`,
    );
    setCompactCardSizeIndex(
      savedCompactSizeIndex
        ? parseInt(savedCompactSizeIndex, 10)
        : Math.max(
            1,
            Math.min(5, Math.round((defaultCompactSize - 80) / 40) + 1),
          ),
    );
  }, [
    defaultColumnMode,
    defaultCompactSize,
    defaultViewMode,
    prevTitle,
    storageKeyBase,
    title,
  ]);

  useEffect(() => {
    localStorage.setItem(`${storageKeyBase}-view-mode`, viewMode);
  }, [viewMode, storageKeyBase]);

  useEffect(() => {
    localStorage.setItem(`${storageKeyBase}-column-mode`, columnMode);
  }, [columnMode, storageKeyBase]);

  useEffect(() => {
    localStorage.setItem(
      `${storageKeyBase}-compact-size-index`,
      compactCardSizeIndex.toString(),
    );
  }, [compactCardSizeIndex, storageKeyBase]);

  const actualCardSize = 80 + (compactCardSizeIndex - 1) * 40;
  const [virtualRows, setVirtualRows] = useState({ start: 0, end: 0 });
  const [, startTransition] = useTransition();
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const emptyStateFlavor = useMemo(() => getRandomEmptyStateFlavor(), []);

  const processedItems = useMemo(() => {
    let result = [...items];
    const searchScoreById = new Map<string, number>();

    if (deferredSearchTerm && searchProps) {
      const lowerTerm = deferredSearchTerm.toLowerCase();
      result = result.filter((item) => {
        const nameCandidate =
          typeof (item as any)?.name === "string" ? String((item as any).name) : "";
        const keyCandidate = getItemKeyForSearch(item) || "";
        const descriptionCandidate =
          typeof (item as any)?.description === "string"
            ? String((item as any).description)
            : "";
        const idCandidate =
          typeof (item as any)?.id === "string" ? String((item as any).id) : "";

        const weightedScore = Math.max(
          getMatchScore(nameCandidate, lowerTerm) >= 0
            ? getMatchScore(nameCandidate, lowerTerm) * 1.0
            : -1,
          getMatchScore(keyCandidate, lowerTerm) >= 0
            ? getMatchScore(keyCandidate, lowerTerm) * 0.8
            : -1,
          getMatchScore(descriptionCandidate, lowerTerm) >= 0
            ? getMatchScore(descriptionCandidate, lowerTerm) * 0.4
            : -1,
          getMatchScore(idCandidate, lowerTerm) >= 0
            ? getMatchScore(idCandidate, lowerTerm) * 0.3
            : -1,
        );

        const customMatch = searchProps.searchFn(item, lowerTerm);
        if (weightedScore >= 0) {
          searchScoreById.set(item.id, weightedScore);
          return true;
        }

        if (customMatch) {
          const fallbackScore = 200;
          searchScoreById.set(item.id, fallbackScore);
          return true;
        }

        const itemKey = getItemKeyForSearch(item);
        return itemKey ? fuzzyMatch(itemKey, lowerTerm) : false;
      });
    }

    if (filterOptions) {
      filterOptions.forEach((filter) => {
        const activeValue = activeFilters[filter.id];
        if (activeValue !== undefined && activeValue !== null) {
          result = result.filter((item) => filter.predicate(item, activeValue));
        }
      });
    }

    const sortOpt = sortOptions.find((opt) => opt.value === currentSort);
    result.sort((a, b) => {
      if (deferredSearchTerm && searchProps) {
        const scoreA = searchScoreById.get(a.id) ?? -1;
        const scoreB = searchScoreById.get(b.id) ?? -1;
        if (scoreA !== scoreB) return scoreB - scoreA;
      }

      if (sortOpt) {
        const base = sortOpt.sortFn(a, b);
        return sortDirection === "desc" ? -base : base;
      }

      return 0;
    });

    return result;
  }, [
    items,
    deferredSearchTerm,
    currentSort,
    sortDirection,
    activeFilters,
    searchProps,
    filterOptions,
    sortOptions,
  ]);

  const [containerWidth, setContainerWidth] = useState(1200);
  useEffect(() => {
    if (!listContainerRef.current) return;
    const observer = new window.ResizeObserver((entries) => {
      for (const entry of entries) {
        const nextWidth = entry.contentRect.width;
        setContainerWidth((prev) =>
          Math.abs(prev - nextWidth) > 2 ? nextWidth : prev,
        );
      }
    });
    observer.observe(listContainerRef.current);
    return () => observer.disconnect();
  }, []);

  const effectiveColumnCount =
    viewMode === "compact"
      ? Math.max(1, Math.floor(containerWidth / actualCardSize))
      : columnMode === "auto"
        ? isXlLayout
          ? 2
          : 1
        : parseInt(columnMode);

  const activeFilterCount = Object.values(activeFilters).filter(
    (v) => v !== null,
  ).length;
  const hasActiveSearch = deferredSearchTerm.trim().length > 0;
  const isShowingLoadingState =
    isLoading &&
    items.length === 0 &&
    !hasActiveSearch &&
    activeFilterCount === 0;
  const isTrulyEmptyCollection =
    items.length === 0 && !hasActiveSearch && activeFilterCount === 0;
  const shouldVirtualize = false;
  const totalRows = Math.ceil(processedItems.length / effectiveColumnCount);
  const estimatedRowHeight =
    viewMode === "compact"
      ? Math.max(96, actualCardSize + 20)
      : ESTIMATED_REGULAR_ROW_HEIGHT;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setIsXlLayout(window.innerWidth >= 1280);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!shouldVirtualize) {
      setVirtualRows({ start: 0, end: Math.max(0, totalRows - 1) });
      return;
    }

    const updateVirtualRows = () => {
      const container = listContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const viewportTop = window.scrollY;
      const viewportBottom = viewportTop + window.innerHeight;
      const containerTop = viewportTop + rect.top;

      const relativeTop = Math.max(0, viewportTop - containerTop);
      const relativeBottom = Math.max(0, viewportBottom - containerTop);

      const start = Math.max(
        0,
        Math.floor(relativeTop / estimatedRowHeight) - VIRTUAL_OVERSCAN_ROWS,
      );
      const end = Math.min(
        Math.max(0, totalRows - 1),
        Math.ceil(relativeBottom / estimatedRowHeight) + VIRTUAL_OVERSCAN_ROWS,
      );

      setVirtualRows((prev) =>
        prev.start === start && prev.end === end ? prev : { start, end },
      );
    };

    let frameId = 0;
    const scheduleUpdate = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        updateVirtualRows();
      });
    };

    updateVirtualRows();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [estimatedRowHeight, shouldVirtualize, totalRows]);

  useEffect(() => {
    if (!shouldVirtualize) return;
    const initialVisibleRows = Math.max(
      1,
      Math.ceil(window.innerHeight / estimatedRowHeight) +
        VIRTUAL_OVERSCAN_ROWS,
    );
    setVirtualRows({
      start: 0,
      end: Math.min(Math.max(0, totalRows - 1), initialVisibleRows),
    });
  }, [
    shouldVirtualize,
    estimatedRowHeight,
    effectiveColumnCount,
    viewMode,
    columnMode,
    totalRows,
  ]);

  const { startIndex, endIndex, topSpacerHeight, bottomSpacerHeight } =
    useMemo(() => {
      if (!shouldVirtualize) {
        return {
          startIndex: 0,
          endIndex: processedItems.length,
          topSpacerHeight: 0,
          bottomSpacerHeight: 0,
        };
      }

      const startIndex = virtualRows.start * effectiveColumnCount;
      const endIndex = Math.min(
        processedItems.length,
        (virtualRows.end + 1) * effectiveColumnCount,
      );
      const topSpacerHeight = virtualRows.start * estimatedRowHeight;
      const bottomSpacerHeight = Math.max(
        0,
        (totalRows - virtualRows.end - 1) * estimatedRowHeight,
      );

      return { startIndex, endIndex, topSpacerHeight, bottomSpacerHeight };
    }, [
      shouldVirtualize,
      virtualRows.start,
      virtualRows.end,
      effectiveColumnCount,
      estimatedRowHeight,
      processedItems.length,
      totalRows,
    ]);

  const renderedItems = useMemo(
    () => processedItems.slice(startIndex, endIndex),
    [processedItems, startIndex, endIndex],
  );

  const regularGridClass = {
    auto: "grid-cols-1 xl:grid-cols-2",
    "1": "grid-cols-1",
    "2": "grid-cols-2",
    "3": "grid-cols-3",
  }[columnMode];

  const compactGridStyle = {
    gridTemplateColumns: `repeat(auto-fill, minmax(${actualCardSize}px, 1fr))`,
  };

  const skeletonCards =
    viewMode === "compact"
      ? Array.from({ length: 12 }, (_, i) => (
          <Skeleton
            key={`skeleton-${i}`}
            className="aspect-square rounded-2xl"
            style={{ minWidth: actualCardSize }}
          />
        ))
      : Array.from({ length: 6 }, (_, i) => (
          <div
            key={`skeleton-${i}`}
            className="rounded-3xl bg-card p-6 h-90 flex flex-col gap-4"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-6 w-2/5" />
            </div>
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex gap-2 mt-auto">
              <Skeleton className="h-9 w-24 rounded-xl" />
              <Skeleton className="h-9 w-24 rounded-xl" />
            </div>
          </div>
        ));

  const toggleItemClass =
    "h-9 px-3.5 text-sm font-medium gap-2 cursor-pointer rounded-none first:rounded-l-xl last:rounded-r-xl data-[state=on]:bg-primary/10 data-[state=on]:text-primary hover:bg-accent hover:text-foreground transition-colors";
  const aceOptions = [
    {
      key: "none" as const,
      label: "No Base Ace",
      icon: ProhibitInset,
      iconClassName: "text-muted-foreground",
    },
    {
      key: "HC_A_hearts" as const,
      label: "Hearts Ace",
      icon: Heart,
      iconClassName: "text-red-500",
    },
    {
      key: "HC_A_diamonds" as const,
      label: "Diamonds Ace",
      icon: Diamond,
      iconClassName: "text-yellow-400",
    },
    {
      key: "HC_A_clubs" as const,
      label: "Clubs Ace",
      icon: Club,
      iconClassName: "text-blue-500",
    },
    {
      key: "HC_A_spades" as const,
      label: "Spades Ace",
      icon: Spade,
      iconClassName: "text-gray-300",
    },
  ];

  // Removed unused memoizedCards
  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <SquaresFour weight="fill" className="h-4 w-4 text-primary" />
            {reforged ? "Reference View" : "Collection View"}
            {reforged && (
              <Badge variant="secondary" className="text-[10px] uppercase">
                Read Only
              </Badge>
            )}
          </h2>
          <div className="flex items-center gap-4">
            <h1 className="text-5xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground font-medium pt-1">
            <span className="text-foreground">{subtitle}</span>
            <div className="h-1 w-1 rounded-full bg-border" />
            <span>
              {isShowingLoadingState
                ? "Loading items..."
                : `${processedItems.length} of ${items.length} items`}
            </span>
          </div>
        </div>

        {!reforged && (onAddNew || onAddFromTemplate) && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {onAddFromTemplate && (
              <Button
                onClick={onAddFromTemplate}
                size="lg"
                variant="outline"
                className="font-bold cursor-pointer transition-colors"
              >
                {addFromTemplateLabel}
              </Button>
            )}
            {onAddNew && (
              <Button
                onClick={onAddNew}
                size="lg"
                className="font-bold shadow-md cursor-pointer transition-colors"
              >
                <Plus className="mr-2 h-5 w-5" weight="bold" />
                {addNewLabel}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="border-b border-border w-full" />

      <div className="flex flex-col gap-4">
        <div className="relative w-full group">
          <MagnifyingGlass
            className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors"
            weight="bold"
          />
          <Input
            placeholder={searchProps?.placeholder || "Search items..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 bg-card border-border hover:border-primary/50 focus:border-primary h-12 text-lg shadow-sm transition-all rounded-xl w-full"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 cursor-pointer"
            >
              <X className="h-4 w-4" weight="bold" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="gap-3 h-9 px-3 text-sm bg-card border-border hover:bg-accent hover:border-primary/50 text-foreground font-medium shadow-sm transition-all rounded-md justify-between cursor-pointer group"
              >
                <span className="flex items-center gap-2">
                  <ArrowsDownUp
                    className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors"
                    weight="duotone"
                  />
                  <span className="truncate">
                    {sortOptions.find((s) => s.value === currentSort)?.label}
                  </span>
                </span>
                <CaretDown
                  className="h-4 w-4 text-muted-foreground opacity-50"
                  weight="bold"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 rounded-xl border-border bg-card p-2"
            >
              <div className="px-2 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Sort By
              </div>
              {sortOptions.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => setCurrentSort(opt.value)}
                  className="cursor-pointer rounded-lg focus:bg-accent focus:text-accent-foreground py-2 font-medium"
                >
                  {opt.label}
                  {currentSort === opt.value && (
                    <div className="ml-auto w-2 h-2 rounded-full bg-primary" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="my-2 bg-border/50" />
              <DropdownMenuItem
                onClick={() =>
                  setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
                }
                className="cursor-pointer rounded-lg focus:bg-accent focus:text-accent-foreground py-2 font-medium"
              >
                {sortDirection === "asc"
                  ? "Ascending (Low to High)"
                  : "Descending (High to Low)"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {filterOptions && filterOptions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={activeFilterCount > 0 ? "secondary" : "outline"}
                  className={cn(
                    "gap-2 h-9 px-3 text-sm bg-card border-border hover:bg-accent hover:border-primary/50 font-medium shadow-sm transition-all rounded-md cursor-pointer group",
                    activeFilterCount > 0 &&
                      "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20",
                  )}
                >
                  <Funnel
                    className={cn(
                      "h-5 w-5 transition-colors",
                      activeFilterCount > 0
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-primary",
                    )}
                    weight={activeFilterCount > 0 ? "fill" : "duotone"}
                  />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-1 h-5 min-w-5 px-1.5 flex items-center justify-center bg-background text-foreground shadow-none border border-border rounded-md"
                    >
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-64 rounded-xl border-border bg-card p-2"
              >
                {filterOptions.map((group) => (
                  <div key={group.id} className="mb-2 last:mb-0">
                    <div className="px-2 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      {group.label}
                    </div>
                    {group.options.map((opt) => (
                      <DropdownMenuCheckboxItem
                        key={`${group.id}-${opt.value}`}
                        checked={activeFilters[group.id] === opt.value}
                        onCheckedChange={(checked) => {
                          setActiveFilters((prev) => {
                            const next = { ...prev };
                            if (checked) next[group.id] = opt.value;
                            else delete next[group.id];
                            return next;
                          });
                        }}
                        className="cursor-pointer rounded-lg py-2 font-medium"
                      >
                        {opt.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                    <DropdownMenuSeparator className="my-2 bg-border/50" />
                  </div>
                ))}
                <DropdownMenuItem
                  className="justify-center text-primary font-bold cursor-pointer rounded-lg py-2 hover:bg-primary/10 focus:bg-primary/10 focus:text-primary"
                  onClick={() => setActiveFilters({})}
                >
                  Clear All Filters
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {renderCompactCard && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider shrink-0">
                View
              </span>
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(v) =>
                  v &&
                  startTransition(() => setViewMode(v as "regular" | "compact"))
                }
                className="rounded-xl border border-border bg-card shadow-sm overflow-hidden h-9"
              >
                <ToggleGroupItem value="regular" className={toggleItemClass}>
                  <Rows className="h-4 w-4" weight="duotone" />
                  Regular
                </ToggleGroupItem>
                <ToggleGroupItem value="compact" className={toggleItemClass}>
                  <SquaresFour className="h-4 w-4" weight="duotone" />
                  Compact
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          )}
          {viewMode === "regular" && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider shrink-0">
                Columns
              </span>
              <ToggleGroup
                type="single"
                value={columnMode}
                onValueChange={(v) =>
                  v && startTransition(() => setColumnMode(v as ColumnMode))
                }
                className="rounded-xl border border-border bg-card shadow-sm overflow-hidden h-9"
              >
                {(["auto", "1", "2", "3"] as ColumnMode[]).map((mode) => (
                  <ToggleGroupItem
                    key={mode}
                    value={mode}
                    className={toggleItemClass}
                  >
                    {mode === "auto" ? "Auto" : mode}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          )}
          {viewMode === "compact" && (
            <div className="flex items-center gap-3 h-9 px-4 rounded-xl border border-border bg-card shadow-sm min-w-56">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider shrink-0">
                Size
              </span>
              <Slider
                value={[compactCardSizeIndex]}
                onValueChange={([v]) => setCompactCardSizeIndex(v)}
                min={1}
                max={5}
                step={1}
                className="flex-1"
              />
              <span className="text-xs font-mono text-muted-foreground shrink-0 w-8 text-right">
                {compactCardSizeIndex}
              </span>
            </div>
          )}
          {aceSelectorMode !== "none" && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider shrink-0">
                Base Card
              </span>
              <div className="flex items-center gap-1 rounded-xl border border-border bg-card shadow-sm h-9 px-1">
                {aceOptions.map((ace) => (
                  <IconButton
                    key={ace.key}
                    icon={ace.icon}
                    tooltip={ace.label}
                    onClick={() => setSelectedAce(ace.key)}
                    isActive={selectedAce === ace.key}
                    iconClassName={ace.iconClassName}
                    iconOnly
                    className="!h-7 !w-7"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {headerContent && <div className="py-2">{headerContent}</div>}

      {isShowingLoadingState ? (
        <div
          className={cn(
            "grid gap-4",
            viewMode === "compact" ? "" : regularGridClass,
          )}
          style={viewMode === "compact" ? compactGridStyle : undefined}
        >
          {skeletonCards}
        </div>
      ) : processedItems.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-32 text-center border-2 border-dashed border-border rounded-2xl bg-card/30"
        >
          {isTrulyEmptyCollection ? (
            <>
              <div className="mb-6 text-3xl text-muted-foreground/70">
                :(
              </div>
              <h3 className="text-xl font-bold text-foreground">
                No {title.toLowerCase()} yet
              </h3>
              <p className="text-muted-foreground max-w-md mt-2">
                {emptyStateFlavor}
              </p>
            </>
          ) : (
            <>
              <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
                <MagnifyingGlass
                  className="h-10 w-10 text-muted-foreground/50"
                  weight="duotone"
                />
              </div>
              <h3 className="text-xl font-bold text-foreground">
                No items found
              </h3>
              <p className="text-muted-foreground max-w-md mt-2">
                We couldn't find anything matching your search. Try adjusting
                your filters or creating a new item.
              </p>
              <Button
                variant="link"
                onClick={() => {
                  setSearchTerm("");
                  setActiveFilters({});
                }}
                className="mt-6 text-primary font-bold cursor-pointer"
              >
                Clear all filters
              </Button>
            </>
          )}
        </motion.div>
      ) : (
        <div ref={listContainerRef}>
          {topSpacerHeight > 0 && (
            <div style={{ height: topSpacerHeight }} aria-hidden="true" />
          )}

          <div
            className={cn(
              "grid gap-4",
              viewMode === "compact" ? "" : regularGridClass,
            )}
            style={viewMode === "compact" ? compactGridStyle : undefined}
          >
            {renderedItems.map((item) => (
              <div key={item.id}>
                <CardRenderer
                  item={item}
                  viewMode={viewMode}
                  renderCard={(entry) => renderCard(entry, { selectedAce })}
                  renderCompactCard={
                    renderCompactCard
                      ? (entry) => renderCompactCard(entry, { selectedAce })
                      : undefined
                  }
                />
              </div>
            ))}
          </div>

          {bottomSpacerHeight > 0 && (
            <div style={{ height: bottomSpacerHeight }} aria-hidden="true" />
          )}
        </div>
      )}
    </div>
  );
}
export const GenericItemPage = memo(
  GenericItemPageInternal,
) as typeof GenericItemPageInternal;
