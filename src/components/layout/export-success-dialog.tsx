import { useEffect, useState, useMemo } from "react";
import {
  Copy,
  FolderOpen,
  CheckCircle,
  Play,
  BookOpenText,
  Bug,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getBalatroGamePath } from "@/lib/services/storage";

interface ExportSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modFolderPath: string;
  fileCount: number;
}

export function ExportSuccessDialog({
  open,
  onOpenChange,
  modFolderPath,
  fileCount,
}: ExportSuccessDialogProps) {
  const [copied, setCopied] = useState(false);
  const [openFolderError, setOpenFolderError] = useState<string | null>(null);
  const [openBalatroError, setOpenBalatroError] = useState<string | null>(null);
  const [canOpenBalatro, setCanOpenBalatro] = useState(false);

  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 2,
        duration: 1.5 + Math.random() * 2,
        color: [
          "bg-primary",
          "bg-accent",
          "bg-blue-500",
          "bg-purple-500",
          "bg-pink-500",
        ][Math.floor(Math.random() * 5)],
      })),
    [],
  );

  useEffect(() => {
    if (!open) {
      setCopied(false);
      setOpenFolderError(null);
      setOpenBalatroError(null);
      setCanOpenBalatro(false);
    }
  }, [open]);

  useEffect(() => {
    let active = true;
    const checkBalatro = async () => {
      if (!open) return;
      const gamePath = getBalatroGamePath().trim();
      if (!gamePath) {
        if (active) setCanOpenBalatro(false);
        return;
      }
      try {
        const canLaunch = await invoke<boolean>("can_launch_balatro", {
          gamePath,
        });
        if (active) setCanOpenBalatro(canLaunch);
      } catch {
        if (active) setCanOpenBalatro(false);
      }
    };

    void checkBalatro();
    return () => {
      active = false;
    };
  }, [open]);

  const handleCopyPath = async () => {
    try {
      if (!modFolderPath) return;
      await navigator.clipboard.writeText(modFolderPath);
      setCopied(true);
      setOpenFolderError(null);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
      setOpenFolderError("Could not copy path to clipboard.");
    }
  };

  const handleOpenFolder = async () => {
    try {
      if (!modFolderPath) return;
      await invoke("open_folder_in_file_manager", { path: modFolderPath });
      setOpenFolderError(null);
    } catch {
      setOpenFolderError("Could not open the folder. Try Copy Path instead.");
    }
  };

  const handleOpenBalatro = async () => {
    try {
      const gamePath = getBalatroGamePath().trim();
      if (!gamePath) return;
      await invoke("launch_or_relaunch_balatro", { gamePath });
      setOpenBalatroError(null);
    } catch {
      setOpenBalatroError("Could not launch Balatro.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayContent={
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {confettiPieces.map((piece) => (
              <motion.div
                key={`confetti-${piece.id}`}
                className={`absolute top-0 h-3 w-1.5 rounded-full ${piece.color}`}
                style={{ left: `${piece.left}%` }}
                initial={{ opacity: 0, y: -20, rotate: 0 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  y: ["-5vh", "20vh", "60vh", "105vh"],
                  rotate: [0, 180, 360, 720],
                }}
                transition={{
                  duration: piece.duration,
                  repeat: Number.POSITIVE_INFINITY,
                  repeatDelay: Math.random() * 2,
                  delay: piece.delay,
                  ease: "linear",
                }}
              />
            ))}
          </div>
        }
        className="overflow-hidden border border-border/60 bg-card p-0 sm:max-w-2xl"
      >
        <div className="relative p-6 pb-2">
          <DialogHeader className="text-left space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" weight="duotone" />
              <DialogTitle className="text-xl font-semibold tracking-tight">
                Mod Exported
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground">
              Folder export complete. Your mod is ready to test.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/90">
              <FolderOpen className="h-3.5 w-3.5 text-primary" />
              <span>Export Location</span>
            </div>
            <div className="break-all font-mono text-sm text-foreground">
              {modFolderPath}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/90">
              <CheckCircle className="h-3.5 w-3.5 text-primary" />
              <span>Summary</span>
            </div>
            <div className="text-sm text-foreground">
              Wrote {fileCount} files to your mod folder.
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/90">
              <BookOpenText className="h-3.5 w-3.5 text-primary" />
              <span>Learn More About Modding</span>
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <a
                href="https://github.com/nh6574/VanillaRemade/wiki"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-2 hover:underline"
              >
                Vanilla Remade Wiki by N'
              </a>
              <a
                href="https://github.com/Steamodded/smods/wiki"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-2 hover:underline"
              >
                SMODS Official Wiki
              </a>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/90">
              <Bug className="h-3.5 w-3.5 text-primary" />
              <span>Found a Bug or Have Suggestions?</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Open an issue on{" "}
              <a
                href="https://github.com/Jaydchw/joker-forge/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-2 hover:underline"
              >
                GitHub
              </a>
              .
            </p>
          </div>
        </div>

        {openFolderError ? <div className="px-6 pb-1 text-xs text-destructive">{openFolderError}</div> : null}
        {openBalatroError ? <div className="px-6 pb-2 text-xs text-destructive">{openBalatroError}</div> : null}

        <DialogFooter className="flex w-full flex-col gap-2 border-t border-border/40 bg-muted/10 p-4 sm:flex-row sm:flex-wrap">
          <Button
            variant="outline"
            className="w-full cursor-pointer sm:flex-1"
            type="button"
            onClick={handleCopyPath}
          >
            <Copy className="mr-2 h-4 w-4" />
            {copied ? "Copied" : "Copy Path"}
          </Button>
          <Button
            variant="secondary"
            className="w-full cursor-pointer sm:flex-1"
            type="button"
            onClick={handleOpenFolder}
          >
            <FolderOpen className="mr-2 h-4 w-4" />
            Open Folder
          </Button>
          {canOpenBalatro ? (
            <Button
              variant="default"
              className="w-full cursor-pointer sm:basis-full"
              type="button"
              onClick={handleOpenBalatro}
            >
              <Play className="mr-2 h-4 w-4" />
              Launch Balatro
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
