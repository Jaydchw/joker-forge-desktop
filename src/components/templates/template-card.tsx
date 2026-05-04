import type React from "react";
import {
  ArrowCounterClockwise,
  BookmarksSimple,
  ClockClockwise,
  DiceFive,
  Flask,
  Infinity,
  Lightning,
  PuzzlePiece,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ItemTemplateEntry, TemplateEntry } from "@/lib/templates";

type TemplateCardAction = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: (template: TemplateEntry) => void;
  destructive?: boolean;
};

interface TemplateCardProps {
  template: TemplateEntry;
  selected?: boolean;
  selectable?: boolean;
  onToggleSelect?: (templateId: string) => void;
  onCardClick?: (template: TemplateEntry) => void;
  actions?: TemplateCardAction[];
  className?: string;
  imageLayout?: "mixed" | "text-only";
}

export const formatTemplateMeta = (template: TemplateEntry): string => {
  const updated = new Date(template.updatedAt).toLocaleString();
  return `Updated ${updated}`;
};

export const capitalizeLabel = (value: string): string =>
  value.length > 0
    ? `${value.charAt(0).toUpperCase()}${value.slice(1)}`
    : value;

export const getTemplateImage = (template: TemplateEntry): string | null => {
  if (template.kind !== "item") return null;
  const itemTemplate = template as ItemTemplateEntry;
  const rawImage = itemTemplate.payload?.image;
  return typeof rawImage === "string" && rawImage.trim().length > 0
    ? rawImage
    : null;
};

const formatTriggerLabel = (trigger: string): string =>
  trigger
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

const getRuleStats = (template: TemplateEntry) => {
  if (template.kind !== "rule") return null;
  const rule = template.payload;
  const conditions = rule.conditionGroups.reduce(
    (sum, group) => sum + group.conditions.length,
    0,
  );
  const conditionGroups = rule.conditionGroups.length;
  const randomGroups = rule.randomGroups.length;
  const loopGroups = rule.loops.length;
  const directEffects = rule.effects.length;
  const randomEffects = rule.randomGroups.reduce(
    (sum, group) => sum + group.effects.length,
    0,
  );
  const loopEffects = rule.loops.reduce(
    (sum, group) => sum + group.effects.length,
    0,
  );
  const effects = directEffects + randomEffects + loopEffects;

  return {
    trigger: rule.trigger,
    blueprintCompatible: rule.blueprintCompatible,
    conditions,
    conditionGroups,
    effects,
    randomGroups,
    loopGroups,
  };
};

export function TemplateCard({
  template,
  selected = false,
  selectable = false,
  onToggleSelect,
  onCardClick,
  actions,
  className,
  imageLayout = "mixed",
}: TemplateCardProps) {
  const previewImage = getTemplateImage(template);
  const showImageSlot = template.kind === "item" || imageLayout === "mixed";
  const ruleStats = getRuleStats(template);
  const isRule = template.kind === "rule";

  const actionsMarkup = actions?.length ? (
    <div
      className="mb-2 flex items-center justify-center"
      onClick={(event) => event.stopPropagation()}
    >
      {actions.map((action, index) => {
        const Icon = action.icon;
        return (
          <div
            key={action.id}
            className={cn(
              "flex items-center",
              index > 0 && "border-l border-border/70",
            )}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={action.label}
                  onClick={() => action.onClick(template)}
                  className={cn(
                    "h-8 w-8 rounded-none bg-transparent px-0 hover:bg-transparent",
                    action.destructive
                      ? "text-destructive hover:text-destructive"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  icon={<Icon className="h-4 w-4" />}
                />
              </TooltipTrigger>
              <TooltipContent>{action.label}</TooltipContent>
            </Tooltip>
          </div>
        );
      })}
    </div>
  ) : null;

  return (
    <div
      role={selectable ? "button" : undefined}
      tabIndex={selectable ? 0 : undefined}
      onClick={() => {
        if (onCardClick) {
          onCardClick(template);
          return;
        }
        if (selectable && onToggleSelect) onToggleSelect(template.id);
      }}
      onKeyDown={(event) => {
        if (onCardClick && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onCardClick(template);
          return;
        }
        if (!selectable || !onToggleSelect) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggleSelect(template.id);
        }
      }}
      className={cn(
        "flex h-full flex-col rounded-xl bg-card p-2 transition-colors",
        showImageSlot ? "min-h-60" : "min-h-44",
        selectable && "cursor-pointer hover:bg-accent/30",
        onCardClick && "cursor-pointer hover:bg-accent/30",
        selected && "bg-primary/10 ring-1 ring-primary/40",
        className,
      )}
    >
      {!isRule && showImageSlot && (
        <div className="mb-2 flex h-28 items-center justify-center overflow-hidden rounded-lg">
          {previewImage ? (
            <img
              src={previewImage}
              alt={template.name}
              className="h-full w-full object-contain [image-rendering:pixelated]"
              draggable={false}
            />
          ) : (
            <span className="text-[11px] font-medium text-muted-foreground">
              No preview
            </span>
          )}
        </div>
      )}

      {!isRule && actionsMarkup}

      {!isRule && (
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="space-y-1.5">
            <p className="truncate text-sm font-semibold text-foreground">
              {template.name}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <BookmarksSimple className="h-3.5 w-3.5" />
              <span className="truncate">{capitalizeLabel(template.itemType)}</span>
            </div>
          </div>
          <div className="mt-auto pt-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ClockClockwise className="h-3.5 w-3.5" />
              <span className="truncate">{formatTemplateMeta(template)}</span>
            </div>
          </div>
        </div>
      )}

      {isRule && ruleStats && (
        <div className="flex h-full min-w-0 flex-1 flex-col p-3">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {template.name}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                Rule {capitalizeLabel(template.itemType)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {ruleStats.conditionGroups} condition group
                {ruleStats.conditionGroups === 1 ? "" : "s"}
              </p>
            </div>
            <div
              className={cn(
                "inline-flex items-center px-1 py-0.5 text-[10px] font-semibold",
                ruleStats.blueprintCompatible
                  ? "text-balatro-blue"
                  : "text-destructive",
              )}
            >
              <Infinity
                className="mr-1 h-3 w-3"
                weight={ruleStats.blueprintCompatible ? "fill" : "regular"}
              />
              {ruleStats.blueprintCompatible ? "Blueprint On" : "Blueprint Off"}
            </div>
          </div>

          <div className="mb-3 px-1">
            <div className="flex items-center gap-2 text-[11px] font-medium text-balatro-money">
              <Lightning className="h-3.5 w-3.5" />
              <span className="truncate">{formatTriggerLabel(ruleStats.trigger)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 px-2 py-1.5 text-muted-foreground">
              <Flask className="h-3.5 w-3.5 text-balatro-blue" />
              <span>{ruleStats.conditions} Conditions</span>
            </div>
            <div className="flex items-center gap-2 px-2 py-1.5 text-muted-foreground">
              <PuzzlePiece className="h-3.5 w-3.5 text-balatro-green" />
              <span>{ruleStats.effects} Effects</span>
            </div>
            <div className="flex items-center gap-2 px-2 py-1.5 text-muted-foreground">
              <DiceFive className="h-3.5 w-3.5 text-balatro-green" />
              <span>{ruleStats.randomGroups} Random</span>
            </div>
            <div className="flex items-center gap-2 px-2 py-1.5 text-muted-foreground">
              <ArrowCounterClockwise className="h-3.5 w-3.5 text-balatro-blue" />
              <span>{ruleStats.loopGroups} Loops</span>
            </div>
          </div>

          <div className="mt-auto pt-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ClockClockwise className="h-3.5 w-3.5" />
              <span className="truncate">{formatTemplateMeta(template)}</span>
            </div>
          </div>
        </div>
      )}
      {isRule && actionsMarkup}
    </div>
  );
}
