import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowBendUpLeft,
  ArrowBendUpRight,
  Circle,
  DownloadSimple,
  Eraser,
  Eyedropper,
  FlipHorizontal,
  FlipVertical,
  FloppyDiskBack,
  GridFour,
  Image as ImageIcon,
  Minus,
  PaintBucket,
  PencilSimple,
  Plus,
  Rectangle,
  ArrowsOutCardinal,
  Trash,
  Question,
  Eye,
  EyeSlash,
  LockKey,
  LockKeyOpen,
  Copy,
  Scissors,
  ClipboardText,
  FilePlus,
  Selection as SelectionIcon,
  CaretUp,
  CaretDown,
  ArrowsMerge,
  Stack,
  Sparkle,
} from "@phosphor-icons/react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { downloadDir, join } from "@tauri-apps/api/path";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogPortal,
  DialogOverlay,
} from "@/components/ui/dialog";
import { GenericDialogColorPicker } from "@/components/ui/generic-dialog-color-picker";
import { PlaceholderPickerDialog } from "@/components/pages/placeholder-picker-dialog";
import {
  PlaceholderCategory,
  PlaceholderEntry,
} from "@/lib/placeholder-assets.ts";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { PixelLayerData } from "@/lib/types";
import { CustomContextMenu } from "@/components/ui/custom-context-menu";

type Tool = "pen" | "eraser" | "fill" | "picker" | "shape" | "select";
type ShapeType = "line" | "rect" | "ellipse";

type LayerState = {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  locked: boolean;
};

type SelectionRect = { x: number; y: number; w: number; h: number } | null;
type FloatingSelection = {
  imageData: ImageData;
  x: number;
  y: number;
} | null;

type PixelArtEditorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  sourceImage?: string;
  sourceLayers?: PixelLayerData[];
  onSaveToItem: (payload: {
    imageDataUrl: string;
    layers: PixelLayerData[];
  }) => void;
};

const CANVAS_WIDTH = 71;
const CANVAS_HEIGHT = 95;
const DISPLAY_SCALE = 6;
const MAX_HISTORY = 40;

const BALATRO_PALETTE = [
  "#000000",
  "#222222",
  "#666666",
  "#888888",
  "#d8d8d8",
  "#eeeeee",
  "#efefef",
  "#ffffff",
  "#fe5f55",
  "#f83b2f",
  "#f87d75",
  "#b44430",
  "#f06b3f",
  "#fd682b",
  "#cb724c",
  "#ff9a00",
  "#f3b958",
  "#fda200",
  "#e29000",
  "#ffc052",
  "#eac058",
  "#fae37e",
  "#ffff00",
  "#65efaf",
  "#50846e",
  "#4bc292",
  "#56a887",
  "#4ca893",
  "#235955",
  "#b8d8d8",
  "#00ffff",
  "#7a9e9f",
  "#374244",
  "#4f6367",
  "#5f7377",
  "#374649",
  "#13afce",
  "#708b91",
  "#cdd9dc",
  "#9bb6bd",
  "#424e54",
  "#009dff",
  "#008ee6",
  "#bfc7d5",
  "#4584fa",
  "#95acff",
  "#646eb7",
  "#8389dd",
  "#403995",
  "#4f31b9",
  "#a782d1",
  "#8867a5",
  "#caa0ef",
  "#b26cbb",
  "#c75985",
  "#f03464",
] as const;

const normalizeHex = (value: string) => {
  const trimmed = value.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(trimmed))
    return `#${trimmed
      .split("")
      .map((c) => `${c}${c}`)
      .join("")}`;
  if (/^[0-9a-f]{6}$/.test(trimmed)) return `#${trimmed}`;
  return "#000000";
};

const hexToRgba = (hex: string, alpha: number) => {
  const n = normalizeHex(hex);
  const r = parseInt(n.slice(1, 3), 16);
  const g = parseInt(n.slice(3, 5), 16);
  const b = parseInt(n.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

const getCtx = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D context unavailable");
  return ctx;
};

const generateId = () => Math.random().toString(36).substr(2, 9);

const toPixel = (
  clientX: number,
  clientY: number,
  stage: HTMLDivElement,
  zoom: number,
  pan: { x: number; y: number },
) => {
  const rect = stage.getBoundingClientRect();
  const worldX = (clientX - rect.left - pan.x) / zoom;
  const worldY = (clientY - rect.top - pan.y) / zoom;
  const rawX = Math.floor(worldX / DISPLAY_SCALE);
  const rawY = Math.floor(worldY / DISPLAY_SCALE);
  const inBounds =
    rawX >= 0 && rawX < CANVAS_WIDTH && rawY >= 0 && rawY < CANVAS_HEIGHT;
  return {
    x: clamp(rawX, 0, CANVAS_WIDTH - 1),
    y: clamp(rawY, 0, CANVAS_HEIGHT - 1),
    inBounds,
  };
};

function TipButton({
  tooltip,
  side = "bottom",
  children,
  ...props
}: React.ComponentProps<typeof Button> & {
  tooltip: string;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button {...props}>{children}</Button>
      </TooltipTrigger>
      <TooltipContent side={side}>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

// Keybinds definition
const KEYBINDS = [
  { key: "B / P", action: "Pen tool" },
  { key: "E", action: "Eraser tool" },
  { key: "F", action: "Fill tool" },
  { key: "I / K", action: "Eyedropper tool" },
  { key: "H", action: "Shape tool" },
  { key: "M", action: "Marquee Selection tool" },
  { key: "G", action: "Toggle grid" },
  { key: "Alt+Click", action: "Quick pick color" },
  { key: "Ctrl+Z", action: "Undo" },
  { key: "Ctrl+Y / Ctrl+Shift+Z", action: "Redo" },
  { key: "Ctrl+A", action: "Select all" },
  { key: "Ctrl+D", action: "Deselect" },
  { key: "Ctrl+C", action: "Copy selection" },
  { key: "Ctrl+X", action: "Cut selection" },
  { key: "Ctrl+V", action: "Paste selection" },
  { key: "Ctrl+S", action: "Save to item" },
  { key: "Ctrl+Shift+S", action: "Save to device" },
  { key: "Ctrl+Shift+N", action: "New layer" },
  { key: "Ctrl+Alt+P", action: "Toggle pixel-perfect" },
  { key: "Del / Backspace", action: "Clear layer or selection" },
  { key: "Esc", action: "Deselect / Commit selection" },
  { key: "[ / ]", action: "Decrease / increase brush size" },
  { key: "0 / R", action: "Reset view" },
  { key: "Space+Drag", action: "Pan" },
  { key: "MMB Drag", action: "Pan" },
  { key: "Scroll", action: "Zoom" },
  { key: "Ctrl+Scroll", action: "Brush size" },
];

export function PixelArtEditorDialog({
  open,
  onOpenChange,
  itemName,
  sourceImage,
  sourceLayers,
  onSaveToItem,
}: PixelArtEditorDialogProps) {
  // Canvases
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const flattenCanvasRef = useRef<HTMLCanvasElement | null>(null); // For exporting
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Layers
  const [layers, setLayers] = useState<LayerState[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [hasClipboard, setHasClipboard] = useState(false);

  // Clear error message after 3 seconds
  useEffect(() => {
    if (editorError) {
      const timer = setTimeout(() => setEditorError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [editorError]);
  const layerCanvasesRef = useRef<Record<string, HTMLCanvasElement>>({});

  // Selection
  const [selection, setSelection] = useState<SelectionRect>(null);
  const [floatingSelection, setFloatingSelection] =
    useState<FloatingSelection>(null);
  const clipboardRef = useRef<{
    imageData: ImageData;
    w: number;
    h: number;
  } | null>(null);

  // Tools
  const [tool, setTool] = useState<Tool>("pen");
  const [shapeType, setShapeType] = useState<ShapeType>("rect");
  const [shapeFilled, setShapeFilled] = useState(false);
  const [pixelPerfect, setPixelPerfect] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [gridOpacity, setGridOpacity] = useState(8);
  const [penSize, setPenSize] = useState(1);
  const [currentColor, setCurrentColor] = useState("#fe5f55");
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1.3);
  const [pan, setPan] = useState({ x: 20, y: 20 });
  const [isPlaceholderPickerOpen, setIsPlaceholderPickerOpen] = useState(false);
  const [placeholderCategory, setPlaceholderCategory] =
    useState<PlaceholderCategory>("joker");
  const [showHelpMenu, setShowHelpMenu] = useState(false);
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);

  // History - we snapshot all layer image data arrays
  type HistoryLayerSnapshot = { state: LayerState; data: ImageData };
  type HistorySnapshot = {
    layers: HistoryLayerSnapshot[];
    activeLayerId: string | null;
    selection: SelectionRect;
    floating: FloatingSelection;
  };
  const historyRef = useRef<HistorySnapshot[]>([]);
  const historyIndexRef = useRef(-1);
  const [historyIndexUi, setHistoryIndexUi] = useState(-1);
  const [historyLengthUi, setHistoryLengthUi] = useState(0);

  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const toolRef = useRef(tool);
  const penSizeRef = useRef(penSize);
  const currentColorRef = useRef(currentColor);
  const pixelPerfectRef = useRef(pixelPerfect);
  const showGridRef = useRef(showGrid);
  const gridOpacityRef = useRef(gridOpacity);
  const selectionRef = useRef(selection);
  const floatingSelectionRef = useRef(floatingSelection);
  const activeLayerIdRef = useRef(activeLayerId);
  const layersRef = useRef(layers);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);
  useEffect(() => {
    penSizeRef.current = penSize;
  }, [penSize]);
  useEffect(() => {
    currentColorRef.current = currentColor;
  }, [currentColor]);
  useEffect(() => {
    pixelPerfectRef.current = pixelPerfect;
  }, [pixelPerfect]);
  useEffect(() => {
    showGridRef.current = showGrid;
  }, [showGrid]);
  useEffect(() => {
    gridOpacityRef.current = gridOpacity;
  }, [gridOpacity]);
  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);
  useEffect(() => {
    floatingSelectionRef.current = floatingSelection;
  }, [floatingSelection]);
  useEffect(() => {
    activeLayerIdRef.current = activeLayerId;
  }, [activeLayerId]);
  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  const hasSelection = !!selection;
  const activeLayer = useMemo(
    () => layers.find((l) => l.id === activeLayerId),
    [layers, activeLayerId],
  );
  const canEditActiveLayer =
    activeLayer && !activeLayer.locked && activeLayer.visible;

  const lastHoverPixelRef = useRef<{ x: number; y: number } | null>(null);
  const lastHoverInBoundsRef = useRef(false);
  const keyStateRef = useRef({ spaceDown: false });
  const pixelPerfectStateRef = useRef<{
    last: { x: number; y: number } | null;
    lastDir: { x: number; y: number } | null;
  }>({ last: null, lastDir: null });
  const dragStateRef = useRef<{
    drawing: boolean;
    panning: boolean;
    selecting: boolean;
    movingSelection: boolean;
    pointerId: number | null;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    panOriginX: number;
    panOriginY: number;
    snapshot: Record<string, ImageData> | null;
    selStartX: number;
    selStartY: number;
  }>({
    drawing: false,
    panning: false,
    selecting: false,
    movingSelection: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    panOriginX: 0,
    panOriginY: 0,
    snapshot: null,
    selStartX: 0,
    selStartY: 0,
  });

  // Utils
  const commitColor = useCallback((color: string) => {
    const n = normalizeHex(color);
    if (BALATRO_PALETTE.includes(n as (typeof BALATRO_PALETTE)[number])) return;
    setRecentColors((prev) => [n, ...prev.filter((c) => c !== n)].slice(0, 24));
  }, []);

  const registerColor = useCallback(
    (color: string) => {
      const n = normalizeHex(color);
      setCurrentColor(n);
      commitColor(n);
    },
    [commitColor],
  );

  const getActiveCanvas = useCallback(() => {
    if (!activeLayerIdRef.current) return null;
    const layer = layersRef.current.find(
      (l) => l.id === activeLayerIdRef.current,
    );
    if (!layer) return null;
    if (layer.locked) {
      setEditorError(`Layer "${layer.name}" is locked`);
      return null;
    }
    if (!layer.visible) {
      setEditorError(`Layer "${layer.name}" is hidden`);
      return null;
    }
    return layerCanvasesRef.current[activeLayerIdRef.current];
  }, []);

  // History
  const refreshPreviewRef = useRef<() => void>(() => {});

  const pushHistory = useCallback(() => {
    const snapshot: HistorySnapshot = {
      layers: layersRef.current.map((l) => {
        const cvs = layerCanvasesRef.current[l.id];
        return {
          state: { ...l },
          data: getCtx(cvs).getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT),
        };
      }),
      activeLayerId: activeLayerIdRef.current,
      selection: selectionRef.current ? { ...selectionRef.current } : null,
      floating: floatingSelectionRef.current
        ? {
            x: floatingSelectionRef.current.x,
            y: floatingSelectionRef.current.y,
            // Duplicate ImageData to prevent mutation issues
            imageData: new ImageData(
              new Uint8ClampedArray(
                floatingSelectionRef.current.imageData.data,
              ),
              floatingSelectionRef.current.imageData.width,
              floatingSelectionRef.current.imageData.height,
            ),
          }
        : null,
    };

    const base = historyRef.current.slice(0, historyIndexRef.current + 1);
    base.push(snapshot);
    if (base.length > MAX_HISTORY) base.shift();
    historyRef.current = base;
    historyIndexRef.current = base.length - 1;
    setHistoryLengthUi(base.length);
    setHistoryIndexUi(historyIndexRef.current);
  }, []);

  const restoreHistory = useCallback((index: number) => {
    const snapshot = historyRef.current[index];
    if (!snapshot) return;

    // Restore layers. If layers changed, we must recreate the canvases
    // For simplicity, we assume layers don't get deleted/added much, but if they do:
    const newLayers = snapshot.layers.map((snap) => {
      const layerState = { ...snap.state };
      if (!layerCanvasesRef.current[layerState.id]) {
        const cvs = document.createElement("canvas");
        cvs.width = CANVAS_WIDTH;
        cvs.height = CANVAS_HEIGHT;
        layerCanvasesRef.current[layerState.id] = cvs;
      }
      getCtx(layerCanvasesRef.current[layerState.id]).putImageData(
        snap.data,
        0,
        0,
      );
      return layerState;
    });

    // Clean up orphaned canvases
    Object.keys(layerCanvasesRef.current).forEach((id) => {
      if (!snapshot.layers.find((l) => l.state.id === id)) {
        delete layerCanvasesRef.current[id];
      }
    });
    const nextActiveId =
      snapshot.activeLayerId &&
      newLayers.find((l) => l.id === snapshot.activeLayerId)
        ? snapshot.activeLayerId
        : newLayers[0]?.id || null;

    layersRef.current = newLayers;
    activeLayerIdRef.current = nextActiveId;
    setLayers(newLayers);
    setActiveLayerId(nextActiveId);

    setSelection(snapshot.selection);
    setFloatingSelection(snapshot.floating);

    historyIndexRef.current = index;
    setHistoryIndexUi(index);
    refreshPreviewRef.current();
  }, []);

  const renderGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    const opacity = gridOpacityRef.current / 100;
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${opacity})`;
    ctx.lineWidth = 1;
    for (let x = 0; x <= CANVAS_WIDTH; x++) {
      const px = x * DISPLAY_SCALE + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, CANVAS_HEIGHT * DISPLAY_SCALE);
      ctx.stroke();
    }
    for (let y = 0; y <= CANVAS_HEIGHT; y++) {
      const py = y * DISPLAY_SCALE + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(CANVAS_WIDTH * DISPLAY_SCALE, py);
      ctx.stroke();
    }
    ctx.restore();
  }, []);

  const refreshPreview = useCallback(() => {
    const preview = previewCanvasRef.current;
    if (!preview) return;
    const ctx = getCtx(preview);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, preview.width, preview.height);

    const sortedLayers = [...layersRef.current].reverse();
    for (const layer of sortedLayers) {
      if (!layer.visible) continue;
      const cvs = layerCanvasesRef.current[layer.id];
      if (cvs) {
        ctx.globalAlpha = layer.opacity;
        ctx.drawImage(cvs, 0, 0, preview.width, preview.height);
      }
    }
    ctx.globalAlpha = 1.0;

    if (floatingSelectionRef.current) {
      const { imageData, x, y } = floatingSelectionRef.current;
      const tempCvs = document.createElement("canvas");
      tempCvs.width = imageData.width;
      tempCvs.height = imageData.height;
      getCtx(tempCvs).putImageData(imageData, 0, 0);
      ctx.drawImage(
        tempCvs,
        x * DISPLAY_SCALE,
        y * DISPLAY_SCALE,
        imageData.width * DISPLAY_SCALE,
        imageData.height * DISPLAY_SCALE,
      );
    }

    if (showGridRef.current) renderGrid(ctx);
  }, [renderGrid]);

  useEffect(() => {
    refreshPreviewRef.current = refreshPreview;
  }, [refreshPreview]);

  const drawOverlayPreview = useCallback(
    (px: number | null, py: number | null) => {
      const overlay = overlayCanvasRef.current;
      if (!overlay) return;
      const ctx = overlay.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, overlay.width, overlay.height);

      // Draw selection box if it exists
      if (selectionRef.current) {
        const { x, y, w, h } = selectionRef.current;
        ctx.save();
        ctx.strokeStyle = "white";
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 2;
        ctx.lineDashOffset = (Date.now() / 50) % 8; // Marching ants effect isn't animated unless we set interval, we'll just do static for now
        ctx.strokeRect(
          x * DISPLAY_SCALE,
          y * DISPLAY_SCALE,
          w * DISPLAY_SCALE,
          h * DISPLAY_SCALE,
        );
        ctx.strokeStyle = "black";
        ctx.lineDashOffset = ((Date.now() / 50) % 8) + 4;
        ctx.strokeRect(
          x * DISPLAY_SCALE,
          y * DISPLAY_SCALE,
          w * DISPLAY_SCALE,
          h * DISPLAY_SCALE,
        );
        ctx.restore();
      }

      if (px === null || py === null) return;

      const t = toolRef.current;
      if (t === "select") {
        if (dragStateRef.current.selecting) {
          const drag = dragStateRef.current;
          const startX = drag.selStartX;
          const startY = drag.selStartY;
          const curX = px;
          const curY = py;
          const minX = Math.min(startX, curX);
          const minY = Math.min(startY, curY);
          const maxX = Math.max(startX, curX);
          const maxY = Math.max(startY, curY);
          const w = maxX - minX + 1;
          const h = maxY - minY + 1;

          ctx.save();
          ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 2;
          ctx.strokeRect(
            minX * DISPLAY_SCALE,
            minY * DISPLAY_SCALE,
            w * DISPLAY_SCALE,
            h * DISPLAY_SCALE,
          );
          ctx.restore();
        }
        return;
      }

      if (t !== "pen" && t !== "eraser") return;

      const radius = Math.floor(penSizeRef.current / 2);
      ctx.fillStyle =
        t === "pen"
          ? hexToRgba(currentColorRef.current, 0.65)
          : "rgba(255,255,255,0.25)";

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy <= radius * radius) {
            const x = px + dx,
              y = py + dy;
            if (x >= 0 && x < CANVAS_WIDTH && y >= 0 && y < CANVAS_HEIGHT) {
              ctx.fillRect(
                x * DISPLAY_SCALE,
                y * DISPLAY_SCALE,
                DISPLAY_SCALE,
                DISPLAY_SCALE,
              );
            }
          }
        }
      }
    },
    [],
  );

  const updateStageCursor = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (dragStateRef.current.panning) {
      stage.style.cursor = "grabbing";
      return;
    }
    if (keyStateRef.current.spaceDown) {
      stage.style.cursor = "grab";
      return;
    }

    let isOverSelection = false;
    if (selectionRef.current && lastHoverPixelRef.current) {
      const { x, y } = lastHoverPixelRef.current;
      const sel = selectionRef.current;
      isOverSelection =
        x >= sel.x && x < sel.x + sel.w && y >= sel.y && y < sel.y + sel.h;
    }

    const isInBounds = lastHoverInBoundsRef.current;
    const map: Record<Tool, string> = {
      pen: isInBounds ? "none" : "crosshair",
      eraser: isInBounds ? "none" : "crosshair",
      fill: "cell",
      picker: "crosshair",
      shape: "crosshair",
      select: isOverSelection ? "move" : "crosshair",
    };
    stage.style.cursor = map[toolRef.current] ?? "crosshair";
  }, []);

  useEffect(() => {
    if (lastHoverPixelRef.current)
      drawOverlayPreview(
        lastHoverPixelRef.current.x,
        lastHoverPixelRef.current.y,
      );
  }, [currentColor, tool, selection, drawOverlayPreview]);

  // Layer Management
  const addLayer = useCallback(
    (imageData?: ImageData) => {
      const id = generateId();
      const cvs = document.createElement("canvas");
      cvs.width = CANVAS_WIDTH;
      cvs.height = CANVAS_HEIGHT;
      if (imageData) {
        getCtx(cvs).putImageData(imageData, 0, 0);
      }
      layerCanvasesRef.current[id] = cvs;
      setLayers((prev) => {
        const newLayer = {
          id,
          name: `Layer ${prev.length + 1}`,
          visible: true,
          opacity: 1,
          locked: false,
        };
        const next = [newLayer, ...prev];
        layersRef.current = next;
        return next; // Add to top
      });
      activeLayerIdRef.current = id;
      setActiveLayerId(id);
      pushHistory();
      refreshPreview();
    },
    [pushHistory, refreshPreview],
  );

  const deleteLayer = useCallback(
    (id: string) => {
      if (layersRef.current.length <= 1) return; // Don't delete last layer
      setLayers((prev) => {
        const filtered = prev.filter((l) => l.id !== id);
        layersRef.current = filtered;
        if (activeLayerIdRef.current === id) {
          const nextActive = filtered[0]?.id || null;
          activeLayerIdRef.current = nextActive;
          setActiveLayerId(nextActive);
        }
        return filtered;
      });
      delete layerCanvasesRef.current[id];
      pushHistory();
      refreshPreview();
    },
    [pushHistory, refreshPreview],
  );

  const toggleLayerVisibility = useCallback(
    (id: string) => {
      setLayers((prev) => {
        const next = prev.map((l) =>
          l.id === id ? { ...l, visible: !l.visible } : l,
        );
        layersRef.current = next;
        return next;
      });
      pushHistory();
      refreshPreview();
    },
    [pushHistory, refreshPreview],
  );

  const toggleLayerLock = useCallback(
    (id: string) => {
      setLayers((prev) => {
        const next = prev.map((l) =>
          l.id === id ? { ...l, locked: !l.locked } : l,
        );
        layersRef.current = next;
        return next;
      });
      pushHistory();
    },
    [pushHistory],
  );

  const moveLayer = useCallback(
    (id: string, dir: "up" | "down") => {
      setLayers((prev) => {
        const idx = prev.findIndex((l) => l.id === id);
        if (idx < 0) return prev;
        if (dir === "up" && idx > 0) {
          const next = [...prev];
          [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
          layersRef.current = next;
          return next;
        }
        if (dir === "down" && idx < prev.length - 1) {
          const next = [...prev];
          [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
          layersRef.current = next;
          return next;
        }
        return prev;
      });
      pushHistory();
      refreshPreview();
    },
    [pushHistory, refreshPreview],
  );

  const mergeLayerDown = useCallback(
    (id: string) => {
      const idx = layersRef.current.findIndex((l) => l.id === id);
      if (idx < 0 || idx >= layersRef.current.length - 1) return;
      const belowId = layersRef.current[idx + 1].id;

      const upperCvs = layerCanvasesRef.current[id];
      const lowerCvs = layerCanvasesRef.current[belowId];
      const upperOpacity = layersRef.current[idx].opacity;

      const ctx = getCtx(lowerCvs);
      ctx.save();
      ctx.globalAlpha = upperOpacity;
      ctx.drawImage(upperCvs, 0, 0);
      ctx.restore();

      deleteLayer(id); // Handles history push
    },
    [deleteLayer],
  );
  // Selection logic
  const commitSelection = useCallback(() => {
    if (floatingSelectionRef.current && selectionRef.current) {
      const activeCvs = getActiveCanvas();
      if (activeCvs) {
        const ctx = getCtx(activeCvs);
        const temp = document.createElement("canvas");
        temp.width = floatingSelectionRef.current.imageData.width;
        temp.height = floatingSelectionRef.current.imageData.height;
        getCtx(temp).putImageData(floatingSelectionRef.current.imageData, 0, 0);

        ctx.save();
        ctx.drawImage(
          temp,
          floatingSelectionRef.current.x,
          floatingSelectionRef.current.y,
        );
        ctx.restore();
      }
      setFloatingSelection(null);
      pushHistory();
      refreshPreview();
    }
  }, [getActiveCanvas, pushHistory, refreshPreview]);

  const clearSelection = useCallback(() => {
    commitSelection();
    setSelection(null);
  }, [commitSelection]);

  const copySelection = useCallback(() => {
    if (!selectionRef.current) return;
    const { x, y, w, h } = selectionRef.current;

    if (floatingSelectionRef.current) {
      clipboardRef.current = {
        imageData: new ImageData(
          new Uint8ClampedArray(floatingSelectionRef.current.imageData.data),
          w,
          h,
        ),
        w,
        h,
      };
      setHasClipboard(true);
      return;
    }

    const activeCvs = getActiveCanvas();
    if (!activeCvs) return;
    const ctx = getCtx(activeCvs);
    clipboardRef.current = {
      imageData: ctx.getImageData(x, y, w, h),
      w,
      h,
    };
    setHasClipboard(true);
  }, [getActiveCanvas]);

  const cutSelection = useCallback(() => {
    if (!selectionRef.current) return;
    copySelection();

    if (floatingSelectionRef.current) {
      setFloatingSelection(null);
      setSelection(null);
      pushHistory();
      refreshPreview();
      return;
    }

    const { x, y, w, h } = selectionRef.current;
    const activeCvs = getActiveCanvas();
    if (activeCvs) {
      const ctx = getCtx(activeCvs);
      ctx.clearRect(x, y, w, h);
      setSelection(null);
      pushHistory();
      refreshPreview();
    }
  }, [copySelection, getActiveCanvas, pushHistory, refreshPreview]);

  const pasteSelection = useCallback(() => {
    if (!clipboardRef.current) return;
    commitSelection();
    const { w, h, imageData } = clipboardRef.current;
    const x = Math.max(0, Math.floor(CANVAS_WIDTH / 2 - w / 2));
    const y = Math.max(0, Math.floor(CANVAS_HEIGHT / 2 - h / 2));
    setSelection({ x, y, w, h });
    setFloatingSelection({
      x,
      y,
      imageData: new ImageData(new Uint8ClampedArray(imageData.data), w, h),
    });
    setTool("select");
    toolRef.current = "select";
    pushHistory();
    refreshPreview();
  }, [commitSelection, pushHistory, refreshPreview]);

  // Drawing Primitives
  const drawCircle = useCallback(
    (cx: number, cy: number, radius: number, color: string, erase = false) => {
      const activeCvs = getActiveCanvas();
      if (!activeCvs) return;
      const ctx = getCtx(activeCvs);
      ctx.save();

      // Mask by selection if active
      if (selectionRef.current && !floatingSelectionRef.current) {
        const { x, y, w, h } = selectionRef.current;
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
      }

      if (erase) ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = color;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy <= radius * radius) {
            const x = cx + dx,
              y = cy + dy;
            if (x >= 0 && x < CANVAS_WIDTH && y >= 0 && y < CANVAS_HEIGHT)
              ctx.fillRect(x, y, 1, 1);
          }
        }
      }
      ctx.restore();
    },
    [getActiveCanvas],
  );

  const drawLine = useCallback(
    (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      color: string,
      size: number,
      erase = false,
    ) => {
      let cx = x0,
        cy = y0;
      const dx = Math.abs(x1 - x0),
        sx = x0 < x1 ? 1 : -1;
      const dy = -Math.abs(y1 - y0),
        sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      const radius = Math.max(0, Math.floor(size / 2));
      while (true) {
        drawCircle(cx, cy, radius, color, erase);
        if (cx === x1 && cy === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) {
          err += dy;
          cx += sx;
        }
        if (e2 <= dx) {
          err += dx;
          cy += sy;
        }
      }
    },
    [drawCircle],
  );

  const drawPixelPerfectStep = useCallback(
    (x: number, y: number, color: string) => {
      const state = pixelPerfectStateRef.current;
      if (state.last) {
        const dx = x - state.last.x;
        const dy = y - state.last.y;
        const dir = { x: Math.sign(dx), y: Math.sign(dy) };
        if (
          dir.x !== 0 &&
          dir.y !== 0 &&
          state.lastDir &&
          (state.lastDir.x === 0 || state.lastDir.y === 0)
        ) {
          drawCircle(state.last.x, state.last.y, 0, color, true);
        }
        state.lastDir = dir;
      }
      drawCircle(x, y, 0, color, false);
      state.last = { x, y };
    },
    [drawCircle],
  );

  const drawFreehandLine = useCallback(
    (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      color: string,
      size: number,
      erase = false,
    ) => {
      if (erase || size !== 1 || !pixelPerfectRef.current) {
        drawLine(x0, y0, x1, y1, color, size, erase);
        return;
      }
      let cx = x0,
        cy = y0;
      const dx = Math.abs(x1 - x0),
        sx = x0 < x1 ? 1 : -1;
      const dy = -Math.abs(y1 - y0),
        sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      while (true) {
        drawPixelPerfectStep(cx, cy, color);
        if (cx === x1 && cy === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) {
          err += dy;
          cx += sx;
        }
        if (e2 <= dx) {
          err += dx;
          cy += sy;
        }
      }
    },
    [drawLine, drawPixelPerfectStep],
  );

  const floodFill = useCallback(
    (x: number, y: number, color: string) => {
      const activeCvs = getActiveCanvas();
      if (!activeCvs) return;

      // If we have a selection and clicking outside, ignore or clear selection
      if (selectionRef.current && !floatingSelectionRef.current) {
        const { x: sx, y: sy, w: sw, h: sh } = selectionRef.current;
        if (x < sx || x >= sx + sw || y < sy || y >= sy + sh) return; // Outside selection
      }

      const ctx = getCtx(activeCvs);
      const image = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      const data = image.data;
      const idx = (y * CANVAS_WIDTH + x) * 4;
      const start = [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
      const n = normalizeHex(color);
      const target = [
        parseInt(n.slice(1, 3), 16),
        parseInt(n.slice(3, 5), 16),
        parseInt(n.slice(5, 7), 16),
        255,
      ];
      if (start.every((v, i) => v === target[i])) return;

      const stack: Array<[number, number]> = [[x, y]];
      const matches = (o: number) =>
        data[o] === start[0] &&
        data[o + 1] === start[1] &&
        data[o + 2] === start[2] &&
        data[o + 3] === start[3];

      while (stack.length > 0) {
        const curr = stack.pop()!;
        const [px, py] = curr;
        if (px < 0 || py < 0 || px >= CANVAS_WIDTH || py >= CANVAS_HEIGHT)
          continue;

        if (selectionRef.current) {
          const { x: sx, y: sy, w: sw, h: sh } = selectionRef.current;
          if (px < sx || px >= sx + sw || py < sy || py >= sy + sh) continue;
        }

        const o = (py * CANVAS_WIDTH + px) * 4;
        if (!matches(o)) continue;
        data[o] = target[0];
        data[o + 1] = target[1];
        data[o + 2] = target[2];
        data[o + 3] = target[3];
        stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
      }
      ctx.putImageData(image, 0, 0);
      refreshPreview();
    },
    [getActiveCanvas, refreshPreview],
  );
  const drawShape = useCallback(
    (
      startX: number,
      startY: number,
      endX: number,
      endY: number,
      erase = false,
    ) => {
      const activeCvs = getActiveCanvas();
      if (!activeCvs) return;
      const ctx = getCtx(activeCvs);
      const minX = Math.min(startX, endX),
        minY = Math.min(startY, endY);
      const maxX = Math.max(startX, endX),
        maxY = Math.max(startY, endY);
      const color = currentColorRef.current;
      const size = penSizeRef.current;
      const type = shapeType;
      const filled = shapeFilled;

      ctx.save();
      if (selectionRef.current && !floatingSelectionRef.current) {
        const { x, y, w, h } = selectionRef.current;
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
      }

      if (type === "line") {
        drawLine(startX, startY, endX, endY, color, size, erase);
        ctx.restore();
        return;
      }
      if (type === "rect") {
        if (filled) {
          if (erase) ctx.globalCompositeOperation = "destination-out";
          ctx.fillStyle = color;
          ctx.fillRect(minX, minY, maxX - minX + 1, maxY - minY + 1);
        } else {
          drawLine(minX, minY, maxX, minY, color, size, erase);
          drawLine(maxX, minY, maxX, maxY, color, size, erase);
          drawLine(maxX, maxY, minX, maxY, color, size, erase);
          drawLine(minX, maxY, minX, minY, color, size, erase);
        }
        ctx.restore();
        return;
      }
      const rx = Math.max(1, Math.floor((maxX - minX) / 2));
      const ry = Math.max(1, Math.floor((maxY - minY) / 2));
      const cx = minX + rx,
        cy = minY + ry;

      if (erase) ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = color;
      for (let ey = minY; ey <= maxY; ey++) {
        for (let ex = minX; ex <= maxX; ex++) {
          const nx = (ex - cx) / rx,
            ny = (ey - cy) / ry;
          const v = nx * nx + ny * ny;
          if (filled ? v <= 1 : v >= 0.82 && v <= 1.1)
            ctx.fillRect(ex, ey, 1, 1);
        }
      }
      ctx.restore();
    },
    [drawLine, shapeType, shapeFilled, getActiveCanvas],
  );

  const pickColorAt = useCallback(
    (x: number, y: number) => {
      // Pick from the preview canvas directly so we get what the user sees
      const preview = previewCanvasRef.current;
      if (!preview) return;
      const ctx = getCtx(preview);
      const pixel = ctx.getImageData(
        x * DISPLAY_SCALE + DISPLAY_SCALE / 2,
        y * DISPLAY_SCALE + DISPLAY_SCALE / 2,
        1,
        1,
      ).data;
      // If it's fully transparent, just return
      if (pixel[3] === 0) return;
      const hex = `#${pixel[0].toString(16).padStart(2, "0")}${pixel[1].toString(16).padStart(2, "0")}${pixel[2].toString(16).padStart(2, "0")}`;
      registerColor(hex);
    },
    [registerColor],
  );

  const applyFlip = useCallback(
    (direction: "horizontal" | "vertical") => {
      const activeCvs = getActiveCanvas();
      if (!activeCvs) return;
      const ctx = getCtx(activeCvs);
      const target = { x: 0, y: 0, w: CANVAS_WIDTH, h: CANVAS_HEIGHT };

      // If there is a selection, flip only the selection
      if (selectionRef.current && !floatingSelectionRef.current) {
        target.x = selectionRef.current.x;
        target.y = selectionRef.current.y;
        target.w = selectionRef.current.w;
        target.h = selectionRef.current.h;
      }

      const source = ctx.getImageData(target.x, target.y, target.w, target.h);
      const temp = document.createElement("canvas");
      temp.width = target.w;
      temp.height = target.h;
      getCtx(temp).putImageData(source, 0, 0);
      ctx.save();
      ctx.clearRect(target.x, target.y, target.w, target.h);

      ctx.translate(target.x, target.y);
      if (direction === "horizontal") {
        ctx.translate(target.w, 0);
        ctx.scale(-1, 1);
      } else {
        ctx.translate(0, target.h);
        ctx.scale(1, -1);
      }
      ctx.drawImage(temp, 0, 0);
      ctx.restore();
      pushHistory();
      refreshPreview();
    },
    [getActiveCanvas, pushHistory, refreshPreview],
  );

  const clearCanvas = useCallback(() => {
    if (floatingSelectionRef.current) {
      setFloatingSelection(null);
      setSelection(null);
      pushHistory();
      refreshPreview();
      return;
    }
    const activeCvs = getActiveCanvas();
    if (!activeCvs) return;
    const ctx = getCtx(activeCvs);
    if (selectionRef.current) {
      const { x, y, w, h } = selectionRef.current;
      ctx.clearRect(x, y, w, h);
    } else {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
    pushHistory();
    refreshPreview();
  }, [getActiveCanvas, pushHistory, refreshPreview]);

  const centerCanvas = useCallback((currentZoom: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const cw = CANVAS_WIDTH * DISPLAY_SCALE * currentZoom;
    const ch = CANVAS_HEIGHT * DISPLAY_SCALE * currentZoom;
    setPan({
      x: (stage.clientWidth - cw) / 2,
      y: (stage.clientHeight - ch) / 2,
    });
  }, []);

  const drawImageToLayerCanvas = useCallback(
    async (src: string, cvs: HTMLCanvasElement) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to load: ${src}`));
        img.src = src;
      });
      const ctx = getCtx(cvs);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    },
    [],
  );

  const loadImageToCanvas = useCallback(
    async (src: string) => {
      const cvs = document.createElement("canvas");
      cvs.width = CANVAS_WIDTH;
      cvs.height = CANVAS_HEIGHT;
      await drawImageToLayerCanvas(src, cvs);

      // Create new background layer
      const id = generateId();
      layerCanvasesRef.current[id] = cvs;
      const nextLayers = [
        { id, name: "Background", visible: true, opacity: 1, locked: false },
      ];
      layersRef.current = nextLayers;
      activeLayerIdRef.current = id;
      setLayers(nextLayers);
      setActiveLayerId(id);

      historyRef.current = [];
      historyIndexRef.current = -1;
      setHistoryLengthUi(0);
      setHistoryIndexUi(-1);

      pushHistory();
      refreshPreview();
    },
    [drawImageToLayerCanvas, pushHistory, refreshPreview],
  );

  const loadLayersToCanvas = useCallback(
    async (layersPayload: PixelLayerData[]) => {
      const nextLayers: LayerState[] = [];
      layerCanvasesRef.current = {};

      for (const layer of layersPayload) {
        const cvs = document.createElement("canvas");
        cvs.width = CANVAS_WIDTH;
        cvs.height = CANVAS_HEIGHT;
        if (layer.imageDataUrl) {
          await drawImageToLayerCanvas(layer.imageDataUrl, cvs);
        }
        layerCanvasesRef.current[layer.id] = cvs;
        nextLayers.push({
          id: layer.id,
          name: layer.name,
          visible: layer.visible,
          opacity: layer.opacity,
          locked: layer.locked,
        });
      }

      layersRef.current = nextLayers;
      const nextActive = nextLayers[0]?.id || null;
      activeLayerIdRef.current = nextActive;
      setLayers(nextLayers);
      setActiveLayerId(nextActive);

      historyRef.current = [];
      historyIndexRef.current = -1;
      setHistoryLengthUi(0);
      setHistoryIndexUi(-1);

      pushHistory();
      refreshPreview();
    },
    [drawImageToLayerCanvas, pushHistory, refreshPreview],
  );

  const buildLayerExport = useCallback((): PixelLayerData[] => {
    return layersRef.current.map((layer) => {
      const cvs = layerCanvasesRef.current[layer.id];
      return {
        id: layer.id,
        name: layer.name,
        visible: layer.visible,
        opacity: layer.opacity,
        locked: layer.locked,
        imageDataUrl: cvs ? cvs.toDataURL("image/png") : "",
      };
    });
  }, []);

  // Save
  const handleSaveToItem = useCallback(() => {
    commitSelection();
    const flatten = flattenCanvasRef.current;
    if (!flatten) return;
    const ctx = getCtx(flatten);
    flatten.width = CANVAS_WIDTH;
    flatten.height = CANVAS_HEIGHT;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const sortedLayers = [...layersRef.current].reverse();
    for (const layer of sortedLayers) {
      if (!layer.visible) continue;
      const cvs = layerCanvasesRef.current[layer.id];
      if (cvs) {
        ctx.globalAlpha = layer.opacity;
        ctx.drawImage(cvs, 0, 0);
      }
    }
    onSaveToItem({
      imageDataUrl: flatten.toDataURL("image/png"),
      layers: buildLayerExport(),
    });
    onOpenChange(false);
  }, [commitSelection, onSaveToItem, buildLayerExport, onOpenChange]);

  const handleSaveToDevice = useCallback(async () => {
    commitSelection();
    const flatten = flattenCanvasRef.current;
    if (!flatten) return;
    const ctx = getCtx(flatten);
    flatten.width = CANVAS_WIDTH;
    flatten.height = CANVAS_HEIGHT;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const sortedLayers = [...layersRef.current].reverse();
    for (const layer of sortedLayers) {
      if (!layer.visible) continue;
      const cvs = layerCanvasesRef.current[layer.id];
      if (cvs) {
        ctx.globalAlpha = layer.opacity;
        ctx.drawImage(cvs, 0, 0);
      }
    }

    const filename = `${itemName.replace(/[^a-z0-9]/gi, "_")}_pixel.png`;
    const dataUrl = flatten.toDataURL("image/png");
    try {
      try {
        const target = await save({
          title: "Save Pixel Art",
          defaultPath: await join(await downloadDir(), filename),
          filters: [{ name: "PNG Image", extensions: ["png"] }],
        });
        if (!target || typeof target !== "string") return;
        const finalPath = target.toLowerCase().endsWith(".png")
          ? target
          : `${target}.png`;
        await writeFile(
          finalPath,
          new Uint8Array(await (await fetch(dataUrl)).arrayBuffer()),
        );
      } catch {
        const link = document.createElement("a");
        link.download = filename;
        link.href = dataUrl;
        link.click();
      }
    } catch (error) {
      console.error("Failed to save pixel image:", error);
      window.alert("Failed to save image. Please try again.");
    }
  }, [commitSelection, itemName]);

  // Init
  useEffect(() => {
    if (!open) return;
    const rafId = requestAnimationFrame(() => {
      const preview = previewCanvasRef.current;
      const overlay = overlayCanvasRef.current;
      if (!preview || !overlay) return;
      preview.width = CANVAS_WIDTH * DISPLAY_SCALE;
      preview.height = CANVAS_HEIGHT * DISPLAY_SCALE;
      overlay.width = CANVAS_WIDTH * DISPLAY_SCALE;
      overlay.height = CANVAS_HEIGHT * DISPLAY_SCALE;

      const initialize = async () => {
        setTool("pen");
        setShapeType("rect");
        setShapeFilled(false);
        setPixelPerfect(false);
        setSelection(null);
        setFloatingSelection(null);
        layerCanvasesRef.current = {};
        setLayers([]);

        const initialZoom = 1.3;
        setZoom(initialZoom);
        if (sourceLayers && sourceLayers.length > 0) {
          await loadLayersToCanvas(sourceLayers);
        } else {
          try {
            await loadImageToCanvas(sourceImage || "/images/back.png");
          } catch {
            await loadImageToCanvas("/images/back.png");
          }
        }
        centerCanvas(initialZoom);
      };
      void initialize();
    });
    return () => cancelAnimationFrame(rafId);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (e.code === "Space") {
        keyStateRef.current.spaceDown = true;
        updateStageCursor();
        return;
      }

      if (e.key === "Escape") {
        clearSelection();
        return;
      }

      if (ctrl && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        if (historyIndexRef.current > 0)
          restoreHistory(historyIndexRef.current - 1);
        return;
      }
      if (
        ctrl &&
        (e.key.toLowerCase() === "y" ||
          (e.key.toLowerCase() === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        if (historyIndexRef.current < historyRef.current.length - 1)
          restoreHistory(historyIndexRef.current + 1);
        return;
      }
      if (ctrl && e.key.toLowerCase() === "c") {
        e.preventDefault();
        copySelection();
        return;
      }
      if (ctrl && e.key.toLowerCase() === "x") {
        e.preventDefault();
        cutSelection();
        return;
      }
      if (ctrl && e.key.toLowerCase() === "v") {
        e.preventDefault();
        pasteSelection();
        return;
      }
      if (ctrl && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (e.shiftKey) handleSaveToDevice();
        else handleSaveToItem();
        return;
      }

      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (ctrl && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setTool("select");
        toolRef.current = "select";
        setSelection({ x: 0, y: 0, w: CANVAS_WIDTH, h: CANVAS_HEIGHT });
        return;
      }
      if (ctrl && e.key.toLowerCase() === "d") {
        e.preventDefault();
        clearSelection();
        return;
      }
      if (ctrl && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        addLayer();
        return;
      }
      if (ctrl && e.altKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setPixelPerfect((prev) => !prev);
        return;
      }

      if (e.key === "b" || e.key === "p") {
        setTool("pen");
        toolRef.current = "pen";
        updateStageCursor();
      }
      if (e.key === "e") {
        setTool("eraser");
        toolRef.current = "eraser";
        updateStageCursor();
      }
      if (e.key === "f") {
        setTool("fill");
        toolRef.current = "fill";
        updateStageCursor();
      }
      if (e.key === "i" || e.key === "k") {
        setTool("picker");
        toolRef.current = "picker";
        updateStageCursor();
      }
      if (e.key === "h") {
        setTool("shape");
        toolRef.current = "shape";
        setShapeMenuOpen(true);
        updateStageCursor();
      }
      if (e.key === "m") {
        setTool("select");
        toolRef.current = "select";
        updateStageCursor();
      }
      if (e.key === "g") setShowGrid((prev) => !prev);
      if (e.key === "[") {
        const n = clamp(penSizeRef.current - 1, 1, 16);
        penSizeRef.current = n;
        setPenSize(n);
        if (lastHoverPixelRef.current)
          drawOverlayPreview(
            lastHoverPixelRef.current.x,
            lastHoverPixelRef.current.y,
          );
      }
      if (e.key === "]") {
        const n = clamp(penSizeRef.current + 1, 1, 16);
        penSizeRef.current = n;
        setPenSize(n);
        if (lastHoverPixelRef.current)
          drawOverlayPreview(
            lastHoverPixelRef.current.x,
            lastHoverPixelRef.current.y,
          );
      }
      if (e.key === "0" || e.key === "r") {
        const z = 1.3;
        setZoom(z);
        centerCanvas(z);
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        clearCanvas();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        keyStateRef.current.spaceDown = false;
        updateStageCursor();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [
    open,
    restoreHistory,
    clearCanvas,
    centerCanvas,
    updateStageCursor,
    copySelection,
    cutSelection,
    pasteSelection,
    clearSelection,
    addLayer,
    handleSaveToItem,
    handleSaveToDevice,
  ]);

  useEffect(() => {
    refreshPreview();
  }, [refreshPreview]);

  // Pointer Handlers
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const allowPan = event.button === 1 || keyStateRef.current.spaceDown;
    const drag = dragStateRef.current;
    drag.pointerId = event.pointerId;
    drag.startX = event.clientX;
    drag.startY = event.clientY;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    drag.panOriginX = panRef.current.x;
    drag.panOriginY = panRef.current.y;

    // Create layer snapshots for shape tool
    const activeCvs = getActiveCanvas();
    if (activeCvs) {
      drag.snapshot = {
        [activeLayerIdRef.current!]: getCtx(activeCvs).getImageData(
          0,
          0,
          CANVAS_WIDTH,
          CANVAS_HEIGHT,
        ),
      };
    }

    if (allowPan) {
      drag.panning = true;
      drag.drawing = false;
      drag.selecting = false;
      drag.movingSelection = false;
      event.currentTarget.setPointerCapture(event.pointerId);
      updateStageCursor();
      return;
    }
    if (event.button !== 0) return;

    const hp = toPixel(
      event.clientX,
      event.clientY,
      stage,
      zoomRef.current,
      panRef.current,
    );
    const { x, y, inBounds } = hp;
    lastHoverPixelRef.current = { x, y };
    lastHoverInBoundsRef.current = inBounds;

    if (!inBounds) {
      drag.drawing = false;
      drag.pointerId = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      updateStageCursor();
      return;
    }

    if (event.altKey) {
      pickColorAt(x, y);
      drag.drawing = false;
      drag.pointerId = null;
      return;
    }

    drag.panning = false;
    event.currentTarget.setPointerCapture(event.pointerId);

    const t = toolRef.current;
    if (t === "select") {
      // Check if clicking inside an existing selection
      if (selectionRef.current) {
        const { x: sx, y: sy, w: sw, h: sh } = selectionRef.current;
        if (x >= sx && x < sx + sw && y >= sy && y < sy + sh) {
          // Move selection
          drag.movingSelection = true;
          // If not already floating, extract it now
          if (!floatingSelectionRef.current && activeCvs) {
            const ctx = getCtx(activeCvs);
            const imageData = ctx.getImageData(sx, sy, sw, sh);
            ctx.clearRect(sx, sy, sw, sh); // Cut from background
            setFloatingSelection({ x: sx, y: sy, imageData });
            refreshPreview();
          }
          return;
        } else {
          // Clicked outside, commit current selection and start new
          commitSelection();
          setSelection(null);
        }
      }

      drag.selecting = true;
      drag.selStartX = x;
      drag.selStartY = y;
      return;
    }

    // Automatically commit selection if we start drawing outside the select tool
    commitSelection();

    if (t === "picker") {
      pickColorAt(x, y);
      drag.drawing = false;
      return;
    }
    if (t === "fill") {
      commitColor(currentColorRef.current);
      floodFill(x, y, currentColorRef.current);
      pushHistory();
      drag.drawing = false;
      return;
    }

    drag.drawing = true;

    if (t === "pen") {
      commitColor(currentColorRef.current);
      if (pixelPerfectRef.current && penSizeRef.current === 1) {
        pixelPerfectStateRef.current = { last: null, lastDir: null };
        drawPixelPerfectStep(x, y, currentColorRef.current);
      } else {
        drawCircle(
          x,
          y,
          Math.floor(penSizeRef.current / 2),
          currentColorRef.current,
          false,
        );
      }
      refreshPreview();
      return;
    }
    if (t === "eraser") {
      drawCircle(
        x,
        y,
        Math.floor(penSizeRef.current / 2),
        currentColorRef.current,
        true,
      );
      refreshPreview();
      return;
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const drag = dragStateRef.current;

    const hp = toPixel(
      event.clientX,
      event.clientY,
      stage,
      zoomRef.current,
      panRef.current,
    );
    lastHoverPixelRef.current = { x: hp.x, y: hp.y };
    lastHoverInBoundsRef.current = hp.inBounds;

    // Only update cursor if not dragging
    if (drag.pointerId === null) {
      updateStageCursor();
    }

    if (hp.inBounds) drawOverlayPreview(hp.x, hp.y);
    else drawOverlayPreview(null, null);

    if (drag.pointerId !== event.pointerId) return;
    if (drag.panning) {
      setPan({
        x: drag.panOriginX + event.clientX - drag.startX,
        y: drag.panOriginY + event.clientY - drag.startY,
      });
      return;
    }

    if (!hp.inBounds) {
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      return;
    }

    const { x, y } = hp;

    if (
      drag.movingSelection &&
      selectionRef.current &&
      floatingSelectionRef.current
    ) {
      // We move based on pixel delta to avoid weird jumps
      const last = toPixel(
        drag.lastX,
        drag.lastY,
        stage,
        zoomRef.current,
        panRef.current,
      );
      const dx = x - last.x;
      const dy = y - last.y;
      if (dx !== 0 || dy !== 0) {
        setSelection((prev) =>
          prev ? { ...prev, x: prev.x + dx, y: prev.y + dy } : null,
        );
        setFloatingSelection((prev) =>
          prev ? { ...prev, x: prev.x + dx, y: prev.y + dy } : null,
        );
        drag.lastX = event.clientX;
        drag.lastY = event.clientY;
        refreshPreview();
      }
      return;
    }

    if (drag.selecting) {
      refreshPreview(); // Force redraw of selection box
      return;
    }

    if (!drag.drawing) return;

    const last = toPixel(
      drag.lastX,
      drag.lastY,
      stage,
      zoomRef.current,
      panRef.current,
    );
    const t = toolRef.current;

    if (t === "pen") {
      drawFreehandLine(
        last.x,
        last.y,
        x,
        y,
        currentColorRef.current,
        penSizeRef.current,
        false,
      );
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      refreshPreview();
      return;
    }
    if (t === "eraser") {
      drawLine(
        last.x,
        last.y,
        x,
        y,
        currentColorRef.current,
        penSizeRef.current,
        true,
      );
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      refreshPreview();
      return;
    }
    if (t === "shape") {
      const start = toPixel(
        drag.startX,
        drag.startY,
        stage,
        zoomRef.current,
        panRef.current,
      );
      const activeCvs = getActiveCanvas();
      const snap = drag.snapshot?.[activeLayerIdRef.current!];
      if (activeCvs && snap) getCtx(activeCvs).putImageData(snap, 0, 0);
      drawShape(start.x, start.y, x, y);
      refreshPreview();
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const drag = dragStateRef.current;
    if (drag.pointerId !== event.pointerId) return;

    if (drag.panning) {
      drag.panning = false;
      drag.pointerId = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      updateStageCursor();
      return;
    }

    const { x, y } = toPixel(
      event.clientX,
      event.clientY,
      stage,
      zoomRef.current,
      panRef.current,
    );

    if (drag.movingSelection) {
      drag.movingSelection = false;
      drag.pointerId = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      pushHistory();
      return;
    }

    if (drag.selecting) {
      drag.selecting = false;
      const startX = drag.selStartX;
      const startY = drag.selStartY;
      const minX = Math.min(startX, x);
      const minY = Math.min(startY, y);
      const maxX = Math.max(startX, x);
      const maxY = Math.max(startY, y);
      const w = maxX - minX + 1;
      const h = maxY - minY + 1;

      if (w > 1 || h > 1) {
        setSelection({ x: minX, y: minY, w, h });
      } else {
        setSelection(null);
      }
      drag.pointerId = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      refreshPreview();
      return;
    }

    if (!drag.drawing) {
      drag.pointerId = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }

    const t = toolRef.current;
    if (t === "shape") {
      const activeCvs = getActiveCanvas();
      const snap = drag.snapshot?.[activeLayerIdRef.current!];
      if (activeCvs && snap) getCtx(activeCvs).putImageData(snap, 0, 0);
      const start = toPixel(
        drag.startX,
        drag.startY,
        stage,
        zoomRef.current,
        panRef.current,
      );
      commitColor(currentColorRef.current);
      drawShape(start.x, start.y, x, y);
      refreshPreview();
    }

    if (t === "pen" || t === "eraser" || t === "shape") pushHistory();
    pixelPerfectStateRef.current = { last: null, lastDir: null };
    drag.drawing = false;
    drag.pointerId = null;
    drag.snapshot = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const handlePointerLeave = () => {
    lastHoverPixelRef.current = null;
    lastHoverInBoundsRef.current = false;
    drawOverlayPreview(null, null);
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (event.ctrlKey) {
      event.preventDefault();
      const next = clamp(
        penSizeRef.current + (event.deltaY > 0 ? -1 : 1),
        1,
        16,
      );
      penSizeRef.current = next;
      setPenSize(next);
      if (lastHoverPixelRef.current)
        drawOverlayPreview(
          lastHoverPixelRef.current.x,
          lastHoverPixelRef.current.y,
        );
      return;
    }
    event.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const mx = event.clientX - rect.left,
      my = event.clientY - rect.top;
    const nextZoom = clamp(
      zoomRef.current + (event.deltaY > 0 ? -0.1 : 0.1),
      0.5,
      8,
    );
    const worldX = (mx - panRef.current.x) / zoomRef.current;
    const worldY = (my - panRef.current.y) / zoomRef.current;
    setZoom(nextZoom);
    setPan({ x: mx - worldX * nextZoom, y: my - worldY * nextZoom });
  };


  const mergedPalette = useMemo(() => {
    const base: string[] = [...BALATRO_PALETTE];
    for (const c of recentColors) if (!base.includes(c)) base.unshift(c);
    return Array.from(new Set(base));
  }, [recentColors]);

  const paletteRows = useMemo(() => {
    const rows: string[][] = [];
    for (let i = 0; i < mergedPalette.length; i += 7)
      rows.push(mergedPalette.slice(i, i + 7));
    return rows;
  }, [mergedPalette]);

  const SHAPE_OPTIONS: {
    key: ShapeType;
    label: string;
    icon: typeof Rectangle;
  }[] = [
    { key: "line", label: "Line", icon: PencilSimple },
    { key: "rect", label: "Rectangle", icon: Rectangle },
    { key: "ellipse", label: "Ellipse", icon: Circle },
  ];

  const TOOLS: {
    key: Tool;
    label: string;
    shortcut: string;
    icon: typeof PencilSimple;
  }[] = [
    { key: "pen", label: "Pen", shortcut: "B", icon: PencilSimple },
    { key: "eraser", label: "Eraser", shortcut: "E", icon: Eraser },
    { key: "fill", label: "Fill", shortcut: "F", icon: PaintBucket },
    { key: "picker", label: "Eyedropper", shortcut: "I", icon: Eyedropper },
    {
      key: "select",
      label: "Marquee Selection",
      shortcut: "M",
      icon: SelectionIcon,
    },
  ];


  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogPortal>
          <DialogOverlay className="bg-background/95 backdrop-blur-sm" />
          <DialogContent
            className="top-9 left-0 translate-x-0 translate-y-0 h-[calc(100dvh-36px)] w-screen max-w-none border-0 rounded-none bg-background p-0 sm:rounded-none flex flex-col focus-visible:outline-none"
            style={{ width: "100vw", maxWidth: "100vw" }}
            onInteractOutside={(event) => event.preventDefault()}
          >
            <DialogHeader className="sr-only">
              <DialogTitle>Pixel Art Editor</DialogTitle>
              <DialogDescription>Edit a 71×95 pixel sprite.</DialogDescription>
            </DialogHeader>

            <div className="flex h-full flex-col">
              <div className="flex items-center gap-2 border-b border-border/40 px-4 py-2 pr-12 bg-card z-10 shadow-sm">
                <span className="shrink-0 text-sm font-semibold text-foreground">
                  Pixel Art Editor
                </span>

                <Separator orientation="vertical" className="h-5 mx-1" />

                {/* Brush size */}
                <div className="flex items-center gap-1.5">
                  <span className="shrink-0 text-xs text-muted-foreground hidden sm:inline-block">
                    Brush
                  </span>
                  <TipButton
                    tooltip="Decrease ([)"
                    variant="ghost"
                    size="icon-sm"
                    className="h-7 w-7"
                    onClick={() => {
                      const n = clamp(penSizeRef.current - 1, 1, 16);
                      penSizeRef.current = n;
                      setPenSize(n);
                      if (lastHoverPixelRef.current)
                        drawOverlayPreview(
                          lastHoverPixelRef.current.x,
                          lastHoverPixelRef.current.y,
                        );
                    }}
                  >
                    <Minus className="h-3 w-3" />
                  </TipButton>
                  <span className="w-6 text-center text-xs font-semibold tabular-nums">
                    {penSize}px
                  </span>
                  <TipButton
                    tooltip="Increase (])"
                    variant="ghost"
                    size="icon-sm"
                    className="h-7 w-7"
                    onClick={() => {
                      const n = clamp(penSizeRef.current + 1, 1, 16);
                      penSizeRef.current = n;
                      setPenSize(n);
                      if (lastHoverPixelRef.current)
                        drawOverlayPreview(
                          lastHoverPixelRef.current.x,
                          lastHoverPixelRef.current.y,
                        );
                    }}
                  >
                    <Plus className="h-3 w-3" />
                  </TipButton>
                </div>

                <Separator orientation="vertical" className="h-5 mx-1" />

                {/* Pixel-perfect toggle */}
                <div className="flex items-center gap-1">
                  <TipButton
                    tooltip={`Pixel-perfect (Ctrl+Alt+P) ${pixelPerfect ? "On" : "Off"}`}
                    variant={pixelPerfect ? "secondary" : "ghost"}
                    size="icon-sm"
                    className="h-7 w-7"
                    onClick={() => setPixelPerfect((prev) => !prev)}
                  >
                    <Sparkle
                      className="h-3.5 w-3.5"
                      weight={pixelPerfect ? "fill" : "regular"}
                    />
                  </TipButton>
                </div>

                <Separator orientation="vertical" className="h-5 mx-1" />

                {/* Zoom */}
                <div className="flex items-center gap-1 hidden sm:flex">
                  <TipButton
                    tooltip="Zoom out"
                    variant="ghost"
                    size="icon-sm"
                    className="h-7 w-7"
                    onClick={() => setZoom((p) => clamp(p - 0.1, 0.5, 8))}
                  >
                    <Minus className="h-3 w-3" />
                  </TipButton>
                  <span className="w-10 text-center text-xs font-semibold tabular-nums">
                    {Math.round(zoom * 100)}%
                  </span>
                  <TipButton
                    tooltip="Zoom in"
                    variant="ghost"
                    size="icon-sm"
                    className="h-7 w-7"
                    onClick={() => setZoom((p) => clamp(p + 0.1, 0.5, 8))}
                  >
                    <Plus className="h-3 w-3" />
                  </TipButton>
                </div>

                <Separator
                  orientation="vertical"
                  className="h-5 mx-1 hidden sm:block"
                />

                {/* Grid opacity */}
                <div className="flex items-center gap-1.5 hidden md:flex">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-7 w-7"
                        onClick={() => setShowGrid((p) => !p)}
                      >
                        <GridFour
                          className={cn(
                            "h-4 w-4",
                            showGrid
                              ? "text-foreground"
                              : "text-muted-foreground/40",
                          )}
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {showGrid ? "Hide grid (G)" : "Show grid (G)"}
                    </TooltipContent>
                  </Tooltip>
                  {showGrid && (
                    <input
                      type="range"
                      min={2}
                      max={30}
                      step={1}
                      value={gridOpacity}
                      onChange={(e) => {
                        setGridOpacity(Number(e.target.value));
                        refreshPreview();
                      }}
                      className="w-16 cursor-pointer accent-foreground"
                      title="Grid opacity"
                    />
                  )}
                </div>

                {tool === "shape" && (
                  <>
                    <Separator orientation="vertical" className="h-5 mx-1" />
                    <div className="flex items-center gap-1">
                      {SHAPE_OPTIONS.map(({ key, label, icon: Icon }) => (
                        <TipButton
                          key={key}
                          tooltip={label}
                          variant={shapeType === key ? "secondary" : "ghost"}
                          size="icon-sm"
                          className="h-7 w-7"
                          onClick={() => setShapeType(key)}
                        >
                          <Icon
                            className="h-3.5 w-3.5"
                            weight={shapeType === key ? "fill" : "regular"}
                          />
                        </TipButton>
                      ))}
                    </div>
                    <Button
                      variant={shapeFilled ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => setShapeFilled((p) => !p)}
                    >
                      {shapeFilled ? "Filled" : "Outline"}
                    </Button>
                  </>
                )}

                <div className="flex-1" />
                {/* Action icons */}
                <div className="flex items-center gap-1">
                  <TipButton
                    tooltip="Alt+Click canvas to pick color"
                    variant="ghost"
                    size="icon-sm"
                    className="h-7 w-7"
                    onClick={() => {
                      setTool("picker");
                      toolRef.current = "picker";
                      updateStageCursor();
                    }}
                  >
                    <Eyedropper className="h-4 w-4" />
                  </TipButton>

                  <Separator
                    orientation="vertical"
                    className="h-4 mx-0.5 hidden sm:block"
                  />

                  <div className="hidden sm:flex items-center gap-1">
                    <TipButton
                      tooltip="Flip horizontal"
                      variant="ghost"
                      size="icon-sm"
                      className="h-7 w-7"
                      onClick={() => applyFlip("horizontal")}
                    >
                      <FlipHorizontal className="h-4 w-4" />
                    </TipButton>
                    <TipButton
                      tooltip="Flip vertical"
                      variant="ghost"
                      size="icon-sm"
                      className="h-7 w-7"
                      onClick={() => applyFlip("vertical")}
                    >
                      <FlipVertical className="h-4 w-4" />
                    </TipButton>
                  </div>

                  <Separator
                    orientation="vertical"
                    className="h-4 mx-0.5 hidden sm:block"
                  />

                  <div className="hidden sm:flex items-center gap-1">
                    <TipButton
                      tooltip="Reset view (0)"
                      variant="ghost"
                      size="icon-sm"
                      className="h-7 w-7"
                      onClick={() => {
                        const z = 1.3;
                        setZoom(z);
                        centerCanvas(z);
                      }}
                    >
                      <ArrowsOutCardinal className="h-4 w-4" />
                    </TipButton>
                    <TipButton
                      tooltip="Clear canvas (Del)"
                      variant="ghost"
                      size="icon-sm"
                      className="h-7 w-7"
                      onClick={clearCanvas}
                    >
                      <Trash className="h-4 w-4 text-destructive" />
                    </TipButton>
                  </div>

                  <Separator
                    orientation="vertical"
                    className="h-4 mx-0.5 hidden sm:block"
                  />

                  <div className="hidden sm:flex items-center gap-1">
                    <TipButton
                      tooltip="Load back.png"
                      variant="ghost"
                      size="icon-sm"
                      className="h-7 w-7"
                      onClick={() => void loadImageToCanvas("/images/back.png")}
                    >
                      <ImageIcon className="h-4 w-4" />
                    </TipButton>
                    <TipButton
                      tooltip="Choose placeholder"
                      variant="ghost"
                      size="icon-sm"
                      className="h-7 w-7"
                      onClick={() => setIsPlaceholderPickerOpen(true)}
                    >
                      <ImageIcon className="h-4 w-4" weight="duotone" />
                    </TipButton>
                  </div>

                  <Separator orientation="vertical" className="h-4 mx-0.5" />

                  <TipButton
                    tooltip="Help Menu"
                    variant="ghost"
                    size="icon-sm"
                    className="h-7 w-7"
                    onClick={() => setShowHelpMenu(true)}
                  >
                    <Question className="h-4 w-4" />
                  </TipButton>
                </div>

                <Separator orientation="vertical" className="h-5 mx-1" />

                {/* Undo / Redo */}
                <div className="flex items-center gap-1">
                  <TipButton
                    tooltip="Undo (Ctrl+Z)"
                    variant="secondary"
                    size="icon-sm"
                    className="h-7 w-7"
                    onClick={() =>
                      historyIndexRef.current > 0 &&
                      restoreHistory(historyIndexRef.current - 1)
                    }
                    disabled={historyIndexUi <= 0}
                  >
                    <ArrowBendUpLeft className="h-4 w-4" weight="bold" />
                  </TipButton>
                  <TipButton
                    tooltip="Redo (Ctrl+Y)"
                    variant="secondary"
                    size="icon-sm"
                    className="h-7 w-7"
                    onClick={() =>
                      historyIndexRef.current < historyRef.current.length - 1 &&
                      restoreHistory(historyIndexRef.current + 1)
                    }
                    disabled={historyIndexUi >= historyLengthUi - 1}
                  >
                    <ArrowBendUpRight className="h-4 w-4" weight="bold" />
                  </TipButton>
                </div>

                <Separator orientation="vertical" className="h-5 mx-2" />

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs px-3 cursor-pointer"
                    onClick={() => onOpenChange(false)}
                  >
                    Discard
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs px-3 hidden md:flex"
                    onClick={handleSaveToDevice}
                  >
                    <DownloadSimple weight="bold" className="mr-1.5" /> Save
                    Base
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 text-xs px-3"
                    onClick={handleSaveToItem}
                  >
                    <FloppyDiskBack weight="bold" className="mr-1.5" /> Save To
                    Item
                  </Button>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col sm:flex-row bg-background">
                {/* ── Left column: tools ── */}
                <aside className="flex sm:w-14 shrink-0 flex-row sm:flex-col items-center sm:items-stretch gap-2 bg-card p-2 sm:p-3 overflow-x-auto sm:overflow-visible shadow-[1px_0_10px_rgba(0,0,0,0.1)] z-10">
                  <div className="flex sm:flex-col gap-1.5 flex-1">
                    {TOOLS.map(({ key, label, shortcut, icon: Icon }) => {
                      const active = tool === key;
                      return (
                        <Tooltip key={key}>
                          <TooltipTrigger asChild>
                            <Button
                              variant={active ? "secondary" : "ghost"}
                              size="icon"
                              className={cn(
                                "h-10 w-10 shrink-0",
                                active &&
                                  "bg-primary/20 text-primary hover:bg-primary/30 hover:text-primary",
                              )}
                              onClick={() => {
                                setTool(key);
                                toolRef.current = key;
                                updateStageCursor();
                              }}
                            >
                              <Icon
                                className="h-5 w-5"
                                weight={active ? "fill" : "regular"}
                              />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent
                            side="right"
                            className="hidden sm:block"
                          >
                            {label} ({shortcut})
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}

                    {/* Shape tool with submenu */}
                    <Popover
                      open={shapeMenuOpen}
                      onOpenChange={setShapeMenuOpen}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <PopoverTrigger asChild>
                            <Button
                              variant={tool === "shape" ? "secondary" : "ghost"}
                              size="icon"
                              className={cn(
                                "h-10 w-10 shrink-0",
                                tool === "shape" &&
                                  "bg-primary/20 text-primary hover:bg-primary/30 hover:text-primary",
                              )}
                              onClick={() => {
                                setTool("shape");
                                toolRef.current = "shape";
                                setShapeMenuOpen(true);
                                updateStageCursor();
                              }}
                            >
                              {(() => {
                                const ActiveIcon =
                                  SHAPE_OPTIONS.find((s) => s.key === shapeType)
                                    ?.icon ?? Rectangle;
                                return (
                                  <ActiveIcon
                                    className="h-5 w-5"
                                    weight={
                                      tool === "shape" ? "fill" : "regular"
                                    }
                                  />
                                );
                              })()}
                            </Button>
                          </PopoverTrigger>
                        </TooltipTrigger>
                        <TooltipContent
                          side="right"
                          className="hidden sm:block"
                        >
                          Shape (H)
                        </TooltipContent>
                      </Tooltip>
                      <PopoverContent
                        side="right"
                        className="w-36 p-1.5"
                        sideOffset={12}
                      >
                        <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Shape
                        </p>
                        <div className="flex flex-col gap-1">
                          {SHAPE_OPTIONS.map(({ key, label, icon: Icon }) => (
                            <Button
                              key={key}
                              variant={
                                shapeType === key ? "secondary" : "ghost"
                              }
                              size="sm"
                              className="h-8 w-full justify-start gap-2 text-xs"
                              onClick={() => {
                                setShapeType(key);
                                setShapeMenuOpen(false);
                              }}
                            >
                              <Icon
                                className="h-4 w-4"
                                weight={shapeType === key ? "fill" : "regular"}
                              />
                              {label}
                            </Button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="mt-auto px-1 pt-2 sm:border-t sm:border-border/40">
                    <CustomContextMenu
                      groups={[
                        {
                          items: [
                            {
                              label: "Select Color",
                              icon: PaintBucket,
                              onSelect: () => setCurrentColor(currentColor),
                            },
                            {
                              label: "Fill Active Layer",
                              icon: PaintBucket,
                              disabled: !canEditActiveLayer,
                              onSelect: () =>
                                floodFill(
                                  Math.floor(CANVAS_WIDTH / 2),
                                  Math.floor(CANVAS_HEIGHT / 2),
                                  currentColor,
                                ),
                            },
                          ],
                        },
                      ]}
                    >
                      <div
                        className="h-8 w-8 rounded-full border-2 border-background shadow-sm ring-1 ring-border cursor-pointer"
                        style={{ backgroundColor: currentColor }}
                        title={currentColor}
                      />
                    </CustomContextMenu>
                  </div>
                </aside>
                <main className="flex min-h-0 flex-1 flex-col relative z-0">
                  <div className="min-h-0 flex-1 overflow-hidden p-4 sm:p-8 flex items-center justify-center">
                    <CustomContextMenu
                      groups={[
                        {
                          items: [
                            {
                              label: "Copy",
                              icon: Copy,
                              shortcut: "Ctrl+C",
                              disabled: !hasSelection,
                              onSelect: copySelection,
                            },
                            {
                              label: "Cut",
                              icon: Scissors,
                              shortcut: "Ctrl+X",
                              disabled: !hasSelection || !canEditActiveLayer,
                              onSelect: cutSelection,
                            },
                            {
                              label: "Paste",
                              icon: ClipboardText,
                              shortcut: "Ctrl+V",
                              disabled: !hasClipboard || !canEditActiveLayer,
                              onSelect: pasteSelection,
                            },
                          ],
                          separator: true,
                        },
                        {
                          items: [
                            {
                              label: "Flip Horizontal",
                              icon: FlipHorizontal,
                              disabled: !canEditActiveLayer,
                              onSelect: () => applyFlip("horizontal"),
                            },
                            {
                              label: "Flip Vertical",
                              icon: FlipVertical,
                              disabled: !canEditActiveLayer,
                              onSelect: () => applyFlip("vertical"),
                            },
                          ],
                          separator: true,
                        },
                        {
                          items: [
                            {
                              label: "Clear Layer",
                              icon: Trash,
                              shortcut: "Del",
                              variant: "destructive",
                              disabled: !canEditActiveLayer,
                              onSelect: clearCanvas,
                            },
                          ],
                        },
                      ]}
                    >
                      <div
                        ref={stageRef}
                        className="relative h-full w-full overflow-hidden rounded-xl bg-background/50 backdrop-blur-3xl shadow-inner border border-border/20"
                        onWheel={handleWheel}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        onPointerLeave={handlePointerLeave}
                      >
                        <div
                          style={{
                            position: "absolute",
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                            transformOrigin: "top left",
                            width: CANVAS_WIDTH * DISPLAY_SCALE,
                            height: CANVAS_HEIGHT * DISPLAY_SCALE,
                            backgroundImage:
                              "repeating-conic-gradient(#1c1f2e 0% 25%, #13162a 0% 50%)",
                            backgroundSize: "12px 12px",
                            boxShadow: "0 0 0 1px rgba(255,255,255,0.1)",
                          }}
                        >
                          <canvas
                            ref={previewCanvasRef}
                            className="pointer-events-none absolute inset-0 select-none"
                            style={{
                              width: CANVAS_WIDTH * DISPLAY_SCALE,
                              height: CANVAS_HEIGHT * DISPLAY_SCALE,
                              imageRendering: "pixelated",
                            }}
                          />
                          <canvas
                            ref={overlayCanvasRef}
                            className="pointer-events-none absolute inset-0 select-none"
                            style={{
                              width: CANVAS_WIDTH * DISPLAY_SCALE,
                              height: CANVAS_HEIGHT * DISPLAY_SCALE,
                              imageRendering: "pixelated",
                            }}
                          />
                        </div>

                        {editorError && (
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-destructive text-white text-sm font-medium rounded-full shadow-lg animate-in fade-in slide-in-from-bottom-2">
                            {editorError}
                          </div>
                        )}
                      </div>
                    </CustomContextMenu>
                  </div>
                </main>

                <aside className="flex w-full sm:w-72 shrink-0 flex-col bg-card shadow-[-1px_0_10px_rgba(0,0,0,0.1)] z-10 sm:border-l border-border/20">
                  {/* Layers Panel */}
                  <div className="flex flex-col h-1/2 min-h-[250px] border-b border-border/20">
                    <div className="flex items-center justify-between p-3 border-b border-border/10 bg-muted/20">
                      <div className="flex items-center gap-2">
                        <Stack className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Layers
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <TipButton
                          tooltip="Merge Down"
                          variant="ghost"
                          size="icon-sm"
                          className="h-6 w-6"
                          disabled={
                            layers.length <= 1 ||
                            layers.findIndex((l) => l.id === activeLayerId) >=
                              layers.length - 1
                          }
                          onClick={() =>
                            activeLayerId && mergeLayerDown(activeLayerId)
                          }
                        >
                          <ArrowsMerge className="h-3.5 w-3.5" />
                        </TipButton>
                        <TipButton
                          tooltip="New Layer"
                          variant="ghost"
                          size="icon-sm"
                          className="h-6 w-6"
                          onClick={() => addLayer()}
                        >
                          <FilePlus className="h-3.5 w-3.5" />
                        </TipButton>
                        <TipButton
                          tooltip="Delete Layer"
                          variant="ghost"
                          size="icon-sm"
                          className="h-6 w-6 text-destructive"
                          disabled={layers.length <= 1}
                          onClick={() =>
                            activeLayerId && deleteLayer(activeLayerId)
                          }
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </TipButton>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                      {layers.map((layer, idx) => (
                        <CustomContextMenu
                          key={layer.id}
                          groups={[
                            {
                              items: [
                                {
                                  label: layer.visible
                                    ? "Hide Layer"
                                    : "Show Layer",
                                  icon: layer.visible ? EyeSlash : Eye,
                                  onSelect: () =>
                                    toggleLayerVisibility(layer.id),
                                },
                                {
                                  label: layer.locked
                                    ? "Unlock Layer"
                                    : "Lock Layer",
                                  icon: layer.locked ? LockKeyOpen : LockKey,
                                  onSelect: () => toggleLayerLock(layer.id),
                                },
                              ],
                              separator: true,
                            },
                            {
                              items: [
                                {
                                  label: "Move Up",
                                  icon: CaretUp,
                                  disabled: idx === 0,
                                  onSelect: () => moveLayer(layer.id, "up"),
                                },
                                {
                                  label: "Merge Down",
                                  icon: ArrowsMerge,
                                  disabled: idx === layers.length - 1,
                                  onSelect: () => mergeLayerDown(layer.id),
                                },
                              ],
                              separator: true,
                            },
                            {
                              items: [
                                {
                                  label: "Flip Horizontal",
                                  icon: FlipHorizontal,
                                  disabled: layer.locked || !layer.visible,
                                  onSelect: () => {
                                    setActiveLayerId(layer.id);
                                    applyFlip("horizontal");
                                  },
                                },
                                {
                                  label: "Flip Vertical",
                                  icon: FlipVertical,
                                  disabled: layer.locked || !layer.visible,
                                  onSelect: () => {
                                    setActiveLayerId(layer.id);
                                    applyFlip("vertical");
                                  },
                                },
                              ],
                              separator: true,
                            },
                            {
                              items: [
                                {
                                  label: "Delete Layer",
                                  icon: Trash,
                                  variant: "destructive",
                                  disabled: layers.length <= 1,
                                  onSelect: () => deleteLayer(layer.id),
                                },
                              ],
                            },
                          ]}
                        >
                          <div
                            className={cn(
                              "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors text-sm",
                              activeLayerId === layer.id
                                ? "bg-primary/20 text-foreground"
                                : "hover:bg-muted/50 text-muted-foreground",
                            )}
                            onClick={() => setActiveLayerId(layer.id)}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleLayerVisibility(layer.id);
                              }}
                              className="p-1 cursor-pointer hover:text-foreground"
                            >
                              {layer.visible ? (
                                <Eye className="h-4 w-4" />
                              ) : (
                                <EyeSlash className="h-4 w-4 opacity-50" />
                              )}
                            </button>
                            <span className="flex-1 truncate">{layer.name}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleLayerLock(layer.id);
                              }}
                              className="p-1 cursor-pointer hover:text-foreground"
                            >
                              {layer.locked ? (
                                <LockKey className="h-4 w-4 text-warning" />
                              ) : (
                                <LockKeyOpen className="h-4 w-4 opacity-30 hover:opacity-100" />
                              )}
                            </button>
                            <div className="flex flex-col ml-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveLayer(layer.id, "up");
                                }}
                                disabled={idx === 0}
                                className="cursor-pointer disabled:cursor-default disabled:opacity-20 hover:text-foreground"
                              >
                                <CaretUp className="h-3 w-3" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveLayer(layer.id, "down");
                                }}
                                disabled={idx === layers.length - 1}
                                className="cursor-pointer disabled:cursor-default disabled:opacity-20 hover:text-foreground"
                              >
                                <CaretDown className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </CustomContextMenu>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col min-h-0 bg-card">
                    <div className="flex-1 overflow-y-auto p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Palette
                        </span>
                        {recentColors.length > 0 && (
                          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                            +{recentColors.length}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        {paletteRows.map((row, idx) => (
                          <div
                            key={idx}
                            className="flex gap-1.5 justify-center sm:justify-start"
                          >
                            {row.map((hex) => (
                              <CustomContextMenu
                                key={hex}
                                groups={[
                                  {
                                    items: [
                                      {
                                        label: "Select Color",
                                        icon: PaintBucket,
                                        onSelect: () => setCurrentColor(hex),
                                      },
                                      {
                                        label: "Fill Active Layer",
                                        icon: PaintBucket,
                                        disabled: !canEditActiveLayer,
                                        onSelect: () =>
                                          floodFill(
                                            Math.floor(CANVAS_WIDTH / 2),
                                            Math.floor(CANVAS_HEIGHT / 2),
                                            hex,
                                          ),
                                      },
                                    ],
                                  },
                                ]}
                              >
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={() => setCurrentColor(hex)}
                                      className={cn(
                                        "h-7 w-7 sm:h-8 sm:w-8 cursor-pointer rounded-md border transition-all hover:scale-110 hover:shadow-md",
                                        currentColor.toLowerCase() === hex
                                          ? "border-white ring-2 ring-white/60 scale-110 z-10"
                                          : "border-black/20",
                                      )}
                                      style={{ backgroundColor: hex }}
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent>{hex}</TooltipContent>
                                </Tooltip>
                              </CustomContextMenu>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="p-4 border-t border-border/10 bg-muted/10">
                      <GenericDialogColorPicker
                        value={currentColor}
                        onChange={(next) => setCurrentColor(normalizeHex(next))}
                        defaultColor="#fe5f55"
                        valueMode="with-hash"
                        placeholder="#FE5F55"
                        showBadgePreview={false}
                      />
                    </div>
                  </div>
                </aside>
              </div>
            </div>

            <canvas
              ref={flattenCanvasRef}
              className="hidden"
              aria-hidden="true"
            />
          </DialogContent>
        </DialogPortal>
      </Dialog>
      {/* Help Menu Dialog */}
      <Dialog open={showHelpMenu} onOpenChange={setShowHelpMenu}>
        <DialogContent className="max-w-2xl bg-card border-border/40 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/20 bg-muted/10">
            <DialogTitle className="flex items-center gap-2">
              <Question className="h-5 w-5 text-primary" />
              Editor Help & Shortcuts
            </DialogTitle>
            <DialogDescription>
              Everything you need to know to master the Pixel Art Editor.
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="shortcuts" className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b border-border/20 px-6 h-12 bg-transparent">
              <TabsTrigger
                value="shortcuts"
                className="data-[state=active]:bg-muted/50"
              >
                Shortcuts
              </TabsTrigger>
              <TabsTrigger
                value="tools"
                className="data-[state=active]:bg-muted/50"
              >
                Tools
              </TabsTrigger>
              <TabsTrigger
                value="layers"
                className="data-[state=active]:bg-muted/50"
              >
                Layers & Selection
              </TabsTrigger>
            </TabsList>

            <div className="p-6 h-[400px] overflow-y-auto">
              <TabsContent
                value="shortcuts"
                className="m-0 space-y-4 outline-none"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {KEYBINDS.map(({ key, action }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-4 rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-sm hover:bg-muted/40 transition-colors"
                    >
                      <span className="text-muted-foreground">{action}</span>
                      <kbd className="shrink-0 rounded-md border border-border/50 bg-background px-2 py-1 font-mono text-[10px] font-semibold text-foreground shadow-sm">
                        {key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="tools" className="m-0 space-y-6 outline-none">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <PencilSimple className="h-4 w-4 text-primary" /> Drawing
                    Tools
                  </h3>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>
                      <strong className="text-foreground">Pen (B):</strong>{" "}
                      Draws pixels. Hold{" "}
                      <kbd className="px-1 rounded bg-muted">Alt</kbd> and click
                      to quickly pick a color from the canvas.
                    </p>
                    <p>
                      <strong className="text-foreground">Eraser (E):</strong>{" "}
                      Removes pixels from the current layer.
                    </p>
                    <p>
                      <strong className="text-foreground">Fill (F):</strong>{" "}
                      Fills contiguous areas of the same color. Respects active
                      selections.
                    </p>
                    <p>
                      <strong className="text-foreground">Shape (H):</strong>{" "}
                      Draw lines, rectangles, and ellipses. Choose filled or
                      outline mode.
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <ArrowsOutCardinal className="h-4 w-4 text-primary" />{" "}
                    Navigation
                  </h3>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>
                      Use the{" "}
                      <strong className="text-foreground">Scroll Wheel</strong>{" "}
                      to zoom in and out.
                    </p>
                    <p>
                      Hold <strong className="text-foreground">Spacebar</strong>{" "}
                      or{" "}
                      <strong className="text-foreground">
                        Middle Mouse Button
                      </strong>{" "}
                      and drag to pan around the canvas.
                    </p>
                    <p>
                      Press <kbd className="px-1 rounded bg-muted">0</kbd> or{" "}
                      <kbd className="px-1 rounded bg-muted">R</kbd> to reset
                      your view to center.
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent
                value="layers"
                className="m-0 space-y-6 outline-none"
              >
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <Stack className="h-4 w-4 text-primary" /> Layers
                  </h3>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>
                      Layers allow you to draw on separate transparent canvases
                      that stack on top of each other.
                    </p>
                    <p>
                      The{" "}
                      <strong className="text-foreground">Background</strong>{" "}
                      layer is created by default. You can create new layers
                      using the <kbd className="px-1 rounded bg-muted">+</kbd>{" "}
                      button in the layers panel.
                    </p>
                    <p>
                      When you save, all visible layers are merged (flattened)
                      into a single image.
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <SelectionIcon className="h-4 w-4 text-primary" /> Selection
                    Tool
                  </h3>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>
                      Use{" "}
                      <strong className="text-foreground">
                        Marquee Select (M)
                      </strong>{" "}
                      to draw a box. This acts as a mask — drawing and filling
                      will only affect the selected area.
                    </p>
                    <p>
                      Click and drag inside an active selection to{" "}
                      <strong className="text-foreground">Move</strong> those
                      pixels around the canvas.
                    </p>
                    <p>
                      Use standard{" "}
                      <strong className="text-foreground">
                        Ctrl+C / Ctrl+X / Ctrl+V
                      </strong>{" "}
                      to copy and paste sections of the image.
                    </p>
                    <p>
                      Press <strong className="text-foreground">Escape</strong>{" "}
                      or click outside to commit your floating selection.
                    </p>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      <PlaceholderPickerDialog
        open={isPlaceholderPickerOpen}
        onOpenChange={setIsPlaceholderPickerOpen}
        initialCategory={placeholderCategory}
        onSelect={(entry: PlaceholderEntry) => {
          setPlaceholderCategory(entry.category);
          void loadImageToCanvas(entry.src);
        }}
      />

    </>
  );
}
