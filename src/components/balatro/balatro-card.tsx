import { useState, useEffect } from "react";
import { Image as ImageIcon } from "@phosphor-icons/react";
import { BalatroText } from "@/lib/balatro-text-formatter";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  JokerData,
  ConsumableData,
  VoucherData,
  BoosterData,
  DeckData,
  EditionData,
  SealData,
  EnhancementData,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type CardData =
  | JokerData
  | ConsumableData
  | VoucherData
  | BoosterData
  | DeckData
  | EditionData
  | SealData
  | EnhancementData;

interface BalatroCardProps {
  type:
    | "joker"
    | "consumable"
    | "booster"
    | "card"
    | "edition"
    | "voucher"
    | "deck"
    | "enhancement"
    | "seal";
  data: Partial<CardData>;
  onClick?: () => void;
  className?: string;
  size?: "sm" | "md" | "lg";
  rarityName?: string;
  rarityColor?: string;
  setName?: string;
  setColor?: string;
  enhancement?: string;
  seal?: string;
  edition?: string;
  isSeal?: boolean;
  sealBadgeColor?: string;
  editionBadgeColor?: string;
  enhancementReplaceBase?: boolean;
  showCost?: boolean;
}

export function BalatroCard({
  type,
  data,
  onClick,
  className = "",
  size = "md",
  rarityName,
  rarityColor,
  setName,
  setColor,
  enhancement,
  seal,
  edition,
  isSeal = false,
  sealBadgeColor,
  editionBadgeColor,
  enhancementReplaceBase = false,
  showCost = true,
}: BalatroCardProps) {
  const [imageError, setImageError] = useState(false);
  const [selectedAce, setSelectedAce] = useState("HC_A_hearts");
  const [, setHoveredButton] = useState<string | null>(null);

  const aceOptions = [
    [
      { key: "HC_A_hearts", name: "♥", color: "text-red-500" },
      { key: "HC_A_diamonds", name: "♦", color: "text-yellow-400" },
      { key: "HC_A_clubs", name: "♣", color: "text-blue-500" },
      { key: "HC_A_spades", name: "♠", color: "text-gray-200" },
    ],
  ];

  const aceImageFolder = type === "edition" ? "acesbg" : "aces";

  useEffect(() => {
    setImageError(false);
  }, [data.image]);

  const darkenColor = (hexColor: string, amount: number = 0.3): string => {
    if (!hexColor || !hexColor.startsWith("#")) return hexColor;
    const hex = hexColor.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const newR = Math.max(0, Math.floor(r * (1 - amount)));
    const newG = Math.max(0, Math.floor(g * (1 - amount)));
    const newB = Math.max(0, Math.floor(b * (1 - amount)));
    const toHex = (n: number) => n.toString(16).padStart(2, "0");
    return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
  };

  const getBadgeStyles = () => {
    if (isSeal && sealBadgeColor) {
      return { bg: darkenColor(sealBadgeColor, 0.4), shadow: sealBadgeColor };
    }
    if (type === "edition" && editionBadgeColor) {
      return {
        bg: darkenColor(editionBadgeColor, 0.4),
        shadow: editionBadgeColor,
      };
    }

    if (type === "joker" && rarityColor) {
      if (rarityColor.startsWith("bg-")) {
        return { bg: `${rarityColor}shadow`, shadow: rarityColor };
      }
      return { bg: darkenColor(rarityColor, 0.4), shadow: rarityColor };
    }

    if (type === "consumable" && setColor) {
      if (setColor.startsWith("bg-")) {
        return { bg: `${setColor}shadow`, shadow: setColor };
      }
      return { bg: darkenColor(setColor, 0.4), shadow: setColor };
    }

    if (type === "edition")
      return { bg: "bg-balatro-goldshadow", shadow: "bg-balatro-gold" };
    if (type === "voucher")
      return {
        bg: "bg-balatro-voucher_badgetag_shadow",
        shadow: "bg-balatro-voucher_badgetag",
      };

    return { bg: "bg-balatro-greenshadow", shadow: "bg-balatro-green" };
  };

  const sizeClasses = {
    sm: { image: "w-28 h-36", infoWidth: "min-w-40" },
    md: { image: "w-40 h-52", infoWidth: "min-w-48" },
    lg: { image: "w-48 h-64", infoWidth: "min-w-64" },
  };

  const currentSize = sizeClasses[size];
  const badgeStyles = getBadgeStyles();
  const isVanillaBadge =
    typeof badgeStyles.bg === "string" && badgeStyles.bg.startsWith("bg-");

  const getBadgeText = () => {
    if (enhancement) return enhancement;
    if (seal) return seal;
    if (edition) return edition;
    if (type === "joker") return rarityName || "Common";
    if (type === "consumable") return setName || "Tarot";
    if (type === "booster") {
      const booster = data as Partial<BoosterData>;
      return `${(booster.booster_type || "").replace(/_/g, " ")} Pack`;
    }
    if (type === "card" || type === "enhancement") return data.name || "Card";
    if (type === "voucher") return "Voucher";
    if (type === "deck") return "Deck";
    return "";
  };

  const getLocVars = () => {
    if (type === "joker") {
      const joker = data as Partial<JokerData>;
      if (joker.locVars && Array.isArray(joker.locVars.vars)) {
        const colours = joker.locVars.vars.filter(
          (v) => typeof v === "string" && v.startsWith("#"),
        );
        return colours.length > 0 ? { colours } : undefined;
      }
    }
    return undefined;
  };

  const renderCardImage = () => {
    const commonClasses =
      "absolute inset-0 w-full h-full object-contain [image-rendering:pixelated]";
    const hasImage = data.image && !imageError;

    if (
      type === "edition" ||
      type === "card" ||
      type === "enhancement" ||
      type === "seal"
    ) {
      return (
        <div className="relative w-full h-full">
          {!enhancementReplaceBase && (
            <img
              src={`/images/${aceImageFolder}/${selectedAce}.png`}
              alt="Base Card"
              className={cn(
                "w-full h-full object-contain [image-rendering:pixelated]",
                enhancementReplaceBase ? "hidden" : "",
              )}
              draggable="false"
            />
          )}
          {hasImage ? (
            <img
              src={data.image}
              alt={data.name}
              className={commonClasses}
              onError={() => setImageError(true)}
              draggable="false"
            />
          ) : (
            !enhancementReplaceBase && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-50"></div>
            )
          )}
          {data.overlayImage && (
            <img
              src={data.overlayImage}
              alt="Overlay"
              className={commonClasses}
              draggable="false"
            />
          )}
        </div>
      );
    }

    return (
      <div className="relative w-full h-full">
        {hasImage ? (
          <>
            <img
              src={data.image}
              alt={data.name}
              className="w-full h-full object-contain [image-rendering:pixelated]"
              onError={() => setImageError(true)}
              draggable="false"
            />
            {data.overlayImage && (
              <img
                src={data.overlayImage}
                alt="Overlay"
                className={commonClasses}
                draggable="false"
              />
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-muted/20 border-2 border-dashed border-muted-foreground/20 rounded-xl">
            <ImageIcon className="h-16 w-16 text-muted-foreground/30" />
            <span className="text-xs text-muted-foreground/50 font-mono mt-2">
              NO IMAGE
            </span>
          </div>
        )}
      </div>
    );
  };

  const cost = (data as any).cost;

  return (
    <div
      className={cn(
        "select-none font-game relative group/card",
        className,
        onClick && "cursor-pointer",
      )}
      onClick={onClick}
    >
      <div className="flex flex-col items-center">
        {showCost && cost !== undefined && (
          <div className="bg-balatro-cost-bg border-4 border-balatro-cost-border rounded-t-2xl px-4 py-1 -mb-1 z-10 relative shadow-sm">
            <span className="text-balatro-cost-text font-bold text-shadow-cost text-2xl tracking-wider">
              ${cost}
            </span>
          </div>
        )}

        {(type === "card" ||
          type === "edition" ||
          type === "enhancement" ||
          type === "seal") && (
          <div className="mb-2 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity absolute -top-12 bg-balatro-black/90 p-1 rounded-lg z-50">
            {aceOptions[0].map((ace) => (
              <Tooltip key={ace.key}>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAce(ace.key);
                    }}
                    onMouseEnter={() => setHoveredButton(ace.key)}
                    onMouseLeave={() => setHoveredButton(null)}
                    className={cn(
                      "w-10 h-10 rounded border-2 flex items-center justify-center text-2xl font-bold transition-all duration-200",
                      selectedAce === ace.key
                        ? "bg-primary border-primary-foreground text-balatro-black shadow-lg scale-110"
                        : "bg-balatro-black border-balatro-lightgreyshadow text-balatro-white hover:bg-balatro-light-black hover:scale-105",
                    )}
                  >
                    <span className={ace.color}>{ace.name}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{ace.name}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}

        <div
          className={cn(
            currentSize.image,
            "mb-2 flex items-center justify-center overflow-hidden relative z-10 transition-transform hover:scale-[1.02] duration-200",
            showCost && cost !== undefined ? "rounded-t-none" : "rounded-xl",
          )}
        >
          {renderCardImage()}
        </div>

        <div
          className={cn(
            currentSize.infoWidth,
            "shrink-0 absolute top-[95%] left-1/2 transform -translate-x-1/2 z-20 hover:z-30",
          )}
        >
          <div className="relative m-2 filter drop-shadow-lg">
            <div className="absolute inset-0 bg-balatro-lightgreyshadow rounded-2xl translate-y-1" />
            <div className="relative bg-balatro-lightgrey rounded-2xl p-1">
              <div className="bg-balatro-black rounded-xl p-3 shadow-inner">
                {type !== "card" &&
                  type !== "edition" &&
                  type !== "enhancement" && (
                    <h3 className="text-2xl mb-2 text-center text-balatro-white text-shadow-pixel tracking-wide leading-tight">
                      {data.name || `New ${type}`}
                    </h3>
                  )}

                <div className="relative mb-3">
                  <div className="absolute inset-0 bg-balatro-whiteshadow rounded-xl translate-y-1" />
                  <div className="relative bg-balatro-white text-balatro-black font-medium px-3 py-2.5 rounded-xl text-center leading-5 text-sm min-h-12 flex items-center justify-center overflow-visible">
                    <div className="relative z-10">
                      <BalatroText
                        text={data.description || "No description provided."}
                        locVars={getLocVars()}
                        className="block"
                      />
                    </div>
                  </div>
                </div>

                <div className="relative flex justify-center mt-3">
                  <div className="relative">
                    <div
                      className={cn(
                        "absolute inset-0 rounded-xl translate-y-1",
                        isVanillaBadge ? badgeStyles.bg : "",
                      )}
                      style={
                        !isVanillaBadge
                          ? { backgroundColor: badgeStyles.bg }
                          : undefined
                      }
                    />
                    <div
                      className={cn(
                        "relative rounded-xl px-4 py-1 text-center text-balatro-white font-bold text-shadow-pixel tracking-widest text-lg uppercase whitespace-nowrap",
                        isVanillaBadge ? badgeStyles.shadow : "",
                      )}
                      style={
                        !isVanillaBadge
                          ? { backgroundColor: badgeStyles.shadow }
                          : undefined
                      }
                    >
                      {getBadgeText()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
