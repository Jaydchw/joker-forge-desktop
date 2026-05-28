import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { X, List } from "@phosphor-icons/react";
import { cn } from "@/lib/core/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PanelProps {
  id: string;
  position: { x: number; y: number };
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  titleAccessory?: React.ReactNode;
  children: React.ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  headerActions?: React.ReactNode;
}

const Panel: React.FC<PanelProps> = ({
  id,
  position,
  title,
  icon: Icon,
  titleAccessory,
  children,
  onClose,
  closeLabel = "Close panel",
  className,
  headerClassName,
  contentClassName,
  headerActions,
}) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `panel-${id}`,
  });

  const style = transform
    ? {
        position: "absolute" as const,
        left: position.x + transform.x,
        top: position.y + transform.y,
      }
    : {
        position: "absolute" as const,
        left: position.x,
        top: position.y,
      };

  return (
    <div
      ref={setNodeRef}
      data-rb-panel="true"
      style={style}
      className={cn(
        "bg-card/95 backdrop-blur-md border border-border rounded-xl shadow-xl z-40 flex flex-col max-h-[calc(100vh-5rem)] overflow-hidden",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between p-3 border-b border-border cursor-grab active:cursor-grabbing shrink-0",
          headerClassName,
        )}
        {...attributes}
        {...listeners}
      >
        <div className="min-w-0 flex items-center gap-2">
          <List className="h-4 w-4 text-muted-foreground" />
          <Icon className="h-4.5 w-4.5 text-foreground" />
          <h3 className="text-foreground text-sm font-medium tracking-wider uppercase truncate">
            {title}
          </h3>
          {titleAccessory}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {headerActions}
          {onClose ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onClose}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  aria-label={closeLabel}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6} className="text-xs">
                {closeLabel}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </div>

      <div className={cn("min-h-0 flex-1 overflow-y-auto invisible-scrollbar", contentClassName)}>
        {children}
      </div>
    </div>
  );
};

export default Panel;
