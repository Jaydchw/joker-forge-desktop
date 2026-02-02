import { useState, useRef, useEffect, ReactNode } from "react";
import {
  CurrencyDollar,
  Trash,
  PencilSimple,
  X,
  Check,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface CardProperty {
  id: string;
  icon: ReactNode;
  label: string;
  isActive: boolean;
  variant:
    | "default"
    | "success"
    | "warning"
    | "info"
    | "purple"
    | "destructive";
  onClick: () => void;
}

export interface ActionConfig {
  id: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "destructive" | "secondary" | "outline" | "ghost";
}

interface GenericItemCardProps {
  image: ReactNode;
  name: string;
  description: string;
  cost?: number;
  idValue?: number | string;
  badges?: ReactNode;
  properties?: CardProperty[];
  actions?: ActionConfig[];
  onUpdate: (updates: {
    name?: string;
    description?: string;
    cost?: number;
    idValue?: number;
  }) => void;
}

export function GenericItemCard({
  image,
  name,
  description,
  cost,
  idValue,
  badges,
  properties = [],
  actions = [],
  onUpdate,
}: GenericItemCardProps) {
  // Editing states
  const [editingField, setEditingField] = useState<
    "none" | "name" | "desc" | "cost" | "id"
  >("none");
  const [tempValue, setTempValue] = useState("");

  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editingField !== "none" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingField]);

  const startEdit = (
    field: "name" | "desc" | "cost" | "id",
    currentValue: string | number,
  ) => {
    setTempValue(currentValue.toString());
    setEditingField(field);
  };

  const cancelEdit = () => {
    setEditingField("none");
    setTempValue("");
  };

  const saveEdit = () => {
    if (editingField === "name") {
      if (tempValue.trim()) onUpdate({ name: tempValue });
    } else if (editingField === "desc") {
      onUpdate({ description: tempValue });
    } else if (editingField === "cost") {
      const val = parseInt(tempValue);
      if (!isNaN(val)) onUpdate({ cost: val });
    } else if (editingField === "id") {
      const val = parseInt(tempValue);
      if (!isNaN(val)) onUpdate({ idValue: val });
    }
    setEditingField("none");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    }
    if (e.key === "Escape") {
      cancelEdit();
    }
  };

  // Extract delete action
  const deleteAction = actions.find(
    (a) => a.id === "delete" || a.variant === "destructive",
  );
  const otherActions = actions.filter((a) => a !== deleteAction);

  const getPropertyStyles = (
    isActive: boolean,
    variant: CardProperty["variant"],
  ) => {
    const base =
      "flex items-center justify-center h-10 w-10 rounded-xl transition-all duration-200 cursor-pointer border-2";
    if (!isActive)
      return cn(
        base,
        "bg-muted/30 border-transparent text-muted-foreground/30 hover:bg-muted hover:text-muted-foreground hover:border-border",
      );

    const variants = {
      success:
        "bg-green-500/10 text-green-500 border-green-500/30 hover:bg-green-500/20 hover:border-green-500",
      warning:
        "bg-orange-500/10 text-orange-500 border-orange-500/30 hover:bg-orange-500/20 hover:border-orange-500",
      info: "bg-blue-500/10 text-blue-500 border-blue-500/30 hover:bg-blue-500/20 hover:border-blue-500",
      purple:
        "bg-purple-500/10 text-purple-500 border-purple-500/30 hover:bg-purple-500/20 hover:border-purple-500",
      destructive:
        "bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20 hover:border-red-500",
      default:
        "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 hover:border-primary",
    };
    return cn(base, variants[variant]);
  };

  return (
    <div className="group relative flex flex-col sm:flex-row gap-6 p-6 rounded-3xl bg-card shadow-sm hover:shadow-xl transition-all duration-300">
      {/* Delete Button - Top Right */}
      {deleteAction && (
        <div className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteAction.onClick();
                }}
                className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 cursor-pointer rounded-lg"
              >
                <Trash weight="bold" className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="font-bold text-red-500">
              {deleteAction.label}
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Left Column: Image, Cost, Badges */}
      <div className="flex flex-col items-center gap-5 shrink-0 sm:w-48">
        {/* Cost Bubble */}
        {cost !== undefined && (
          <div className="relative z-10 -mb-6 w-full flex justify-center">
            {editingField === "cost" ? (
              <div className="flex items-center justify-center h-10 w-24 bg-card border-2 border-yellow-500 rounded-xl shadow-sm">
                <Input
                  ref={inputRef as React.RefObject<HTMLInputElement>}
                  value={tempValue}
                  onChange={(e) => setTempValue(e.target.value)}
                  onBlur={saveEdit}
                  onKeyDown={handleKeyDown}
                  className="w-full text-center font-bold text-xl text-yellow-500 bg-transparent border-none p-0 focus-visible:ring-0 h-full"
                />
              </div>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    onClick={() => startEdit("cost", cost)}
                    className="h-10 px-4 flex items-center justify-center gap-1.5 rounded-xl bg-card border-2 border-yellow-500/30 text-yellow-500 font-bold text-xl shadow-sm cursor-pointer hover:border-yellow-500 hover:bg-yellow-500 hover:text-white transition-all"
                  >
                    <CurrencyDollar className="h-5 w-5" weight="fill" />
                    {cost}
                  </div>
                </TooltipTrigger>
                <TooltipContent className="font-bold">Edit Cost</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}

        {/* Image Area */}
        <div className="relative w-40 h-56 sm:w-48 sm:h-64 [image-rendering:pixelated] flex items-center justify-center">
          {image}
        </div>

        {/* Badges/Rarity */}
        <div className="relative z-10 -mt-6 w-full flex justify-center">
          {badges}
        </div>
      </div>

      {/* Right Column: Details & Properties */}
      <div className="flex-1 min-w-0 flex flex-col gap-4 relative">
        {/* Header: ID & Name */}
        <div className="flex items-baseline gap-3 pb-2 border-b border-border/40 min-h-[3.5rem] pr-8">
          {/* ID Section */}
          {idValue !== undefined && (
            <div className="shrink-0 self-center">
              {editingField === "id" ? (
                <div className="flex items-center justify-center h-8 w-16 border-b border-primary">
                  <Input
                    ref={inputRef as React.RefObject<HTMLInputElement>}
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    onBlur={saveEdit}
                    onKeyDown={handleKeyDown}
                    className="text-center font-mono text-sm bg-transparent border-none p-0 focus-visible:ring-0 h-full"
                  />
                </div>
              ) : (
                <span
                  onClick={() => startEdit("id", idValue)}
                  className="text-muted-foreground/40 font-mono text-sm font-medium hover:text-primary cursor-pointer transition-colors select-none"
                >
                  #{idValue}
                </span>
              )}
            </div>
          )}

          {/* Name Section */}
          <div className="flex-1 min-w-0">
            {editingField === "name" ? (
              <Input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={handleKeyDown}
                className="text-3xl font-bold tracking-tight h-auto p-0 bg-transparent border-none focus-visible:ring-0 rounded-none placeholder:text-muted-foreground/50 w-full"
              />
            ) : (
              <h3
                className="text-3xl font-bold tracking-tight text-foreground truncate cursor-pointer hover:opacity-70 transition-opacity select-none"
                onClick={() => startEdit("name", name)}
                title={name}
              >
                {name}
              </h3>
            )}
          </div>
        </div>

        {/* Description Section */}
        <div className="flex-1 relative min-h-[100px]">
          {editingField === "desc" ? (
            <Textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={handleKeyDown}
              className="w-full h-full min-h-[120px] text-base resize-none font-medium leading-relaxed bg-transparent border-none focus-visible:ring-0 p-0"
            />
          ) : (
            <div
              className="w-full h-full cursor-pointer text-base leading-relaxed text-muted-foreground hover:text-foreground transition-colors break-words whitespace-pre-wrap"
              onClick={() => startEdit("desc", description)}
              dangerouslySetInnerHTML={{
                __html: description || "No description provided...",
              }}
            />
          )}
        </div>

        {/* Properties (Justified Toggles) */}
        {properties.length > 0 && (
          <div className="flex flex-wrap justify-between gap-2 pt-4 border-t border-border/40">
            {properties.map((prop) => (
              <Tooltip key={prop.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => {
                      e.preventDefault(); // Prevent tooltip close on focus loss
                      e.stopPropagation();
                      prop.onClick();
                    }}
                    onMouseDown={(e) => e.preventDefault()} // Prevent focus shifting
                    className={getPropertyStyles(prop.isActive, prop.variant)}
                  >
                    {prop.icon}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-bold">{prop.label}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}

        {/* Footer Actions */}
        {otherActions.length > 0 && (
          <div className="flex items-center justify-end gap-2 pt-2">
            {otherActions.map((action) => (
              <Tooltip key={action.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant={action.variant || "ghost"}
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      action.onClick();
                    }}
                    className={cn(
                      "h-9 w-9 transition-all hover:scale-110 rounded-lg cursor-pointer",
                    )}
                  >
                    {action.icon}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="font-bold">
                  {action.label}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
