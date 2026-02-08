import { createPortal } from "react-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";

export type GlobalAlert = {
  id: string;
  type: "success" | "danger" | "caution" | "info";
  title: string;
  message: string;
};

type GlobalAlertsProps = {
  alerts: GlobalAlert[];
  onDismiss: (id: string) => void;
};

export function GlobalAlerts({ alerts, onDismiss }: GlobalAlertsProps) {
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
              onClick={() => onDismiss(alert.id)}
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
                <AlertTitle className="font-semibold">{alert.title}</AlertTitle>
                <AlertDescription>
                  {alert.message.split("\n").map((line, index) => (
                    <p
                      key={`${alert.id}-line-${index}`}
                      className={index > 0 ? "font-mono text-xs" : undefined}
                    >
                      {line}
                    </p>
                  ))}
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
