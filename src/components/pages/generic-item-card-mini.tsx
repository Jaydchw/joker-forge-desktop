import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { BadgePreview } from "@/components/balatro/badge-preview";
import { ActionConfig } from "@/components/pages/generic-item-card";

export interface MiniField {
  id: string;
  label: string;
  value: string | number | null | undefined;
  editable?: boolean;
  type?: "text" | "number";
  min?: number;
  max?: number;
  step?: number;
  formatter?: (value: string | number | null | undefined) => string;
  onSave?: (value: string | number) => void;
}

export interface MiniBadgePreview {
  label: string;
  color: string;
  textColor?: string;
}

interface GenericItemCardMiniProps {
  title: string;
  subtitle?: string;
  accentColor?: string;
  badgePreview?: MiniBadgePreview;
  fields?: MiniField[];
  actions?: ActionConfig[];
  onTitleSave?: (value: string) => void;
  className?: string;
}

export function GenericItemCardMini({
  title,
  subtitle,
  accentColor,
  badgePreview,
  fields = [],
  actions = [],
  onTitleSave,
  className,
}: GenericItemCardMiniProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const startEdit = (id: string, value: string | number | null | undefined) => {
    setEditingId(id);
    setTempValue(value === undefined || value === null ? "" : String(value));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setTempValue("");
  };

  const saveEdit = () => {
    if (!editingId) return;

    if (editingId === "__title__") {
      const nextTitle = tempValue.trim();
      if (nextTitle && onTitleSave) onTitleSave(nextTitle);
      setEditingId(null);
      return;
    }

    const field = fields.find((f) => f.id === editingId);
    if (!field || !field.onSave) {
      setEditingId(null);
      return;
    }

    if (field.type === "number") {
      const num = Number(tempValue);
      if (!Number.isNaN(num)) field.onSave(num);
    } else {
      const next = tempValue.trim();
      if (next) field.onSave(next);
    }

    setEditingId(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveEdit();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
    }
  };

  const deleteAction = actions.find(
    (action) => action.id === "delete" || action.variant === "destructive",
  );
  const otherActions = actions.filter((action) => action !== deleteAction);

  const badgeTextColor = badgePreview?.textColor || "#ffffff";
  const resolvedBadge =
    badgePreview ||
    (accentColor
      ? {
          label: title,
          color: accentColor,
          textColor: badgeTextColor,
        }
      : null);

  return (
    <div
      className={cn(
        "group relative rounded-2xl bg-card/95 p-4 shadow-sm transition-shadow",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          {resolvedBadge && (
            <BadgePreview
              label={resolvedBadge.label}
              color={resolvedBadge.color}
              textColor={resolvedBadge.textColor}
              size="sm"
            />
          )}
          <div className="space-y-1">
            {editingId === "__title__" ? (
              <Input
                ref={inputRef}
                value={tempValue}
                onChange={(event) => setTempValue(event.target.value)}
                onBlur={saveEdit}
                onKeyDown={handleKeyDown}
                className="h-9 text-lg font-semibold bg-transparent border-none px-0 shadow-none focus-visible:ring-0"
              />
            ) : (
              <button
                onClick={() => onTitleSave && startEdit("__title__", title)}
                className={cn(
                  "text-left text-lg font-semibold text-foreground truncate",
                  onTitleSave &&
                    "cursor-pointer hover:text-primary transition-colors",
                )}
              >
                {title}
              </button>
            )}
            {subtitle && (
              <div className="text-xs text-muted-foreground font-mono truncate">
                {subtitle}
              </div>
            )}
          </div>
        </div>

        {deleteAction && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(event) => {
              event.stopPropagation();
              deleteAction.onClick();
            }}
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
          >
            {deleteAction.icon}
          </Button>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {fields.map((field, index) => {
          const displayValue = field.formatter
            ? field.formatter(field.value)
            : field.value === undefined || field.value === null
              ? "--"
              : String(field.value);

          return (
            <div key={field.id}>
              {index > 0 && <div className="h-px w-full bg-border/50" />}
              <div className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-muted-foreground">{field.label}</span>
                {editingId === field.id ? (
                  <Input
                    ref={inputRef}
                    type={field.type || "text"}
                    value={tempValue}
                    onChange={(event) => setTempValue(event.target.value)}
                    onBlur={saveEdit}
                    onKeyDown={handleKeyDown}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    className="h-8 w-28 text-right font-mono bg-transparent border-none px-0 shadow-none focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                ) : (
                  <button
                    className={cn(
                      "text-right font-mono",
                      field.editable &&
                        "cursor-pointer text-foreground hover:text-primary transition-colors",
                    )}
                    onClick={() =>
                      field.editable && startEdit(field.id, field.value)
                    }
                  >
                    {displayValue}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {otherActions.length > 0 && (
        <div className="mt-3 flex justify-end gap-2">
          {otherActions.map((action) => (
            <Button
              key={action.id}
              variant={action.variant || "secondary"}
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                action.onClick();
              }}
              className="gap-2 cursor-pointer"
            >
              {action.icon}
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
