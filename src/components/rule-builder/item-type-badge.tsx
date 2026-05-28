import React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Cards, ClipboardText, Flask, Smiley, Ticket } from "@phosphor-icons/react";

interface ItemTypeBadgeProps {
  itemType: "joker" | "consumable" | "card" | "voucher" | "deck";
  className?: string;
}

const ItemTypeBadge: React.FC<ItemTypeBadgeProps> = ({
  itemType,
  className,
}) => {
  const iconMap = {
    joker: Smiley,
    consumable: Flask,
    card: ClipboardText,
    voucher: Ticket,
    deck: Cards,
  } as const;
  const colorMap = {
    joker: "text-joker-primary",
    consumable: "text-consumable-primary",
    card: "text-enhancement-primary",
    voucher: "text-voucher-primary",
    deck: "text-deck-primary",
  } as const;
  const Icon = iconMap[itemType];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`h-6 w-6 rounded-md border border-border/70 bg-card/80 flex items-center justify-center ${className ?? ""}`}
          aria-label={`${itemType} mode`}
        >
          <Icon className={`h-4 w-4 ${colorMap[itemType]}`} weight="duotone" />
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6} className="text-xs">
        {itemType.charAt(0).toUpperCase() + itemType.slice(1)}
      </TooltipContent>
    </Tooltip>
  );
};

export default ItemTypeBadge;
