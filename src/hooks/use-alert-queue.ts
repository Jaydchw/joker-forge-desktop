import { useCallback, useEffect, useRef, useState } from "react";
import type { GlobalAlert } from "@/components/layout/global-alerts";

type UseAlertQueueOptions = {
  dismissAfterMs?: number;
};

export const useAlertQueue = (options: UseAlertQueueOptions = {}) => {
  const dismissAfterMs = options.dismissAfterMs ?? 4500;
  const [alerts, setAlerts] = useState<GlobalAlert[]>([]);
  const timeoutRef = useRef<Map<string, number>>(new Map());

  const pushAlerts = useCallback((nextAlerts: GlobalAlert[]) => {
    if (nextAlerts.length === 0) return;
    setAlerts((prev) => [...nextAlerts, ...prev]);
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
    const timeoutId = timeoutRef.current.get(id);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutRef.current.delete(id);
    }
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
  }, [alerts, dismissAfterMs]);

  return { alerts, pushAlerts, dismissAlert };
};
