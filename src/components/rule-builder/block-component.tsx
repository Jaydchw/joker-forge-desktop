import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Lightning,
  PuzzlePiece,
  Flask,
  Percent,
  Trash,
  Prohibit,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { BlockMarkerColor } from "./types";
import { getBlockMarkerStyle } from "./block-markers";

interface BlockComponentProps {
  label: string;
  type: "trigger" | "condition" | "effect";
  onClick: (e?: React.MouseEvent) => void;
  onIconClick?: (e?: React.MouseEvent) => void;
  isSelected?: boolean;
  showTrash?: boolean;
  onDelete?: () => void;
  parameterCount?: number;
  isNegated?: boolean;
  dynamicTitle?: string;
  variableName?: string;
  hasRandomChance?: boolean;
  isDraggable?: boolean;
  dragHandleProps?: Record<string, unknown>;
  variant?: "default" | "palette" | "condition";
  markerColor?: BlockMarkerColor;
}

const BlockComponent: React.FC<BlockComponentProps> = ({
  label,
  type,
  onClick,
  onIconClick,
  isSelected = false,
  showTrash = false,
  onDelete,
  parameterCount,
  isNegated = false,
  dynamicTitle,
  variableName,
  hasRandomChance = false,
  isDraggable = false,
  dragHandleProps,
  variant = "default",
  markerColor,
}) => {
  const typeLabelLeft = onIconClick
    ? type === "effect"
      ? "3.75rem"
      : "3.25rem"
    : type === "effect"
      ? "3.25rem"
      : "2.75rem";
  const containerPaddingClass = onIconClick ? "p-2.5 pt-5" : "p-3 pt-6";

  const getTypeConfig = () => {
    switch (type) {
      case "trigger":
        return {
          borderColor: "border-l-balatro-money",
          backgroundColor: "bg-card/95",
          icon: (
            <Lightning className="h-6 w-6 text-balatro-money -mt-4 -ml-1" />
          ),
          typeLabel: "Trigger",
          selectColor: "border-balatro-money",
          hoverColor: "hover:border-balatro-money/70",
        };
      case "condition":
        return {
          borderColor: "border-l-balatro-blue",
          backgroundColor: "bg-card/95",
          icon: <Flask className="h-6 w-6 text-balatro-blue -mt-4 -ml-1" />,
          typeLabel: "Condition",
          selectColor: "border-balatro-blue",
          hoverColor: "hover:border-balatro-blue/70",
        };
      case "effect":
        return {
          borderColor: "border-l-balatro-green",
          backgroundColor: "bg-card/95",
          icon: (
            <PuzzlePiece className="h-6 w-6 text-balatro-green -mt-4 -ml-1" />
          ),
          typeLabel: "Effect",
          selectColor: "border-balatro-green",
          hoverColor: "hover:border-balatro-green/70",
        };
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case "palette":
        return "w-full";
      case "condition":
        return "w-62";
      case "default":
      default:
        return "w-71";
    }
  };

  const config = getTypeConfig();
  const displayTitle = dynamicTitle || label;

  const [hasOverflow, setHasOverflow] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const CheckOverflow = () => {
      if (textRef.current && containerRef.current) {
        const overflowAmount =
          textRef.current.scrollWidth - containerRef.current.clientWidth;
        setHasOverflow(overflowAmount > 10);
      } else {
        setHasOverflow(false);
      }
    };

    const timer = setTimeout(CheckOverflow, 100);
    window.addEventListener("resize", CheckOverflow);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", CheckOverflow);
    };
  }, [displayTitle, variant]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick(e);
  };

  return (
    <div
      className={`
        group relative ${config.backgroundColor} ${
          config.borderColor
        } border-l-4 border-2 
        ${isSelected ? config.selectColor : "border-border"}
        rounded-xl cursor-pointer transition-all ${config.hoverColor} ${containerPaddingClass} shadow-sm
        ${getVariantStyles()}
        ${
          isDraggable
            ? "cursor-grab active:cursor-grabbing hover:shadow-lg"
            : ""
        }
      `}
      onClick={handleClick}
      style={{ pointerEvents: "auto", ...getBlockMarkerStyle(markerColor) }}
      {...(isDraggable ? dragHandleProps : {})}
    >
      <div
        className="absolute top-2 text-muted-foreground text-xs font-medium tracking-wider"
        style={{ left: typeLabelLeft }}
      >
        {config.typeLabel}
      </div>

      <div className="absolute top-0.5 right-6 flex items-center gap-2">
        {variableName && (
          <span className="bg-jungle-green-500/15 text-jungle-green-400 text-xs px-2 py-1 rounded-lg font-medium border border-jungle-green-400/30">
            ${variableName}
          </span>
        )}
        {parameterCount !== undefined && parameterCount > 0 && (
          <span className="text-muted-foreground text-xs font-medium">
            {parameterCount} Parameter{parameterCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {showTrash && onDelete && (
        <div className="absolute -top-3 -right-3 z-20 opacity-100">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="h-8 w-8 bg-card! hover:bg-card! text-red-500! hover:text-red-400! opacity-100! hover:opacity-100! cursor-pointer rounded-lg border-2 border-destructive/40 hover:border-red-400/70 transition-all duration-150 hover:scale-105 hover:shadow-[0_0_0_1px_rgba(248,113,113,0.35)]"
              >
                <Trash weight="bold" className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="font-bold text-red-500">
              Delete
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 grow min-w-0">
          <div className="flex items-center gap-2">
            <div className="shrink-0">
              {onIconClick ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onIconClick(e);
                      }}
                      className="h-7 w-7 inline-flex items-center justify-center rounded-md bg-transparent hover:scale-105 transition-all cursor-pointer"
                    >
                      {config.icon}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={4} className="text-xs">
                    Preview Block Code
                  </TooltipContent>
                </Tooltip>
              ) : (
                config.icon
              )}
            </div>
            {isNegated && (
              <div className="shrink-0 -mr-2">
                <Prohibit className="h-4 w-4 text-balatro-red" />
              </div>
            )}
            {hasRandomChance && (
              <div className="shrink-0 -mr-2">
                <Percent className="h-4 w-4 text-jungle-green-400" />
              </div>
            )}
          </div>
          <div ref={containerRef} className="grow min-w-0 overflow-hidden">
            <motion.div
              ref={textRef}
              className="text-foreground text-sm tracking-wide whitespace-nowrap"
              animate={{
                x:
                  hasOverflow && textRef.current && containerRef.current
                    ? [
                        0,
                        -(
                          textRef.current.scrollWidth -
                          containerRef.current.clientWidth
                        ),
                      ]
                    : 0,
              }}
              transition={
                hasOverflow
                  ? {
                      x: {
                        repeat: Infinity,
                        repeatType: "mirror",
                        duration: (textRef.current?.scrollWidth || 0) / 75,
                        ease: "linear",
                        delay: 1.5,
                        repeatDelay: 1.5,
                      },
                    }
                  : { duration: 0 }
              }
            >
              {isNegated ? `NOT ${displayTitle}` : displayTitle}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlockComponent;
