import {
  useState,
  useEffect,
  useLayoutEffect,
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
import IconButton from "@/components/ui/icon-button";
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
import { cn } from "@/lib/core/utils";
import { Separator as UiSeparator } from "@/components/ui/separator";
import {
  Panel,
  Group,
  Separator as PanelSeparator,
} from "react-resizable-panels";
import {
  Upload,
  Trash,
  Crop,
  Image as ImageIcon,
  GlobeHemisphereWest,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  ArrowCounterClockwise,
  ArrowsOutSimple,
} from "@phosphor-icons/react";
import { ItemBadgeSelect } from "@/components/balatro/item-badge-select";
import { ListInput } from "@/components/ui/list-input";
import {
  DescriptionEditor,
  type DescriptionEditorItemContext,
} from "@/components/pages/description-editor";
import { LocalizationEditor } from "@/components/pages/localization-editor";
import {
  PlaceholderCategory,
  PlaceholderEntry,
} from "@/lib/content/placeholder-assets.ts";
import { PlaceholderPickerDialog } from "@/components/pages/placeholder-picker-dialog";
import {
  DEFAULT_LOCALIZATION_LANGUAGE,
  ensureLocalizableWithLanguage,
  getLocalizationEntryByLanguage,
  normalizeLanguageValue,
  sanitizeLocalizationEntries,
  type LocalizationEntry,
} from "@/lib/core/localization";
import { getDefaultLocalizationLanguage } from "@/lib/services/storage";
import {
  sanitizeFieldValue,
  sanitizeKeyLikeValue,
  validateFieldValueBasic,
} from "@/lib/items/item-field-validation";
import { ImageCropperDialog, type SpriteApplyOptions } from "@/components/pages/image-cropper-dialog";
import { ItemShowcaseDialog } from "@/components/pages/item-showcase-dialog";
import {
  getImageDimensions,
  isBalatroCardImageSize,
  normalizeBalatroCardImageSource,
  readFileAsDataUrl,
} from "@/lib/media/image-processing-utils";
import {
  decodeGifDataUrl,
  isGifDataUrl,
  type DecodedGif,
} from "@/lib/media/gif-decoder";
import { getFullSpriteSize } from "@/lib/media/sprite-sizing";

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
  lockedValues?: string[];
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
  allowFullSprite?: boolean;
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

type ImageCropperState = {
  fieldId: string;
  imageSrc: string;
  animation?: DecodedGif;
  allowFullSprite?: boolean;
  initialFullSprite?: boolean;
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
    onOpenPlaceholderPicker,
    onOpenImageCropper,
    onUploadImage,
    onClearImage,
    isProcessingImage,
    rerenderKey,
  }: {
    field: DialogField<any>;
    value: any;
    onChange: (id: string, val: any) => void;
    fullItem: any;
    inGrid?: boolean;
    error?: string;
    showPlaceholderPicker?: boolean;
    onOpenPlaceholderPicker?: () => void;
    onOpenImageCropper?: (fieldId: string, src: string) => void;
    onUploadImage: (
      field: DialogField<any>,
      input: HTMLInputElement,
    ) => Promise<void>;
    onClearImage: (fieldId: string) => Promise<void>;
    isProcessingImage?: boolean;
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
              <div>
                <ItemBadgeSelect
                  kind="rarity"
                  value={String(safeValue || "")}
                  onChange={(val) =>
                    onChange(field.id, isNaN(Number(val)) ? val : Number(val))
                  }
                />
                {error && (
                  <p
                    role="alert"
                    className="text-xs text-destructive dark:text-red-400 mt-1"
                  >
                    {error}
                  </p>
                )}
              </div>
            );
          }
          if (field.id === "set") {
            return (
              <div>
                <ItemBadgeSelect
                  kind="set"
                  value={String(safeValue || "")}
                  onChange={(val) => onChange(field.id, val)}
                />
                {error && (
                  <p
                    role="alert"
                    className="text-xs text-destructive dark:text-red-400 mt-1"
                  >
                    {error}
                  </p>
                )}
              </div>
            );
          }
          const hasEmptyOption =
            field.options?.some((opt) => String(opt.value) === "") ?? false;
          const rawSelectValue =
            safeValue === false && hasEmptyOption
              ? ""
              : String(safeValue ?? "");
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
                    normalizedVal === "" || isNaN(Number(normalizedVal))
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
              lockedValues={field.lockedValues}
            />
          );
        case "image":
          const isOverlayImage = field.id
            .toLowerCase()
            .includes("overlay");
          const imageKind = isOverlayImage ? "Overlay" : "Sprite";
          const uploadLabel = safeValue
            ? `Replace ${imageKind}`
            : `Upload ${imageKind}`;
          return (
            <div className="group/image-field flex flex-col items-center gap-2 p-3 transition-colors hover:bg-muted/5">
              <div className="relative flex h-80 w-60 shrink-0 items-center justify-center overflow-hidden">
                {safeValue ? (
                  <img
                    src={String(safeValue)}
                    alt="Preview"
                    className="w-full h-full object-contain [image-rendering:pixelated]"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                )}

                <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover/image-field:bg-black/55 group-hover/image-field:opacity-100">
                  <div className="flex flex-col gap-2 px-4">
                    <Button asChild disabled={isProcessingImage}>
                      <Label
                        htmlFor={`upload-${field.id}`}
                        className="cursor-pointer"
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        {uploadLabel}
                      </Label>
                    </Button>

                    {showPlaceholderPicker && field.id === "image" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="cursor-pointer"
                        disabled={isProcessingImage}
                        onClick={onOpenPlaceholderPicker}
                      >
                        <ImageIcon className="mr-2 h-4 w-4" />
                        Presets
                      </Button>
                    )}

                    {safeValue && (
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="cursor-pointer"
                          disabled={isProcessingImage}
                          onClick={() =>
                            onOpenImageCropper?.(field.id, String(safeValue))
                          }
                        >
                          <Crop className="mr-2 h-4 w-4" />
                          Adjust
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="cursor-pointer"
                          disabled={isProcessingImage}
                          onClick={() => void onClearImage(field.id)}
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          Clear
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <input
                  id={`upload-${field.id}`}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={isProcessingImage}
                  onChange={(e) => void onUploadImage(field, e.currentTarget)}
                />
              </div>
              {isProcessingImage && (
                <p role="status" className="text-xs text-muted-foreground">
                  Preparing image…
                </p>
              )}
              <p className="text-center text-xs text-muted-foreground">
                PNG, JPG, WebP or animated GIF
              </p>
              {field.allowFullSprite && field.id === "image" && fullItem.fullSprite && (
                <p className="text-center text-xs text-muted-foreground">
                  Full sprite · {fullItem.fullSprite.width} × {fullItem.fullSprite.height}
                </p>
              )}
              {error && (
                <div className="space-y-2 text-center">
                  <p role="alert" className="text-xs text-destructive dark:text-red-400">
                    {error}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onChange(field.id, safeValue || "")}
                  >
                    Discard failed upload
                  </Button>
                </div>
              )}
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
    if (prev.field !== next.field) return false;
    if (prev.onChange !== next.onChange) return false;
    if (prev.field.type === "image" && prev.onUploadImage !== next.onUploadImage) {
      return false;
    }
    if (prev.field.type === "image" && (prev.onClearImage !== next.onClearImage || prev.onOpenImageCropper !== next.onOpenImageCropper || prev.fullItem.fullSprite !== next.fullItem.fullSprite)) return false;
    if (prev.isProcessingImage !== next.isProcessingImage) return false;

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
    const [isShowcaseOpen, setIsShowcaseOpen] = useState(false);
    const [spriteFit, setSpriteFit] = useState(1);
    const previewContainerRef = useRef<HTMLDivElement>(null);
    const previewContentRef = useRef<HTMLDivElement>(null);
    const panLastRef = useRef<{ x: number; y: number } | null>(null);

    useLayoutEffect(() => {
      const viewport = previewContainerRef.current;
      const content = previewContentRef.current;
      if (!viewport || !content) return;
      const shouldFit = Boolean(item?.fullSprite) || (item?.objectType === "joker"
        && ((item.scale_w ?? 100) !== 100 || (item.scale_h ?? 100) !== 100));
      const updateFit = () => {
        const fit = shouldFit ? Math.min(1,
          Math.max(1, viewport.clientWidth - 64) / Math.max(1, content.scrollWidth),
          Math.max(1, viewport.clientHeight - 64) / Math.max(1, content.scrollHeight),
        ) : 1;
        setSpriteFit((previous) => Math.abs(previous - fit) < 0.001 ? previous : fit);
      };
      updateFit();
      if (typeof ResizeObserver === "undefined") return;
      const observer = new ResizeObserver(updateFit);
      observer.observe(viewport);
      observer.observe(content);
      return () => observer.disconnect();
    }, [item?.fullSprite, item?.scale_w, item?.scale_h, item?.objectType, isCollapsed]);

    const handleWheelZoom = useCallback(
      (e: WheelEvent) => {
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

    useEffect(() => {
      const previewContainer = previewContainerRef.current;
      if (!previewContainer) return;

      previewContainer.addEventListener("wheel", handleWheelZoom, {
        passive: false,
      });

      return () => {
        previewContainer.removeEventListener("wheel", handleWheelZoom);
      };
    }, [handleWheelZoom]);

    const handlePanStart = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        const target = e.target as HTMLElement | null;
        if (
          target?.closest(
            "button, a, input, textarea, select, [role='button'], [data-preview-no-pan='true']",
          )
        ) {
          return;
        }
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
              className="slider-container absolute top-4 left-1/2 z-50 flex -translate-x-1/2 items-center justify-center gap-2 rounded-lg border border-border bg-background/80 p-2 shadow-sm"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <MagnifyingGlassMinus className="h-4 w-4 text-muted-foreground" />
              <Slider
                value={scale}
                onValueChange={setScale}
                min={0.5}
                max={1.5}
                step={0.1}
                className="w-24 cursor-pointer"
              />
              <MagnifyingGlassPlus className="h-4 w-4 text-muted-foreground" />
              <span className="w-8 text-center font-mono text-xs">
                {(scale[0] * 100).toFixed(0)}%
              </span>
            </div>
          )}

          {!isCollapsed && (
            <div
              className="absolute bottom-14 left-1/2 z-50 flex -translate-x-1/2 items-center justify-center gap-1 rounded-lg border border-border bg-background/80 p-1.5 shadow-sm"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <IconButton
                icon={ArrowCounterClockwise}
                tooltip="Reset preview position"
                onClick={() => setPan({ x: 0, y: 0 })}
                iconOnly
                className="!h-7 !w-7"
                iconClassName="h-3.5 w-3.5"
              />
              <IconButton
                icon={ArrowsOutSimple}
                tooltip="Open showcase"
                onClick={() => setIsShowcaseOpen(true)}
                iconOnly
                className="!h-7 !w-7"
                iconClassName="h-3.5 w-3.5"
              />
            </div>
          )}

          <div
            ref={previewContainerRef}
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
              ref={previewContentRef}
              className="shrink-0 transform transition-transform duration-200 ease-out"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale[0] * spriteFit})`,
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

          <ItemShowcaseDialog
            open={isShowcaseOpen}
            title={item.name || "Item"}
            fileNameBase={item.name || item.id || "item"}
            onOpenChange={setIsShowcaseOpen}
          >
            {renderPreview(item)}
          </ItemShowcaseDialog>
        </div>
      </Panel>
    );
  },
  (prev, next) => {
    if (prev.isCollapsed !== next.isCollapsed) return false;
    if (prev.renderPreview !== next.renderPreview) return false;
    if (prev.item !== next.item) return false;
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
  const formDataRef = useRef<any>(formData);
  formDataRef.current = formData;
  const [activeTab, setActiveTab] = useState<string>("");
  const [panelSize, setPanelSize] = useState<number>(70);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imageErrors, setImageErrors] = useState<Record<string, string>>({});
  const [processingImageFields, setProcessingImageFields] = useState<string[]>([]);
  const imageUploadSessionRef = useRef(0);
  const imageUploadOwnerRef = useRef<string | null>(null);
  const imageUploadRequestsRef = useRef(new Map<string, symbol>());
  const [defaultLocalizationLanguage, setDefaultLocalizationLanguage] =
    useState<string>(DEFAULT_LOCALIZATION_LANGUAGE);
  const [activeLocalizationLanguage, setActiveLocalizationLanguage] =
    useState<string>(DEFAULT_LOCALIZATION_LANGUAGE);
  const [isPlaceholderDialogOpen, setIsPlaceholderDialogOpen] = useState(false);
  const [imageCropperState, setImageCropperState] =
    useState<ImageCropperState | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const handleSaveRef = useRef<() => void>(() => {});
  const isMini = variant === "mini";

  useLayoutEffect(() => {
    imageUploadSessionRef.current += 1;
    imageUploadOwnerRef.current = open ? item?.id ?? null : null;
    imageUploadRequestsRef.current.clear();
    setProcessingImageFields([]);
    setImageErrors({});
    return () => {
      imageUploadSessionRef.current += 1;
      imageUploadOwnerRef.current = null;
      imageUploadRequestsRef.current.clear();
    };
  }, [open, item?.id]);

  const cancelImageRequest = useCallback((fieldId: string) => {
    imageUploadRequestsRef.current.delete(fieldId);
    setProcessingImageFields([...imageUploadRequestsRef.current.keys()]);
    setImageErrors((prev) => {
      if (!(fieldId in prev)) return prev;
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
    setErrors((prev) => {
      if (!(fieldId in prev)) return prev;
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  }, []);

  const beginImageRequest = useCallback(
    (fieldId: string, ownerId: string) => {
      if (imageUploadOwnerRef.current !== ownerId) return null;
      const session = imageUploadSessionRef.current;
      const token = Symbol(fieldId);
      cancelImageRequest(fieldId);
      imageUploadRequestsRef.current.set(fieldId, token);
      setProcessingImageFields([...imageUploadRequestsRef.current.keys()]);
      const isCurrent = () =>
        session === imageUploadSessionRef.current &&
        imageUploadRequestsRef.current.get(fieldId) === token;
      return {
        isCurrent,
        finish: () => {
          if (!isCurrent()) return;
          imageUploadRequestsRef.current.delete(fieldId);
          setProcessingImageFields([...imageUploadRequestsRef.current.keys()]);
        },
      };
    },
    [cancelImageRequest],
  );

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
      setImageCropperState(null);
      return;
    }

    setFormData(null);
    setImageCropperState(null);
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

  const handleChange = useCallback(
    (path: string, value: any) => {
      const fieldConfig = fieldConfigById.get(path);
      if (fieldConfig?.type === "image") cancelImageRequest(path);
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
          const currentNameWithoutCopySuffix = currentName
            .replace(/\s*\(copy\)\s*$/i, "")
            .trim();
          const expectedCopiedKey = `${sanitizeKeyLikeValue(currentNameWithoutCopySuffix)}_copy`;
          const isAutoGeneratedCopyKey =
            currentKey.endsWith("_copy") &&
            currentKey === expectedCopiedKey;

          if (
            !currentKey ||
            currentKey === oldSlug ||
            isAutoGeneratedCopyKey ||
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
        formDataRef.current = newData;
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
    [cancelImageRequest, defaultLocalizationLanguage, fieldConfigById],
  );

  const handleOpenImageCropper = useCallback(
    (fieldId: string, imageSrc: string, animation?: DecodedGif, initialFullSprite?: boolean) => {
      cancelImageRequest(fieldId);
      const current = formDataRef.current;
      const allowFullSprite = Boolean(fieldConfigById.get(fieldId)?.allowFullSprite
        && (fieldId === "image" || current?.fullSprite));
      setImageCropperState({ fieldId, imageSrc, animation, allowFullSprite,
        initialFullSprite: allowFullSprite && (initialFullSprite ?? Boolean(current?.fullSprite)) });
    },
    [cancelImageRequest, fieldConfigById],
  );

  const commitImage = useCallback(async (
    fieldId: string, source: string, isCurrent: () => boolean, options?: SpriteApplyOptions,
  ) => {
    let snapshot: any;
    let fullSprite: { width: number; height: number } | undefined;
    for (;;) {
      snapshot = formDataRef.current;
      if (!snapshot || !isCurrent()) return;
      const canKeepFull = fieldConfigById.get(fieldId)?.allowFullSprite;
      const keepFull = canKeepFull && (fieldId === "image"
        ? Boolean(source) && (options?.fullSprite ?? Boolean(snapshot.fullSprite))
        : Boolean(snapshot.fullSprite));
      fullSprite = keepFull ? await getFullSpriteSize(
        fieldId === "image" ? source : snapshot.image,
        fieldId === "overlayImage" ? source : snapshot.overlayImage,
        fieldId === "image" && options?.fullSprite ? { width: options.width, height: options.height } : undefined,
      ) : undefined;
      if (!isCurrent()) return;
      const latest = formDataRef.current;
      if (latest?.id !== snapshot.id) return;
      const otherField = fieldId === "image" ? "overlayImage" : "image";
      if (latest[otherField] === snapshot[otherField] && latest.fullSprite === snapshot.fullSprite) break;
    }
    if (!isCurrent()) return;
    cancelImageRequest(fieldId);
    const apply = (current: any) => {
      if (!current || current.id !== snapshot.id) return current;
      const next = { ...current, [fieldId]: source,
        placeholderCreditIndex: undefined, placeholderCategory: undefined,
        ...(fieldId === "image" ? { imageLayers: undefined } : {}),
        ...(fieldConfigById.get(fieldId)?.allowFullSprite ? { fullSprite } : {}),
        ...(fieldId === "image" && (options?.fullSprite || (current.fullSprite && !fullSprite)) ? { scale_w: 100, scale_h: 100 } : {}),
      };
      formDataRef.current = next;
      return next;
    };
    formDataRef.current = apply(formDataRef.current);
    setFormData(apply);
  }, [cancelImageRequest, fieldConfigById]);

  const handleClearImage = useCallback(async (fieldId: string) => {
    if (!item) return;
    const request = beginImageRequest(fieldId, item.id);
    if (!request) return;
    try { await commitImage(fieldId, "", request.isCurrent); }
    catch (error) {
      if (request.isCurrent()) setImageErrors((previous) => ({ ...previous, [fieldId]: error instanceof Error ? error.message : "This image could not be cleared." }));
    } finally { request.finish(); }
  }, [beginImageRequest, commitImage, item]);

  const handleUploadImage = useCallback(
    async (field: DialogField<T>, input: HTMLInputElement) => {
      const file = input.files?.[0];
      input.value = "";
      if (!file || !open || !item) return;
      const request = beginImageRequest(field.id, item.id);
      if (!request) return;
      try {
        const src = await readFileAsDataUrl(file);
        const animation = isGifDataUrl(src) ? decodeGifDataUrl(src) : undefined;
        const dimensions = animation ?? await getImageDimensions(src);
        if (!request.isCurrent()) return;
        if (!isBalatroCardImageSize(dimensions)) {
          handleOpenImageCropper(field.id, src, animation, true);
          return;
        }
        const result = animation ? src : field.processFile
          ? await field.processFile(file)
          : await normalizeBalatroCardImageSource(src);
        if (!request.isCurrent()) return;
        await commitImage(field.id, result, request.isCurrent);
      } catch (error) {
        if (!request.isCurrent()) return;
        console.error("Image processing failed", error);
        setImageErrors((prev) => ({
          ...prev,
          [field.id]: error instanceof Error
            ? error.message
            : "This image could not be opened. Try another PNG, JPEG, WebP, or GIF image.",
        }));
      } finally {
        request.finish();
      }
    },
    [
      beginImageRequest,
      commitImage,
      handleOpenImageCropper,
      item,
      open,
    ],
  );

  const handleSelectPlaceholder = useCallback(
    async (entry: PlaceholderEntry) => {
      if (!open || !item) return;
      const request = beginImageRequest("image", item.id);
      if (!request) return;
      try {
        let image = entry.src;
        try {
          image = await normalizeBalatroCardImageSource(entry.src);
        } catch (error) {
          console.error("Placeholder image normalization failed", error);
        }
        if (!request.isCurrent()) return;
        await commitImage("image", image, request.isCurrent, { fullSprite: false, width: 71, height: 95 });
        handleChange("placeholderCreditIndex", entry.index);
        handleChange("placeholderCategory", entry.category);
      } finally {
        request.finish();
      }
    },
    [beginImageRequest, commitImage, handleChange, item, open],
  );

  const handleApplyImageCrop = useCallback(
    async (dataUrl: string, options?: SpriteApplyOptions) => {
      if (!imageCropperState || !item) return;
      const request = beginImageRequest(imageCropperState.fieldId, item.id);
      if (!request) return;
      try {
        await commitImage(imageCropperState.fieldId, dataUrl, request.isCurrent, options);
        if (imageUploadOwnerRef.current === item.id) setImageCropperState(null);
      } finally { request.finish(); }
    },
    [beginImageRequest, commitImage, imageCropperState, item],
  );

  const handleSave = useCallback(() => {
    if (!formData || !formData.id) return;
    if (imageUploadRequestsRef.current.size > 0 || imageCropperState) return;

    let nextFormData = formData;
    const newErrors: Record<string, string> = { ...imageErrors };
    let hasError = Object.keys(imageErrors).length > 0;

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
  }, [
    formData,
    onSave,
    onOpenChange,
    hasTabs,
    resolvedTabs,
    resolvedGroups,
    imageErrors,
    imageCropperState,
  ]);

  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: PointerEvent) => {
      if (isPlaceholderDialogOpen) return;
      if (imageCropperState) return;
      // The showcase is a nested, portalled dialog. Ignore all outside clicks
      // while it is open so closing it does not also save and close the editor.
      if (
        document.querySelector(
          "[data-item-showcase-dialog='true'][data-state='open']",
        )
      ) {
        return;
      }
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
  }, [open, isPlaceholderDialogOpen, imageCropperState]);

  if (!open || !item || !formData) return null;

  const contentContainerClass = cn(
    "px-6 py-8 max-w-4xl mx-auto w-full",
    isMini && "max-w-3xl",
  );
  const visibleErrors = { ...errors, ...imageErrors };
  const errorEntries = Object.entries(visibleErrors);
  const firstError = errorEntries[0];
  const firstErrorTab = firstError && resolvedTabs.find((tab) =>
    tab.groups.some((group) =>
      group.fields.some((field) => field.id === firstError[0]),
    ),
  );
  const firstErrorLabel = firstError &&
    (fieldConfigById.get(firstError[0])?.label || firstError[0]);

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
                  error={visibleErrors[field.id]}
                  showPlaceholderPicker={showPlaceholderPicker}
                  onOpenPlaceholderPicker={() =>
                    setIsPlaceholderDialogOpen(true)
                  }
                  onOpenImageCropper={handleOpenImageCropper}
                  onUploadImage={handleUploadImage}
                  onClearImage={handleClearImage}
                  isProcessingImage={processingImageFields.includes(field.id)}
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
                disabled={processingImageFields.length > 0 || !!imageCropperState}
                size="lg"
                className="cursor-pointer px-8"
              >
                {processingImageFields.length > 0 ? "Preparing Image…" : "Save Changes"}
              </Button>
            </div>
          </div>
          {firstError && (
            <p role="alert" className="mt-3 text-sm text-destructive dark:text-red-400">
              Changes haven’t been saved. {firstErrorLabel}
              {firstErrorTab ? ` (${firstErrorTab.label})` : ""}: {firstError[1]}
              {errorEntries.length > 1 &&
                ` (${errorEntries.length - 1} more ${errorEntries.length === 2 ? "field needs" : "fields need"} attention.)`}
            </p>
          )}
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
                        {resolvedTabs.map((tab) => {
                          const errorCount = tab.groups.reduce(
                            (count, group) => count + group.fields.filter(
                              (field) => visibleErrors[field.id],
                            ).length,
                            0,
                          );
                          return (
                            <TabsTrigger
                              key={tab.id}
                              value={tab.id}
                              className="w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium border-transparent border-l-4 transition-all cursor-pointer rounded-r-md rounded-l-none data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary hover:bg-primary/5 hover:text-primary"
                            >
                              {tab.icon && (
                                <tab.icon className="h-4 w-4 opacity-70" />
                              )}
                              {tab.label}
                              {errorCount > 0 && (
                                <span
                                  className="ml-auto text-xs text-destructive dark:text-red-400"
                                  aria-label={`${errorCount} ${errorCount === 1 ? "error" : "errors"}`}
                                >
                                  {errorCount}
                                </span>
                              )}
                            </TabsTrigger>
                          );
                        })}
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
          onSelect={handleSelectPlaceholder}
        />
      )}

      <ImageCropperDialog
        open={Boolean(imageCropperState)}
        imageSrc={imageCropperState?.imageSrc ?? null}
        decodedGif={imageCropperState?.animation}
        allowFullSprite={imageCropperState?.allowFullSprite}
        initialFullSprite={imageCropperState?.initialFullSprite}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setImageCropperState(null);
          }
        }}
        onApply={handleApplyImageCrop}
      />
    </Dialog>
  );
}

export const GenericItemDialog = memo(
  GenericItemDialogInternal,
) as typeof GenericItemDialogInternal;
