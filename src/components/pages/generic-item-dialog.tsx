import { useState, useEffect, ReactNode, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import {
  Upload,
  TextT,
  ArrowsClockwise,
  Sparkle,
  Lightning,
  ArrowUUpLeft,
  Trash,
} from "@phosphor-icons/react";
import { applyAutoFormatting } from "@/lib/balatro-text-formatter";

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

const RichTextarea = ({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}) => {
  const [autoFormat, setAutoFormat] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertTag = (tag: string, autoClose = true) => {
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
      newCursor = start + tag.length + selected.length + (autoClose ? 2 : 0);
    } else {
      newVal =
        currentVal.substring(0, start) +
        tag +
        (autoClose ? "{}" : "") +
        currentVal.substring(end);
      newCursor = start + tag.length;
    }

    handleTextChange(newVal, false);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursor, newCursor);
    }, 0);
  };

  const handleTextChange = (val: string, allowAutoFormat = true) => {
    if (autoFormat && allowAutoFormat) {
      const { formatted } = applyAutoFormatting(val, value);
      onChange(formatted);
    } else {
      onChange(val);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newVal = value.substring(0, start) + "[s]" + value.substring(end);

      handleTextChange(newVal, false);

      setTimeout(() => {
        textarea.setSelectionRange(start + 3, start + 3);
      }, 0);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
            <TextT className="h-4 w-4 text-primary" />
            Formatting Tools
          </h4>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline-block">
              Ctrl+Z to undo
            </span>
            <div className="h-4 w-px bg-border mx-2" />
            <Button
              variant={autoFormat ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoFormat(!autoFormat)}
              className={cn(
                "h-7 text-xs gap-1.5",
                autoFormat &&
                  "bg-primary/20 text-primary hover:bg-primary/30 border-primary/20",
              )}
            >
              <Sparkle
                className="h-3 w-3"
                weight={autoFormat ? "fill" : "regular"}
              />
              Auto Format {autoFormat ? "On" : "Off"}
            </Button>
          </div>
        </div>

        <Separator className="bg-border/50" />

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Text Colors
          </p>
          <div className="flex flex-wrap gap-2">
            {COLOR_BUTTONS.map((btn) => (
              <Tooltip key={btn.name}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => insertTag(btn.tag)}
                    className={cn(
                      "w-6 h-6 rounded shadow-sm border border-border/50 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                      btn.color,
                    )}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{btn.name}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Backgrounds
          </p>
          <div className="flex flex-wrap gap-2">
            {BG_BUTTONS.map((btn) => (
              <Tooltip key={btn.name}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => insertTag(btn.tag)}
                    className={cn(
                      "w-6 h-6 rounded shadow-sm border-2 border-background/80 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                      btn.color,
                    )}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{btn.name}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Effects</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => insertTag("[s]", false)}
              className="h-7 text-xs"
            >
              <ArrowUUpLeft className="mr-1.5 h-3 w-3" /> New Line
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => insertTag("{s:1.1}")}
              className="h-7 text-xs"
            >
              <ArrowsClockwise className="mr-1.5 h-3 w-3" /> Scale
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => insertTag("{E:1}")}
              className="h-7 text-xs"
            >
              <Lightning className="mr-1.5 h-3 w-3" /> Float
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => insertTag("{}")}
              className="h-7 text-xs"
            >
              Reset
            </Button>
          </div>
        </div>
      </div>

      <Textarea
        ref={textareaRef}
        value={value || ""}
        onChange={(e) => handleTextChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="font-mono text-sm min-h-40 resize-y bg-background"
      />
    </div>
  );
};

export function GenericItemDialog<T extends { id: string }>({
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
  const [activeTab, setActiveTab] = useState<string>(tabs[0]?.id || "");

  useEffect(() => {
    if (item) {
      setFormData(JSON.parse(JSON.stringify(item)));
      if (tabs.length > 0) {
        setActiveTab(tabs[0].id);
      }
    }
  }, [item, open]);

  const handleChange = (path: string, value: any) => {
    if (!formData) return;
    setFormData((prev) => (prev ? setNestedValue(prev, path, value) : null));
  };

  const handleSave = () => {
    if (formData && formData.id) {
      onSave(formData.id, formData);
      onOpenChange(false);
    }
  };

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    fieldId: string,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        handleChange(fieldId, event.target?.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const renderField = (field: DialogField<T>) => {
    if (!formData || (field.hidden && field.hidden(formData))) return null;

    const value = getNestedValue(formData, field.id);

    switch (field.type) {
      case "rich-textarea":
        return (
          <RichTextarea
            value={value || ""}
            onChange={(val) => handleChange(field.id, val)}
            placeholder={field.placeholder}
          />
        );
      case "textarea":
        return (
          <Textarea
            value={value || ""}
            onChange={(e) => handleChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className="min-h-25 resize-none"
          />
        );
      case "number":
        return (
          <Input
            type="number"
            value={value ?? ""}
            onChange={(e) => handleChange(field.id, parseFloat(e.target.value))}
            placeholder={field.placeholder}
            min={field.min}
            max={field.max}
            step={field.step}
          />
        );
      case "switch":
        return (
          <div className="flex items-center justify-between p-3 border border-border/50 rounded-lg bg-card hover:bg-accent/10 transition-colors">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">{field.label}</Label>
              {field.description && (
                <p className="text-xs text-muted-foreground">
                  {field.description}
                </p>
              )}
            </div>
            <Switch
              checked={!!value}
              onCheckedChange={(checked) => handleChange(field.id, checked)}
            />
          </div>
        );
      case "select":
        return (
          <Select
            value={String(value ?? "")}
            onValueChange={(val) => {
              const numVal = Number(val);
              handleChange(field.id, isNaN(numVal) ? val : numVal);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "image":
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="relative w-28 h-28 border-2 border-dashed border-border rounded-xl flex items-center justify-center bg-muted/10 overflow-hidden group hover:border-primary/50 transition-colors">
                {value ? (
                  <img
                    src={value}
                    alt="Preview"
                    className="w-full h-full object-contain [image-rendering:pixelated]"
                  />
                ) : (
                  <Upload className="h-8 w-8 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Label
                    htmlFor={`upload-${field.id}`}
                    className="cursor-pointer text-white text-xs font-bold px-3 py-1.5 bg-background/20 backdrop-blur-sm rounded-full border border-white/20 hover:bg-background/40 transition-colors"
                  >
                    Change
                  </Label>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <Input
                  id={`upload-${field.id}`}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageUpload(e, field.id)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() =>
                    document.getElementById(`upload-${field.id}`)?.click()
                  }
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {value ? "Change Image" : "Upload Image"}
                </Button>
                {value && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleChange(field.id, "")}
                  >
                    <Trash className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
            {field.description && (
              <p className="text-xs text-muted-foreground pl-1">
                {field.description}
              </p>
            )}
          </div>
        );
      case "custom":
        return field.render
          ? field.render(value, (val) => handleChange(field.id, val), formData)
          : null;
      case "text":
      default:
        return (
          <Input
            value={value || ""}
            onChange={(e) => handleChange(field.id, e.target.value)}
            placeholder={field.placeholder}
          />
        );
    }
  };

  if (!item || !formData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[92vh] flex flex-col p-0 bg-background/95 backdrop-blur-xl border-border/50 gap-0 overflow-hidden shadow-2xl">
        <DialogHeader className="px-8 py-5 border-b border-border/40 shrink-0 bg-muted/5">
          <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="text-base mt-1.5">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden min-h-0">
          <div className="flex-1 flex h-full">
            <div
              className={cn(
                "flex flex-col h-full border-r border-border/40 bg-background/50",
                renderPreview ? "w-[65%]" : "w-full",
              )}
            >
              <div className="flex flex-1 overflow-hidden">
                <div className="w-64 border-r border-border/40 bg-muted/10 flex flex-col shrink-0">
                  <ScrollArea className="flex-1">
                    <Tabs
                      value={activeTab}
                      onValueChange={setActiveTab}
                      orientation="vertical"
                      className="flex flex-col h-full"
                    >
                      <TabsList className="flex flex-col h-full w-full justify-start gap-1 p-3 bg-transparent">
                        {tabs.map((tab) => (
                          <TabsTrigger
                            key={tab.id}
                            value={tab.id}
                            className="w-full justify-start gap-3 px-4 py-3 text-sm font-medium data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:border-l-4 data-[state=active]:border-primary transition-all rounded-r-lg rounded-l-none"
                          >
                            {tab.icon && (
                              <tab.icon
                                className="h-5 w-5 opacity-70"
                                weight="duotone"
                              />
                            )}
                            {tab.label}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      {tabs.map((tab) => (
                        <TabsContent
                          key={tab.id}
                          value={tab.id}
                          className="hidden"
                        />
                      ))}
                    </Tabs>
                  </ScrollArea>
                </div>

                <ScrollArea className="flex-1 bg-background/30">
                  <div className="p-8 max-w-4xl mx-auto">
                    {tabs.map(
                      (tab) =>
                        activeTab === tab.id && (
                          <div
                            key={tab.id}
                            className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300"
                          >
                            {tab.groups.map((group) => (
                              <div
                                key={group.id}
                                className={cn("space-y-5", group.className)}
                              >
                                {group.label && (
                                  <div className="space-y-2 pb-2">
                                    <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                      {group.label}
                                    </h4>
                                    <Separator className="bg-border/60" />
                                  </div>
                                )}
                                <div className="grid grid-cols-1 gap-6">
                                  {group.fields.map((field) => (
                                    <div
                                      key={field.id}
                                      className={cn(
                                        "space-y-2.5",
                                        field.className,
                                      )}
                                    >
                                      {field.type !== "switch" &&
                                        field.label && (
                                          <Label className="text-sm font-semibold text-foreground/80 pl-0.5">
                                            {field.label}
                                          </Label>
                                        )}
                                      {renderField(field)}
                                      {field.type !== "switch" &&
                                        field.description && (
                                          <p className="text-[0.8rem] text-muted-foreground pl-1">
                                            {field.description}
                                          </p>
                                        )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ),
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>

            {renderPreview && (
              <div className="w-[35%] bg-muted/20 flex flex-col items-center justify-center p-8 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-muted/50 to-transparent pointer-events-none" />
                <div className="relative z-10 w-full flex items-center justify-center scale-110">
                  {renderPreview(formData)}
                </div>
                <div className="absolute bottom-6 text-xs text-muted-foreground font-mono opacity-50">
                  Live Preview
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-8 py-5 border-t border-border/40 bg-muted/10 shrink-0 gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={() => onOpenChange(false)}
            className="px-6"
          >
            Cancel
          </Button>
          <Button onClick={handleSave} size="lg" className="px-8 shadow-md">
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
