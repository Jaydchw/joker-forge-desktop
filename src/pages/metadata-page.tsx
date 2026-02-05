import { useState, useEffect, useRef } from "react";
import { useProjectData } from "@/lib/storage";
import { ModMetadata } from "@/lib/balatro-utils";
import {
  FileText,
  Tag,
  Hash,
  User,
  Code,
  Palette,
  ShieldCheck,
  Image as ImageIcon,
  Upload,
  Trash,
  Copy,
  Check,
  BracketsCurly,
  SquaresFour,
} from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const validateModMetadata = (metadata: ModMetadata) => {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};

  if (!metadata.id) {
    errors.id = "Mod ID is required";
  } else if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(metadata.id)) {
    errors.id = "Must start with letter, alphanumeric + underscore only";
  }

  if (!metadata.name?.trim()) errors.name = "Mod name is required";
  if (
    !metadata.author ||
    metadata.author.length === 0 ||
    !metadata.author[0]?.trim()
  ) {
    errors.author = "Author is required";
  }

  if (!metadata.description?.trim())
    errors.description = "Description is required";
  if (!metadata.prefix) errors.prefix = "Prefix is required";

  if (metadata.main_file && !metadata.main_file.endsWith(".lua")) {
    errors.main_file = "Must end with .lua";
  }

  if (metadata.version && !/^\d+\.\d+\.\d+.*$/.test(metadata.version)) {
    warnings.version = "Should follow format (major).(minor).(patch)";
  }

  const hexRegex = /^[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;
  if (metadata.badge_colour && !hexRegex.test(metadata.badge_colour)) {
    warnings.badge_colour = "Invalid Hex (6 or 8 digits)";
  }
  if (
    metadata.badge_text_colour &&
    !hexRegex.test(metadata.badge_text_colour)
  ) {
    warnings.badge_text_colour = "Invalid Hex (6 or 8 digits)";
  }

  return { isValid: Object.keys(errors).length === 0, errors, warnings };
};

const generateModIdFromName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, "")
    .replace(/^[0-9]+/, "") || "mycustommod";

const generatePrefixFromId = (id: string) => id.toLowerCase().substring(0, 8);

const processImage = (
  file: File,
  width: number,
  height: number,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/png"));
      } else {
        reject(new Error("Canvas context failed"));
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = reject;
    img.src = url;
  });
};

export default function MetadataPage() {
  const { data, updateMetadata } = useProjectData();
  const metadata = data.metadata as unknown as ModMetadata;
  const [isCopied, setIsCopied] = useState(false);

  const [authorsRaw, setAuthorsRaw] = useState(metadata.author.join(", "));
  const [depsRaw, setDepsRaw] = useState(metadata.dependencies.join("\n"));
  const [conflictsRaw, setConflictsRaw] = useState(
    metadata.conflicts.join("\n"),
  );
  const [providesRaw, setProvidesRaw] = useState(metadata.provides.join("\n"));

  const previousNameRef = useRef(metadata.name);

  const gameImageSrc = metadata.gameImage || "/images/balatro.png";
  const iconImageSrc = metadata.iconImage || "/images/modicon.png";

  useEffect(() => {
    if (metadata.name && metadata.name !== previousNameRef.current) {
      const oldId = generateModIdFromName(previousNameRef.current || "");
      const oldPrefix = generatePrefixFromId(oldId);

      if (metadata.id === oldId) {
        const newId = generateModIdFromName(metadata.name);
        updateMetadata({ id: newId });

        if (metadata.prefix === oldPrefix) {
          updateMetadata({ prefix: generatePrefixFromId(newId) });
        }
      }
      previousNameRef.current = metadata.name;
    }
  }, [metadata.name, metadata.id, metadata.prefix, updateMetadata]);

  const validation = validateModMetadata(metadata);

  const handleArrayChange = (
    raw: string,
    setRaw: (val: string) => void,
    field: keyof ModMetadata,
    separator: string | RegExp,
  ) => {
    setRaw(raw);
    const parsed = raw
      .split(separator)
      .map((s) => s.trim())
      .filter(Boolean);
    updateMetadata({ [field]: parsed });
  };

  const handleImageUpload = async (file: File, type: "icon" | "game") => {
    try {
      const result =
        type === "icon"
          ? await processImage(file, 34, 34)
          : await processImage(file, 333, 216);

      updateMetadata({
        [type === "icon" ? "iconImage" : "gameImage"]: result,
        [type === "icon" ? "hasUserUploadedIcon" : "hasUserUploadedGameIcon"]:
          true,
      });
    } catch (e) {
      console.error("Image processing failed", e);
    }
  };

  const copyJson = () => {
    const jsonString = JSON.stringify(
      metadata,
      (key, value) => {
        if (key === "gameImage" || key === "iconImage")
          return value ? "[Base64 Data]" : value;
        return value;
      },
      2,
    );

    navigator.clipboard.writeText(jsonString);
    setIsCopied(true);
    toast.success("JSON copied to clipboard");
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleColorChange = (
    value: string,
    field: "badge_colour" | "badge_text_colour",
  ) => {
    const cleanValue = value.replace("#", "").toUpperCase();
    updateMetadata({ [field]: cleanValue });
  };

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <SquaresFour weight="fill" className="h-4 w-4 text-primary" />
            Project Settings
          </h2>
          <div className="flex items-center gap-4">
            <h1 className="text-5xl font-bold tracking-tight text-foreground">
              Mod Metadata
            </h1>
          </div>
          <p className="text-muted-foreground font-medium pt-1">
            Configure the core properties of your mod manifest.
          </p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button
              size="lg"
              className="gap-2 font-bold shadow-md cursor-pointer"
            >
              <BracketsCurly className="w-5 h-5" weight="bold" />
              View JSON
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Metadata JSON</DialogTitle>
              <DialogDescription>
                Raw JSON output for your mod manifest. Image data is truncated
                for display.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-auto bg-muted/50 p-4 rounded-xl border border-border my-2 custom-scrollbar">
              <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap">
                {JSON.stringify(
                  metadata,
                  (key, value) => {
                    if (key === "gameImage" || key === "iconImage")
                      return value ? "[Base64 Data]" : value;
                    return value;
                  },
                  2,
                )}
              </pre>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                onClick={copyJson}
                className="gap-2 font-bold cursor-pointer"
              >
                {isCopied ? (
                  <Check className="w-4 h-4" weight="bold" />
                ) : (
                  <Copy className="w-4 h-4" weight="bold" />
                )}
                {isCopied ? "Copied" : "Copy to Clipboard"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border-b border-border w-full" />

      <section className="space-y-8">
        <div className="flex items-center gap-3 text-2xl font-bold text-foreground">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <FileText className="h-6 w-6" weight="duotone" />
          </div>
          <h3>Basic Information</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <Label className="text-base">Mod Name</Label>
            <div className="relative group">
              <Tag className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                value={metadata.name}
                onChange={(e) => updateMetadata({ name: e.target.value })}
                className={cn(
                  "pl-12 h-12 text-lg rounded-xl",
                  validation.errors.name && "border-destructive",
                )}
                placeholder="My Custom Mod"
              />
            </div>
            {validation.errors.name && (
              <p className="text-sm font-medium text-destructive">
                {validation.errors.name}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-base">Mod ID</Label>
            <div className="relative group">
              <Hash className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                value={metadata.id}
                onChange={(e) => updateMetadata({ id: e.target.value })}
                className={cn(
                  "pl-12 h-12 text-lg font-mono rounded-xl",
                  validation.errors.id && "border-destructive",
                )}
                placeholder="mycustommod"
              />
            </div>
            {validation.errors.id && (
              <p className="text-sm font-medium text-destructive">
                {validation.errors.id}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-base">Authors</Label>
            <div className="relative group">
              <User className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                value={authorsRaw}
                onChange={(e) =>
                  handleArrayChange(
                    e.target.value,
                    setAuthorsRaw,
                    "author",
                    ",",
                  )
                }
                className="pl-12 h-12 text-lg rounded-xl"
                placeholder="Separate with commas..."
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-base">Prefix</Label>
            <div className="relative group">
              <Code className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                value={metadata.prefix}
                onChange={(e) => updateMetadata({ prefix: e.target.value })}
                className="pl-12 h-12 text-lg font-mono rounded-xl"
                maxLength={10}
              />
            </div>
            {validation.errors.prefix && (
              <p className="text-sm font-medium text-destructive">
                {validation.errors.prefix}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-base">Description</Label>
          <Textarea
            value={metadata.description}
            onChange={(e) => updateMetadata({ description: e.target.value })}
            className="min-h-32 text-base resize-none rounded-xl p-4"
            placeholder="Describe what your mod does..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
          <div className="space-y-3">
            <Label className="text-base">Main File</Label>
            <Input
              value={metadata.main_file}
              onChange={(e) => updateMetadata({ main_file: e.target.value })}
              className="h-12 font-mono text-base rounded-xl"
            />
            {validation.errors.main_file && (
              <p className="text-sm font-medium text-destructive">
                {validation.errors.main_file}
              </p>
            )}
          </div>
          <div
            className="flex items-center justify-between border-2 border-border rounded-xl p-3 px-4 h-12 hover:border-primary/50 transition-colors bg-card cursor-pointer"
            onClick={() =>
              updateMetadata({ disable_vanilla: !metadata.disable_vanilla })
            }
          >
            <div className="space-y-0.5">
              <Label
                className="text-base cursor-pointer"
                htmlFor="vanilla-switch"
              >
                Disable Vanilla
              </Label>
            </div>
            <Switch
              id="vanilla-switch"
              checked={metadata.disable_vanilla}
              onCheckedChange={(c) => updateMetadata({ disable_vanilla: c })}
              className="cursor-pointer"
            />
          </div>
        </div>
      </section>

      <Separator className="my-8" />

      <section className="space-y-8">
        <div className="flex items-center gap-3 text-2xl font-bold text-foreground">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <ImageIcon className="h-6 w-6" weight="duotone" />
          </div>
          <h3>Assets</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-base font-bold">Game Logo</Label>
              <span className="text-xs bg-muted px-3 py-1.5 rounded-md text-muted-foreground font-mono font-bold">
                333x216px
              </span>
            </div>
            <div className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center gap-6 bg-muted/20 hover:bg-muted/40 transition-colors min-h-75 relative group">
              <img
                src={gameImageSrc}
                className="max-w-full max-h-45 object-contain shadow-xl rounded-lg [image-rendering:pixelated] transition-transform group-hover:scale-105 duration-300"
                alt="Game Logo"
              />

              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center gap-3 rounded-xl backdrop-blur-[2px]">
                <Button
                  variant="secondary"
                  className="relative cursor-pointer font-bold shadow-lg hover:scale-105 transition-transform"
                  size="default"
                >
                  <Upload className="mr-2 h-4 w-4" weight="bold" />
                  Upload New
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) =>
                      e.target.files?.[0] &&
                      handleImageUpload(e.target.files[0], "game")
                    }
                  />
                </Button>
                {metadata.gameImage && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="shadow-lg hover:scale-105 transition-transform cursor-pointer"
                    onClick={() =>
                      updateMetadata({
                        gameImage: "",
                        hasUserUploadedGameIcon: false,
                      })
                    }
                  >
                    <Trash className="h-4 w-4" weight="bold" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-base font-bold">Mod Icon</Label>
              <span className="text-xs bg-muted px-3 py-1.5 rounded-md text-muted-foreground font-mono font-bold">
                34x34px
              </span>
            </div>
            <div className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center gap-6 bg-muted/20 hover:bg-muted/40 transition-colors min-h-75 relative group">
              <img
                src={iconImageSrc}
                className="w-24 h-24 object-contain shadow-xl rounded-lg [image-rendering:pixelated] scale-150 transition-transform group-hover:scale-[1.6] duration-300"
                alt="Mod Icon"
              />

              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center gap-3 rounded-xl backdrop-blur-[2px]">
                <Button
                  variant="secondary"
                  className="relative cursor-pointer font-bold shadow-lg hover:scale-105 transition-transform"
                  size="default"
                >
                  <Upload className="mr-2 h-4 w-4" weight="bold" />
                  Upload New
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) =>
                      e.target.files?.[0] &&
                      handleImageUpload(e.target.files[0], "icon")
                    }
                  />
                </Button>
                {metadata.iconImage && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="shadow-lg hover:scale-105 transition-transform cursor-pointer"
                    onClick={() =>
                      updateMetadata({
                        iconImage: "",
                        hasUserUploadedIcon: false,
                      })
                    }
                  >
                    <Trash className="h-4 w-4" weight="bold" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Separator className="my-8" />

      <section className="space-y-8">
        <div className="flex items-center gap-3 text-2xl font-bold text-foreground">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Palette className="h-6 w-6" weight="duotone" />
          </div>
          <h3>Appearance</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="text-base">Display Name</Label>
              <Input
                value={metadata.display_name}
                onChange={(e) =>
                  updateMetadata({ display_name: e.target.value })
                }
                placeholder={metadata.name}
                className="h-12 text-lg rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="text-base">Badge Color</Label>
                <div className="flex gap-3">
                  <div className="relative h-12 w-16 shrink-0 rounded-xl overflow-hidden shadow-sm border-2 border-border hover:border-primary/50 transition-colors cursor-pointer">
                    <input
                      type="color"
                      value={`#${metadata.badge_colour}`}
                      onChange={(e) =>
                        handleColorChange(e.target.value, "badge_colour")
                      }
                      className="absolute -top-2 -left-2 w-[200%] h-[200%] cursor-pointer p-0 m-0 border-0"
                    />
                  </div>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-3 text-muted-foreground font-mono">
                      #
                    </span>
                    <Input
                      value={metadata.badge_colour}
                      onChange={(e) =>
                        updateMetadata({ badge_colour: e.target.value })
                      }
                      placeholder="666665"
                      className="pl-7 h-12 font-mono uppercase rounded-xl"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-base">Text Color</Label>
                <div className="flex gap-3">
                  <div className="relative h-12 w-16 shrink-0 rounded-xl overflow-hidden shadow-sm border-2 border-border hover:border-primary/50 transition-colors cursor-pointer">
                    <input
                      type="color"
                      value={`#${metadata.badge_text_colour}`}
                      onChange={(e) =>
                        handleColorChange(e.target.value, "badge_text_colour")
                      }
                      className="absolute -top-2 -left-2 w-[200%] h-[200%] cursor-pointer p-0 m-0 border-0"
                    />
                  </div>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-3 text-muted-foreground font-mono">
                      #
                    </span>
                    <Input
                      value={metadata.badge_text_colour}
                      onChange={(e) =>
                        updateMetadata({ badge_text_colour: e.target.value })
                      }
                      placeholder="FFFFFF"
                      className="pl-7 h-12 font-mono uppercase rounded-xl"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Label className="text-base">Badge Preview</Label>
            <div className="flex-1 flex items-center justify-center p-10 bg-muted/30 rounded-2xl border-2 border-dashed border-border min-h-50">
              <div
                className="px-6 py-2.5 rounded-lg text-4xl font-bold font-game tracking-wider border-[3px] shadow-2xl scale-125 transition-all duration-300"
                style={{
                  backgroundColor: `#${metadata.badge_colour}`,
                  color: `#${metadata.badge_text_colour}`,
                  borderColor: `#${metadata.badge_colour}`,
                }}
              >
                {metadata.display_name || "BADGE"}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Separator className="my-8" />

      <section className="space-y-8">
        <div className="flex items-center gap-3 text-2xl font-bold text-foreground">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" weight="duotone" />
          </div>
          <h3>Advanced & Dependencies</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <Label className="text-base">Version</Label>
            <Input
              value={metadata.version}
              onChange={(e) => updateMetadata({ version: e.target.value })}
              className="h-12 font-mono text-base rounded-xl"
            />
          </div>
          <div className="space-y-3">
            <Label className="text-base">Priority</Label>
            <Input
              type="number"
              value={metadata.priority}
              onChange={(e) =>
                updateMetadata({ priority: parseInt(e.target.value) || 0 })
              }
              className="h-12 text-base rounded-xl"
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <Label className="text-base">
              Dependencies{" "}
              <span className="text-muted-foreground font-normal text-sm ml-1">
                (one per line)
              </span>
            </Label>
            <Textarea
              value={depsRaw}
              onChange={(e) =>
                handleArrayChange(
                  e.target.value,
                  setDepsRaw,
                  "dependencies",
                  "\n",
                )
              }
              className="font-mono text-sm min-h-32 bg-muted/30 rounded-xl p-4"
              placeholder="Steamodded (>=1.0.0)"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <Label className="text-base">Conflicts</Label>
              <Textarea
                value={conflictsRaw}
                onChange={(e) =>
                  handleArrayChange(
                    e.target.value,
                    setConflictsRaw,
                    "conflicts",
                    "\n",
                  )
                }
                className="font-mono text-sm min-h-32 bg-muted/30 rounded-xl p-4"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-base">Provides</Label>
              <Textarea
                value={providesRaw}
                onChange={(e) =>
                  handleArrayChange(
                    e.target.value,
                    setProvidesRaw,
                    "provides",
                    "\n",
                  )
                }
                className="font-mono text-sm min-h-32 bg-muted/30 rounded-xl p-4"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
