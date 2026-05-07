import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MagnifyingGlass, User } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PLACEHOLDER_CATEGORIES,
  PlaceholderCategory,
  PlaceholderEntry,
  getPlaceholderCategoryLabel,
  getPlaceholderEntriesForCategory,
} from "@/lib/placeholder-assets.ts";
import { fuzzyMatchAny } from "@/lib/search";

type PlaceholderPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCategory?: PlaceholderCategory;
  onSelect: (entry: PlaceholderEntry) => void;
};

const categoryColorClass: Record<PlaceholderCategory, string> = {
  joker: "data-[state=active]:!text-joker-primary hover:!text-joker-primary/90",
  consumable:
    "data-[state=active]:!text-consumable-primary hover:!text-consumable-primary/90",
  deck: "data-[state=active]:!text-deck-primary hover:!text-deck-primary/90",
  enhancement:
    "data-[state=active]:!text-enhancement-primary hover:!text-enhancement-primary/90",
  seal: "data-[state=active]:!text-seal-primary hover:!text-seal-primary/90",
  voucher:
    "data-[state=active]:!text-voucher-primary hover:!text-voucher-primary/90",
  booster:
    "data-[state=active]:!text-booster-primary hover:!text-booster-primary/90",
};

export function PlaceholderPickerDialog({
  open,
  onOpenChange,
  initialCategory = "joker",
  onSelect,
}: PlaceholderPickerDialogProps) {
  const [activeCategory, setActiveCategory] =
    useState<PlaceholderCategory>(initialCategory);
  const [search, setSearch] = useState("");
  const [entriesByCategory, setEntriesByCategory] = useState<
    Partial<Record<PlaceholderCategory, PlaceholderEntry[]>>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [groupByArtist, setGroupByArtist] = useState(false);

  useEffect(() => {
    if (!open) return;
    setActiveCategory(initialCategory);
  }, [open, initialCategory]);

  useEffect(() => {
    if (!open) return;

    let isMounted = true;
    const load = async () => {
      setIsLoading(true);
      const rows = await Promise.all(
        PLACEHOLDER_CATEGORIES.map(async (category) => {
          const entries = await getPlaceholderEntriesForCategory(category);
          return [category, entries] as const;
        }),
      );

      if (!isMounted) return;
      setEntriesByCategory(Object.fromEntries(rows));
      setIsLoading(false);
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [open]);

  const visibleEntries = useMemo(() => {
    const source = entriesByCategory[activeCategory] || [];
    const term = search.trim().toLowerCase();
    if (!term) return source;

    return source.filter((entry) => {
      const indexText = String(entry.index);
      return fuzzyMatchAny([entry.credit, indexText], term);
    });
  }, [activeCategory, entriesByCategory, search]);

  const orderedEntries = useMemo(
    () => [...visibleEntries].sort((a, b) => a.index - b.index),
    [visibleEntries],
  );

  const groupedByCredit = useMemo(() => {
    return visibleEntries.reduce(
      (acc, entry) => {
        const key = entry.credit || "Unknown";
        if (!acc[key]) acc[key] = [];
        acc[key].push(entry);
        return acc;
      },
      {} as Record<string, PlaceholderEntry[]>,
    );
  }, [visibleEntries]);

  const sortedCredits = useMemo(
    () => Object.keys(groupedByCredit).sort((a, b) => a.localeCompare(b)),
    [groupedByCredit],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="placeholder-picker-content max-w-300! w-[78vw]! h-[76vh]! max-h-[76vh]! p-0 overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Choose Placeholder Sprite</DialogTitle>
          <DialogDescription>
            Pick a preset placeholder image for this item.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-4 flex items-center gap-3">
          <div className="relative flex-1">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by credit or number..."
              className="pl-9"
            />
          </div>
          <Button
            variant={groupByArtist ? "default" : "outline"}
            size="sm"
            onClick={() => setGroupByArtist((prev) => !prev)}
            className="cursor-pointer"
          >
            {groupByArtist ? "Artist View" : "Grid View"}
          </Button>
        </div>

        <Tabs
          value={activeCategory}
          onValueChange={(value) =>
            setActiveCategory(value as PlaceholderCategory)
          }
          className="flex-1 min-h-0 px-6 pb-6"
        >
          <TabsList
            variant="line"
            className="w-full justify-start flex-wrap h-auto p-0 border-b border-border/60"
          >
            {PLACEHOLDER_CATEGORIES.map((category) => (
              <TabsTrigger
                key={category}
                value={category}
                className={`cursor-pointer text-muted-foreground ${categoryColorClass[category]}`}
              >
                {getPlaceholderCategoryLabel(category)}
              </TabsTrigger>
            ))}
          </TabsList>

          {PLACEHOLDER_CATEGORIES.map((category) => (
            <TabsContent
              key={category}
              value={category}
              className="mt-4 h-full min-h-0"
            >
              <ScrollArea className="h-[56vh] rounded-lg">
                <div className="p-4 space-y-6">
                  {isLoading && (
                    <p className="text-sm text-muted-foreground">
                      Loading placeholders...
                    </p>
                  )}

                  {!isLoading && orderedEntries.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No placeholders found for this category.
                    </p>
                  )}

                  {!isLoading && !groupByArtist && (
                    <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 xl:grid-cols-10 2xl:grid-cols-11 gap-3">
                      {orderedEntries.map((entry) => (
                        <Tooltip key={`${entry.category}-${entry.index}`}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => {
                                onSelect(entry);
                                onOpenChange(false);
                              }}
                              className="h-auto p-0 flex flex-col gap-1 items-center bg-transparent border-0 cursor-pointer transition-transform hover:scale-105"
                            >
                              <img
                                src={entry.src}
                                alt={`${entry.category} placeholder ${entry.index}`}
                                className="w-full h-auto object-contain [image-rendering:pixelated]"
                                loading="lazy"
                                decoding="async"
                              />
                              <div className="text-[11px] font-medium text-muted-foreground">
                                #{entry.index}
                              </div>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-semibold">{entry.credit}</p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  )}

                  {!isLoading &&
                    groupByArtist &&
                    sortedCredits.map((credit) => (
                      <section key={credit} className="space-y-3">
                        <div className="flex items-center gap-2">
                          <User
                            className="h-4 w-4 text-primary"
                            weight="duotone"
                          />
                          <h4 className="text-sm font-semibold text-foreground">
                            {credit}
                          </h4>
                          <span className="text-xs text-muted-foreground">
                            {groupedByCredit[credit].length} image
                            {groupedByCredit[credit].length === 1 ? "" : "s"}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 xl:grid-cols-10 2xl:grid-cols-11 gap-3">
                          {groupedByCredit[credit].map((entry) => (
                            <Tooltip key={`${entry.category}-${entry.index}`}>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSelect(entry);
                                    onOpenChange(false);
                                  }}
                                  className="h-auto p-0 flex flex-col gap-1 items-center bg-transparent border-0 cursor-pointer transition-transform hover:scale-105"
                                >
                                  <img
                                    src={entry.src}
                                    alt={`${entry.category} placeholder ${entry.index}`}
                                    className="w-full h-auto object-contain [image-rendering:pixelated]"
                                    loading="lazy"
                                    decoding="async"
                                  />
                                  <div className="text-[11px] font-medium text-muted-foreground">
                                    #{entry.index}
                                  </div>
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-semibold">{entry.credit}</p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </section>
                    ))}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
