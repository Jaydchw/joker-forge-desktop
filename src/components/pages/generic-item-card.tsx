import { useState, useRef, useEffect, ReactNode } from "react";
import { CurrencyDollar, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/balatro-utils";
import { RaritySelect } from "@/components/balatro/rarity-select";

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
  rarity?: number | string;
  onUpdate: (updates: {
    name?: string;
    description?: string;
    cost?: number;
    idValue?: number;
    objectKey?: string;
    rarity?: number;
  }) => void;
  onDuplicate?: () => void;
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
  rarity,
  onUpdate,
  onDuplicate,
}: GenericItemCardProps) {
  const [editingField, setEditingField] = useState<
    "none" | "name" | "desc" | "cost" | "id"
  >("none");
  const [tempValue, setTempValue] = useState("");
  const [tooltipStates, setTooltipStates] = useState<Record<string, boolean>>(
    {},
  );

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
      if (tempValue.trim()) {
        onUpdate({
          name: tempValue,
          objectKey: slugify(tempValue),
        });
      }
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

  const deleteAction = actions.find(
    (a) => a.id === "delete" || a.variant === "destructive",
  );
  const duplicateAction = actions.find((a) => a.id === "duplicate");
  const otherActions = actions.filter(
    (a) => a !== deleteAction && a !== duplicateAction,
  );

  const getPropertyStyles = (
    isActive: boolean,
    variant: CardProperty["variant"],
  ) => {
    const base =
      "flex items-center justify-center h-10 w-10 rounded-xl transition-all duration-200 cursor-pointer border-2 outline-none focus:outline-none";
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
    <div className="group relative flex flex-col sm:flex-row gap-6 p-6 rounded-3xl bg-card transition-all duration-300 h-90">
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

      <div className="flex flex-col items-center gap-5 shrink-0 sm:w-56">
        {cost !== undefined && (
          <div className="relative z-10 -mb-12 w-full flex justify-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  onClick={() =>
                    editingField !== "cost" && startEdit("cost", cost)
                  }
                  className="h-10 px-4 flex items-center justify-center gap-1.5 rounded-lg bg-card border-2 border-yellow-500/30 text-yellow-500 font-bold text-xl shadow-sm cursor-pointer hover:border-yellow-500 hover:bg-yellow-500 hover:text-white transition-all group/cost"
                >
                  <CurrencyDollar className="h-5 w-5" weight="fill" />
                  {editingField === "cost" ? (
                    <input
                      ref={inputRef as React.RefObject<HTMLInputElement>}
                      type="text"
                      value={tempValue}
                      onChange={(e) => setTempValue(e.target.value)}
                      onBlur={saveEdit}
                      onKeyDown={handleKeyDown}
                      className="w-12 text-center font-bold text-xl text-yellow-500 group-hover/cost:text-white bg-transparent border-none p-0 outline-none focus:outline-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span>{cost}</span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent className="font-bold">Edit Cost</TooltipContent>
            </Tooltip>
          </div>
        )}

        <div className="relative w-55 h-90 [image-rendering:pixelated] -mt-8 flex items-center justify-center">
          {image}
        </div>

        <div className="relative z-10 -mt-20 w-full flex justify-center">
          {rarity !== undefined ? (
            <RaritySelect
              value={String(rarity)}
              onChange={(val) => onUpdate({ rarity: Number(val) })}
            />
          ) : (
            badges
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-3 relative h-full">
        <div className="flex items-baseline gap-3 pb-2 border-b border-border/40 min-h-14 pr-8 shrink-0">
          {idValue !== undefined && (
            <div className="shrink-0 self-center">
              <span
                onClick={() =>
                  editingField !== "id" && startEdit("id", idValue)
                }
                className="text-muted-foreground/40 font-mono text-sm font-medium hover:text-primary cursor-pointer transition-colors select-none"
              >
                #
                {editingField === "id" ? (
                  <input
                    ref={inputRef as React.RefObject<HTMLInputElement>}
                    type="text"
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    onBlur={saveEdit}
                    onKeyDown={handleKeyDown}
                    className="w-12 text-center font-mono text-sm text-muted-foreground/40 font-medium bg-transparent border-none p-0 outline-none focus:outline-none inline-block"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  idValue
                )}
              </span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            {editingField === "name" ? (
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type="text"
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={handleKeyDown}
                className="text-3xl font-bold tracking-tight text-foreground bg-transparent border-none p-0 outline-none focus:outline-none w-full"
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

        <div className="flex-1 relative overflow-hidden">
          {editingField === "desc" ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={handleKeyDown}
              className="w-full h-full text-[13px] resize-none font-medium leading-relaxed text-muted-foreground bg-transparent border-none p-0 outline-none focus:outline-none"
            />
          ) : (
            <div
              className="w-full h-full cursor-pointer text-[13px] leading-relaxed text-muted-foreground hover:text-foreground transition-colors wrap-break-word whitespace-pre-wrap overflow-y-auto pr-2"
              onClick={() => startEdit("desc", description)}
              dangerouslySetInnerHTML={{
                __html: description || "No description provided...",
              }}
            />
          )}
        </div>

        <div className="mt-auto shrink-0 flex flex-col gap-4">
          {properties.length > 0 && (
            <div className="flex flex-wrap justify-between gap-2 pt-4 border-t border-border/40">
              {properties.map((prop) => (
                <Tooltip
                  key={prop.id}
                  open={tooltipStates[prop.id]}
                  onOpenChange={(open) =>
                    setTooltipStates((prev) => ({ ...prev, [prop.id]: open }))
                  }
                >
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        prop.onClick();
                        setTooltipStates((prev) => ({
                          ...prev,
                          [prop.id]: true,
                        }));
                      }}
                      onPointerDown={(e) => e.preventDefault()}
                      onMouseEnter={() =>
                        setTooltipStates((prev) => ({
                          ...prev,
                          [prop.id]: true,
                        }))
                      }
                      onMouseLeave={() =>
                        setTooltipStates((prev) => ({
                          ...prev,
                          [prop.id]: false,
                        }))
                      }
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

          <div className="flex items-center justify-between gap-2 pt-2">
            {duplicateAction && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onDuplicate) {
                        onDuplicate();
                      } else {
                        duplicateAction.onClick();
                      }
                    }}
                    onPointerDown={(e) => e.preventDefault()}
                    className="h-9 w-9 transition-all hover:scale-110 rounded-lg cursor-pointer"
                  >
                    {duplicateAction.icon}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="font-bold">
                  {duplicateAction.label}
                </TooltipContent>
              </Tooltip>
            )}

            <div className="flex gap-2">
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
                      onPointerDown={(e) => e.preventDefault()}
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
          </div>
        </div>
      </div>
    </div>
  );
}
