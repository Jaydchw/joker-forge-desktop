import { ReactNode, memo } from "react";
import { Trash } from "@phosphor-icons/react";
import { ActionConfig } from "@/components/pages/generic-item-card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/core/utils";
import {
  type AceSelection,
  getAceImagePath,
} from "@/lib/balatro/card-preview-utils";
import { motion } from "framer-motion";

interface GenericItemCardCompactProps {
  image: ReactNode;
  overlayImage?: string;
  name: string;
  actions?: ActionConfig[];
  className?: string;
  cardPreview?: {
    type: "enhancement" | "seal" | "edition";
    selectedAce?: AceSelection;
    replaceBaseCard?: boolean;
    shader?: string | false;
  };
}

export const GenericItemCardCompact = memo(function GenericItemCardCompact({
  image,
  overlayImage,
  name,
  actions = [],
  className,
  cardPreview,
}: GenericItemCardCompactProps) {
  const deleteAction = actions.find(
    (a) => a.id === "delete" || a.variant === "destructive",
  );
  const editAction = actions.find((a) => a.id === "edit");
  const otherActions = actions.filter((a) => a !== deleteAction);

  const hasBaseAce =
    cardPreview?.selectedAce &&
    cardPreview.selectedAce !== "none" &&
    !cardPreview.replaceBaseCard;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={cn(
        "group relative aspect-[71/95] overflow-hidden rounded-2xl w-full max-w-[220px] mx-auto",
        className,
      )}
    >
      <div
        className={cn(
          "w-full h-full relative [image-rendering:pixelated]",
          editAction && "cursor-pointer",
        )}
        onClick={() => {
          if (editAction) editAction.onClick();
        }}
      >
        {cardPreview?.type === "seal" && (
          <img
            src="/images/back.png"
            alt="Card Back"
            className="absolute inset-0 w-full h-full object-contain [image-rendering:pixelated] pointer-events-none z-0"
            draggable="false"
          />
        )}
        <div
          className={cn(
            "w-full h-full",
            cardPreview?.type === "seal" ? "relative z-20" : "",
          )}
        >
          {image}
        </div>
        {hasBaseAce && (
          <img
            src={getAceImagePath(
              cardPreview.selectedAce as Exclude<AceSelection, "none">,
              cardPreview.type === "edition" ? "acesbg" : "aces",
            )}
            alt="Base Card"
            className={cn(
              "absolute inset-0 w-full h-full object-contain [image-rendering:pixelated] pointer-events-none",
              cardPreview?.type === "seal"
                ? "z-10"
                : cardPreview?.type === "enhancement"
                  ? "z-20"
                  : "z-10",
            )}
            draggable="false"
          />
        )}
        {overlayImage && (
          <img
            src={overlayImage}
            alt="Overlay"
            className={cn(
              "absolute inset-0 w-full h-full object-contain [image-rendering:pixelated] pointer-events-none",
              cardPreview?.type === "enhancement" ? "z-30" : "z-20",
            )}
            draggable="false"
          />
        )}
        {cardPreview?.type === "edition" && !overlayImage && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none px-2">
            <span className="bg-black/60 text-white text-[10px] font-bold rounded px-1.5 py-0.5 text-center break-all">
              {typeof cardPreview.shader === "string" &&
              cardPreview.shader.trim()
                ? cardPreview.shader
                : "No Shader"}
            </span>
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 p-3 bg-linear-to-t from-black/80 via-black/50 to-transparent translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-200">
        <p className="text-xs font-bold text-white text-center truncate w-full px-1 drop-shadow">
          {name}
        </p>
        <div className="flex items-center gap-1 flex-wrap justify-center">
          {otherActions.map((action) => (
            <Tooltip key={action.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick();
                  }}
                  onPointerDown={(e) => e.preventDefault()}
                  className="h-7 w-7 rounded-lg cursor-pointer bg-white/10 hover:bg-white/25 text-white border-0 hover:scale-110 transition-all [&_svg]:h-3.5 [&_svg]:w-3.5"
                >
                  {action.icon}
                </Button>
              </TooltipTrigger>
              <TooltipContent className="font-bold">
                {action.label}
              </TooltipContent>
            </Tooltip>
          ))}
          {deleteAction && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteAction.onClick();
                  }}
                  onPointerDown={(e) => e.preventDefault()}
                  className="h-7 w-7 rounded-lg cursor-pointer bg-white/10 hover:bg-red-500/50 text-white border-0 hover:scale-110 transition-all [&_svg]:h-3.5 [&_svg]:w-3.5"
                >
                  <Trash weight="bold" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="font-bold text-red-400">
                {deleteAction.label}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </motion.div>
  );
});
