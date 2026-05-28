import { useState, useEffect } from "react";
import {
  Club,
  Diamond,
  Heart,
  Image as ImageIcon,
  Spade,
} from "@phosphor-icons/react";
import IconButton from "@/components/ui/icon-button";
import { BalatroText } from "@/lib/balatro/balatro-text-formatter";
import { getDescriptionVariablePlaceholdersEnabled } from "@/lib/services/storage";
import { getItemLocVarsFromUserVariables } from "@/lib/description/description-loc-vars";
import {
  JokerData,
  ConsumableData,
  VoucherData,
  BoosterData,
  DeckData,
  EditionData,
  SealData,
  EnhancementData,
} from "@/lib/core/types";
import { cn } from "@/lib/core/utils";

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

const ACE_OPTIONS = [
  {
    key: "HC_A_hearts",
    label: "Hearts Ace",
    icon: Heart,
    iconClassName: "text-red-500",
  },
  {
    key: "HC_A_diamonds",
    label: "Diamonds Ace",
    icon: Diamond,
    iconClassName: "text-yellow-400",
  },
  {
    key: "HC_A_clubs",
    label: "Clubs Ace",
    icon: Club,
    iconClassName: "text-blue-500",
  },
  {
    key: "HC_A_spades",
    label: "Spades Ace",
    icon: Spade,
    iconClassName: "text-gray-200",
  },
];

const SIZE_CLASSES = {
  sm: { image: "w-28 h-36" },
  md: { image: "w-40 h-52" },
  lg: { image: "w-48 h-64" },
};

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
    const showPlaceholders = getDescriptionVariablePlaceholdersEnabled();

    const aceImageFolder = type === "edition" ? "acesbg" : "aces";

    useEffect(() => {
      setImageError(false);
    }, [data.image]);

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

    const currentSize = SIZE_CLASSES[size];
    const badgeStyles = getBadgeStyles();
    const isVanillaBadge =
      typeof badgeStyles.bg === "string" && badgeStyles.bg.startsWith("bg-");

    const getBadgeText = () => {
      if (enhancement) return enhancement;
      if (seal) return seal;
      if (type === "edition") {
        const shader = (data as Partial<EditionData>)?.shader;
        return typeof shader === "string" && shader.trim() ? shader : "No Shader";
      }
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
      const itemLocVars = getItemLocVarsFromUserVariables(
        data as Partial<CardData>,
      );
      const vars = itemLocVars?.vars ?? [];
      const colours = vars.filter(
        (value) => typeof value === "string" && value.startsWith("#"),
      );
      if (vars.length === 0 && colours.length === 0) return undefined;
      return { vars, colours };
    };

    const renderCardImage = () => {
      const commonClasses =
        "absolute inset-0 w-full h-full object-contain [image-rendering:pixelated]";
      const hasImage = data.image && !imageError;
      const objectType = (data as any)?.objectType;
      const isEnhancementCard =
        type === "enhancement" || objectType === "enhancement";
      const isSealCard = type === "seal" || isSeal || objectType === "seal";

      if (
        type === "edition" ||
        type === "card" ||
        type === "enhancement" ||
        type === "seal"
      ) {
        if (isSealCard) {
          return (
            <div className="relative w-full h-full">
              <img
                src="/images/back.png"
                alt="Card Back"
                className={`${commonClasses} z-0`}
                draggable="false"
              />

              {!enhancementReplaceBase && (
                <img
                  src={`/images/${aceImageFolder}/${selectedAce}.png`}
                  alt="Base Card"
                  className={`${commonClasses} z-10`}
                  draggable="false"
                />
              )}

              {hasImage ? (
                <img
                  src={data.image}
                  alt={data.name}
                  className={`${commonClasses} z-20`}
                  onError={() => setImageError(true)}
                  draggable="false"
                />
              ) : (
                !enhancementReplaceBase && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none opacity-50"></div>
                )
              )}

              {data.overlayImage && (
                <img
                  src={data.overlayImage}
                  alt="Overlay"
                  className={`${commonClasses} z-30`}
                  draggable="false"
                />
              )}
            </div>
          );
        }

        if (isEnhancementCard) {
          return (
            <div className="relative w-full h-full">
              {hasImage ? (
                <img
                  src={data.image}
                  alt={data.name}
                  className={`${commonClasses} z-10`}
                  onError={() => setImageError(true)}
                  draggable="false"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-50"></div>
              )}

              {!enhancementReplaceBase && (
                <img
                  src={`/images/${aceImageFolder}/${selectedAce}.png`}
                  alt="Base Card"
                  className={`${commonClasses} z-20`}
                  draggable="false"
                />
              )}

              {data.overlayImage && (
                <img
                  src={data.overlayImage}
                  alt="Overlay"
                  className={`${commonClasses} z-30`}
                  draggable="false"
                />
              )}
            </div>
          );
        }

        return (
          <div className="relative w-full h-full">
            {isSealCard && (
              <img
                src="/images/back.png"
                alt="Card Back"
                className={commonClasses}
                draggable="false"
              />
            )}

            {!enhancementReplaceBase && (
              <img
                src={`/images/${aceImageFolder}/${selectedAce}.png`}
                alt="Base Card"
                className="w-full h-full object-contain [image-rendering:pixelated]"
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
            <div className="w-full h-full flex flex-col items-center justify-center bg-muted/20 border-2 border-dashed border-muted-foreground/20 rounded-lg">
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
    const hasOverlay = Boolean(data.overlayImage);
    const objectType = (data as any)?.objectType;
    const isEnhancementPreview =
      type === "enhancement" || objectType === "enhancement";
    const isSealPreview = type === "seal" || isSeal || objectType === "seal";
    const isCardType =
      type === "card" ||
      type === "edition" ||
      type === "enhancement" ||
      type === "seal";

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
            <div
              data-showcase-cost-badge="true"
              className={cn(
                "bg-balatro-cost-bg border-4 border-balatro-cost-border rounded-t-2xl px-4 py-1 -mb-1 relative shadow-sm",
                hasOverlay ? "z-0" : "z-10",
              )}
            >
              <span
                data-showcase-cost-text="true"
                className="text-balatro-cost-text font-bold text-shadow-cost text-2xl tracking-wider"
              >
                ${cost}
              </span>
            </div>
          )}

          {(isEnhancementPreview || isSealPreview) && !enhancementReplaceBase && (
            <div
              className="mb-2 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity absolute -top-11 z-50"
              onClick={(e) => e.stopPropagation()}
            >
              {ACE_OPTIONS.map((ace) => (
                <IconButton
                  key={ace.key}
                  icon={ace.icon}
                  tooltip={ace.label}
                  onClick={() => setSelectedAce(ace.key)}
                  isActive={selectedAce === ace.key}
                  iconClassName={ace.iconClassName}
                  iconOnly
                  className="!h-8 !w-8"
                />
              ))}
            </div>
          )}

          <div
            className={cn(
              currentSize.image,
              "mb-2 flex items-center justify-center overflow-hidden relative",
              hasOverlay ? "z-20" : "z-10",
              showCost && cost !== undefined ? "rounded-t-none" : "rounded-lg",
            )}
          >
            {renderCardImage()}
          </div>

          <div
            className={cn(
              "w-fit min-w-48 max-w-none",
              "shrink-0 absolute top-[95%] left-1/2 transform -translate-x-1/2 hover:z-30",
              hasOverlay ? "z-10" : "z-20",
            )}
          >
            <div className="relative m-2 filter drop-shadow-lg">
              <div className="absolute inset-0 bg-balatro-lightgreyshadow rounded-2xl translate-y-1" />
              <div className="relative bg-balatro-lightgrey rounded-2xl p-1">
                <div className="bg-balatro-black rounded-lg p-3 shadow-inner">
                  {!isCardType && (
                    <h3 className="text-2xl mb-2 text-center text-balatro-white text-shadow-pixel tracking-wide leading-tight whitespace-nowrap px-2">
                      {data.name || `New ${type}`}
                    </h3>
                  )}

                  <div className="relative mb-3">
                    <div className="absolute inset-0 bg-balatro-whiteshadow rounded-lg translate-y-1" />
                    <div className="relative bg-balatro-white text-balatro-black font-medium px-3 py-2.5 rounded-lg text-center leading-5 text-sm min-h-12 flex items-center justify-center overflow-visible">
                      <div className="relative z-10 whitespace-nowrap">
                        <BalatroText
                          text={data.description || "No description provided."}
                          locVars={getLocVars()}
                          replaceVariables={showPlaceholders}
                          className="block whitespace-nowrap"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="relative flex justify-center mt-3">
                    <div className="relative">
                      <div
                        className={cn(
                          "absolute inset-0 rounded-lg translate-y-1",
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
                          "relative rounded-lg px-4 py-1 text-center text-balatro-white text-shadow-pixel  text-lg whitespace-nowrap",
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
