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
  Sparkle,
  Trash,
  Image as ImageIcon,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
} from "@phosphor-icons/react";
import { applyAutoFormatting } from "@/lib/balatro-text-formatter";
import { slugify } from "@/lib/balatro-utils";
import { RaritySelect } from "@/components/balatro/rarity-select";

export type FieldType =
  | "text"
  | "number"
  | "textarea"
  | "rich-textarea"
  | "select"
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
  render?: (value: any, onChange: (val: any) => void, item: T) => ReactNode;
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

interface GenericItemDialogProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: T | null;
  title: string;
  description?: string;
  tabs: DialogTab<T>[];
  onSave: (id: string, updates: Partial<T>) => void;
  renderPreview?: (item: T) => ReactNode;
}

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

const COLOR_BUTTONS = [
  { tag: "{C:red}", color: "bg-balatro-red", name: "Red" },
  { tag: "{C:blue}", color: "bg-balatro-blue", name: "Blue" },
  { tag: "{C:green}", color: "bg-balatro-green", name: "Green" },
  { tag: "{C:purple}", color: "bg-balatro-purple", name: "Purple" },
  { tag: "{C:attention}", color: "bg-balatro-attention", name: "Orange" },
  { tag: "{C:money}", color: "bg-balatro-money", name: "Money" },
  { tag: "{C:gold}", color: "bg-balatro-gold", name: "Gold" },
  { tag: "{C:white}", color: "bg-white", name: "White" },
  { tag: "{C:inactive}", color: "bg-balatro-secondary", name: "Inactive" },
  { tag: "{C:hearts}", color: "bg-balatro-hearts", name: "Hearts" },
  { tag: "{C:clubs}", color: "bg-balatro-clubs", name: "Clubs" },
  { tag: "{C:diamonds}", color: "bg-balatro-diamonds", name: "Diamonds" },
  { tag: "{C:spades}", color: "bg-balatro-spades", name: "Spades" },
  { tag: "{C:tarot}", color: "bg-balatro-tarot", name: "Tarot" },
  { tag: "{C:planet}", color: "bg-balatro-planet", name: "Planet" },
  { tag: "{C:spectral}", color: "bg-balatro-spectral", name: "Spectral" },
  { tag: "{C:enhanced}", color: "bg-balatro-enhanced", name: "Enhanced" },
  { tag: "{C:legendary}", color: "bg-balatro-purple", name: "Legendary" },
  { tag: "{C:edition}", color: "bg-balatro-edition", name: "Edition" },
];

const BG_BUTTONS = [
  { tag: "{X:red,C:white}", color: "bg-balatro-red", name: "Red BG" },
  { tag: "{X:blue,C:white}", color: "bg-balatro-blue", name: "Blue BG" },
  { tag: "{X:mult,C:white}", color: "bg-balatro-mult", name: "Mult BG" },
  { tag: "{X:chips,C:white}", color: "bg-balatro-chips", name: "Chips BG" },
  { tag: "{X:money,C:white}", color: "bg-balatro-money", name: "Money BG" },
  {
    tag: "{X:attention,C:white}",
    color: "bg-balatro-attention",
    name: "Attention BG",
  },
  { tag: "{X:tarot,C:white}", color: "bg-balatro-tarot", name: "Tarot BG" },
  { tag: "{X:planet,C:white}", color: "bg-balatro-planet", name: "Planet BG" },
  {
    tag: "{X:spectral,C:white}",
    color: "bg-balatro-spectral",
    name: "Spectral BG",
  },
  {
    tag: "{X:enhanced,C:white}",
    color: "bg-balatro-enhanced",
    name: "Enhanced BG",
  },
];

const RichTextarea = memo(
  ({
    value,
    onChange,
    placeholder,
    error,
  }: {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    error?: string;
  }) => {
    const [autoFormat, setAutoFormat] = useState(true);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const insertTag = useCallback(
      (tag: string, autoClose = true) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentVal = textarea.value;
        const selected = currentVal.substring(start, end);

        let newVal = "";
        let newCursor = 0;

        if (selected) {
          newVal =
            currentVal.substring(0, start) +
            tag +
            selected +
            (autoClose ? "{}" : "") +
            currentVal.substring(end);
          newCursor =
            start + tag.length + selected.length + (autoClose ? 2 : 0);
        } else {
          newVal =
            currentVal.substring(0, start) +
            tag +
            (autoClose ? "{}" : "") +
            currentVal.substring(end);
          newCursor = start + tag.length;
        }

        const formattedVal = autoFormat
          ? applyAutoFormatting(newVal, value).formatted
          : newVal;
        onChange(formattedVal);

        requestAnimationFrame(() => {
          if (textarea) {
            textarea.focus();
            textarea.setSelectionRange(newCursor, newCursor);
          }
        });
      },
      [autoFormat, onChange, value],
    );

    const handleTextChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        if (autoFormat) {
          const { formatted } = applyAutoFormatting(val, value);
          onChange(formatted);
        } else {
          onChange(val);
        }
      },
      [autoFormat, onChange, value],
    );

    return (
      <div className="space-y-2">
        <div className="bg-muted/40 border border-border rounded-md p-2 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant={autoFormat ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setAutoFormat(!autoFormat)}
                className="h-6 text-[10px] px-2 cursor-pointer"
              >
                <Sparkle
                  className={cn("h-3 w-3 mr-1", autoFormat && "text-primary")}
                  weight={autoFormat ? "fill" : "regular"}
                />
                Auto Format: {autoFormat ? "ON" : "OFF"}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {COLOR_BUTTONS.map((btn) => (
              <button
                key={btn.name}
                type="button"
                onClick={() => insertTag(btn.tag)}
                className={cn(
                  "w-4 h-4 rounded border border-border/50 hover:scale-110 transition-transform cursor-pointer",
                  btn.color,
                )}
                title={btn.name}
              />
            ))}
            <div className="w-px h-4 bg-border mx-1" />
            {BG_BUTTONS.map((btn) => (
              <button
                key={btn.name}
                type="button"
                onClick={() => insertTag(btn.tag)}
                className={cn(
                  "w-4 h-4 rounded border-2 border-background/80 hover:scale-110 transition-transform cursor-pointer",
                  btn.color,
                )}
                title={btn.name}
              />
            ))}
          </div>
        </div>
        <Textarea
          ref={textareaRef}
          value={value || ""}
          onChange={handleTextChange}
          placeholder={placeholder}
          className={cn(
            "font-mono text-sm min-h-30 resize-y bg-background border-muted-foreground/20 cursor-text",
            error && "border-destructive focus-visible:ring-destructive",
          )}
        />
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </div>
    );
  },
);

const MemoizedField = memo(
  ({
    field,
    value,
    onChange,
    fullItem,
    inGrid,
    error,
  }: {
    field: DialogField<any>;
    value: any;
    onChange: (id: string, val: any) => void;
    fullItem: any;
    inGrid?: boolean;
    error?: string;
  }) => {
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
            <RichTextarea
              value={String(safeValue || "")}
              onChange={(val) => onChange(field.id, val)}
              placeholder={field.placeholder}
              error={error}
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
              <RaritySelect
                value={String(safeValue || "")}
                onChange={(val) =>
                  onChange(field.id, isNaN(Number(val)) ? val : Number(val))
                }
              />
            );
          }
          return (
            <div>
              <Select
                value={String(safeValue || "")}
                onValueChange={(val) =>
                  onChange(field.id, isNaN(Number(val)) ? val : Number(val))
                }
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
                  {field.options?.map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={String(opt.value)}
                      className="cursor-pointer"
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {error && (
                <p className="text-xs text-destructive mt-1">{error}</p>
              )}
            </div>
          );
        case "image":
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
                        } catch (err) {
                          console.error("Image processing failed", err);
                        }
                      } else {
                        const reader = new FileReader();
                        reader.onload = (event) =>
                          onChange(field.id, event.target?.result);
                        reader.readAsDataURL(file);
                      }
                    }
                  }}
                />

                {safeValue && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                    onClick={() => onChange(field.id, "")}
                  >
                    <Trash className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
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
    const previewContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const container = previewContainerRef.current;
      if (!container) return;

      const handleWheel = (e: WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const delta = -e.deltaY * 0.001;
          setScale((prev) => {
            const newScale = Math.max(0.5, Math.min(1.5, prev[0] + delta));
            return [newScale];
          });
        }
      };

      container.addEventListener("wheel", handleWheel, { passive: false });
      return () => container.removeEventListener("wheel", handleWheel);
    }, []);

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
            </div>
          )}

          <div
            ref={previewContainerRef}
            className={cn(
              "flex-1 flex items-center justify-center p-8 overflow-auto bg-size-[16px_16px] bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#1f2937_1px,transparent_1px)] transition-opacity duration-200",
              isCollapsed && "opacity-0",
            )}
          >
            <div
              className="transform transition-transform duration-200 ease-out"
              style={{ transform: `scale(${scale[0]})` }}
            >
              {renderPreview(item)}
            </div>
          </div>
          {!isCollapsed && (
            <div className="p-3 border-t border-border/40 bg-background/50 text-center text-xs text-muted-foreground font-mono">
              Live Preview (Ctrl/Cmd + Scroll to zoom)
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
  onSave,
  renderPreview,
}: GenericItemDialogProps<T>) {
  const [formData, setFormData] = useState<T | null>(null);
  const [activeTab, setActiveTab] = useState<string>("");
  const [panelSize, setPanelSize] = useState<number>(70);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const modalRef = useRef<HTMLDivElement>(null);
  const handleSaveRef = useRef<() => void>(() => {});

  const isPreviewCollapsed = panelSize > 95;
  const resolvedActiveTab = activeTab || tabs[0]?.id || "";
  const activeTabConfig = useMemo(
    () => tabs.find((tab) => tab.id === resolvedActiveTab),
    [tabs, resolvedActiveTab],
  );

  useEffect(() => {
    if (open && item) {
      if (tabs.length > 0) setActiveTab(tabs[0].id);

      setFormData({ ...item });
      setErrors({});
    } else {
      setFormData(null);
    }
  }, [open, item, tabs]);

  const handleChange = useCallback((path: string, value: any) => {
    setFormData((prev: any) => {
      if (!prev) return null;
      let newData = setNestedValue(prev, path, value);

      if (path === "name" && typeof value === "string") {
        const currentName = prev.name || "";
        const currentKey = prev.objectKey || "";
        const oldSlug = slugify(currentName);

        if (
          !currentKey ||
          currentKey === oldSlug ||
          currentKey.startsWith("new_") ||
          currentKey === "unnamed_item"
        ) {
          newData = setNestedValue(newData, "objectKey", slugify(value));
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
  }, []);

  const handleSave = useCallback(() => {
    if (!formData || !formData.id) return;

    const newErrors: Record<string, string> = {};
    let hasError = false;

    tabs.forEach((tab) => {
      tab.groups.forEach((group) => {
        group.fields.forEach((field) => {
          if (field.validate) {
            const error = field.validate(
              getNestedValue(formData, field.id),
              formData,
            );
            if (error) {
              newErrors[field.id] = error;
              hasError = true;
            }
          }
        });
      });
    });

    setErrors(newErrors);

    if (!hasError) {
      onSave(formData.id, formData);
      onOpenChange(false);
    } else {
      const firstErrorField = Object.keys(newErrors)[0];
      for (const tab of tabs) {
        for (const group of tab.groups) {
          if (group.fields.some((f) => f.id === firstErrorField)) {
            setActiveTab(tab.id);
            return;
          }
        }
      }
    }
  }, [formData, onSave, onOpenChange, tabs]);

  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        handleSaveRef.current();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  if (!open || !item || !formData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={modalRef}
        className="max-w-[95vw]! w-[95vw]! h-[90vh]! max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden shadow-2xl bg-background border-border/50"
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
                <div className="w-56 border-r border-border/40 bg-muted/5 flex flex-col shrink-0">
                  <ScrollArea className="flex-1">
                    <TabsList className="flex flex-col w-full bg-transparent p-2 gap-1 h-auto">
                      {tabs.map((tab) => (
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

                <div className="flex-1 bg-background flex flex-col min-w-0">
                  <ScrollArea className="flex-1">
                    <div className="px-6 py-8 max-w-4xl mx-auto w-full">
                      {activeTabConfig && (
                        <TabsContent
                          value={activeTabConfig.id}
                          className="mt-0 space-y-10 outline-none"
                        >
                          {activeTabConfig.groups.map((group) => (
                            <div key={group.id} className="space-y-4">
                              {group.label && (
                                <div className="space-y-2 pb-2">
                                  <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                    {group.label}
                                  </h4>
                                  <UiSeparator className="bg-primary/20 h-0.5" />
                                </div>
                              )}
                              <div
                                className={cn(group.className || "space-y-0")}
                              >
                                {group.fields.map((field) => {
                                  if (field.hidden && field.hidden(formData!))
                                    return null;
                                  return (
                                    <MemoizedField
                                      key={field.id}
                                      field={field}
                                      value={getNestedValue(formData, field.id)}
                                      onChange={handleChange}
                                      fullItem={formData}
                                      inGrid={
                                        !!group.className?.includes("grid")
                                      }
                                      error={errors[field.id]}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </TabsContent>
                      )}
                    </div>
                  </ScrollArea>
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
                item={formData}
                renderPreview={renderPreview}
                isCollapsed={isPreviewCollapsed}
              />
            )}
          </Group>
        </Tabs>

        <DialogFooter className="hidden" />
      </DialogContent>
    </Dialog>
  );
}

export const GenericItemDialog = memo(
  GenericItemDialogInternal,
) as typeof GenericItemDialogInternal;
