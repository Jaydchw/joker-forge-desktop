import { useState, useMemo, ReactNode } from "react";
import {
  Plus,
  MagnifyingGlass,
  ArrowsDownUp,
  Funnel,
  SquaresFour,
  X,
  CaretDown,
} from "@phosphor-icons/react";
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
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

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
  subtitle?: string; // Often the Mod Name
  items: T[];
  searchProps?: {
    placeholder?: string;
    searchFn: (item: T, term: string) => boolean;
  };
  sortOptions: SortOption<T>[];
  defaultSort?: string;
  filterOptions?: FilterOption<T>[];
  onAddNew?: () => void;
  addNewLabel?: string;
  renderCard: (item: T) => ReactNode;
  headerContent?: ReactNode; // For extra custom stats/info if needed
}

export function GenericItemPage<T extends { id: string }>({
  title,
  subtitle,
  items,
  searchProps,
  sortOptions,
  defaultSort,
  filterOptions,
  onAddNew,
  addNewLabel = "Add New Item",
  renderCard,
  headerContent,
}: GenericItemPageProps<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentSort, setCurrentSort] = useState(
    defaultSort || sortOptions[0]?.value,
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});

  const processedItems = useMemo(() => {
    let result = [...items];

    if (searchTerm && searchProps) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter((item) => searchProps.searchFn(item, lowerTerm));
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
    if (sortOpt) {
      result.sort(sortOpt.sortFn);
      if (sortDirection === "desc") {
        result.reverse();
      }
    }

    return result;
  }, [
    items,
    searchTerm,
    currentSort,
    sortDirection,
    activeFilters,
    searchProps,
    filterOptions,
    sortOptions,
  ]);

  const activeFilterCount = Object.values(activeFilters).filter(
    (v) => v !== null,
  ).length;

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <SquaresFour weight="fill" className="h-4 w-4 text-primary" />
            Collection View
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
              {processedItems.length} of {items.length} items
            </span>
          </div>
        </div>

        {onAddNew && (
          <Button
            onClick={onAddNew}
            size="lg"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg hover:shadow-primary/20 transition-all cursor-pointer rounded-xl"
          >
            <Plus className="mr-2 h-5 w-5" weight="bold" />
            {addNewLabel}
          </Button>
        )}
      </div>

      <div className="border-b border-border w-full" />

      {/* Toolbar Section */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 group">
          <MagnifyingGlass
            className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors"
            weight="bold"
          />
          <Input
            placeholder={searchProps?.placeholder || "Search items..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 bg-card border-border hover:border-primary/50 focus:border-primary h-12 text-lg shadow-sm transition-all rounded-xl"
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

        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="gap-3 h-12 px-4 bg-card border-border hover:bg-accent hover:border-primary/50 text-foreground font-medium shadow-sm transition-all rounded-xl min-w-[180px] justify-between cursor-pointer group"
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
                    "gap-2 h-12 px-4 bg-card border-border hover:bg-accent hover:border-primary/50 font-medium shadow-sm transition-all rounded-xl cursor-pointer group",
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
        </div>
      </div>

      {/* Header Extra Content (Optional) */}
      {headerContent && <div className="py-2">{headerContent}</div>}

      {/* Grid Content */}
      {processedItems.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-32 text-center border-2 border-dashed border-border rounded-2xl bg-card/30"
        >
          <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
            <MagnifyingGlass
              className="h-10 w-10 text-muted-foreground/50"
              weight="duotone"
            />
          </div>
          <h3 className="text-xl font-bold text-foreground">No items found</h3>
          <p className="text-muted-foreground max-w-md mt-2">
            We couldn't find anything matching your search. Try adjusting your
            filters or creating a new item.
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
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <AnimatePresence mode="popLayout">
            {processedItems.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                {renderCard(item)}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
