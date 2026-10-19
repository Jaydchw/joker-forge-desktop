import { useEffect, useId, useMemo, useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { DotsSixVertical } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getEffectTypeById, getTriggerById } from "./rule-catalog";
import { getBlockMarkerDefinition } from "./block-markers";
import { getRuleLabel } from "./rule-names";
import { RuleNameEditor } from "./rule-name-editor";
import type { Effect, Rule } from "./types";

interface RuleOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rules: Rule[];
  selectedRuleId: string | null;
  onReorder: (orderedRuleIds: string[]) => void;
  onRuleNameRequest?: (ruleId: string) => void;
  onRuleNameChange?: (ruleId: string, name: string) => void;
  onRuleNameCancel?: () => void;
  renamingRuleId?: string | null;
  generateEffectTitle?: (effect: Effect) => string;
  disabledReason?: string;
  isBusy?: boolean;
}

function SortableRuleRow({
  rule,
  originalNumber,
  position,
  selected,
  disabled,
  onRuleNameRequest,
  onRuleNameChange,
  onRuleNameCancel,
  isNameEditing,
  nameDisabled,
  generateEffectTitle,
}: {
  rule: Rule;
  originalNumber: number;
  position: number;
  selected: boolean;
  disabled: boolean;
  onRuleNameRequest?: (ruleId: string) => void;
  onRuleNameChange?: (ruleId: string, name: string) => void;
  onRuleNameCancel?: () => void;
  isNameEditing: boolean;
  nameDisabled: boolean;
  generateEffectTitle?: (effect: Effect) => string;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: rule.id,
    disabled,
  });
  const triggerLabel = getTriggerById(rule.trigger)?.label.joker || "Unknown trigger";
  const effects = [
    ...(rule.effects ?? []),
    ...(rule.randomGroups ?? []).flatMap((group) => group.effects ?? []),
    ...(rule.loops ?? []).flatMap((group) => group.effects ?? []),
  ];
  const effectSummary = effects.length
    ? effects.slice(0, 2).map((effect) => generateEffectTitle?.(effect) || getEffectTypeById(effect.type)?.label || "Effect").join(" · ") +
      (effects.length > 2 ? ` · +${effects.length - 2} more` : "")
    : "No effects";
  const marker = getBlockMarkerDefinition(rule.markerColor);
  const ruleLabel = getRuleLabel(rule, originalNumber);

  return (
    <li
      ref={setNodeRef}
      data-rule-order-id={rule.id}
      aria-current={selected ? "true" : undefined}
      className={`relative flex items-center gap-2 rounded-lg border px-2 py-2.5 ${
        selected ? "border-jungle-green-400/60 bg-jungle-green-400/10" : "border-border bg-card"
      } ${isDragging ? "z-10 shadow-lg ring-2 ring-ring/50" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        type="button"
        data-rule-order-handle={rule.id}
        aria-label={`Drag ${ruleLabel} to reorder`}
        disabled={disabled}
        className="flex h-9 w-7 shrink-0 touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 cursor-grab active:cursor-grabbing"
      >
        <DotsSixVertical className="size-5" aria-hidden="true" />
      </button>
      <span
        aria-label={`Position ${position}`}
        className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium tabular-nums text-muted-foreground"
      >
        {position}
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex min-w-0 items-center gap-2">
          {marker && (
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: marker.color }}
              title={`${marker.label} rule color`}
              aria-hidden="true"
            />
          )}
          <RuleNameEditor
            rule={rule}
            ruleNumber={originalNumber}
            isEditing={isNameEditing}
            onEdit={onRuleNameRequest ? () => onRuleNameRequest(rule.id) : undefined}
            onCommit={onRuleNameChange ? (name) => onRuleNameChange(rule.id, name) : undefined}
            onCancel={onRuleNameCancel}
            disabled={nameDisabled}
            variant="list"
          />
          {selected && <span className="shrink-0 text-[10px] font-medium text-jungle-green-600 dark:text-jungle-green-300">Selected</span>}
        </div>
        <p className="truncate text-xs text-foreground/90" title={triggerLabel}>{triggerLabel}</p>
        <p className="truncate text-xs text-muted-foreground" title={effectSummary}>{effectSummary}</p>
      </div>
    </li>
  );
}

export function RuleOrderDialog({
  open,
  onOpenChange,
  rules,
  selectedRuleId,
  onReorder,
  onRuleNameRequest,
  onRuleNameChange,
  onRuleNameCancel,
  renamingRuleId = null,
  generateEffectTitle,
  disabledReason,
  isBusy = false,
}: RuleOrderDialogProps) {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const externalOrderKey = JSON.stringify(rules.map((rule) => rule.id));
  const [draftIds, setDraftIds] = useState(() => rules.map((rule) => rule.id));
  const [positionText, setPositionText] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [moveStatus, setMoveStatus] = useState("");
  const originalNumbers = useMemo(() => new Map(rules.map((rule, index) => [rule.id, index + 1])), [rules]);
  const rulesById = useMemo(() => new Map(rules.map((rule) => [rule.id, rule])), [rules]);
  const ruleLabel = (id: string) => getRuleLabel(rulesById.get(id) ?? {}, originalNumbers.get(id) ?? 0);
  const selectedPosition = selectedRuleId ? draftIds.indexOf(selectedRuleId) + 1 : 0;
  const blocked = Boolean(disabledReason) || isBusy;
  const validDraft = draftIds.length === rules.length && new Set(draftIds).size === rules.length && draftIds.every((id) => rulesById.has(id));
  const hasChanges = JSON.stringify(draftIds) !== externalOrderKey;
  const trimmedPosition = positionText.trim();
  const position = Number(trimmedPosition);
  const positionError = !trimmedPosition
    ? "Enter a position."
    : !/^\d+$/.test(trimmedPosition) || !Number.isSafeInteger(position)
      ? "Enter a whole number."
      : position < 1 || position > rules.length
        ? `Choose a position from 1 to ${rules.length}.`
        : undefined;
  const canMove = !blocked && !activeId && validDraft && selectedPosition > 0 && !positionError && position !== selectedPosition;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (!open) return;
    setDraftIds(JSON.parse(externalOrderKey) as string[]);
    setActiveId(null);
    setMoveStatus("");
  }, [open, externalOrderKey, selectedRuleId]);

  useEffect(() => {
    if (open) setPositionText(selectedPosition > 0 ? String(selectedPosition) : "");
  }, [open, selectedPosition]);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (blocked || !over || active.id === over.id) return;
    setDraftIds((previous) => {
      const from = previous.indexOf(String(active.id));
      const to = previous.indexOf(String(over.id));
      return from < 0 || to < 0 ? previous : arrayMove(previous, from, to);
    });
    setMoveStatus("");
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!isBusy) onOpenChange(nextOpen); }}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
        showCloseButton={!isBusy}
        onEscapeKeyDown={(event) => { if (activeId || renamingRuleId) event.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>Rule order</DialogTitle>
          <DialogDescription>{rules.length} {rules.length === 1 ? "rule" : "rules"}</DialogDescription>
        </DialogHeader>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={({ active }) => setActiveId(String(active.id))}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
          accessibility={{
            screenReaderInstructions: {
              draggable: "Press Space to pick up a rule, use the up and down arrow keys to move it, and press Space to drop. Press Escape to cancel dragging.",
            },
            announcements: {
              onDragStart: ({ active }) => `Picked up ${ruleLabel(String(active.id))}, position ${draftIds.indexOf(String(active.id)) + 1} of ${rules.length}.`,
              onDragOver: ({ active, over }) => over ? `${ruleLabel(String(active.id))} is over position ${draftIds.indexOf(String(over.id)) + 1}.` : undefined,
              onDragEnd: ({ active, over }) => over ? `${ruleLabel(String(active.id))} moved to position ${draftIds.indexOf(String(over.id)) + 1}.` : "Drag cancelled. Order unchanged.",
              onDragCancel: () => "Drag cancelled. Order unchanged.",
            },
          }}
        >
          <div className="max-h-[min(45vh,24rem)] overflow-y-auto overscroll-contain rounded-lg border border-border bg-muted/20 p-2">
            <SortableContext items={draftIds} strategy={verticalListSortingStrategy}>
              <ol aria-label="Rule order" className="space-y-2">
                {draftIds.map((id, index) => {
                  const rule = rulesById.get(id);
                  return rule ? (
                    <SortableRuleRow
                      key={id}
                      rule={rule}
                      originalNumber={originalNumbers.get(id) ?? index + 1}
                      position={index + 1}
                      selected={id === selectedRuleId}
                      disabled={blocked || !validDraft}
                      onRuleNameRequest={onRuleNameRequest}
                      onRuleNameChange={onRuleNameChange}
                      onRuleNameCancel={onRuleNameCancel}
                      isNameEditing={id === renamingRuleId}
                      nameDisabled={isBusy || Boolean(activeId)}
                      generateEffectTitle={generateEffectTitle}
                    />
                  ) : null;
                })}
              </ol>
            </SortableContext>
          </div>
        </DndContext>

        {selectedPosition > 0 && (
          <form
            noValidate
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!canMove) return;
              setDraftIds((previous) => arrayMove(previous, previous.indexOf(selectedRuleId!), position - 1));
              setMoveStatus(`${ruleLabel(selectedRuleId!)} moved to position ${position}.`);
            }}
          >
            <Label htmlFor={fieldId}>Move selected rule to</Label>
            <div className="flex items-center gap-2">
              <Input
                id={fieldId}
                type="number"
                min={1}
                max={rules.length}
                step={1}
                inputMode="numeric"
                value={positionText}
                onChange={(event) => setPositionText(event.target.value)}
                onFocus={(event) => event.target.select()}
                disabled={blocked || Boolean(activeId) || !validDraft}
                aria-invalid={Boolean(positionError)}
                aria-describedby={positionError ? errorId : undefined}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">of {rules.length}</span>
              <Button type="submit" variant="outline" disabled={!canMove} className="ml-auto">Move</Button>
            </div>
            {positionError && <p id={errorId} role="alert" className="text-sm text-destructive">{positionError}</p>}
          </form>
        )}
        <span className="sr-only" role="status" aria-live="polite">{moveStatus}</span>
        {disabledReason && <p role="status" className="text-sm leading-relaxed text-muted-foreground">{disabledReason}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={isBusy} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            type="button"
            disabled={blocked || Boolean(activeId) || !validDraft || !hasChanges}
            onClick={() => onReorder([...draftIds])}
          >
            {isBusy ? "Applying…" : "Apply order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
