import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeRuleCatalogFromRust } from "@/components/rule-builder/rule-catalog";
import { applyThemeFromStorage } from "./lib/theme-manager";
import { initPostHog } from "./lib/posthog";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);

async function bootstrap() {
  applyThemeFromStorage();
  initPostHog();

  try {
    await initializeRuleCatalogFromRust();
  } catch (error) {
    console.error("Failed to initialize Rust catalog", error);
  }

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );

  const resetCursor = () => {
    if (typeof document === "undefined") return;
    document.documentElement.style.cursor = "default";
    document.body.style.cursor = "default";
  };

  // Guard against WebView occasionally keeping a startup "busy" cursor.
  requestAnimationFrame(() => {
    resetCursor();
    window.setTimeout(resetCursor, 250);
  });
}

void bootstrap();
