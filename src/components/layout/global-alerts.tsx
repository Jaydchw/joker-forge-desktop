import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  getBalatroAutofindAlertShown,
  getBalatroAutofindResult,
  getBalatroInstallPath,
  setBalatroAutofindAlertShown,
  setBalatroAutofindResult,
  setBalatroInstallPath,
} from "@/lib/storage";
import { homeDir, join } from "@tauri-apps/api/path";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";

type GlobalAlert = {
  id: string;
  type: "success" | "danger" | "caution" | "info";
  path?: string;
  message: string;
};

export function GlobalAlerts() {
  const [alerts, setAlerts] = useState<GlobalAlert[]>([]);
  const alertIdRef = useRef(0);
  const timeoutRef = useRef<Map<string, number>>(new Map());
  const dismissAfterMs = 4500;

  useEffect(() => {
    const init = async () => {
      const existingResult = getBalatroAutofindResult();
      const alertShown = getBalatroAutofindAlertShown();

      if (existingResult && alertShown) return;
      if (existingResult && !alertShown) {
        const storedPath = getBalatroInstallPath();
        alertIdRef.current += 1;
        setAlerts((prev) => [
          {
            id: `balatro-autofind-${alertIdRef.current}`,
            type: existingResult === "success" ? "success" : "danger",
            path: storedPath || undefined,
            message:
              existingResult === "success"
                ? "Balatro path was set earlier."
                : "Balatro path could not be determined earlier.",
          },
          ...prev,
        ]);
        setBalatroAutofindAlertShown(true);
        return;
      }

      try {
        const home = await homeDir();
        const base =
          home.endsWith("\\") || home.endsWith("/") ? home.slice(0, -1) : home;
        const rawPath = `${base}\\AppData\\Roaming\\Balatro`;
        setBalatroInstallPath(rawPath);
        setBalatroAutofindResult("success");

        if (!getBalatroAutofindAlertShown()) {
          alertIdRef.current += 1;
          setAlerts((prev) => [
            {
              id: `balatro-autofind-${alertIdRef.current}`,
              type: "success",
              path: rawPath,
              message: "Default Balatro path set (not verified)",
            },
            ...prev,
          ]);
          setBalatroAutofindAlertShown(true);
        }
      } catch {
        setBalatroAutofindResult("failure");
        if (!getBalatroAutofindAlertShown()) {
          alertIdRef.current += 1;
          setAlerts((prev) => [
            {
              id: `balatro-autofind-${alertIdRef.current}`,
              type: "danger",
              message: "Unable to determine the default Balatro path.",
            },
            ...prev,
          ]);
          setBalatroAutofindAlertShown(true);
        }
      }
    };

    void init();
  }, []);

  useEffect(() => {
    alerts.forEach((alert) => {
      if (timeoutRef.current.has(alert.id)) return;
      const timeoutId = window.setTimeout(() => {
        setAlerts((prev) => prev.filter((item) => item.id !== alert.id));
        timeoutRef.current.delete(alert.id);
      }, dismissAfterMs);
      timeoutRef.current.set(alert.id, timeoutId);
    });

    return () => {
      timeoutRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      timeoutRef.current.clear();
    };
  }, [alerts]);

  if (alerts.length === 0 || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed left-1/2 top-6 z-50 w-full max-w-md -translate-x-1/2 px-4">
      <AnimatePresence initial={false}>
        {alerts.map((alert) => {
          const isSuccess = alert.type === "success";
          const variantClasses = {
            success:
              "border-emerald-500/40 bg-emerald-950/70 text-white [&_[data-slot=alert-description]]:text-white/80",
            danger:
              "border-red-500/50 bg-red-950/70 text-white [&_[data-slot=alert-description]]:text-white/80",
            caution:
              "border-amber-500/50 bg-amber-950/70 text-white [&_[data-slot=alert-description]]:text-white/80",
            info: "border-sky-500/50 bg-sky-950/70 text-white [&_[data-slot=alert-description]]:text-white/80",
          }[alert.type];

          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: -24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="cursor-pointer"
              whileHover={{ opacity: 0.82 }}
              onClick={() =>
                setAlerts((prev) => prev.filter((item) => item.id !== alert.id))
              }
            >
              <Alert
                variant={isSuccess ? "default" : "destructive"}
                className={`border shadow-lg backdrop-blur ${variantClasses}`}
              >
                {isSuccess ? (
                  <CheckCircle className="text-primary" weight="fill" />
                ) : (
                  <WarningCircle className="text-destructive" weight="fill" />
                )}
                <AlertTitle className="font-semibold">
                  {isSuccess
                    ? "Balatro path detected"
                    : "Balatro path not available"}
                </AlertTitle>
                <AlertDescription>
                  <p>{alert.message}</p>
                  {alert.path ? (
                    <p className="font-mono text-xs text-foreground/80 break-all">
                      {alert.path}
                    </p>
                  ) : null}
                </AlertDescription>
              </Alert>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
