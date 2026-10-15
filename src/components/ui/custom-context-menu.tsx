import * as React from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
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
  items?: ContextMenuItemConfig[];
  checked?: boolean;
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

function ConfiguredContextMenuItem({ item }: { item: ContextMenuItemConfig }) {
  if (item.show === false) return null;
  const content = (
    <>
      {item.icon && <item.icon className="mr-2 h-4 w-4" />}
      <span>{item.label}</span>
      {item.shortcut && <ContextMenuShortcut>{item.shortcut}</ContextMenuShortcut>}
    </>
  );
  if (item.items) {
    const visibleItems = item.items.filter((child) => child.show !== false);
    if (visibleItems.length === 0) return null;
    return (
      <ContextMenuSub>
        <ContextMenuSubTrigger disabled={item.disabled}>{content}</ContextMenuSubTrigger>
        <ContextMenuPortal>
          <ContextMenuSubContent className="w-44 border-border/95 bg-card/98 shadow-lg backdrop-blur-md">
            {visibleItems.map((child, index) => <ConfiguredContextMenuItem key={index} item={child} />)}
          </ContextMenuSubContent>
        </ContextMenuPortal>
      </ContextMenuSub>
    );
  }
  if (item.checked !== undefined) {
    return (
      <ContextMenuCheckboxItem
        checked={item.checked}
        disabled={item.disabled}
        onSelect={item.onSelect}
        className={item.variant === "destructive" ? "text-destructive focus:bg-destructive/10 focus:text-destructive" : undefined}
      >
        {content}
      </ContextMenuCheckboxItem>
    );
  }
  return (
    <ContextMenuItem disabled={item.disabled} variant={item.variant} onSelect={item.onSelect}>
      {content}
    </ContextMenuItem>
  );
}

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
              {visibleItems.map((item, iIdx) => <ConfiguredContextMenuItem key={iIdx} item={item} />)}
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
