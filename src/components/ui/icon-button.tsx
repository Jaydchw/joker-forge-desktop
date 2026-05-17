import React from "react";
import { cn } from "@/lib/core/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface IconButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  tooltip: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  isActive?: boolean;
  className?: string;
  iconClassName?: string;
}

const IconButton: React.FC<IconButtonProps> = ({
  icon: Icon,
  tooltip,
  shortcut,
  onClick,
  disabled = false,
  isActive = false,
  className,
  iconClassName,
}) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={tooltip}
          size="icon"
          variant="outline"
          className={cn(
            "relative group h-9 w-9 rounded-md border-2 transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            isActive
              ? "bg-primary/10 border-primary/45 text-primary shadow-sm"
              : "bg-card/90 border-border text-muted-foreground hover:border-primary/40 hover:text-primary",
            className,
          )}
          icon={<Icon className={cn("h-4 w-4", iconClassName)} />}
        />
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        sideOffset={6}
        className="text-xs font-medium"
      >
        <div className="flex items-center gap-2">
          <span>{tooltip}</span>
          {shortcut && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {shortcut}
            </span>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

export default IconButton;
