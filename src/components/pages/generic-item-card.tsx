import {
  useState,
  useRef,
  useEffect,
  useMemo,
  ReactNode,
  isValidElement,
  memo,
} from "react";
import {
  CurrencyDollar,
  Image,
  PaintBrush,
  Trash,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PixelArtEditorDialog } from "@/components/pages/pixel-art-editor-dialog";
import { cn } from "@/lib/utils";
import { RaritySelect } from "@/components/balatro/rarity-select";
import { ConsumableSetSelect } from "@/components/balatro/consumable-set-select";
import {
  formatBalatroText,
  applyAutoFormatting,
} from "@/lib/balatro-text-formatter";
import { sanitizeDescription } from "@/lib/description-sanitizer";
import { sanitizeKeyLikeValue } from "@/lib/item-field-validation";
import type { PixelLayerData } from "@/lib/types";
import { getDescriptionVariablePlaceholdersEnabled } from "@/lib/storage";

export interface CardProperty {
  id: string;
  icon: ReactNode;
  label: string;
  isActive: boolean;
  variant:
    | "default"
    | "success"
    | "warning"
    | "info"
    | "purple"
    | "destructive";
  onClick: () => void;
}

export interface ActionConfig {
  id: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "destructive" | "secondary" | "outline" | "ghost";
  badgeCount?: number;
}

interface GenericItemCardProps {
  image: ReactNode;
  imageLayers?: PixelLayerData[];
  overlayImage?: string;
  name: string;
  description: string;
  locVars?: { vars?: Array<string | number>; colours?: string[] };
  cost?: number;
  idValue?: number | string;
  badges?: ReactNode;
  properties?: CardProperty[];
  actions?: ActionConfig[];
  rarity?: number | string;
  consumableSet?: string;
  reforged?: boolean;
  onUpdate: (updates: {
    name?: string;
    description?: string;
    cost?: number;
    idValue?: number;
    objectKey?: string;
    image?: string;
    imageLayers?: PixelLayerData[];
    placeholderCreditIndex?: number | undefined;
    placeholderCategory?: string | undefined;
    rarity?: number | string;
    set?: string;
  }) => void;
  onDuplicate?: () => void;
  editableImageSrc?: string;
  showPlaceholderPickerButton?: boolean;
  onOpenPlaceholderPicker?: () => void;
}

const extractFirstImageSrc = (node: ReactNode): string | undefined => {
  if (!node) return undefined;
  if (!isValidElement(node)) return undefined;

  if (typeof node.type === "string" && node.type.toLowerCase() === "img") {
    const src = (node.props as { src?: unknown }).src;
    return typeof src === "string" ? src : undefined;
  }

  const children = (node.props as { children?: ReactNode }).children;
  if (!children) return undefined;

  if (Array.isArray(children)) {
    for (const child of children) {
      const found = extractFirstImageSrc(child);
      if (found) return found;
    }
    return undefined;
  }

  return extractFirstImageSrc(children);
};

export const GenericItemCard = memo(function GenericItemCard({
  image,
  overlayImage,
  name,
  description,
  locVars,
  cost,
  idValue,
  badges,
  properties = [],
  actions = [],
  rarity,
  consumableSet,
  reforged = false,
  onUpdate,
  onDuplicate,
  editableImageSrc,
  imageLayers,
  showPlaceholderPickerButton = false,
  onOpenPlaceholderPicker,
}: GenericItemCardProps) {
  const isReadOnly = reforged;
  const resolvedEditableImageSrc =
    editableImageSrc || extractFirstImageSrc(image);
  const resolvedEditableImageLayers = imageLayers;
  const [isPixelEditorOpen, setIsPixelEditorOpen] = useState(false);
  const [editingField, setEditingField] = useState<
    "none" | "name" | "desc" | "cost" | "id"
  >("none");
  const [tempValue, setTempValue] = useState("");
  const [isThin, setIsThin] = useState(false);
  const [useTextActionButtons, setUseTextActionButtons] = useState(true);
  const [useCompactIconActions, setUseCompactIconActions] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const showPlaceholders = getDescriptionVariablePlaceholdersEnabled();

  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const sanitizedDescription = useMemo(
    () => sanitizeDescription(description),
    [description],
  );
  const renderedDescriptionHtml = useMemo(
    () =>
      formatBalatroText(sanitizedDescription || "No description provided...", locVars, {
        replaceVariables: showPlaceholders,
      }),
    [locVars, sanitizedDescription, showPlaceholders],
  );

  useEffect(() => {
    if (editingField !== "none" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingField]);

  useEffect(() => {
    if (!cardRef.current || typeof window === "undefined") return;

    const observer = new window.ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? 0;
      const nextIsThin = nextWidth > 0 && nextWidth < 560;
      const nextUseTextActionButtons = nextWidth >= 940;
      const nextUseCompactIconActions = nextWidth > 0 && nextWidth < 760;

      setIsThin((prev) => (prev === nextIsThin ? prev : nextIsThin));
      setUseTextActionButtons((prev) =>
        prev === nextUseTextActionButtons ? prev : nextUseTextActionButtons,
      );
      setUseCompactIconActions((prev) =>
        prev === nextUseCompactIconActions ? prev : nextUseCompactIconActions,
      );
    });

    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  const startEdit = (
    field: "name" | "desc" | "cost" | "id",
    currentValue: string | number,
  ) => {
    if (isReadOnly) return;
    setTempValue(currentValue.toString());
    setEditingField(field);
  };

  const cancelEdit = () => {
    setEditingField("none");
    setTempValue("");
  };

  const handleDescriptionChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    const nextValue = e.target.value;
    const { formatted } = applyAutoFormatting(nextValue, tempValue);
    setTempValue(formatted);
  };

  const saveEdit = () => {
    if (isReadOnly) {
      setEditingField("none");
      return;
    }
    if (editingField === "name") {
      if (tempValue.trim()) {
        const cleanedName = tempValue.trim();
        onUpdate({
          name: cleanedName,
          objectKey: sanitizeKeyLikeValue(cleanedName),
        });
      }
    } else if (editingField === "desc") {
      const { formatted } = applyAutoFormatting(tempValue, sanitizedDescription);
      onUpdate({ description: formatted });
    } else if (editingField === "cost") {
      const val = parseInt(tempValue);
      if (!isNaN(val)) onUpdate({ cost: val });
    } else if (editingField === "id") {
      const val = parseInt(tempValue);
      if (!isNaN(val)) onUpdate({ idValue: val });
    }
    setEditingField("none");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    }
    if (e.key === "Escape") {
      cancelEdit();
    }
  };

  const deleteAction = actions.find(
    (a) => a.id === "delete" || a.variant === "destructive",
  );
  const duplicateAction = actions.find((a) => a.id === "duplicate");
  const editAction = actions.find((a) => a.id === "edit");
  const labeledActionIds = useMemo(() => new Set(["rules", "edit"]), []);
  const textActions = actions.filter(
    (a) => a !== deleteAction && labeledActionIds.has(a.id),
  );
  const iconActions = actions.filter(
    (a) =>
      a !== deleteAction &&
      a !== duplicateAction &&
      !labeledActionIds.has(a.id),
  );

  const getPropertyStyles = (
    isActive: boolean,
    variant: CardProperty["variant"],
  ) => {
    const sizeClass = isThin ? "h-8 w-8 rounded-lg" : "h-10 w-10 rounded-xl";
    const base =
      "flex items-center justify-center transition-all duration-200 cursor-pointer border-2 outline-none focus:outline-none";
    if (!isActive)
      return cn(
        base,
        sizeClass,
        "bg-muted/30 border-transparent text-muted-foreground/30 hover:bg-muted hover:text-muted-foreground hover:border-border",
      );

    const variants = {
      success:
        "bg-green-500/10 text-green-500 border-green-500/30 hover:bg-green-500/20 hover:border-green-500",
      warning:
        "bg-orange-500/10 text-orange-500 border-orange-500/30 hover:bg-orange-500/20 hover:border-orange-500",
      info: "bg-blue-500/10 text-blue-500 border-blue-500/30 hover:bg-blue-500/20 hover:border-blue-500",
      purple:
        "bg-purple-500/10 text-purple-500 border-purple-500/30 hover:bg-purple-500/20 hover:border-purple-500",
      destructive:
        "bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20 hover:border-red-500",
      default:
        "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 hover:border-primary",
    };
    return cn(base, sizeClass, variants[variant]);
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        "group relative flex gap-6 p-6 rounded-3xl bg-card transition-all duration-300 min-h-88 h-full w-full",
        isThin ? "flex-col" : "flex-row",
        isThin && "p-4 gap-4",
        isReadOnly && "bg-card/70",
      )}
    >
      {deleteAction && (
        <div
          className={cn(
            "absolute top-4 right-4 z-20 transition-opacity",
            isThin ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteAction.onClick();
                }}
                className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 cursor-pointer rounded-lg"
              >
                <Trash weight="bold" className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="font-bold text-red-500">
              {deleteAction.label}
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      <div
        className={cn(
          "flex flex-col items-center gap-5 shrink-0 w-full sm:w-56",
          isThin && "w-[15.5rem] max-w-[15.5rem] mx-auto self-center",
        )}
      >
        {cost !== undefined && (
          <div
            className={cn(
              "relative z-10 -mb-12 w-full flex justify-center",
              isThin && "w-[15.5rem] mx-auto",
            )}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  data-showcase-cost-badge="true"
                  onClick={() => {
                    if (isReadOnly) return;
                    if (editingField !== "cost") startEdit("cost", cost);
                  }}
                  className="h-10 px-4 flex items-center justify-center gap-1.5 rounded-lg bg-card border-2 border-yellow-500/30 text-yellow-500 font-bold text-xl shadow-sm cursor-pointer hover:border-yellow-500 hover:bg-yellow-500 hover:text-white transition-all group/cost"
                >
                  <CurrencyDollar className="h-5 w-5" weight="fill" />
                  {editingField === "cost" ? (
                    <input
                      data-showcase-cost-input="true"
                      ref={inputRef as React.RefObject<HTMLInputElement>}
                      type="text"
                      value={tempValue}
                      onChange={(e) => setTempValue(e.target.value)}
                      onBlur={saveEdit}
                      onKeyDown={handleKeyDown}
                      className="w-12 text-center font-bold text-xl text-yellow-500 group-hover/cost:text-white bg-transparent border-none p-0 outline-none focus:outline-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span>{cost}</span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent className="font-bold">Edit Cost</TooltipContent>
            </Tooltip>
          </div>
        )}

        <div
          className={cn(
            "relative w-55 h-90 [image-rendering:pixelated] -mt-8 flex items-center justify-center",
            isThin && "mx-auto w-[15.5rem] h-[25rem]",
          )}
        >
          <div
            onClick={(e) => {
              if (isReadOnly || !editAction) return;
              e.stopPropagation();
              editAction.onClick();
            }}
            className={cn(
              "w-full h-full flex items-center justify-center rounded-lg",
              !isReadOnly && editAction && "cursor-pointer",
            )}
          >
            {image}
          </div>
          {overlayImage && (
            <img
              src={overlayImage}
              alt="Overlay"
              className="absolute inset-0 w-full h-full object-contain [image-rendering:pixelated] pointer-events-none z-10"
              draggable="false"
            />
          )}
        </div>

        <div
          className={cn(
            "relative z-10 -mt-20 w-full flex justify-center",
            isThin && "w-[15.5rem] mx-auto",
          )}
        >
          {rarity !== undefined ? (
            isReadOnly ? (
              <Badge variant="secondary" className="font-bold uppercase">
                Rarity: {rarity}
              </Badge>
            ) : (
              <RaritySelect
                value={String(rarity)}
                className={isThin ? "w-[12.5rem] justify-center" : undefined}
                onChange={(val) =>
                  onUpdate({
                    rarity: isNaN(Number(val)) ? val : Number(val),
                  })
                }
              />
            )
          ) : consumableSet !== undefined ? (
            isReadOnly ? (
              <Badge variant="secondary" className="font-bold uppercase">
                Set: {consumableSet}
              </Badge>
            ) : (
              <ConsumableSetSelect
                value={consumableSet}
                className={isThin ? "w-[12.5rem] justify-center" : undefined}
                onChange={(val) =>
                  onUpdate({
                    set: val,
                  })
                }
              />
            )
          ) : (
            badges
          )}
        </div>
      </div>

      <div
        className={cn(
          "flex-1 min-w-0 sm:min-w-[16rem] flex flex-col gap-3 relative h-full w-full",
          isThin && "gap-2",
        )}
      >
        <div
          className={cn(
            "flex items-baseline gap-3 pb-2 min-h-14 pr-8 shrink-0",
            !isThin && "border-b border-border/40",
          )}
        >
          {idValue !== undefined && (
            <div className="shrink-0 self-center">
              <span
                onClick={
                  isReadOnly
                    ? undefined
                    : () => editingField !== "id" && startEdit("id", idValue)
                }
                className={cn(
                  "text-muted-foreground/40 font-mono text-sm font-medium transition-colors select-none",
                  isReadOnly
                    ? "cursor-default"
                    : "hover:text-primary cursor-pointer",
                )}
              >
                #
                {editingField === "id" ? (
                  <input
                    ref={inputRef as React.RefObject<HTMLInputElement>}
                    type="text"
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    onBlur={saveEdit}
                    onKeyDown={handleKeyDown}
                    className="w-12 text-center font-mono text-sm text-muted-foreground/40 font-medium bg-transparent border-none p-0 outline-none focus:outline-none inline-block"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  idValue
                )}
              </span>
            </div>
          )}

          <div className="flex-1 min-w-0 overflow-hidden">
            {editingField === "name" ? (
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type="text"
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={handleKeyDown}
                className="text-3xl font-bold tracking-tight text-foreground bg-transparent border-none p-0 outline-none focus:outline-none w-full"
              />
            ) : (
              <h3
                className={cn(
                  "text-3xl font-bold tracking-tight text-foreground truncate block w-full max-w-full transition-opacity select-none",
                  isReadOnly
                    ? "cursor-default"
                    : "cursor-pointer hover:opacity-70",
                )}
                onClick={isReadOnly ? undefined : () => startEdit("name", name)}
                title={name}
              >
                {name}
              </h3>
            )}
          </div>
        </div>

        {!isThin && (
          <div className="flex-1 relative overflow-hidden">
            {editingField === "desc" ? (
              <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={tempValue}
                onChange={handleDescriptionChange}
                onBlur={saveEdit}
                onKeyDown={handleKeyDown}
                className="w-full h-full text-[13px] resize-none font-medium leading-relaxed text-muted-foreground bg-transparent border-none p-0 outline-none focus:outline-none"
              />
            ) : (
              <div
                className={cn(
                  "w-full h-full text-[13px] leading-relaxed text-muted-foreground transition-colors wrap-break-word whitespace-pre-wrap overflow-y-auto pr-2",
                  isReadOnly
                    ? "cursor-default"
                    : "cursor-pointer hover:text-foreground",
                )}
                onClick={
                  isReadOnly
                    ? undefined
                    : () => startEdit("desc", sanitizedDescription)
                }
              >
                <span
                  dangerouslySetInnerHTML={{ __html: renderedDescriptionHtml }}
                />
              </div>
            )}
          </div>
        )}

        <div
          className={cn(
            "shrink-0 flex flex-col",
            isThin ? "mt-1 gap-2" : "mt-auto gap-4",
          )}
        >
          {properties.length > 0 && (
            <div
              className={cn(
                "flex flex-wrap gap-2 pt-4",
                "justify-start",
                !isThin && "border-t border-border/40",
              )}
            >
              {properties.map((prop) => (
                <Tooltip key={prop.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isReadOnly) return;
                        prop.onClick();
                      }}
                      onPointerDown={(e) => e.preventDefault()}
                      disabled={isReadOnly}
                      aria-disabled={isReadOnly}
                      className={cn(
                        getPropertyStyles(prop.isActive, prop.variant),
                        isReadOnly && "cursor-default opacity-70",
                      )}
                    >
                      {prop.icon}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-bold">{prop.label}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}

          <div
            className={cn(
              "flex items-center gap-2 pt-2",
              isThin ? "flex-nowrap overflow-visible pb-1" : "justify-between",
            )}
          >
            {duplicateAction && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onDuplicate) {
                        onDuplicate();
                      } else {
                        duplicateAction.onClick();
                      }
                    }}
                    onPointerDown={(e) => e.preventDefault()}
                    className={cn(
                      "transition-all hover:scale-110 rounded-lg cursor-pointer",
                      useCompactIconActions
                        ? "h-7 w-7"
                        : isThin
                          ? "h-8 w-8"
                          : "h-9 w-9",
                    )}
                  >
                    {duplicateAction.icon}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="font-bold">
                  {duplicateAction.label}
                </TooltipContent>
              </Tooltip>
            )}

            <div
              className={cn(
                "flex items-center gap-2",
                isThin ? "flex-nowrap shrink-0" : "flex-wrap",
              )}
            >
              {showPlaceholderPickerButton &&
                onOpenPlaceholderPicker &&
                !isReadOnly && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenPlaceholderPicker();
                        }}
                        onPointerDown={(e) => e.preventDefault()}
                        className={cn(
                          "transition-all hover:scale-110 rounded-lg cursor-pointer",
                          useCompactIconActions
                            ? "h-7 w-7"
                            : isThin
                              ? "h-8 w-8"
                              : "h-9 w-9",
                        )}
                      >
                        <Image className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="font-bold">
                      Choose Placeholder
                    </TooltipContent>
                  </Tooltip>
                )}

              {showPlaceholderPickerButton && !isReadOnly && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsPixelEditorOpen(true);
                      }}
                      onPointerDown={(e) => e.preventDefault()}
                        className={cn(
                          "transition-all hover:scale-110 rounded-lg cursor-pointer",
                          useCompactIconActions
                            ? "h-7 w-7"
                            : isThin
                              ? "h-8 w-8"
                              : "h-9 w-9",
                        )}
                      >
                      <PaintBrush className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="font-bold">
                    Pixel Editor
                  </TooltipContent>
                </Tooltip>
              )}

              {iconActions.map((action) => (
                <Tooltip key={action.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={action.variant || "ghost"}
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        action.onClick();
                      }}
                      onPointerDown={(e) => e.preventDefault()}
                      className={cn(
                        "transition-all hover:scale-110 rounded-lg cursor-pointer",
                        useCompactIconActions
                          ? "h-7 w-7"
                          : isThin
                            ? "h-8 w-8"
                            : "h-9 w-9",
                      )}
                    >
                      {action.icon}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="font-bold">
                    {action.label}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>

            {textActions.length > 0 && (
              <div
                className={cn(
                  "flex items-center gap-2",
                  isThin ? "shrink-0 ml-auto" : "ml-auto",
                )}
              >
                {textActions.map((action) => (
                  <Tooltip key={action.id}>
                    <TooltipTrigger asChild>
                      <Button
                        variant={action.variant || "secondary"}
                        size={useTextActionButtons ? "sm" : "icon"}
                        onClick={(e) => {
                          e.stopPropagation();
                          action.onClick();
                        }}
                        onPointerDown={(e) => e.preventDefault()}
                        className={cn(
                          "relative rounded-lg text-xs font-semibold uppercase tracking-wide cursor-pointer",
                          isThin ? "h-8" : "h-9",
                          useTextActionButtons
                            ? isThin
                              ? "px-2.5"
                              : "px-3"
                            : isThin
                              ? "w-8 px-0"
                              : "w-9 px-0",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <span className="flex h-4 w-4 items-center justify-center">
                            {action.icon}
                          </span>
                          <span
                            className={cn(!useTextActionButtons && "hidden")}
                          >
                            {action.id === "edit" ? "Edit" : "Rules"}
                          </span>
                        </span>
                        {typeof action.badgeCount === "number" && (
                          <span className="absolute -top-2 -right-2 h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-5 shadow-sm">
                            {action.badgeCount}
                          </span>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="font-bold">
                      {action.label}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <PixelArtEditorDialog
        open={isPixelEditorOpen}
        onOpenChange={setIsPixelEditorOpen}
        itemName={name}
        sourceImage={resolvedEditableImageSrc}
        sourceLayers={resolvedEditableImageLayers}
        onSaveToItem={({ imageDataUrl, layers }) =>
          onUpdate({
            image: imageDataUrl,
            imageLayers: layers,
            placeholderCreditIndex: undefined,
            placeholderCategory: undefined,
          })
        }
      />
    </div>
  );
});
