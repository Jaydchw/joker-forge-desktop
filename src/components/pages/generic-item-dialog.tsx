import {
  useState,
  useEffect,
  ReactNode,
  useRef,
  useCallback,
  useMemo,
  memo,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Separator as UiSeparator } from "@/components/ui/separator";
import {
  Panel,
  Group,
  Separator as PanelSeparator,
} from "react-resizable-panels";
import {
  Upload,
  Trash,
  Image as ImageIcon,
  GlobeHemisphereWest,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  ArrowCounterClockwise,
} from "@phosphor-icons/react";
import { ItemBadgeSelect } from "@/components/balatro/item-badge-select";
import { ListInput } from "@/components/ui/list-input";
import {
  DescriptionEditor,
  type DescriptionEditorItemContext,
} from "@/components/pages/description-editor";
import { LocalizationEditor } from "@/components/pages/localization-editor";
import {
  PlaceholderEntry,
  PlaceholderCategory,
  getPlaceholderEntriesForCategory,
} from "@/lib/placeholder-assets.ts";
import { PlaceholderPickerDialog } from "@/components/pages/placeholder-picker-dialog";
import {
  DEFAULT_LOCALIZATION_LANGUAGE,
  ensureLocalizableWithLanguage,
  getLocalizationEntryByLanguage,
  normalizeLanguageValue,
  sanitizeLocalizationEntries,
  type LocalizationEntry,
} from "@/lib/localization";
import { getDefaultLocalizationLanguage } from "@/lib/storage";
import {
  sanitizeFieldValue,
  sanitizeKeyLikeValue,
  validateFieldValueBasic,
} from "@/lib/item-field-validation";

export type FieldType =
  | "text"
  | "number"
  | "slider"
  | "textarea"
  | "rich-textarea"
  | "select"
  | "list"
  | "switch"
  | "image"
  | "custom";

export interface FieldOption {
  label: string;
  value: string | number;
}

export interface DialogField<T> {
  id: string;
  label?: string;
  type: FieldType;
  description?: string;
  options?: FieldOption[];
  placeholder?: string;
  render?: (
    value: any,
    onChange: (val: any) => void,
    item: T,
    setField: (id: string, val: any) => void,
  ) => ReactNode;
  className?: string;
  hidden?: (item: T) => boolean;
  validate?: (value: any, item: T) => string | null;
  processFile?: (file: File) => Promise<string>;
  min?: number;
  max?: number;
  step?: number;
}

export interface FieldGroup<T> {
  id: string;
  label?: string;
  fields: DialogField<T>[];
  className?: string;
}

export interface DialogTab<T> {
  id: string;
  label: string;
  icon?: React.ElementType;
  groups: FieldGroup<T>[];
}

export interface GenericItemDialogProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: T | null;
  title: string;
  description?: string;
  tabs?: DialogTab<T>[];
  groups?: FieldGroup<T>[];
  variant?: "default" | "mini";
  onSave: (id: string, updates: Partial<T>) => void;
  renderPreview?: (item: T) => ReactNode;
  showPlaceholderPicker?: boolean;
  placeholderCategory?: PlaceholderCategory;
}

const EMPTY_SELECT_SENTINEL = "__JF_EMPTY__";

const getNestedValue = (obj: any, path: string) => {
  if (!obj) return undefined;
  return path.split(".").reduce((acc, part) => acc && acc[part], obj);
};

const setNestedValue = (obj: any, path: string, value: any) => {
  const parts = path.split(".");
  const last = parts.pop();
  if (!last) return { ...obj };

  const newObj = { ...obj };
  let current = newObj;
  for (const part of parts) {
    if (!current[part]) current[part] = {};
    current[part] = { ...current[part] };
    current = current[part];
  }
  current[last] = value;
  return newObj;
};

type LocalizableDialogItem = {
  name?: string;
  description?: string;
  localizations?: LocalizationEntry[];
} & DescriptionEditorItemContext;

const isLocalizableDialogItem = (value: unknown): value is LocalizableDialogItem => {
  return Boolean(value && typeof value === "object");
};

const MemoizedField = memo(
  ({
    field,
    value,
    onChange,
    fullItem,
    inGrid,
    error,
    showPlaceholderPicker,
    placeholderCategory,
    placeholderCredits,
    onOpenPlaceholderPicker,
    rerenderKey,
  }: {
    field: DialogField<any>;
    value: any;
    onChange: (id: string, val: any) => void;
    fullItem: any;
    inGrid?: boolean;
    error?: string;
    showPlaceholderPicker?: boolean;
    placeholderCategory?: PlaceholderCategory;
    placeholderCredits?: Record<number, string>;
    onOpenPlaceholderPicker?: () => void;
    rerenderKey?: string;
  }) => {
    void rerenderKey;
    const safeValue =
      field.type === "number" &&
      (value === undefined || value === null || Number.isNaN(Number(value)))
        ? ""
        : value;

    const content = (() => {
      switch (field.type) {
        case "text":
          return (
            <div>
              <Input
                value={String(safeValue || "")}
                onChange={(e) => onChange(field.id, e.target.value)}
                placeholder={field.placeholder}
                className={cn(
                  "cursor-text",
                  error && "border-destructive focus-visible:ring-destructive",
                )}
              />
              {error && (
                <p className="text-xs text-destructive mt-1">{error}</p>
              )}
            </div>
          );
        case "number":
          return (
            <div>
              <Input
                type="number"
                value={safeValue}
                onChange={(e) => {
                  const val = e.target.value;
                  onChange(field.id, val === "" ? undefined : Number(val));
                }}
                placeholder={field.placeholder}
                min={field.min}
                max={field.max}
                step={field.step}
                className={cn(
                  "cursor-text",
                  error && "border-destructive focus-visible:ring-destructive",
                )}
              />
              {error && (
                <p className="text-xs text-destructive mt-1">{error}</p>
              )}
            </div>
          );
        case "slider": {
          const sliderValue =
            typeof safeValue === "number" ? safeValue : (field.min ?? 0);
          const minValue = field.min ?? 0;
          const maxValue = field.max ?? 100;
          return (
            <div>
              <div className="space-y-2.5">
                <Slider
                  value={[sliderValue]}
                  min={minValue}
                  max={maxValue}
                  step={field.step}
                  onValueChange={(val) => onChange(field.id, val[0])}
                  className="w-full cursor-pointer"
                />
                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono px-1">
                  <span>{minValue}</span>
                  <span>{maxValue}</span>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    Value
                  </span>
                  <Input
                    type="number"
                    value={Number.isNaN(sliderValue) ? "" : sliderValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      onChange(field.id, val === "" ? undefined : Number(val));
                    }}
                    min={minValue}
                    max={maxValue}
                    step={field.step}
                    className="h-10 w-44 text-right font-mono number-input-compact"
                  />
                </div>
              </div>
              {error && (
                <p className="text-xs text-destructive mt-1">{error}</p>
              )}
            </div>
          );
        }
        case "textarea":
          return (
            <div>
              <Textarea
                value={String(safeValue || "")}
                onChange={(e) => onChange(field.id, e.target.value)}
                placeholder={field.placeholder}
                className={cn(
                  "min-h-20 cursor-text",
                  error && "border-destructive focus-visible:ring-destructive",
                )}
              />
              {error && (
                <p className="text-xs text-destructive mt-1">{error}</p>
              )}
            </div>
          );
        case "rich-textarea":
          return (
            <DescriptionEditor
              value={String(safeValue || "")}
              onChange={(val) => onChange(field.id, val)}
              placeholder={field.placeholder}
              error={error}
              item={fullItem}
            />
          );
        case "switch":
          return (
            <Switch
              checked={!!safeValue}
              onCheckedChange={(checked) => onChange(field.id, checked)}
              className="cursor-pointer"
            />
          );
        case "select":
          if (field.id === "rarity") {
            return (
              <ItemBadgeSelect
                kind="rarity"
                value={String(safeValue || "")}
                onChange={(val) =>
                  onChange(field.id, isNaN(Number(val)) ? val : Number(val))
                }
              />
            );
          }
          if (field.id === "set") {
            return (
              <ItemBadgeSelect
                kind="set"
                value={String(safeValue || "")}
                onChange={(val) => onChange(field.id, val)}
              />
            );
          }
          const rawSelectValue = String(safeValue ?? "");
          const hasEmptyOption =
            field.options?.some((opt) => String(opt.value) === "") ?? false;
          const resolvedSelectValue =
            rawSelectValue === "" && hasEmptyOption
              ? EMPTY_SELECT_SENTINEL
              : rawSelectValue;

          return (
            <div>
              <Select
                value={resolvedSelectValue}
                onValueChange={(val) => {
                  const normalizedVal =
                    val === EMPTY_SELECT_SENTINEL ? "" : val;
                  onChange(
                    field.id,
                    isNaN(Number(normalizedVal))
                      ? normalizedVal
                      : Number(normalizedVal),
                  );
                }}
              >
                <SelectTrigger
                  className={cn(
                    "cursor-pointer",
                    error &&
                      "border-destructive focus-visible:ring-destructive",
                  )}
                >
                  <SelectValue placeholder={field.placeholder} />
                </SelectTrigger>
                <SelectContent>
                  {field.options?.map((opt) => {
                    const optionValue =
                      String(opt.value) === ""
                        ? EMPTY_SELECT_SENTINEL
                        : String(opt.value);
                    return (
                      <SelectItem
                        key={`${field.id}-${optionValue}-${opt.label}`}
                        value={optionValue}
                        className="cursor-pointer"
                      >
                        {opt.label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {error && (
                <p className="text-xs text-destructive mt-1">{error}</p>
              )}
            </div>
          );
        case "list":
          return (
            <ListInput
              value={Array.isArray(safeValue) ? safeValue : []}
              onChange={(val) => onChange(field.id, val)}
              placeholder={field.placeholder}
            />
          );
        case "image":
          const itemPlaceholderCategory =
            (fullItem?.placeholderCategory as
              | PlaceholderCategory
              | undefined) || placeholderCategory;
          const placeholderCreditIndex =
            typeof fullItem?.placeholderCreditIndex === "number"
              ? fullItem.placeholderCreditIndex
              : undefined;
          const placeholderCredit =
            placeholderCreditIndex !== undefined
              ? placeholderCredits?.[placeholderCreditIndex]
              : undefined;

          return (
            <div className="flex items-start gap-4 p-3 hover:bg-muted/5 transition-colors">
              <div className="relative w-20 h-28 shrink-0 rounded-md overflow-hidden flex items-center justify-center group">
                {safeValue ? (
                  <img
                    src={String(safeValue)}
                    alt="Preview"
                    className="w-full h-full object-contain [image-rendering:pixelated]"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                )}
              </div>
              <div className="flex-1 space-y-3">
                <Label
                  htmlFor={`upload-${field.id}`}
                  className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-4 py-2 w-full"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {safeValue ? "Change Image" : "Upload Image"}
                </Label>
                <input
                  id={`upload-${field.id}`}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (field.processFile) {
                        try {
                          const result = await field.processFile(file);
                          onChange(field.id, result);
                          if ("placeholderCreditIndex" in (fullItem as any)) {
                            onChange("placeholderCreditIndex", undefined);
                          }
                        } catch (err) {
                          console.error("Image processing failed", err);
                        }
                      } else {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          onChange(field.id, event.target?.result);
                          if ("placeholderCreditIndex" in (fullItem as any)) {
                            onChange("placeholderCreditIndex", undefined);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }
                  }}
                />

                {showPlaceholderPicker && field.id === "image" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full cursor-pointer"
                    onClick={onOpenPlaceholderPicker}
                  >
                    <ImageIcon className="mr-2 h-4 w-4" />
                    Choose Placeholder
                  </Button>
                )}

                {safeValue && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                    onClick={() => {
                      onChange(field.id, "");
                      if ("placeholderCreditIndex" in (fullItem as any)) {
                        onChange("placeholderCreditIndex", undefined);
                      }
                      if ("placeholderCategory" in (fullItem as any)) {
                        onChange("placeholderCategory", undefined);
                      }
                    }}
                  >
                    <Trash className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                )}

                {placeholderCredit && (
                  <p className="text-[11px] text-muted-foreground text-center">
                    Placeholder credit: {placeholderCredit}
                    {itemPlaceholderCategory
                      ? ` (${itemPlaceholderCategory})`
                      : ""}
                  </p>
                )}

                {field.description && (
                  <p className="text-[10px] text-muted-foreground leading-tight text-center">
                    {field.description}
                  </p>
                )}
              </div>
            </div>
          );
        case "custom":
          return field.render
            ? field.render(
                safeValue,
                (val) => onChange(field.id, val),
                fullItem,
                onChange,
              )
            : null;
        default:
          return null;
      }
    })();

    if (field.type === "switch") {
      return (
        <div
          className={cn(
            "flex items-center justify-between py-2 cursor-pointer group/toggle",
            inGrid ? "h-full" : "",
          )}
          onClick={() => onChange(field.id, !safeValue)}
        >
          <div className="space-y-0.5 max-w-[70%]">
            <Label className="text-sm font-bold text-foreground/80 leading-none cursor-pointer">
              {field.label}
            </Label>
            {field.description && (
              <p className="text-[0.8rem] text-muted-foreground">
                {field.description}
              </p>
            )}
          </div>
          <div className="flex items-center h-full">
            <div onClick={(e) => e.stopPropagation()}>{content}</div>
          </div>
        </div>
      );
    }

    if (field.type === "rich-textarea") {
      return (
        <div className="space-y-2 py-2">
          <Label className="text-sm font-bold text-foreground/80 block">
            {field.label}
          </Label>
          {content}
          {field.description && (
            <p className="text-[0.7rem] text-muted-foreground mt-1 leading-snug">
              {field.description}
            </p>
          )}
        </div>
      );
    }

    if (inGrid) {
      return (
        <div className="space-y-2">
          <Label className="text-sm font-bold text-foreground/80 block">
            {field.label}
          </Label>
          {content}
          {field.description && (
            <p className="text-[0.7rem] text-muted-foreground mt-1 leading-snug">
              {field.description}
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-4 gap-4 items-start py-3 border-b border-border/20 last:border-0">
        <div className="col-span-1 pt-2 pr-2">
          <Label className="text-sm font-bold text-foreground/80 block wrap-break-word">
            {field.label}
          </Label>
          {field.description && (
            <p className="text-[0.7rem] text-muted-foreground mt-1.5 leading-snug">
              {field.description}
            </p>
          )}
        </div>
        <div className="col-span-3 space-y-1">{content}</div>
      </div>
    );
  },
  (prev, next) => {
    if (prev.value !== next.value) return false;
    if (prev.field.id !== next.field.id) return false;
    if (prev.inGrid !== next.inGrid) return false;
    if (prev.error !== next.error) return false;

    const prevHidden = prev.field.hidden
      ? prev.field.hidden(prev.fullItem)
      : false;
    const nextHidden = next.field.hidden
      ? next.field.hidden(next.fullItem)
      : false;
    if (prevHidden !== nextHidden) return false;

    if (prev.field.type === "custom") {
      return prev.fullItem === next.fullItem;
    }

    return true;
  },
);

const PreviewPanel = memo(
  ({
    item,
    renderPreview,
    isCollapsed,
  }: {
    item: any;
    renderPreview: (item: any) => ReactNode;
    isCollapsed: boolean;
  }) => {
    const [scale, setScale] = useState([1.0]);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const previewContainerRef = useRef<HTMLDivElement>(null);
    const panLastRef = useRef<{ x: number; y: number } | null>(null);

    const handleWheelZoom = useCallback(
      (e: React.WheelEvent<HTMLDivElement>) => {
        if (e.cancelable) {
          e.preventDefault();
        }
        e.stopPropagation();
        const delta = -e.deltaY * 0.0015;
        setScale((prev) => {
          const newScale = Math.max(0.5, Math.min(1.5, prev[0] + delta));
          return [newScale];
        });
      },
      [],
    );

    const handlePanStart = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        setIsPanning(true);
        panLastRef.current = { x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
      },
      [],
    );

    const handlePanMove = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isPanning || !panLastRef.current) return;
        const dx = e.clientX - panLastRef.current.x;
        const dy = e.clientY - panLastRef.current.y;
        panLastRef.current = { x: e.clientX, y: e.clientY };
        setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      },
      [isPanning],
    );

    const handlePanEnd = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        setIsPanning(false);
        panLastRef.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      },
      [],
    );

    if (!item) return null;

    return (
      <Panel defaultSize={30} minSize={0}>
        <div className="h-full bg-muted/10 flex flex-col border-l border-border/40 relative">
          {!isCollapsed && (
            <div
              className="slider-container absolute top-4 right-4 z-50 flex items-center gap-2 bg-background/80 p-2 rounded-lg border border-border shadow-sm"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <MagnifyingGlassMinus className="w-4 h-4 text-muted-foreground" />
              <Slider
                value={scale}
                onValueChange={setScale}
                min={0.5}
                max={1.5}
                step={0.1}
                className="w-24 cursor-pointer"
              />
              <MagnifyingGlassPlus className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-mono w-8 text-right">
                {(scale[0] * 100).toFixed(0)}%
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px]"
                onClick={() => setPan({ x: 0, y: 0 })}
              >
                <ArrowCounterClockwise className="h-3.5 w-3.5 mr-1" />
                Reset Position
              </Button>
            </div>
          )}

          <div
            ref={previewContainerRef}
            onWheel={handleWheelZoom}
            onPointerDown={handlePanStart}
            onPointerMove={handlePanMove}
            onPointerUp={handlePanEnd}
            onPointerCancel={handlePanEnd}
            className={cn(
              "flex-1 flex items-center justify-center p-8 overflow-hidden bg-size-[16px_16px] bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#1f2937_1px,transparent_1px)] transition-opacity duration-200 touch-none select-none",
              isPanning ? "cursor-grabbing" : "cursor-grab",
              isCollapsed && "opacity-0",
            )}
          >
            <div
              className="transform transition-transform duration-200 ease-out"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale[0]})`,
              }}
            >
              {renderPreview(item)}
            </div>
          </div>
          {!isCollapsed && (
            <div className="p-3 border-t border-border/40 bg-background/50 text-center text-xs text-muted-foreground font-mono">
              Live Preview (drag to pan, scroll to zoom)
            </div>
          )}
        </div>
      </Panel>
    );
  },
  (prev, next) => {
    if (prev.isCollapsed !== next.isCollapsed) return false;
    if (prev.item?.id !== next.item?.id) return false;
    if (prev.item?.name !== next.item?.name) return false;
    if (prev.item?.description !== next.item?.description) return false;
    if (prev.item?.image !== next.item?.image) return false;
    if (prev.item?.overlayImage !== next.item?.overlayImage) return false;
    if (prev.item?.rarity !== next.item?.rarity) return false;
    if (prev.item?.set !== next.item?.set) return false;
    return true;
  },
);

function GenericItemDialogInternal<T extends { id: string }>({
  open,
  onOpenChange,
  item,
  title,
  description,
  tabs,
  groups,
  variant = "default",
  onSave,
  renderPreview,
  showPlaceholderPicker = false,
  placeholderCategory,
}: GenericItemDialogProps<T>) {
  const [formData, setFormData] = useState<T | null>(null);
  const [activeTab, setActiveTab] = useState<string>("");
  const [panelSize, setPanelSize] = useState<number>(70);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [defaultLocalizationLanguage, setDefaultLocalizationLanguage] =
    useState<string>(DEFAULT_LOCALIZATION_LANGUAGE);
  const [activeLocalizationLanguage, setActiveLocalizationLanguage] =
    useState<string>(DEFAULT_LOCALIZATION_LANGUAGE);
  const [isPlaceholderDialogOpen, setIsPlaceholderDialogOpen] = useState(false);
  const [placeholderCredits, setPlaceholderCredits] = useState<
    Record<number, string>
  >({});
  const modalRef = useRef<HTMLDivElement>(null);
  const handleSaveRef = useRef<() => void>(() => {});
  const isMini = variant === "mini";

  const resolvedTabs = useMemo(() => {
    const baseTabs = tabs && tabs.length > 0 ? [...tabs] : [];
    if (baseTabs.length === 0) return baseTabs;
    if (!isLocalizableDialogItem(item)) return baseTabs;
    if (baseTabs.some((tab) => tab.id === "localization")) return baseTabs;

    const localizationTab: DialogTab<T> = {
      id: "localization",
      label: "Localization",
      icon: GlobeHemisphereWest,
      groups: [
        {
          id: "localization_overrides",
          className: "grid grid-cols-1 gap-6",
          fields: [
            {
              id: "localizations",
              type: "custom",
              label: "Language Overrides",
              render: (value, onChange, currentItem) => {
                const localizableItem = currentItem as LocalizableDialogItem;
                return (
                  <LocalizationEditor
                    key={`localization-editor-${activeLocalizationLanguage}`}
                    value={sanitizeLocalizationEntries(value)}
                    onChange={onChange}
                    baseName={localizableItem.name || ""}
                    baseDescription={localizableItem.description || ""}
                    itemContext={currentItem as DescriptionEditorItemContext}
                    activeLanguage={activeLocalizationLanguage}
                    onActiveLanguageChange={setActiveLocalizationLanguage}
                    defaultLanguage={defaultLocalizationLanguage}
                  />
                );
              },
            },
          ],
        },
      ],
    };

    return [...baseTabs, localizationTab];
  }, [item, tabs, activeLocalizationLanguage, defaultLocalizationLanguage]);
  const hasTabs = resolvedTabs.length > 0;
  const resolvedGroups = useMemo(
    () => (!hasTabs ? groups || [] : []),
    [groups, hasTabs],
  );

  const isPreviewCollapsed = panelSize > 95;
  const resolvedActiveTab = hasTabs
    ? activeTab || resolvedTabs[0]?.id || ""
    : "";
  const activeTabConfig = useMemo(
    () => resolvedTabs.find((tab) => tab.id === resolvedActiveTab),
    [resolvedTabs, resolvedActiveTab],
  );
  const fieldConfigById = useMemo(() => {
    const groupsToScan = hasTabs
      ? resolvedTabs.flatMap((tab) => tab.groups)
      : resolvedGroups;
    const entries = groupsToScan.flatMap((group) =>
      group.fields.map((field) => [field.id, field] as const),
    );
    return new Map(entries);
  }, [hasTabs, resolvedTabs, resolvedGroups]);

  useEffect(() => {
    if (open && item) {
      const nextDefaultLanguage = getDefaultLocalizationLanguage();
      setDefaultLocalizationLanguage(nextDefaultLanguage);
      setActiveLocalizationLanguage(nextDefaultLanguage);

      if (hasTabs && resolvedTabs.length > 0) {
        setActiveTab(resolvedTabs[0].id);
      }

      if (isLocalizableDialogItem(item)) {
        const normalizedLocalizableItem = ensureLocalizableWithLanguage(
          item as LocalizableDialogItem,
          nextDefaultLanguage,
        );
        setFormData(normalizedLocalizableItem as unknown as T);
      } else {
        setFormData({ ...(item as T) });
      }
      setErrors({});
      setIsPlaceholderDialogOpen(false);
      return;
    }

    setFormData(null);
  }, [open, item?.id, hasTabs]);

  const previewItem = useMemo(() => {
    if (!formData || !isLocalizableDialogItem(formData)) return formData;
    const localizableFormData = formData as T & LocalizableDialogItem;

    const isLocalizationTabActive = resolvedActiveTab === "localization";
    const normalizedLanguage =
      normalizeLanguageValue(
        isLocalizationTabActive
          ? activeLocalizationLanguage
          : defaultLocalizationLanguage,
      ) ||
      defaultLocalizationLanguage;
    const localizations = sanitizeLocalizationEntries(
      localizableFormData.localizations,
    );
    const selectedLocalization = getLocalizationEntryByLanguage(
      localizations,
      normalizedLanguage,
    );
    const isDefaultLanguage =
      normalizedLanguage.toLowerCase() ===
      defaultLocalizationLanguage.toLowerCase();
    if (!selectedLocalization) {
      if (isDefaultLanguage) return localizableFormData;
      return {
        ...localizableFormData,
        name: "",
        description: "",
      };
    }

    const localizedName = selectedLocalization.name;
    const localizedDescription = selectedLocalization.description;

    if (
      localizedName === localizableFormData.name &&
      localizedDescription === localizableFormData.description
    ) {
      return localizableFormData;
    }

    return {
      ...localizableFormData,
      name: localizedName,
      description: localizedDescription,
    };
  }, [
    activeLocalizationLanguage,
    defaultLocalizationLanguage,
    formData,
    resolvedActiveTab,
  ]);

  useEffect(() => {
    if (!open || !showPlaceholderPicker || !placeholderCategory) {
      setPlaceholderCredits({});
      return;
    }

    let isMounted = true;
    const load = async () => {
      const entries =
        await getPlaceholderEntriesForCategory(placeholderCategory);
      if (!isMounted) return;

      const creditMap = entries.reduce(
        (acc: Record<number, string>, entry: PlaceholderEntry) => {
          acc[entry.index] = entry.credit;
          return acc;
        },
        {} as Record<number, string>,
      );

      setPlaceholderCredits(creditMap);
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [open, placeholderCategory, showPlaceholderPicker]);

  const handleChange = useCallback(
    (path: string, value: any) => {
      const fieldConfig = fieldConfigById.get(path);
      const nextValue = fieldConfig
        ? sanitizeFieldValue(fieldConfig.type, path, value)
        : value;

      setFormData((prev: any) => {
        if (!prev) return null;
        let newData: any;
        const normalizedDefaultLanguage =
          normalizeLanguageValue(defaultLocalizationLanguage) ||
          DEFAULT_LOCALIZATION_LANGUAGE;

        if (
          isLocalizableDialogItem(prev) &&
          (path === "name" || path === "description")
        ) {
          const base = ensureLocalizableWithLanguage(
            prev as LocalizableDialogItem,
            normalizedDefaultLanguage,
          );
          const existingDefaultLocalization =
            getLocalizationEntryByLanguage(
              base.localizations,
              normalizedDefaultLanguage,
            ) || {
              language: normalizedDefaultLanguage,
              name: "",
              description: "",
            };

          const updatedDefaultLocalization: LocalizationEntry = {
            ...existingDefaultLocalization,
            name:
              path === "name"
                ? String(nextValue ?? "")
                : existingDefaultLocalization.name,
            description:
              path === "description"
                ? String(nextValue ?? "")
                : existingDefaultLocalization.description,
          };

          const nextLocalizations = base.localizations
            .filter(
              (entry) =>
                entry.language.toLowerCase() !==
                normalizedDefaultLanguage.toLowerCase(),
            )
            .concat(updatedDefaultLocalization);

          newData = {
            ...base,
            name: updatedDefaultLocalization.name,
            description: updatedDefaultLocalization.description,
            localizations: nextLocalizations,
          };
        } else {
          newData = setNestedValue(prev, path, nextValue);
        }

        if (isLocalizableDialogItem(prev) && path === "localizations") {
          const withLocalizations = {
            ...(prev as LocalizableDialogItem),
            localizations: sanitizeLocalizationEntries(nextValue),
          };
          newData = ensureLocalizableWithLanguage(
            withLocalizations,
            normalizedDefaultLanguage,
          );
        }

        if (path === "name" && typeof nextValue === "string") {
          const currentName = prev.name || "";
          const currentKey = prev.objectKey || "";
          const oldSlug = sanitizeKeyLikeValue(currentName);

          if (
            !currentKey ||
            currentKey === oldSlug ||
            currentKey.startsWith("new_") ||
            currentKey === "unnamed_item"
          ) {
            newData = setNestedValue(
              newData,
              "objectKey",
              sanitizeKeyLikeValue(nextValue),
            );
          }
        }
        return newData;
      });

      setErrors((prev) => {
        if (prev[path]) {
          const newErrors = { ...prev };
          delete newErrors[path];
          return newErrors;
        }
        return prev;
      });
    },
    [defaultLocalizationLanguage, fieldConfigById],
  );

  const handleSave = useCallback(() => {
    if (!formData || !formData.id) return;

    let nextFormData = formData;
    const newErrors: Record<string, string> = {};
    let hasError = false;

    const validationGroups = hasTabs
      ? resolvedTabs.flatMap((tab) => tab.groups)
      : resolvedGroups;

    validationGroups.forEach((group) => {
      group.fields.forEach((field) => {
        if (field.hidden && field.hidden(nextFormData as T)) {
          return;
        }
        const currentValue = getNestedValue(nextFormData, field.id);
        const basicValidation = validateFieldValueBasic(
          field.type,
          field.id,
          currentValue,
          field.options,
          field.min,
          field.max,
        );

        if (basicValidation.sanitizedValue !== currentValue) {
          nextFormData = setNestedValue(
            nextFormData,
            field.id,
            basicValidation.sanitizedValue,
          );
        }

        if (basicValidation.error) {
          newErrors[field.id] = basicValidation.error;
          hasError = true;
          return;
        }

        if (field.validate) {
          const error = field.validate(
            getNestedValue(nextFormData, field.id),
            nextFormData,
          );
          if (error) {
            newErrors[field.id] = error;
            hasError = true;
          }
        }
      });
    });

    setErrors(newErrors);
    setFormData(nextFormData);

    if (!hasError) {
      onSave(nextFormData.id, nextFormData);
      onOpenChange(false);
    } else if (hasTabs) {
      const firstErrorField = Object.keys(newErrors)[0];
      for (const tab of resolvedTabs) {
        for (const group of tab.groups) {
          if (group.fields.some((f) => f.id === firstErrorField)) {
            setActiveTab(tab.id);
            return;
          }
        }
      }
    }
  }, [formData, onSave, onOpenChange, hasTabs, resolvedTabs, resolvedGroups]);

  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: PointerEvent) => {
      if (isPlaceholderDialogOpen) return;
      // Keep the editor open while any Radix select menu is active.
      // Use capture-phase pointerdown so this runs before Radix closes the menu.
      if (
        document.querySelector(
          "[data-slot='select-trigger'][data-state='open'], [data-slot='select-content'][data-state='open']",
        )
      ) {
        return;
      }

      const target = event.target as Element | null;
      if (target?.closest("[data-tauri-drag-region]")) {
        return;
      }
      if (target?.closest(".placeholder-picker-content")) {
        return;
      }
      if (
        target?.closest(
          "[data-radix-popper-content-wrapper], [data-radix-portal], [data-radix-select-content], [data-radix-select-viewport]",
        )
      ) {
        return;
      }
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        handleSaveRef.current();
      }
    };

    document.addEventListener("pointerdown", handleClickOutside, true);
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside, true);
    };
  }, [open, isPlaceholderDialogOpen]);

  if (!open || !item || !formData) return null;

  const contentContainerClass = cn(
    "px-6 py-8 max-w-4xl mx-auto w-full",
    isMini && "max-w-3xl",
  );

  const renderGroups = (groupList: FieldGroup<T>[]) => (
    <div className={contentContainerClass}>
      {groupList.map((group, index) => (
        <div
          key={group.id}
          className={cn(
            "space-y-4",
            index > 0 && "mt-10 pt-4 border-t border-border/30",
          )}
        >
          {group.label && (
            <div className="space-y-2 pb-2">
              <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                {group.label}
              </h4>
              <UiSeparator className="bg-primary/20 h-0.5" />
            </div>
          )}
          <div className={cn(group.className || "space-y-0")}>
            {group.fields.map((field) => {
              if (field.hidden && field.hidden(formData!)) return null;

              if (
                field.id === "localizations" &&
                field.type === "custom" &&
                isLocalizableDialogItem(formData)
              ) {
                const localizableItem = formData as LocalizableDialogItem;
                return (
                  <LocalizationEditor
                    key={`localization-editor-direct-${activeLocalizationLanguage}`}
                    value={sanitizeLocalizationEntries(localizableItem.localizations)}
                    onChange={(entries) => handleChange("localizations", entries)}
                    baseName={localizableItem.name || ""}
                    baseDescription={localizableItem.description || ""}
                    itemContext={formData as DescriptionEditorItemContext}
                    activeLanguage={activeLocalizationLanguage}
                    onActiveLanguageChange={setActiveLocalizationLanguage}
                    defaultLanguage={defaultLocalizationLanguage}
                  />
                );
              }

              return (
                <MemoizedField
                  key={field.id}
                  field={field}
                  value={getNestedValue(formData, field.id)}
                  onChange={handleChange}
                  fullItem={formData}
                  inGrid={!!group.className?.includes("grid")}
                  error={errors[field.id]}
                  showPlaceholderPicker={showPlaceholderPicker}
                  placeholderCategory={placeholderCategory}
                  placeholderCredits={placeholderCredits}
                  onOpenPlaceholderPicker={() =>
                    setIsPlaceholderDialogOpen(true)
                  }
                  rerenderKey={
                    field.id === "localizations"
                      ? activeLocalizationLanguage
                      : undefined
                  }
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  const dialogSizeClass = isMini
    ? "max-w-[85vw]! w-[85vw]! h-[80vh]! max-h-[80vh]"
    : "max-w-[95vw]! w-[95vw]! h-[90vh]! max-h-[90vh]";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={modalRef}
        className={cn(
          dialogSizeClass,
          "flex flex-col p-0 gap-0 overflow-hidden shadow-2xl bg-background border-border/50",
        )}
        showCloseButton={false}
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
        }}
      >
        <DialogHeader className="px-6 py-4 border-b border-border/40 shrink-0 bg-muted/10">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-bold tracking-tight">
                {title}
              </DialogTitle>
              {description && (
                <DialogDescription>{description}</DialogDescription>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="lg"
                onClick={() => onOpenChange(false)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                size="lg"
                className="cursor-pointer px-8"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </DialogHeader>

        {hasTabs ? (
          <Tabs
            value={resolvedActiveTab}
            onValueChange={setActiveTab}
            className="flex-1 flex overflow-hidden min-h-0"
            orientation="vertical"
          >
            <Group orientation="horizontal" className="flex-1">
              <Panel
                defaultSize={renderPreview ? 70 : 100}
                minSize={renderPreview ? 50 : 100}
                onResize={(size) =>
                  setPanelSize(
                    typeof size === "number"
                      ? size
                      : Array.isArray(size)
                        ? size[0]
                        : 0,
                  )
                }
              >
                <div className="flex h-full">
                  <div
                    className={cn(
                      "border-r border-border/40 bg-muted/5 flex flex-col shrink-0",
                      isMini ? "w-48" : "w-56",
                    )}
                  >
                    <ScrollArea className="flex-1">
                      <TabsList className="flex flex-col w-full bg-transparent p-2 gap-1 h-auto">
                        {resolvedTabs.map((tab) => (
                          <TabsTrigger
                            key={tab.id}
                            value={tab.id}
                            className="w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium border-transparent border-l-4 transition-all cursor-pointer rounded-r-md rounded-l-none data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary hover:bg-primary/5 hover:text-primary"
                          >
                            {tab.icon && (
                              <tab.icon className="h-4 w-4 opacity-70" />
                            )}
                            {tab.label}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </ScrollArea>
                  </div>

                  <div className="flex-1 bg-background flex flex-col min-w-0 min-h-0">
                    <div className="flex-1 min-h-0 overflow-y-auto">
                      {activeTabConfig && (
                        <TabsContent
                          value={activeTabConfig.id}
                          className="mt-0 space-y-10 outline-none"
                        >
                          {renderGroups(activeTabConfig.groups)}
                        </TabsContent>
                      )}
                    </div>
                  </div>
                </div>
              </Panel>

              {renderPreview && (
                <PanelSeparator className="w-1.5 bg-border/40 hover:bg-primary/50 transition-colors flex items-center justify-center cursor-col-resize z-50 focus:outline-none">
                  <div className="h-8 w-1 bg-muted-foreground/30 rounded-full" />
                </PanelSeparator>
              )}

              {renderPreview && (
                <PreviewPanel
                  item={previewItem}
                  renderPreview={renderPreview}
                  isCollapsed={isPreviewCollapsed}
                />
              )}
            </Group>
          </Tabs>
        ) : (
          <div className="flex-1 flex min-h-0">
            <div className="flex-1 bg-background flex flex-col min-w-0 min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto">
                {renderGroups(resolvedGroups)}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="hidden" />
      </DialogContent>

      {showPlaceholderPicker && (
        <PlaceholderPickerDialog
          open={isPlaceholderDialogOpen}
          onOpenChange={setIsPlaceholderDialogOpen}
          initialCategory={placeholderCategory}
          onSelect={(entry) => {
            handleChange("image", entry.src);
            handleChange("placeholderCreditIndex", entry.index);
            handleChange("placeholderCategory", entry.category);
          }}
        />
      )}
    </Dialog>
  );
}

export const GenericItemDialog = memo(
  GenericItemDialogInternal,
) as typeof GenericItemDialogInternal;
