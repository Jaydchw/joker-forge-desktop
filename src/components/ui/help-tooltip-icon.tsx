import { Info } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HelpTooltipIconProps {
  content: ReactNode;
  iconClassName?: string;
  triggerClassName?: string;
  contentClassName?: string;
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  ariaLabel?: string;
}

export function HelpTooltipIcon({
  content,
  iconClassName,
  triggerClassName,
  contentClassName,
  side = "top",
  sideOffset = 6,
  ariaLabel = "Show help",
}: HelpTooltipIconProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={ariaLabel}
          className={cn(
            "inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-help",
            triggerClassName,
          )}
        >
          <Info className={cn("h-4 w-4", iconClassName)} />
        </span>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={sideOffset}
        className={cn("max-w-72 text-xs", contentClassName)}
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

export default HelpTooltipIcon;
