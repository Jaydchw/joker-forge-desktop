import type { GlobalAlert } from "@/components/layout/global-alerts";

export const GLOBAL_ALERTS_EVENT = "joker_forge:push_global_alerts";

export interface GlobalAlertsEventDetail {
  alerts: GlobalAlert[];
}

const createAlertId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const pushGlobalAlerts = (alerts: GlobalAlert[]) => {
  if (typeof window === "undefined" || alerts.length === 0) return;

  window.dispatchEvent(
    new CustomEvent<GlobalAlertsEventDetail>(GLOBAL_ALERTS_EVENT, {
      detail: { alerts },
    }),
  );
};

export const pushGlobalAlert = (
  alert: Omit<GlobalAlert, "id"> & { id?: string },
) => {
  pushGlobalAlerts([
    {
      ...alert,
      id: alert.id || createAlertId(),
    },
  ]);
};
