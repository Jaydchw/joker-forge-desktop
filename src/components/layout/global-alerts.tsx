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
    <div className="fixed left-1/2 top-12 z-[80] w-full max-w-sm -translate-x-1/2 px-4">
      <AnimatePresence initial={false}>
        {alerts.map((alert) => {
          const isSuccess = alert.type === "success";
          const iconClass = {
            success: "text-emerald-300",
            danger: "text-red-300",
            caution: "text-amber-200",
            info: "text-sky-200",
          }[alert.type];
          const variantClasses = {
            success:
              "border-emerald-500/35 bg-emerald-950/45 text-white [&_[data-slot=alert-description]]:text-white/75",
            danger:
              "border-red-500/40 bg-red-950/45 text-white [&_[data-slot=alert-description]]:text-white/75",
            caution:
              "border-amber-500/40 bg-amber-950/45 text-white [&_[data-slot=alert-description]]:text-white/75",
            info: "border-sky-500/40 bg-sky-950/45 text-white [&_[data-slot=alert-description]]:text-white/75",
          }[alert.type];

          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: -24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="mb-2 cursor-pointer last:mb-0"
              whileHover={{ opacity: 0.9 }}
              onClick={() => onDismiss(alert.id)}
            >
              <Alert
                variant={isSuccess ? "default" : "destructive"}
                className={`rounded-lg border px-3 py-2 shadow-md backdrop-blur-sm ${variantClasses}`}
              >
                {isSuccess ? (
                  <CheckCircle className={`size-4 ${iconClass}`} weight="fill" />
                ) : (
                  <WarningCircle className={`size-4 ${iconClass}`} weight="fill" />
                )}
                <AlertTitle className="text-[13px] font-semibold leading-tight">
                  {alert.title}
                </AlertTitle>
                <AlertDescription className="text-xs leading-snug">
                  {alert.message.split("\n").map((line, index) => (
                    <p
                      key={`${alert.id}-line-${index}`}
                      className={index > 0 ? "font-mono text-[11px]" : undefined}
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
