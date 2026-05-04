import { useEffect, useRef, useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { TitleBar } from "./title-bar";
import { motion } from "framer-motion";
import { GlobalAlerts } from "./global-alerts";
import { useAlertQueue } from "@/hooks/use-alert-queue";
import { runBalatroAutofind } from "@/lib/balatro-autofind";
import {
  GLOBAL_ALERTS_EVENT,
  type GlobalAlertsEventDetail,
} from "@/lib/global-alerts-bus";

interface MainLayoutProps {
  children: React.ReactNode;
  pageTitle?: string;
}

export function MainLayout({ children, pageTitle }: MainLayoutProps) {
  const [isPinned, setIsPinned] = useState(false);
  const [isHoverOpen, setIsHoverOpen] = useState(false);
  const [hasOpenDialog, setHasOpenDialog] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPointerOverSidebarRef = useRef(false);
  const { alerts, pushAlerts, dismissAlert } = useAlertQueue();

  const isVisible = isPinned || isHoverOpen;

  const handleMouseEnter = () => {
    if (hasOpenDialog) return;
    isPointerOverSidebarRef.current = true;
    if (isPinned) return;
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHoverOpen(true);
  };

  const handleMouseLeave = () => {
    if (hasOpenDialog) return;
    isPointerOverSidebarRef.current = false;
    if (isPinned) return;
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHoverOpen(false);
    }, 150);
  };

  useEffect(() => {
    if (isPinned) return;

    const EDGE_TRIGGER_WIDTH = 260;
    const TITLEBAR_HEIGHT = 36;

    const handleMouseMove = (event: MouseEvent) => {
      if (hasOpenDialog) return;
      const isInEdgeZone =
        event.clientX <= EDGE_TRIGGER_WIDTH && event.clientY >= TITLEBAR_HEIGHT;

      if (isInEdgeZone) {
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
          hoverTimeoutRef.current = null;
        }
        if (!isHoverOpen) {
          setIsHoverOpen(true);
        }
        return;
      }

      if (isPointerOverSidebarRef.current) {
        return;
      }

      if (!hoverTimeoutRef.current) {
        hoverTimeoutRef.current = setTimeout(() => {
          setIsHoverOpen(false);
          hoverTimeoutRef.current = null;
        }, 150);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
    };
  }, [hasOpenDialog, isHoverOpen, isPinned]);

  useEffect(() => {
    const syncDialogState = () => {
      const openDialogs = document.querySelectorAll("[data-slot='dialog-content']");
      setHasOpenDialog(openDialogs.length > 0);
    };

    syncDialogState();
    const observer = new MutationObserver(syncDialogState);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (hasOpenDialog && !isPinned) {
      setIsHoverOpen(false);
    }
  }, [hasOpenDialog, isPinned]);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      const nextAlerts = await runBalatroAutofind();
      if (!isMounted) return;
      pushAlerts(nextAlerts);
    };
    void init();
    return () => {
      isMounted = false;
    };
  }, [pushAlerts]);

  useEffect(() => {
    const handleGlobalAlerts = (event: Event) => {
      const customEvent = event as CustomEvent<GlobalAlertsEventDetail>;
      const nextAlerts = customEvent.detail?.alerts ?? [];
      pushAlerts(nextAlerts);
    };

    window.addEventListener(GLOBAL_ALERTS_EVENT, handleGlobalAlerts);
    return () => {
      window.removeEventListener(GLOBAL_ALERTS_EVENT, handleGlobalAlerts);
    };
  }, [pushAlerts]);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-foreground transition-colors duration-300">
      <TitleBar />

      <div className="pt-9 z-40 relative">
        <Sidebar
          isVisible={isVisible}
          isPinned={isPinned}
          onTogglePin={() => {
            setIsPinned(!isPinned);
            if (isPinned) setIsHoverOpen(true);
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden transition-all duration-300 ease-in-out pt-9">
        <Header title={pageTitle} />

        <motion.main
          className="flex-1 overflow-y-auto px-4 py-8 md:p-8"
          animate={{ paddingLeft: isPinned ? "288px" : "32px" }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <GlobalAlerts alerts={alerts} onDismiss={dismissAlert} />
          {children}
        </motion.main>
      </div>
    </div>
  );
}
