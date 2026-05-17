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

interface GenericItemCardCompactProps {
  image: ReactNode;
  overlayImage?: string;
  name: string;
  actions?: ActionConfig[];
  className?: string;
}

export const GenericItemCardCompact = memo(function GenericItemCardCompact({
  image,
  overlayImage,
  name,
  actions = [],
  className,
}: GenericItemCardCompactProps) {
  const deleteAction = actions.find(
    (a) => a.id === "delete" || a.variant === "destructive",
  );
  const editAction = actions.find((a) => a.id === "edit");
  const otherActions = actions.filter((a) => a !== deleteAction);

  return (
    <div
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
        {image}
        {overlayImage && (
          <img
            src={overlayImage}
            alt="Overlay"
            className="absolute inset-0 w-full h-full object-contain [image-rendering:pixelated] pointer-events-none z-0"
            draggable="false"
          />
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
    </div>
  );
});
