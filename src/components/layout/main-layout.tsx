import { useEffect, useRef, useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { TitleBar } from "./title-bar";
import { motion } from "framer-motion";
import { GlobalAlerts } from "./global-alerts";
import { useAlertQueue } from "@/hooks/use-alert-queue";
import { runBalatroAutofind } from "@/lib/balatro-autofind";

interface MainLayoutProps {
  children: React.ReactNode;
  pageTitle?: string;
}

export function MainLayout({ children, pageTitle }: MainLayoutProps) {
  const [isPinned, setIsPinned] = useState(false);
  const [isHoverOpen, setIsHoverOpen] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { alerts, pushAlerts, dismissAlert } = useAlertQueue();

  const isVisible = isPinned || isHoverOpen;

  const handleMouseEnter = () => {
    if (isPinned) return;
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHoverOpen(true);
  };

  const handleMouseLeave = () => {
    if (isPinned) return;
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHoverOpen(false);
    }, 150);
  };

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

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-lexend text-foreground transition-colors duration-300">
      <TitleBar />

      {!isPinned && (
        <div
          className="fixed left-0 top-0 mt-9 z-40 h-[calc(100vh-2.25rem)] w-96"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />
      )}

      <div className="pt-9 z-50 relative">
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
