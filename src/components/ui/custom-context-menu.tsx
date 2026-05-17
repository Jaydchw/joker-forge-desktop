import * as React from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  ArrowClockwise,
  Code,
} from "@phosphor-icons/react";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/core/utils";

export type ContextMenuItemConfig = {
  label: string;
  icon?: React.ElementType;
  shortcut?: string;
  variant?: "default" | "destructive";
  disabled?: boolean;
  onSelect?: () => void;
  show?: boolean;
};

export type ContextMenuGroupConfig = {
  label?: string;
  items: ContextMenuItemConfig[];
  separator?: boolean;
};

type CustomContextMenuProps = {
  children: React.ReactNode;
  groups?: ContextMenuGroupConfig[];
  /**
   * Whether to include the default "system" actions like Refresh and DevTools.
   * Defaults to true.
   */
  includeDefault?: boolean;
  className?: string;
};

export function CustomContextMenu({
  children,
  groups = [],
  includeDefault = true,
  className,
}: CustomContextMenuProps) {
  // Construct the final groups
  const allGroups = [...groups];

  if (includeDefault) {
    // Add a separator if there were previous groups
    if (allGroups.length > 0) {
      allGroups[allGroups.length - 1].separator = true;
    }

    allGroups.push({
      items: [
        {
          label: "Refresh",
          icon: ArrowClockwise,
          shortcut: "F5",
          onSelect: () => window.location.reload(),
        },
        {
          label: "Developer Tools",
          icon: Code,
          shortcut: "F12",
          onSelect: () => void invoke("open_devtools"),
        },
      ],
      separator: false,
    });
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent 
        className={cn(
          "w-52 border-border/95 bg-card/98 shadow-[0_18px_35px_-18px_rgba(0,0,0,0.72)] backdrop-blur-md",
          className
        )}
      >
        {allGroups.map((group, gIdx) => {
          const visibleItems = group.items.filter((item) => item.show !== false);
          if (visibleItems.length === 0 && !group.label) return null;

          return (
            <React.Fragment key={gIdx}>
              {group.label && <ContextMenuLabel>{group.label}</ContextMenuLabel>}
              {visibleItems.map((item, iIdx) => (
                <ContextMenuItem
                  key={iIdx}
                  disabled={item.disabled}
                  variant={item.variant}
                  onSelect={item.onSelect}
                >
                  {item.icon && <item.icon className="mr-2 h-4 w-4" />}
                  <span>{item.label}</span>
                  {item.shortcut && (
                    <ContextMenuShortcut>{item.shortcut}</ContextMenuShortcut>
                  )}
                </ContextMenuItem>
              ))}
              {group.separator && (
                <ContextMenuSeparator />
              )}
            </React.Fragment>
          );
        })}
      </ContextMenuContent>
    </ContextMenu>
  );
}
