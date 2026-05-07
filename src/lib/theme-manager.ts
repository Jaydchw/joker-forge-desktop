import type { ThemePreference } from "@/lib/storage";
import { getCurrentWebview } from "@tauri-apps/api/webview";

export const THEME_CHANGE_EVENT = "joker_forge_theme_change";

const THEME_LIBRARY_KEY = "joker_forge_theme_library";
const ACTIVE_THEME_KEY = "joker_forge_active_theme_id";
const THEME_PREFERENCE_KEY = "joker_forge_theme_preference";
const APP_ZOOM_LEVEL_KEY = "joker_forge_app_zoom_level";

const DEFAULT_THEME_ID = "default";
const BUILT_IN_THEME_IDS = new Set<string>([
  "default",
  "system-classic",
  "system-neon-noir",
  "system-solar-dusk",
  "system-forest-mist",
  "system-vaporwave",
  "system-crt-phosphor",
]);

const THEME_VARIABLES = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "border",
  "input",
  "ring",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
] as const;

export type ThemeVariable = (typeof THEME_VARIABLES)[number];
export type ThemePalette = Record<ThemeVariable, string>;
export type ThemeFontFamily = string;
export type AppZoomLevel =
  | "xxs"
  | "xs"
  | "small"
  | "medium"
  | "large"
  | "xl"
  | "xxl";

export interface ThemeUiSettings {
  fontScale: number;
  radiusPx: number;
  fontFamily: ThemeFontFamily;
}

export interface AppThemeDefinition {
  id: string;
  name: string;
  builtIn?: boolean;
  light: ThemePalette;
  dark: ThemePalette;
  ui: ThemeUiSettings;
}

export interface ThemeFilePayload {
  type: "jokerforge-theme";
  version: 1;
  theme: Omit<AppThemeDefinition, "id" | "builtIn">;
}

export const APP_ZOOM_LEVELS: Array<{
  key: AppZoomLevel;
  label: string;
  scale: number;
}> = [
  { key: "xxs", label: "XXS", scale: 0.7 },
  { key: "xs", label: "XS", scale: 0.8 },
  { key: "small", label: "Small", scale: 0.9 },
  { key: "medium", label: "Medium", scale: 1 },
  { key: "large", label: "Large", scale: 1.1 },
  { key: "xl", label: "XL", scale: 1.2 },
  { key: "xxl", label: "XXL", scale: 1.3 },
];

export const THEME_FONT_OPTIONS: Array<{
  key: ThemeFontFamily;
  label: string;
  cssValue: string;
  googleFamily?: string;
}> = [
  {
    key: "lexend",
    label: "Lexend",
    cssValue: '"Lexend", sans-serif',
    googleFamily: "Lexend:wght@300;400;500;600;700",
  },
  {
    key: "inter",
    label: "Inter",
    cssValue: '"Inter", sans-serif',
    googleFamily: "Inter:wght@300;400;500;600;700",
  },
  {
    key: "manrope",
    label: "Manrope",
    cssValue: '"Manrope", sans-serif',
    googleFamily: "Manrope:wght@300;400;500;600;700",
  },
  {
    key: "poppins",
    label: "Poppins",
    cssValue: '"Poppins", sans-serif',
    googleFamily: "Poppins:wght@300;400;500;600;700",
  },
  {
    key: "rubik",
    label: "Rubik",
    cssValue: '"Rubik", sans-serif',
    googleFamily: "Rubik:wght@300;400;500;600;700",
  },
  {
    key: "montserrat",
    label: "Montserrat",
    cssValue: '"Montserrat", sans-serif',
    googleFamily: "Montserrat:wght@300;400;500;600;700",
  },
  {
    key: "work-sans",
    label: "Work Sans",
    cssValue: '"Work Sans", sans-serif',
    googleFamily: "Work+Sans:wght@300;400;500;600;700",
  },
  {
    key: "rounded",
    label: "Rounded Sans",
    cssValue: 'ui-rounded, "Trebuchet MS", "Segoe UI", sans-serif',
  },
  {
    key: "system",
    label: "System Sans",
    cssValue: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  },
  {
    key: "serif",
    label: "Serif",
    cssValue: "ui-serif, Georgia, Cambria, serif",
  },
  {
    key: "merriweather",
    label: "Merriweather",
    cssValue: '"Merriweather", serif',
    googleFamily: "Merriweather:wght@300;400;700",
  },
  {
    key: "playfair-display",
    label: "Playfair Display",
    cssValue: '"Playfair Display", serif',
    googleFamily: "Playfair+Display:wght@400;500;600;700",
  },
];

const ensureGoogleFontLoaded = (familyKey: ThemeFontFamily) => {
  if (typeof document === "undefined") return;
  const option = THEME_FONT_OPTIONS.find((item) => item.key === familyKey);
  if (!option?.googleFamily) return;

  const linkId = `jf-font-${option.key}`;
  if (document.getElementById(linkId)) return;

  const link = document.createElement("link");
  link.id = linkId;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${option.googleFamily}&display=swap`;
  document.head.appendChild(link);
};

const isAppZoomLevel = (value: unknown): value is AppZoomLevel =>
  typeof value === "string" &&
  APP_ZOOM_LEVELS.some((zoomLevel) => zoomLevel.key === value);

const getAppZoomScale = (zoomLevel: AppZoomLevel): number =>
  APP_ZOOM_LEVELS.find((item) => item.key === zoomLevel)?.scale ?? 1;

const applyWebviewZoom = async (scale: number) => {
  if (typeof window === "undefined") return;
  try {
    await getCurrentWebview().setZoom(scale);
  } catch (error) {
    console.warn("Failed to apply webview zoom", { scale, error });
  }
};

export const getAppZoomLevel = (): AppZoomLevel => {
  if (typeof window === "undefined") return "medium";
  const raw = window.localStorage.getItem(APP_ZOOM_LEVEL_KEY);
  return isAppZoomLevel(raw) ? raw : "medium";
};

export const setAppZoomLevel = (zoomLevel: AppZoomLevel) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(APP_ZOOM_LEVEL_KEY, zoomLevel);
  void applyWebviewZoom(getAppZoomScale(zoomLevel));
  applyThemeFromStorage();
};

export const stepAppZoomLevel = (direction: "in" | "out"): AppZoomLevel => {
  const current = getAppZoomLevel();
  const currentIndex = APP_ZOOM_LEVELS.findIndex((item) => item.key === current);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex =
    direction === "in"
      ? Math.min(APP_ZOOM_LEVELS.length - 1, safeIndex + 1)
      : Math.max(0, safeIndex - 1);
  const nextLevel = APP_ZOOM_LEVELS[nextIndex]?.key ?? "medium";
  setAppZoomLevel(nextLevel);
  return nextLevel;
};

export const THEME_VARIABLE_GROUPS: Array<{
  heading: string;
  items: Array<{ key: ThemeVariable; label: string }>;
}> = [
  {
    heading: "Surfaces",
    items: [
      { key: "background", label: "App Background" },
      { key: "foreground", label: "App Foreground" },
      { key: "card", label: "Card Background" },
      { key: "card-foreground", label: "Card Foreground" },
      { key: "popover", label: "Popover Background" },
      { key: "popover-foreground", label: "Popover Foreground" },
    ],
  },
  {
    heading: "Actions",
    items: [
      { key: "primary", label: "Primary" },
      { key: "primary-foreground", label: "Primary Foreground" },
      { key: "secondary", label: "Secondary" },
      { key: "secondary-foreground", label: "Secondary Foreground" },
      { key: "accent", label: "Accent" },
      { key: "accent-foreground", label: "Accent Foreground" },
      { key: "destructive", label: "Destructive" },
      { key: "ring", label: "Focus Ring" },
    ],
  },
  {
    heading: "Support",
    items: [
      { key: "muted", label: "Muted" },
      { key: "muted-foreground", label: "Muted Foreground" },
      { key: "border", label: "Border" },
      { key: "input", label: "Input" },
    ],
  },
  {
    heading: "Sidebar",
    items: [
      { key: "sidebar", label: "Sidebar Background" },
      { key: "sidebar-foreground", label: "Sidebar Foreground" },
      { key: "sidebar-primary", label: "Sidebar Primary" },
      {
        key: "sidebar-primary-foreground",
        label: "Sidebar Primary Foreground",
      },
      { key: "sidebar-accent", label: "Sidebar Accent" },
      {
        key: "sidebar-accent-foreground",
        label: "Sidebar Accent Foreground",
      },
      { key: "sidebar-border", label: "Sidebar Border" },
      { key: "sidebar-ring", label: "Sidebar Ring" },
    ],
  },
];

export const THEME_VARIABLE_USAGE: Record<ThemeVariable, string[]> = {
  background: [
    "App background",
    "Rule Builder canvas + panels",
    "Editor workspace surfaces",
  ],
  foreground: [
    "Primary text + icons",
    "Rule Builder Live Code panel text/caret",
  ],
  card: [
    "Item info cards (jokers, vouchers, decks, consumables)",
    "Rule Builder blocks + floating dock",
    "Dialog surfaces",
  ],
  "card-foreground": ["Text/icons on item cards", "Rule Builder panel text"],
  popover: ["Select menus + popovers", "Toast surfaces", "Context menus"],
  "popover-foreground": ["Text/icons inside popovers", "Toast text"],
  primary: [
    "Primary buttons",
    "Item badges + highlights",
    "Rule Builder selection + code highlights",
  ],
  "primary-foreground": ["Text/icons on primary buttons", "Badge text"],
  secondary: ["Secondary buttons", "Subtle chips + fills"],
  "secondary-foreground": ["Text/icons on secondary"],
  muted: [
    "Muted chips + labels",
    "Rule Builder variable pills",
    "Subtle panels",
  ],
  "muted-foreground": [
    "Helper text",
    "Placeholders",
    "Rule Builder list metadata",
  ],
  accent: ["Hover + selected rows", "Rule Builder block palette rows"],
  "accent-foreground": ["Text/icons on accent"],
  destructive: ["Delete buttons", "Rule Builder remove block button"],
  border: [
    "Card + panel borders",
    "Rule Builder list dividers",
    "Section separators",
  ],
  input: ["Text inputs + selects", "Rule Builder search fields"],
  ring: ["Focus ring", "Rule Builder focus-visible outlines"],
  sidebar: ["Sidebar background"],
  "sidebar-foreground": ["Sidebar text/icons"],
  "sidebar-primary": ["Sidebar primary buttons", "Active items"],
  "sidebar-primary-foreground": ["Text/icons on sidebar primary"],
  "sidebar-accent": ["Sidebar hover/selected"],
  "sidebar-accent-foreground": ["Text/icons on sidebar accent"],
  "sidebar-border": ["Sidebar borders", "Dividers"],
  "sidebar-ring": ["Sidebar focus ring"],
};

const DEFAULT_UI: ThemeUiSettings = {
  fontScale: 1,
  radiusPx: 10,
  fontFamily: "lexend",
};

const DEFAULT_LIGHT: ThemePalette = {
  background: "#FAFAFA",
  foreground: "#262626",
  card: "#FFFFFF",
  "card-foreground": "#262626",
  popover: "#FFFFFF",
  "popover-foreground": "#262626",
  primary: "#3E8B70",
  "primary-foreground": "#F1F8F5",
  secondary: "#F5F5F5",
  "secondary-foreground": "#333333",
  muted: "#F5F5F5",
  "muted-foreground": "#757575",
  accent: "#F5F5F5",
  "accent-foreground": "#333333",
  destructive: "#CB3535",
  border: "#E5E5E5",
  input: "#E5E5E5",
  ring: "#3E8B70",
  sidebar: "#FAFAFA",
  "sidebar-foreground": "#262626",
  "sidebar-primary": "#3E8B70",
  "sidebar-primary-foreground": "#F1F8F5",
  "sidebar-accent": "#F5F5F5",
  "sidebar-accent-foreground": "#333333",
  "sidebar-border": "#E5E5E5",
  "sidebar-ring": "#3E8B70",
};

const DEFAULT_DARK: ThemePalette = {
  background: "#0A0A0A",
  foreground: "#FAFAFA",
  card: "#0A0A0A",
  "card-foreground": "#FAFAFA",
  popover: "#0A0A0A",
  "popover-foreground": "#FAFAFA",
  primary: "#3E8B70",
  "primary-foreground": "#F1F8F5",
  secondary: "#141414",
  "secondary-foreground": "#FAFAFA",
  muted: "#0F0F0F",
  "muted-foreground": "#C0C0C0",
  accent: "#141414",
  "accent-foreground": "#FAFAFA",
  destructive: "#8A2525",
  border: "#1F1F1F",
  input: "#1F1F1F",
  ring: "#3E8B70",
  sidebar: "#0A0A0A",
  "sidebar-foreground": "#FAFAFA",
  "sidebar-primary": "#3E8B70",
  "sidebar-primary-foreground": "#F1F8F5",
  "sidebar-accent": "#0F0F0F",
  "sidebar-accent-foreground": "#FAFAFA",
  "sidebar-border": "#1F1F1F",
  "sidebar-ring": "#3E8B70",
};

const BASE_BUILT_IN_THEME: AppThemeDefinition = {
  id: DEFAULT_THEME_ID,
  name: "Default",
  builtIn: true,
  light: DEFAULT_LIGHT,
  dark: DEFAULT_DARK,
  ui: DEFAULT_UI,
};

const SYSTEM_PRESETS: AppThemeDefinition[] = [
  {
    id: "system-classic",
    name: "Classic",
    builtIn: true,
    light: {
      background: "#1E2B30",
      foreground: "#BEC7D4",
      card: "#1E2B30",
      "card-foreground": "#BEC7D4",
      popover: "#1E2B30",
      "popover-foreground": "#BEC7D4",
      primary: "#59A487",
      "primary-foreground": "#FFFFFF",
      secondary: "#2F4047",
      "secondary-foreground": "#BEC7D4",
      muted: "#26353B",
      "muted-foreground": "#AAB4C2",
      accent: "#2F4047",
      "accent-foreground": "#D8DFE8",
      destructive: "#FF4C40",
      border: "#3A4C53",
      input: "#3A4C53",
      ring: "#59A487",
      sidebar: "#1E2B30",
      "sidebar-foreground": "#BEC7D4",
      "sidebar-primary": "#59A487",
      "sidebar-primary-foreground": "#FFFFFF",
      "sidebar-accent": "#26353B",
      "sidebar-accent-foreground": "#D8DFE8",
      "sidebar-border": "#3A4C53",
      "sidebar-ring": "#59A487",
    },
    dark: {
      background: "#1E2B30",
      foreground: "#BEC7D4",
      card: "#1E2B30",
      "card-foreground": "#BEC7D4",
      popover: "#1E2B30",
      "popover-foreground": "#BEC7D4",
      primary: "#59A487",
      "primary-foreground": "#FFFFFF",
      secondary: "#2F4047",
      "secondary-foreground": "#BEC7D4",
      muted: "#26353B",
      "muted-foreground": "#AAB4C2",
      accent: "#2F4047",
      "accent-foreground": "#D8DFE8",
      destructive: "#FF4C40",
      border: "#3A4C53",
      input: "#3A4C53",
      ring: "#59A487",
      sidebar: "#1E2B30",
      "sidebar-foreground": "#BEC7D4",
      "sidebar-primary": "#59A487",
      "sidebar-primary-foreground": "#FFFFFF",
      "sidebar-accent": "#26353B",
      "sidebar-accent-foreground": "#D8DFE8",
      "sidebar-border": "#3A4C53",
      "sidebar-ring": "#59A487",
    },
    ui: { ...DEFAULT_UI, fontFamily: "lexend", radiusPx: 10 },
  },
  {
    id: "system-neon-noir",
    name: "Neon Noir",
    builtIn: true,
    light: {
      background: "#0D1020",
      foreground: "#E5ECFF",
      card: "#121632",
      "card-foreground": "#E5ECFF",
      popover: "#121632",
      "popover-foreground": "#E5ECFF",
      primary: "#00E5FF",
      "primary-foreground": "#04121A",
      secondary: "#1A1F43",
      "secondary-foreground": "#D7E2FF",
      muted: "#151938",
      "muted-foreground": "#98A6D8",
      accent: "#2B1E53",
      "accent-foreground": "#EFE7FF",
      destructive: "#FF4D6D",
      border: "#283061",
      input: "#283061",
      ring: "#A970FF",
      sidebar: "#0D1020",
      "sidebar-foreground": "#E5ECFF",
      "sidebar-primary": "#00E5FF",
      "sidebar-primary-foreground": "#04121A",
      "sidebar-accent": "#151938",
      "sidebar-accent-foreground": "#D7E2FF",
      "sidebar-border": "#283061",
      "sidebar-ring": "#A970FF",
    },
    dark: {
      background: "#090B17",
      foreground: "#EAF0FF",
      card: "#0E1228",
      "card-foreground": "#EAF0FF",
      popover: "#0E1228",
      "popover-foreground": "#EAF0FF",
      primary: "#00E5FF",
      "primary-foreground": "#04121A",
      secondary: "#161A37",
      "secondary-foreground": "#D7E2FF",
      muted: "#13162D",
      "muted-foreground": "#95A2D2",
      accent: "#2B1E53",
      "accent-foreground": "#EFE7FF",
      destructive: "#FF4D6D",
      border: "#242B56",
      input: "#242B56",
      ring: "#A970FF",
      sidebar: "#090B17",
      "sidebar-foreground": "#EAF0FF",
      "sidebar-primary": "#00E5FF",
      "sidebar-primary-foreground": "#04121A",
      "sidebar-accent": "#13162D",
      "sidebar-accent-foreground": "#D7E2FF",
      "sidebar-border": "#242B56",
      "sidebar-ring": "#A970FF",
    },
    ui: { ...DEFAULT_UI, fontFamily: "rubik", radiusPx: 12 },
  },
  {
    id: "system-solar-dusk",
    name: "Solar Dusk",
    builtIn: true,
    light: {
      background: "#FFF6E9",
      foreground: "#2A1B14",
      card: "#FFF1DF",
      "card-foreground": "#2A1B14",
      popover: "#FFF1DF",
      "popover-foreground": "#2A1B14",
      primary: "#F97316",
      "primary-foreground": "#FFF7ED",
      secondary: "#FEE7C7",
      "secondary-foreground": "#4A2D20",
      muted: "#FCE2C4",
      "muted-foreground": "#8A5A3F",
      accent: "#FDBA74",
      "accent-foreground": "#3A2117",
      destructive: "#C2410C",
      border: "#F2CDA3",
      input: "#F2CDA3",
      ring: "#EA580C",
      sidebar: "#FFF6E9",
      "sidebar-foreground": "#2A1B14",
      "sidebar-primary": "#F97316",
      "sidebar-primary-foreground": "#FFF7ED",
      "sidebar-accent": "#FCE2C4",
      "sidebar-accent-foreground": "#4A2D20",
      "sidebar-border": "#F2CDA3",
      "sidebar-ring": "#EA580C",
    },
    dark: {
      background: "#1F140F",
      foreground: "#FFE8D2",
      card: "#281A14",
      "card-foreground": "#FFE8D2",
      popover: "#281A14",
      "popover-foreground": "#FFE8D2",
      primary: "#FB923C",
      "primary-foreground": "#2F1608",
      secondary: "#3B271D",
      "secondary-foreground": "#FFD9BA",
      muted: "#322118",
      "muted-foreground": "#D39D76",
      accent: "#4A2E20",
      "accent-foreground": "#FFE8D2",
      destructive: "#F87171",
      border: "#5B3A29",
      input: "#5B3A29",
      ring: "#FB923C",
      sidebar: "#1F140F",
      "sidebar-foreground": "#FFE8D2",
      "sidebar-primary": "#FB923C",
      "sidebar-primary-foreground": "#2F1608",
      "sidebar-accent": "#322118",
      "sidebar-accent-foreground": "#FFD9BA",
      "sidebar-border": "#5B3A29",
      "sidebar-ring": "#FB923C",
    },
    ui: { ...DEFAULT_UI, fontFamily: "work-sans", radiusPx: 10 },
  },
  {
    id: "system-forest-mist",
    name: "Forest Mist",
    builtIn: true,
    light: {
      background: "#EDF4EF",
      foreground: "#1D2A23",
      card: "#F4F8F5",
      "card-foreground": "#1D2A23",
      popover: "#F4F8F5",
      "popover-foreground": "#1D2A23",
      primary: "#2F855A",
      "primary-foreground": "#F0FFF4",
      secondary: "#DCEADD",
      "secondary-foreground": "#274133",
      muted: "#D5E4D7",
      "muted-foreground": "#567364",
      accent: "#B7D7C0",
      "accent-foreground": "#1F3428",
      destructive: "#B83232",
      border: "#B8CDBD",
      input: "#B8CDBD",
      ring: "#2F855A",
      sidebar: "#EDF4EF",
      "sidebar-foreground": "#1D2A23",
      "sidebar-primary": "#2F855A",
      "sidebar-primary-foreground": "#F0FFF4",
      "sidebar-accent": "#D5E4D7",
      "sidebar-accent-foreground": "#274133",
      "sidebar-border": "#B8CDBD",
      "sidebar-ring": "#2F855A",
    },
    dark: {
      background: "#0F1713",
      foreground: "#DCE9DF",
      card: "#142019",
      "card-foreground": "#DCE9DF",
      popover: "#142019",
      "popover-foreground": "#DCE9DF",
      primary: "#68D391",
      "primary-foreground": "#0D2418",
      secondary: "#1E2C24",
      "secondary-foreground": "#D3E6DA",
      muted: "#1A271F",
      "muted-foreground": "#8FB39D",
      accent: "#223329",
      "accent-foreground": "#DCE9DF",
      destructive: "#FC8181",
      border: "#2B4033",
      input: "#2B4033",
      ring: "#68D391",
      sidebar: "#0F1713",
      "sidebar-foreground": "#DCE9DF",
      "sidebar-primary": "#68D391",
      "sidebar-primary-foreground": "#0D2418",
      "sidebar-accent": "#1A271F",
      "sidebar-accent-foreground": "#D3E6DA",
      "sidebar-border": "#2B4033",
      "sidebar-ring": "#68D391",
    },
    ui: { ...DEFAULT_UI, fontFamily: "manrope", radiusPx: 9 },
  },
  {
    id: "system-vaporwave",
    name: "Vaporwave",
    builtIn: true,
    light: {
      background: "#FFF0FA",
      foreground: "#341247",
      card: "#FFE4F6",
      "card-foreground": "#341247",
      popover: "#FFE4F6",
      "popover-foreground": "#341247",
      primary: "#FF3CAC",
      "primary-foreground": "#FFFFFF",
      secondary: "#F6D2FF",
      "secondary-foreground": "#4A1C66",
      muted: "#F1CCFF",
      "muted-foreground": "#7A4A97",
      accent: "#6A5CFF",
      "accent-foreground": "#FFFFFF",
      destructive: "#FF4D6D",
      border: "#E0A6FF",
      input: "#E0A6FF",
      ring: "#00E0FF",
      sidebar: "#FFF0FA",
      "sidebar-foreground": "#341247",
      "sidebar-primary": "#FF3CAC",
      "sidebar-primary-foreground": "#FFFFFF",
      "sidebar-accent": "#F1CCFF",
      "sidebar-accent-foreground": "#4A1C66",
      "sidebar-border": "#E0A6FF",
      "sidebar-ring": "#00E0FF",
    },
    dark: {
      background: "#130A1F",
      foreground: "#FCEBFF",
      card: "#1B0F2B",
      "card-foreground": "#FCEBFF",
      popover: "#1B0F2B",
      "popover-foreground": "#FCEBFF",
      primary: "#FF3CAC",
      "primary-foreground": "#2B071E",
      secondary: "#2A1944",
      "secondary-foreground": "#F5D9FF",
      muted: "#24153B",
      "muted-foreground": "#C79DE2",
      accent: "#6A5CFF",
      "accent-foreground": "#FFFFFF",
      destructive: "#FF4D6D",
      border: "#433067",
      input: "#433067",
      ring: "#00E0FF",
      sidebar: "#130A1F",
      "sidebar-foreground": "#FCEBFF",
      "sidebar-primary": "#FF3CAC",
      "sidebar-primary-foreground": "#2B071E",
      "sidebar-accent": "#24153B",
      "sidebar-accent-foreground": "#F5D9FF",
      "sidebar-border": "#433067",
      "sidebar-ring": "#00E0FF",
    },
    ui: { ...DEFAULT_UI, fontFamily: "montserrat", radiusPx: 14 },
  },
  {
    id: "system-crt-phosphor",
    name: "CRT Phosphor",
    builtIn: true,
    light: {
      background: "#E8FFE6",
      foreground: "#17331A",
      card: "#DFF7DC",
      "card-foreground": "#17331A",
      popover: "#DFF7DC",
      "popover-foreground": "#17331A",
      primary: "#1E9E38",
      "primary-foreground": "#EFFFF0",
      secondary: "#CFEFCC",
      "secondary-foreground": "#1B4A21",
      muted: "#C5E8C1",
      "muted-foreground": "#3A6A3F",
      accent: "#AEE6AE",
      "accent-foreground": "#17401D",
      destructive: "#C53030",
      border: "#99C79A",
      input: "#99C79A",
      ring: "#2BB24A",
      sidebar: "#E8FFE6",
      "sidebar-foreground": "#17331A",
      "sidebar-primary": "#1E9E38",
      "sidebar-primary-foreground": "#EFFFF0",
      "sidebar-accent": "#C5E8C1",
      "sidebar-accent-foreground": "#1B4A21",
      "sidebar-border": "#99C79A",
      "sidebar-ring": "#2BB24A",
    },
    dark: {
      background: "#050A06",
      foreground: "#9BFFA7",
      card: "#0A110B",
      "card-foreground": "#9BFFA7",
      popover: "#0A110B",
      "popover-foreground": "#9BFFA7",
      primary: "#3BFF73",
      "primary-foreground": "#05230D",
      secondary: "#102014",
      "secondary-foreground": "#9BFFA7",
      muted: "#0D1A11",
      "muted-foreground": "#69C676",
      accent: "#133019",
      "accent-foreground": "#9BFFA7",
      destructive: "#FF6666",
      border: "#1E3A24",
      input: "#1E3A24",
      ring: "#3BFF73",
      sidebar: "#050A06",
      "sidebar-foreground": "#9BFFA7",
      "sidebar-primary": "#3BFF73",
      "sidebar-primary-foreground": "#05230D",
      "sidebar-accent": "#0D1A11",
      "sidebar-accent-foreground": "#9BFFA7",
      "sidebar-border": "#1E3A24",
      "sidebar-ring": "#3BFF73",
    },
    ui: { ...DEFAULT_UI, fontFamily: "system", radiusPx: 4 },
  },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const normalizeHex = (value: string, fallback: string) => {
  const source = (value || "")
    .replace("#", "")
    .replace(/[^0-9a-fA-F]/g, "")
    .slice(0, 6)
    .padEnd(6, "0");
  const fallbackHex = fallback
    .replace("#", "")
    .replace(/[^0-9a-fA-F]/g, "")
    .slice(0, 6)
    .padEnd(6, "0");
  return `#${(source || fallbackHex).toUpperCase()}`;
};

const sanitizePalette = (
  candidate: unknown,
  fallback: ThemePalette,
): ThemePalette => {
  const safeCandidate =
    candidate && typeof candidate === "object"
      ? (candidate as Partial<Record<ThemeVariable, string>>)
      : {};

  const palette = {} as ThemePalette;
  for (const key of THEME_VARIABLES) {
    const next = safeCandidate[key] || fallback[key];
    palette[key] = normalizeHex(String(next), fallback[key]);
  }
  return palette;
};

const sanitizeThemeUi = (candidate: unknown): ThemeUiSettings => {
  if (!candidate || typeof candidate !== "object") {
    return { ...DEFAULT_UI };
  }

  const safe = candidate as Partial<ThemeUiSettings>;
  const fontScale = clamp(
    Number(safe.fontScale ?? DEFAULT_UI.fontScale),
    0.8,
    1.6,
  );
  const radiusPx = clamp(Number(safe.radiusPx ?? DEFAULT_UI.radiusPx), 0, 24);
  const fontFamily = THEME_FONT_OPTIONS.some(
    (item) => item.key === safe.fontFamily,
  )
    ? (safe.fontFamily as ThemeFontFamily)
    : DEFAULT_UI.fontFamily;

  return {
    fontScale: Number.isFinite(fontScale)
      ? Number(fontScale.toFixed(2))
      : DEFAULT_UI.fontScale,
    radiusPx: Number.isFinite(radiusPx)
      ? Number(radiusPx.toFixed(1))
      : DEFAULT_UI.radiusPx,
    fontFamily,
  };
};

const resolveThemeFontStack = (family: ThemeFontFamily): string => {
  return (
    THEME_FONT_OPTIONS.find((item) => item.key === family)?.cssValue ||
    THEME_FONT_OPTIONS[0].cssValue
  );
};

const colorStringToHex = (value: string, fallback: string): string => {
  if (typeof document === "undefined") return fallback;
  if (!value) return fallback;

  const probe = document.createElement("span");
  const mountTarget = document.body || document.documentElement;
  probe.style.color = value;
  mountTarget.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();

  const match = computed.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!match) return fallback;

  const toHex = (channel: string) =>
    Number.parseInt(channel, 10).toString(16).padStart(2, "0").toUpperCase();

  return `#${toHex(match[1])}${toHex(match[2])}${toHex(match[3])}`;
};

const getCssVarFromStyles = (
  variable: string,
  mode: ThemePreference,
): string | null => {
  if (typeof document === "undefined") return null;

  let rootValue: string | null = null;
  let darkValue: string | null = null;

  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }

    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSStyleRule)) continue;
      const selector = rule.selectorText;
      if (selector === ":root") {
        const value = rule.style.getPropertyValue(variable).trim();
        if (value) rootValue = value;
      }
      if (selector === ".dark") {
        const value = rule.style.getPropertyValue(variable).trim();
        if (value) darkValue = value;
      }
    }
  }

  return mode === "dark" ? darkValue || rootValue : rootValue || darkValue;
};

const getRuntimeDefaultPalette = (
  mode: ThemePreference,
  fallback: ThemePalette,
): ThemePalette => {
  if (typeof document === "undefined") return fallback;

  const result = {} as ThemePalette;
  for (const key of THEME_VARIABLES) {
    const token = getCssVarFromStyles(`--${key}`, mode);
    result[key] = colorStringToHex(token || fallback[key], fallback[key]);
  }
  return result;
};

const withUnifiedSurface = (theme: AppThemeDefinition): AppThemeDefinition => ({
  ...theme,
  light: {
    ...theme.light,
    card: theme.light.background,
    "card-foreground": theme.light.foreground,
    popover: theme.light.background,
    "popover-foreground": theme.light.foreground,
  },
  dark: {
    ...theme.dark,
    card: theme.dark.background,
    "card-foreground": theme.dark.foreground,
    popover: theme.dark.background,
    "popover-foreground": theme.dark.foreground,
  },
});

const getBuiltInThemes = (): AppThemeDefinition[] => {
  const baseLight = getRuntimeDefaultPalette("light", DEFAULT_LIGHT);
  const baseDark = getRuntimeDefaultPalette("dark", DEFAULT_DARK);

  const runtimeDefault = withUnifiedSurface({
    id: DEFAULT_THEME_ID,
    name: "Default",
    builtIn: true,
    light: baseLight,
    dark: baseDark,
    ui: { ...DEFAULT_UI },
  });

  const presets = SYSTEM_PRESETS.map((theme) =>
    withUnifiedSurface({
      ...theme,
      light: sanitizePalette(theme.light, runtimeDefault.light),
      dark: sanitizePalette(theme.dark, runtimeDefault.dark),
      ui: sanitizeThemeUi(theme.ui),
      builtIn: true,
    }),
  );

  return [runtimeDefault, ...presets];
};

const emitThemeChange = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
};

const getStoredThemePreference = (): ThemePreference => {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(THEME_PREFERENCE_KEY);
  return stored === "light" ? "light" : "dark";
};

const getStoredThemeLibrary = (): AppThemeDefinition[] => {
  const builtIns = getBuiltInThemes();
  const defaultTheme = builtIns[0] || BASE_BUILT_IN_THEME;

  if (typeof window === "undefined") {
    return builtIns;
  }

  const stored = window.localStorage.getItem(THEME_LIBRARY_KEY);
  if (!stored) {
    return builtIns;
  }

  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return builtIns;
    }

    const mapped = parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const partial = item as Partial<AppThemeDefinition>;
        return {
          id:
            typeof partial.id === "string" && partial.id.trim()
              ? partial.id
              : crypto.randomUUID(),
          name:
            typeof partial.name === "string" && partial.name.trim()
              ? partial.name.trim()
              : "Custom Theme",
          builtIn: false,
          light: sanitizePalette(partial.light, defaultTheme.light),
          dark: sanitizePalette(partial.dark, defaultTheme.dark),
          ui: sanitizeThemeUi(partial.ui),
        } satisfies AppThemeDefinition;
      })
      .filter((item) => !BUILT_IN_THEME_IDS.has(item.id));

    return [...builtIns, ...mapped];
  } catch {
    return builtIns;
  }
};

const persistThemeLibrary = (themes: AppThemeDefinition[]) => {
  if (typeof window === "undefined") return;
  const customThemes = themes.filter((theme) => !theme.builtIn);
  window.localStorage.setItem(THEME_LIBRARY_KEY, JSON.stringify(customThemes));
};

export const clearThemeStorage = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(THEME_LIBRARY_KEY);
  window.localStorage.removeItem(ACTIVE_THEME_KEY);
};

export const getThemeLibrary = (): AppThemeDefinition[] =>
  getStoredThemeLibrary();

export const getActiveThemeId = (): string => {
  if (typeof window === "undefined") return DEFAULT_THEME_ID;
  return window.localStorage.getItem(ACTIVE_THEME_KEY) || DEFAULT_THEME_ID;
};

export const getActiveTheme = (): AppThemeDefinition => {
  const themes = getStoredThemeLibrary();
  const activeId = getActiveThemeId();
  return (
    themes.find((theme) => theme.id === activeId) ||
    themes[0] ||
    BASE_BUILT_IN_THEME
  );
};

export const setActiveThemeId = (themeId: string) => {
  if (typeof window === "undefined") return;
  const themes = getStoredThemeLibrary();
  const exists = themes.some((theme) => theme.id === themeId);
  const resolved = exists ? themeId : DEFAULT_THEME_ID;
  window.localStorage.setItem(ACTIVE_THEME_KEY, resolved);
  applyThemeFromStorage();
  emitThemeChange();
};

export const createThemeFromBase = (
  name: string,
  baseTheme: AppThemeDefinition,
): AppThemeDefinition => {
  const next: AppThemeDefinition = {
    id: crypto.randomUUID(),
    name: name.trim() || "Custom Theme",
    builtIn: false,
    light: { ...baseTheme.light },
    dark: { ...baseTheme.dark },
    ui: sanitizeThemeUi(baseTheme.ui),
  };

  const themes = getStoredThemeLibrary();
  const updated = [...themes, next];
  persistThemeLibrary(updated);
  emitThemeChange();
  return next;
};

export const updateTheme = (theme: AppThemeDefinition): AppThemeDefinition => {
  if (theme.builtIn || theme.id === DEFAULT_THEME_ID) {
    return getBuiltInTheme();
  }

  const defaultTheme = getBuiltInTheme();
  const normalized: AppThemeDefinition = {
    id: theme.id,
    name: theme.name.trim() || "Custom Theme",
    builtIn: false,
    light: sanitizePalette(theme.light, defaultTheme.light),
    dark: sanitizePalette(theme.dark, defaultTheme.dark),
    ui: sanitizeThemeUi(theme.ui),
  };

  const themes = getStoredThemeLibrary();
  const updated = themes.map((item) =>
    item.id === normalized.id ? normalized : item,
  );
  persistThemeLibrary(updated);

  if (getActiveThemeId() === normalized.id) {
    applyThemeFromStorage();
  }

  emitThemeChange();
  return normalized;
};

export const deleteTheme = (themeId: string) => {
  if (BUILT_IN_THEME_IDS.has(themeId)) return;
  const themes = getStoredThemeLibrary();
  const updated = themes.filter((theme) => theme.id !== themeId);
  persistThemeLibrary(updated);

  if (getActiveThemeId() === themeId) {
    setActiveThemeId(DEFAULT_THEME_ID);
  } else {
    emitThemeChange();
  }
};

export const resetThemeDefaults = () => {
  if (typeof window === "undefined") return;
  clearThemeStorage();
  applyThemeFromStorage();
  emitThemeChange();
};

export const applyTheme = (
  theme: AppThemeDefinition,
  mode: ThemePreference,
) => {
  if (typeof document === "undefined") return;

  if (mode === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }

  const uiSettings = sanitizeThemeUi(theme.ui);
  const appZoomScale = getAppZoomScale(getAppZoomLevel());
  const resolvedFontStack = resolveThemeFontStack(uiSettings.fontFamily);
  ensureGoogleFontLoaded(uiSettings.fontFamily);
  document.documentElement.style.fontSize = `${uiSettings.fontScale * 16}px`;
  void applyWebviewZoom(appZoomScale);
  document.documentElement.style.setProperty(
    "--radius",
    `${uiSettings.radiusPx}px`,
  );
  document.documentElement.style.setProperty(
    "--font-lexend",
    resolvedFontStack,
  );
  document.documentElement.style.setProperty(
    "--app-font-family",
    resolvedFontStack,
  );
  document.documentElement.style.fontFamily = resolvedFontStack;
  if (document.body) {
    document.body.style.fontFamily = resolvedFontStack;
  }

  if (theme.id === DEFAULT_THEME_ID) {
    for (const key of THEME_VARIABLES) {
      document.documentElement.style.removeProperty(`--${key}`);
    }
    return;
  }

  const palette = mode === "dark" ? theme.dark : theme.light;
  for (const key of THEME_VARIABLES) {
    document.documentElement.style.setProperty(`--${key}`, palette[key]);
  }
};

export const applyThemeFromStorage = () => {
  if (typeof window === "undefined") return;
  applyTheme(getActiveTheme(), getStoredThemePreference());
};

export const subscribeThemeChanges = (onChange: () => void) => {
  if (typeof window === "undefined") return () => {};
  const handler = () => onChange();
  window.addEventListener(THEME_CHANGE_EVENT, handler);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, handler);
};

export const toThemeFilePayload = (
  theme: AppThemeDefinition,
): ThemeFilePayload => ({
  type: "jokerforge-theme",
  version: 1,
  theme: {
    name: theme.name,
    light: { ...theme.light },
    dark: { ...theme.dark },
    ui: sanitizeThemeUi(theme.ui),
  },
});

export const parseThemeFilePayload = (
  raw: unknown,
): Omit<AppThemeDefinition, "id" | "builtIn"> | null => {
  const defaultTheme = getBuiltInTheme();
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as Partial<ThemeFilePayload>;
  if (payload.type !== "jokerforge-theme" || payload.version !== 1) {
    return null;
  }

  const candidate = payload.theme;
  if (!candidate || typeof candidate !== "object") return null;

  const next = candidate as Partial<Omit<AppThemeDefinition, "id" | "builtIn">>;
  return {
    name:
      typeof next.name === "string" && next.name.trim()
        ? next.name.trim()
        : "Imported Theme",
    light: sanitizePalette(next.light, defaultTheme.light),
    dark: sanitizePalette(next.dark, defaultTheme.dark),
    ui: sanitizeThemeUi(next.ui),
  };
};

export const createThemeFromImported = (
  importedTheme: Omit<AppThemeDefinition, "id" | "builtIn">,
): AppThemeDefinition => {
  const defaultTheme = getBuiltInTheme();
  const next: AppThemeDefinition = {
    id: crypto.randomUUID(),
    name: importedTheme.name,
    builtIn: false,
    light: sanitizePalette(importedTheme.light, defaultTheme.light),
    dark: sanitizePalette(importedTheme.dark, defaultTheme.dark),
    ui: sanitizeThemeUi(importedTheme.ui),
  };

  const themes = getStoredThemeLibrary();
  const updated = [...themes, next];
  persistThemeLibrary(updated);
  emitThemeChange();
  return next;
};

export const getBuiltInTheme = (): AppThemeDefinition =>
  getBuiltInThemes()[0] || BASE_BUILT_IN_THEME;
