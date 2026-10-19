import { useLayoutEffect, useRef, type MouseEvent } from "react";
import { Input } from "@/components/ui/input";
import { getRuleLabel, getRuleName } from "./rule-names";
import type { Rule } from "./types";

interface RuleNameEditorProps {
  rule: Rule;
  ruleNumber: number;
  isEditing: boolean;
  onEdit?: () => void;
  onCommit?: (name: string) => void;
  onCancel?: () => void;
  onModifierClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  variant?: "header" | "list";
}

export function RuleNameEditor({
  rule, ruleNumber, isEditing, onEdit, onCommit, onCancel, onModifierClick,
  disabled = false, variant = "header",
}: RuleNameEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const finishedRef = useRef(false);
  const restoreFocusRef = useRef(false);
  const name = getRuleName(rule);
  const label = getRuleLabel(rule, ruleNumber);

  useLayoutEffect(() => {
    if (isEditing) {
      finishedRef.current = false;
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (restoreFocusRef.current) {
      restoreFocusRef.current = false;
      buttonRef.current?.focus();
    }
  }, [isEditing, rule.id]);

  const commit = () => {
    if (finishedRef.current || disabled) return;
    finishedRef.current = true;
    onCommit?.(inputRef.current?.value ?? "");
  };
  const content = (
    <>
      <span className={`block truncate ${variant === "header" ? "tracking-normal" : "text-sm font-medium"}`} title={name}>
        {name || `Rule ${ruleNumber}`}
      </span>
      {name && <span className={`block text-[10px] leading-tight text-muted-foreground ${variant === "header" ? "tracking-widest" : ""}`}>Rule {ruleNumber}</span>}
    </>
  );

  return (
    <div className={`min-w-0 ${variant === "list" ? "flex-1" : "max-w-full text-center"}`}>
      {isEditing ? (
        <Input
          ref={inputRef}
          data-rule-name-input={rule.id}
          aria-label={`Name for Rule ${ruleNumber}`}
          defaultValue={name ?? ""}
          placeholder={`Rule ${ruleNumber}`}
          autoComplete="off"
          disabled={disabled}
          className={`h-7 min-w-0 text-sm ${variant === "header" ? "w-48 max-w-full text-center" : "w-full"}`}
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || event.keyCode === 229) return;
            if (event.key === "Enter") {
              event.stopPropagation();
              event.preventDefault();
              restoreFocusRef.current = true;
              commit();
            } else if (event.key === "Escape") {
              event.stopPropagation();
              event.preventDefault();
              if (finishedRef.current) return;
              finishedRef.current = true;
              restoreFocusRef.current = true;
              onCancel?.();
            }
          }}
        />
      ) : onEdit ? (
        <button
          ref={buttonRef}
          type="button"
          data-rule-name-display={rule.id}
          aria-label={`Rename ${label}`}
          disabled={disabled}
          className={`block w-full min-w-0 rounded-sm text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${variant === "header" ? "text-center text-sm tracking-widest" : "text-left"}`}
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            if ((event.ctrlKey || event.metaKey) && onModifierClick) onModifierClick(event);
            else onEdit();
          }}
        >
          {content}
        </button>
      ) : <span className="block min-w-0">{content}</span>}
    </div>
  );
}
