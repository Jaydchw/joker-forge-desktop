import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  Rule,
  ConditionGroup,
  Condition as RuleCondition,
  Effect as RuleEffect,
  RandomGroup,
  SelectedItem,
  LoopGroup,
} from "./types";

import BlockComponent from "./block-component";
import {
  CaretDown,
  List,
  ArrowCounterClockwise,
  Flask,
  PuzzlePiece,
  Trash,
  Plus,
  Copy,
  X,
  DiceFive,
  Infinity,
  BookmarksSimple,
} from "@phosphor-icons/react";
import {
  JokerData,
  ConsumableData,
  EnhancementData,
  SealData,
  EditionData,
  VoucherData,
  DeckData,
} from "@/lib/balatro-utils";
import {
  getTriggerById,
  getEffectTypeById,
  getConditionTypeById,
} from "./rule-catalog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RuleCardProps {
  rule: Rule;
  ruleIndex: number;
  selectedItem: SelectedItem;
  onSelectItem: (item: {
    type: "trigger" | "condition" | "effect" | "randomgroup" | "loopgroup";
    ruleId: string;
    itemId?: string;
    groupId?: string;
    randomGroupId?: string;
    loopGroupId?: string;
  }) => void;
  onDeleteRule: (ruleId: string) => void;
  onDuplicateRule: (ruleId: string) => void;
  onSaveRuleTemplate: (ruleId: string) => void;
  onDeleteCondition: (ruleId: string, conditionId: string) => void;
  onDeleteConditionGroup: (ruleId: string, groupId: string) => void;
  onDeleteEffect: (ruleId: string, effectId: string) => void;
  onAddConditionGroup: (ruleId: string) => void;
  onAddRandomGroup: (ruleId: string) => void;
  onAddLoop: (ruleId: string) => void;
  onToggleBlueprintCompatibility: (ruleId: string) => void;
  onDeleteRandomGroup: (ruleId: string, randomGroupId: string) => void;
  onDeleteLoopGroup: (ruleId: string, randomGroupId: string) => void;
  onToggleGroupOperator?: (ruleId: string, groupId: string) => void;
  onUpdatePosition: (
    ruleId: string,
    position: { x: number; y: number },
    options?: { snap?: boolean },
  ) => void;
  onMoveSelectedRulesByDelta: (deltaX: number, deltaY: number) => void;
  onFinalizeMultiRuleDrag: () => void;
  isRuleSelected: boolean;
  selectedRuleCount: number;
  item:
    | JokerData
    | ConsumableData
    | EnhancementData
    | SealData
    | EditionData
    | VoucherData
    | DeckData;
  itemType: "joker" | "consumable" | "card" | "voucher" | "deck";
  generateConditionTitle: (condition: RuleCondition) => string;
  generateEffectTitle: (effect: RuleEffect) => string;
  formatTriggerLabel?: (label: string) => string;
  getParameterCount: (
    params: Record<string, { value: unknown; valueType?: string }>,
  ) => number;
  onUpdateConditionOperator: (
    ruleId: string,
    conditionId: string,
    operator: "and" | "or",
  ) => void;
  onRuleDoubleClick: () => void;
  onPreviewBlockCode?: (target: {
    type: "trigger" | "condition" | "effect";
    ruleId: string;
    itemId?: string;
    groupId?: string;
  }) => void;
  scale: number;
  isPaletteDragging: boolean;
  onSelectRuleCard: (ruleId: string, additive: boolean) => void;
}

const RuleTooltipButton: React.FC<{
  tooltip: string;
  className: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
}> = ({ tooltip, className, onClick, children }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Tooltip open={isHovered}>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={className}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onFocus={() => setIsHovered(true)}
          onBlur={() => setIsHovered(false)}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6} className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
};

const Condition: React.FC<{
  condition: RuleCondition;
  ruleId: string;
  groupId: string;
  isSelected: boolean;
  isNegated: boolean;
  onSelect: () => void;
  onDelete: () => void;
  parameterCount: number;
  dynamicTitle: string;
  itemType: "joker" | "consumable" | "card" | "voucher" | "deck";
  onPreviewCode?: () => void;
  scale: number;
}> = ({
  condition,
  ruleId,
  groupId,
  isSelected,
  isNegated,
  onSelect,
  onDelete,
  parameterCount,
  dynamicTitle,
  onPreviewCode,
  scale,
}) => {
  const conditionType = getConditionTypeById(condition.type);

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: condition.id });

  const adjustedTransform = transform
    ? {
        ...transform,
        x: transform.x / Math.max(scale, 0.1),
        y: transform.y / Math.max(scale, 0.1),
      }
    : null;

  const style = {
    transform: CSS.Transform.toString(adjustedTransform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="flex justify-center"
      data-rb-context="condition"
      data-rule-id={ruleId}
      data-group-id={groupId}
      data-item-id={condition.id}
    >
      <BlockComponent
        type="condition"
        label={conditionType?.label || "Unknown Condition"}
        dynamicTitle={dynamicTitle}
        isSelected={isSelected}
        onClick={(e) => {
          e?.stopPropagation();
          onSelect();
        }}
        showTrash={true}
        onDelete={() => {
          onDelete();
        }}
        parameterCount={parameterCount}
        isNegated={isNegated && condition.type !== "check_flag"}
        isDraggable={true}
        onIconClick={onPreviewCode}
        dragHandleProps={listeners}
        variant="palette"
      />
    </div>
  );
};

const Effect: React.FC<{
  effect: RuleEffect;
  ruleId: string;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  parameterCount: number;
  dynamicTitle: string;
  randomGroupId?: string;
  loopGroupId?: string;
  itemType: "joker" | "consumable" | "card" | "voucher" | "deck";
  onPreviewCode?: () => void;
  scale: number;
}> = ({
  effect,
  ruleId,
  isSelected,
  onSelect,
  onDelete,
  parameterCount,
  dynamicTitle,
  randomGroupId,
  loopGroupId,
  onPreviewCode,
  scale,
}) => {
  const effectType = getEffectTypeById(effect.type);

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: effect.id });

  const adjustedTransform = transform
    ? {
        ...transform,
        x: transform.x / Math.max(scale, 0.1),
        y: transform.y / Math.max(scale, 0.1),
      }
    : null;

  const style = {
    transform: CSS.Transform.toString(adjustedTransform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="flex justify-center"
      data-rb-context="effect"
      data-rule-id={ruleId}
      data-item-id={effect.id}
      data-random-group-id={randomGroupId}
      data-loop-group-id={loopGroupId}
    >
      <BlockComponent
        type="effect"
        label={effectType?.label || "Unknown Effect"}
        dynamicTitle={dynamicTitle}
        isSelected={isSelected}
        onClick={(e) => {
          e?.stopPropagation();
          onSelect();
        }}
        showTrash={true}
        onDelete={() => {
          onDelete();
        }}
        parameterCount={parameterCount}
        isDraggable={true}
        onIconClick={onPreviewCode}
        dragHandleProps={listeners}
        variant="palette"
      />
    </div>
  );
};

const RandomGroupContainer: React.FC<{
  group: RandomGroup;
  ruleId: string;
  children: React.ReactNode;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}> = ({ group, ruleId, children, isSelected, onSelect, onDelete }) => {
  return (
    <div
      className={`border-2 border-dashed rounded-xl p-4 bg-jungle-green-500/8 relative transition-all min-h-30 w-full max-w-full ${
        isSelected ? "border-jungle-green-400" : "border-jungle-green-400/30"
      }`}
      data-rb-context="random-group"
      data-rule-id={ruleId}
      data-random-group-id={group.id}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="text-jungle-green-400 text-xs tracking-wider font-medium">
          {group.chance_numerator.value} in {group.chance_denominator.value}{" "}
          chance {isSelected && "(SELECTED)"}
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <RuleTooltipButton
            tooltip="Delete Random Group"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="w-full h-full flex items-center rounded justify-center"
          >
            <X className="h-4 w-4 text-jungle-green-400/60 hover:text-jungle-green-400 cursor-pointer transition-colors" />
          </RuleTooltipButton>
        </div>
      </div>
      {children}
    </div>
  );
};

const LoopGroupContainer: React.FC<{
  group: LoopGroup;
  ruleId: string;
  children: React.ReactNode;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}> = ({ group, ruleId, children, isSelected, onSelect, onDelete }) => {
  return (
    <div
      className={`border-2 border-dashed rounded-xl p-4 bg-balatro-blue/10 relative transition-all min-h-30 w-full max-w-full ${
        isSelected ? "border-balatro-blue" : "border-balatro-blue/30"
      }`}
      data-rb-context="loop-group"
      data-rule-id={ruleId}
      data-loop-group-id={group.id}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="text-balatro-blue text-xs tracking-wider font-medium">
          Loop {group.repetitions.value} times {isSelected && "(SELECTED)"}
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <RuleTooltipButton
            tooltip="Delete Loop"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="w-full h-full flex items-center rounded justify-center"
          >
            <X className="h-4 w-4 text-balatro-blue/60 hover:text-balatro-blue cursor-pointer transition-colors" />
          </RuleTooltipButton>
        </div>
      </div>
      {children}
    </div>
  );
};

const RuleCard: React.FC<RuleCardProps> = ({
  rule,
  ruleIndex,
  selectedItem,
  onSelectItem,
  onDuplicateRule,
  onSaveRuleTemplate,
  onDeleteRule,
  onDeleteCondition,
  onDeleteConditionGroup,
  onDeleteEffect,
  onAddConditionGroup,
  onToggleBlueprintCompatibility,
  onAddRandomGroup,
  onAddLoop,
  onDeleteRandomGroup,
  onDeleteLoopGroup,
  onToggleGroupOperator,
  onUpdatePosition,
  onMoveSelectedRulesByDelta,
  onFinalizeMultiRuleDrag,
  isRuleSelected,
  selectedRuleCount,
  generateConditionTitle,
  generateEffectTitle,
  formatTriggerLabel,
  getParameterCount,
  onUpdateConditionOperator,
  itemType,
  onRuleDoubleClick,
  onPreviewBlockCode,
  scale,
  isPaletteDragging,
  onSelectRuleCard,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [groupOperators, setGroupOperators] = useState<Record<string, string>>(
    {},
  );
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const didDragRef = useRef(false);

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop:rule:${rule.id}`,
  });

  const isMultiSelectionDragging =
    isDragging && isRuleSelected && selectedRuleCount > 1;
  const transformOffset =
    isDragging && !isMultiSelectionDragging ? dragOffset : { x: 0, y: 0 };

  const handleCardMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      e.stopPropagation();
      didDragRef.current = false;
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
      };
    }
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        const deltaX =
          (e.clientX - dragStartRef.current.x) / Math.max(scale, 0.1);
        const deltaY =
          (e.clientY - dragStartRef.current.y) / Math.max(scale, 0.1);
        if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
          didDragRef.current = true;
        }

        if (isMultiSelectionDragging) {
          onMoveSelectedRulesByDelta(deltaX, deltaY);
          dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
          };
          return;
        }

        setDragOffset({ x: deltaX, y: deltaY });
      }
    },
    [isDragging, isMultiSelectionDragging, onMoveSelectedRulesByDelta, scale],
  );

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);

      if (isMultiSelectionDragging) {
        onFinalizeMultiRuleDrag();
        setDragOffset({ x: 0, y: 0 });
        return;
      }

      const finalPosition = {
        x: (rule.position?.x || 0) + dragOffset.x,
        y: (rule.position?.y || 0) + dragOffset.y,
      };
      onUpdatePosition(rule.id, finalPosition);
      setDragOffset({ x: 0, y: 0 });
    }
  }, [
    dragOffset,
    isDragging,
    isMultiSelectionDragging,
    onFinalizeMultiRuleDrag,
    onUpdatePosition,
    rule.id,
    rule.position,
  ]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const trigger = getTriggerById(rule.trigger);
  const triggerLabel = formatTriggerLabel
    ? formatTriggerLabel(trigger?.label[itemType] || "Unknown Trigger")
    : trigger?.label[itemType] || "Unknown Trigger";
  const allConditions = rule.conditionGroups.flatMap(
    (group) => group.conditions,
  );
  const totalConditions = allConditions.length;
  const totalEffects =
    rule.effects.length +
    rule.randomGroups.reduce((sum, group) => sum + group.effects.length, 0) +
    rule.loops.reduce((sum, group) => sum + group.effects.length, 0);
  const shouldRenderSingleConditionDirectly = totalConditions === 1;
  const singleConditionGroup = shouldRenderSingleConditionDirectly
    ? rule.conditionGroups.find((group) => group.conditions.length > 0)
    : undefined;
  const singleCondition = singleConditionGroup?.conditions[0];

  const snapFadeUp = {
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -15 },
  };
  const quickFade = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  };
  const slideFromRight = {
    initial: { opacity: 0, x: 20, scale: 0.9 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: 20, scale: 0.9 },
  };
  const cardEntrance = {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
  };
  const popIn = {
    initial: { opacity: 0, scale: 0.8, y: 10 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.8, y: -10 },
  };

  const isItemSelected = (
    type: "trigger" | "condition" | "effect" | "randomgroup" | "loopgroup",
    itemId?: string,
    groupId?: string,
    randomGroupId?: string,
    loopGroupId?: string,
  ) => {
    if (!selectedItem || selectedItem.ruleId !== rule.id) return false;
    if (selectedItem.type !== type) return false;
    if (type === "trigger") return true;
    if (type === "condition" && groupId && selectedItem.groupId !== groupId)
      return false;
    if (
      type === "randomgroup" &&
      randomGroupId &&
      selectedItem.randomGroupId !== randomGroupId
    )
      return false;
    if (
      type === "loopgroup" &&
      loopGroupId &&
      selectedItem.loopGroupId !== loopGroupId
    )
      return false;
    if (type === "effect") {
      if (selectedItem.itemId !== itemId) return false;
      if (randomGroupId && selectedItem.randomGroupId !== randomGroupId)
        return false;
      if (!randomGroupId && selectedItem.randomGroupId) return false;
      if (loopGroupId && selectedItem.loopGroupId !== loopGroupId) return false;
      if (!loopGroupId && selectedItem.loopGroupId) return false;
      return true;
    }
    return selectedItem.itemId === itemId;
  };

  const isGroupSelected = (groupId: string) => {
    return (
      selectedItem?.ruleId === rule.id && selectedItem?.groupId === groupId
    );
  };
  const isRandomGroupSelected = (randomGroupId: string) => {
    return (
      selectedItem?.ruleId === rule.id &&
      selectedItem?.randomGroupId === randomGroupId
    );
  };
  const isLoopGroupSelected = (loopGroupId: string) => {
    return (
      selectedItem?.ruleId === rule.id &&
      selectedItem?.loopGroupId === loopGroupId
    );
  };

  const handleDuplicateRule = () => onDuplicateRule(rule.id);

  const handleConditionOperatorToggle = (
    groupId: string,
    conditionIndex: number,
  ) => {
    const group = rule.conditionGroups.find((g) => g.id === groupId);
    if (group && group.conditions[conditionIndex]) {
      const condition = group.conditions[conditionIndex];
      const newOperator =
        (condition.operator || "and") === "and" ? "or" : "and";
      onUpdateConditionOperator(rule.id, condition.id, newOperator);
    }
  };

  const handleGroupOperatorToggle = (groupIndex: number, groupId: string) => {
    const key = `group-${groupIndex}`;
    const newOperator = (groupOperators[key] || "AND") === "AND" ? "OR" : "AND";
    setGroupOperators((prev) => ({ ...prev, [key]: newOperator }));
    onToggleGroupOperator?.(rule.id, groupId);
  };

  const renderConditionGroup = (group: ConditionGroup, groupIndex: number) => {
    const isSelected = isGroupSelected(group.id);
    return (
      <motion.div
        key={group.id}
        className="relative"
        variants={popIn}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.15, delay: 0.03 }}
      >
        <div
          className={`border-2 border-dashed rounded-xl p-4 bg-card/80 relative ${
            isSelected ? "border-jungle-green-400" : "border-border"
          }`}
          data-rb-context="condition-group"
          data-rule-id={rule.id}
          data-group-id={group.id}
          onClick={(e) => {
            e.stopPropagation();
            onSelectItem({
              type: "condition",
              ruleId: rule.id,
              groupId: group.id,
            });
          }}
        >
          <div className="flex items-center justify-between mb-10">
            <div className="text-muted-foreground text-xs tracking-wider">
              CONDITION GROUP {groupIndex + 1} {isSelected && "(SELECTED)"}
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <RuleTooltipButton
                tooltip="Delete Condition Group"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteConditionGroup(rule.id, group.id);
                }}
                className="w-full h-full flex items-center rounded justify-center"
              >
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-pointer transition-colors" />
              </RuleTooltipButton>
            </div>
          </div>
          <SortableContext
            items={group.conditions.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {group.conditions.map((condition, conditionIndex) => {
                const currentOperator = condition.operator || "and";
                return (
                  <motion.div key={condition.id}>
                    <div onClick={(e) => e.stopPropagation()}>
                      <Condition
                        condition={condition}
                        ruleId={rule.id}
                        groupId={group.id}
                        isSelected={isItemSelected(
                          "condition",
                          condition.id,
                          group.id,
                        )}
                        isNegated={condition.negate}
                        onSelect={() =>
                          onSelectItem({
                            type: "condition",
                            ruleId: rule.id,
                            itemId: condition.id,
                            groupId: group.id,
                          })
                        }
                        onDelete={() =>
                          onDeleteCondition(rule.id, condition.id)
                        }
                        parameterCount={getParameterCount(condition.params)}
                        dynamicTitle={generateConditionTitle(condition)}
                        itemType={itemType}
                        onPreviewCode={() =>
                          onPreviewBlockCode?.({
                            type: "condition",
                            ruleId: rule.id,
                            itemId: condition.id,
                            groupId: group.id,
                          })
                        }
                        scale={scale}
                      />
                    </div>
                    {conditionIndex < group.conditions.length - 1 && (
                      <div
                        className="text-center py-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() =>
                            handleConditionOperatorToggle(
                              group.id,
                              conditionIndex,
                            )
                          }
                          className="px-3 text-muted-foreground text-sm font-medium tracking-wider cursor-pointer rounded-lg transition-colors hover:bg-accent"
                        >
                          {currentOperator.toUpperCase()}
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </SortableContext>
        </div>
        {groupIndex < rule.conditionGroups.length - 1 && (
          <div className="text-center py-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleGroupOperatorToggle(groupIndex, group.id);
              }}
              className="px-3 text-muted-foreground text-sm font-medium tracking-wider cursor-pointer rounded-lg transition-colors hover:bg-accent"
            >
              {groupOperators[`group-${groupIndex}`] ||
                group.operator?.toUpperCase() ||
                "AND"}
            </button>
          </div>
        )}
      </motion.div>
    );
  };

  const renderRandomGroup = (group: RandomGroup) => {
    return (
      <motion.div
        key={`rg-motion-${group.id}`}
        className="relative"
        variants={popIn}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.15, delay: 0.03 }}
      >
        <RandomGroupContainer
          group={group}
          ruleId={rule.id}
          isSelected={isRandomGroupSelected(group.id)}
          onSelect={() =>
            onSelectItem({
              type: "randomgroup",
              ruleId: rule.id,
              randomGroupId: group.id,
            })
          }
          onDelete={() => onDeleteRandomGroup(rule.id, group.id)}
        >
          <SortableContext
            id={group.id}
            items={group.effects.map((e) => e.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {group.effects.map((effect) => (
                <div key={effect.id} onClick={(e) => e.stopPropagation()}>
                  <Effect
                    effect={effect}
                    ruleId={rule.id}
                    randomGroupId={group.id}
                    isSelected={isItemSelected("effect", effect.id)}
                    onSelect={() =>
                      onSelectItem({
                        type: "effect",
                        ruleId: rule.id,
                        itemId: effect.id,
                        randomGroupId: group.id,
                      })
                    }
                    onDelete={() => onDeleteEffect(rule.id, effect.id)}
                    parameterCount={getParameterCount(effect.params)}
                    dynamicTitle={generateEffectTitle(effect)}
                    itemType={itemType}
                    onPreviewCode={() =>
                      onPreviewBlockCode?.({
                        type: "effect",
                        ruleId: rule.id,
                        itemId: effect.id,
                      })
                    }
                    scale={scale}
                  />
                </div>
              ))}
            </div>
          </SortableContext>
        </RandomGroupContainer>
      </motion.div>
    );
  };

  const renderLoopGroup = (group: LoopGroup) => {
    return (
      <motion.div
        key={`rg-motion-${group.id}`}
        className="relative"
        variants={popIn}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.15, delay: 0.03 }}
      >
        <LoopGroupContainer
          group={group}
          ruleId={rule.id}
          isSelected={isLoopGroupSelected(group.id)}
          onSelect={() =>
            onSelectItem({
              type: "loopgroup",
              ruleId: rule.id,
              loopGroupId: group.id, ///////
            })
          }
          onDelete={() => onDeleteLoopGroup(rule.id, group.id)}
        >
          <SortableContext
            id={group.id}
            items={group.effects.map((e) => e.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {group.effects.map((effect) => (
                <div key={effect.id} onClick={(e) => e.stopPropagation()}>
                  <Effect
                    effect={effect}
                    ruleId={rule.id}
                    loopGroupId={group.id}
                    isSelected={isItemSelected("effect", effect.id)}
                    onSelect={() =>
                      onSelectItem({
                        type: "effect",
                        ruleId: rule.id,
                        itemId: effect.id,
                        loopGroupId: group.id,
                      })
                    }
                    onDelete={() => onDeleteEffect(rule.id, effect.id)}
                    parameterCount={getParameterCount(effect.params)}
                    dynamicTitle={generateEffectTitle(effect)}
                    itemType={itemType}
                    onPreviewCode={() =>
                      onPreviewBlockCode?.({
                        type: "effect",
                        ruleId: rule.id,
                        itemId: effect.id,
                      })
                    }
                    scale={scale}
                  />
                </div>
              ))}
            </div>
          </SortableContext>
        </LoopGroupContainer>
      </motion.div>
    );
  };

  return (
    <div
      ref={setDropRef}
      className="w-80 relative pl-8 select-none"
      data-rb-context="rule"
      data-rule-id={rule.id}
      style={{
        zIndex: isRuleSelected ? 30 : 20,
        pointerEvents: "auto",
        transform: `translate(${transformOffset.x}px, ${transformOffset.y}px)`,
        cursor: isDragging ? "grabbing" : "default",
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (didDragRef.current) {
          didDragRef.current = false;
          return;
        }
        onSelectRuleCard(rule.id, e.ctrlKey || e.metaKey);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onRuleDoubleClick();
      }}
      onMouseDown={handleCardMouseDown}
    >
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="absolute left-0 top-9 -ml-6 bg-card/95 border border-border rounded-xl z-20 flex flex-col gap-2 py-2 p-1.5 shadow-lg"
            variants={slideFromRight}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.15 }}
          >
            <motion.div
              className="w-8 h-8 bg-card rounded-xl flex items-center justify-center border border-destructive/40"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.05 }}
            >
              <RuleTooltipButton
                tooltip="Delete Rule"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteRule(rule.id);
                }}
                className="w-full h-full flex items-center rounded-lg justify-center transition-colors hover:bg-destructive/15 active:bg-destructive/20 cursor-pointer focus:outline-none"
              >
                <Trash className="h-4 w-4 text-destructive transition-colors" />
              </RuleTooltipButton>
            </motion.div>
            <motion.div
              className="w-8 h-8 bg-card rounded-xl flex items-center justify-center border border-balatro-blue/40"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.05 }}
            >
              <RuleTooltipButton
                tooltip="Duplicate Rule"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDuplicateRule();
                  setSidebarOpen(false);
                }}
                className="w-full h-full flex items-center rounded-lg justify-center transition-colors hover:bg-balatro-blue/15 cursor-pointer focus:outline-none"
              >
                <Copy className="h-4 w-4 text-balatro-blue" />
              </RuleTooltipButton>
            </motion.div>
            <motion.div
              className="w-8 h-8 bg-card rounded-xl flex items-center justify-center border border-jungle-green-400/40"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.05 }}
            >
              <RuleTooltipButton
                tooltip="Save Rule as Template"
                onClick={(e) => {
                  e.stopPropagation();
                  onSaveRuleTemplate(rule.id);
                  setSidebarOpen(false);
                }}
                className="w-full h-full flex items-center rounded-lg justify-center transition-colors hover:bg-jungle-green-500/15 cursor-pointer focus:outline-none"
              >
                <BookmarksSimple className="h-4 w-4 text-jungle-green-400" />
              </RuleTooltipButton>
            </motion.div>
            <motion.div
              className="w-8 h-8 bg-card rounded-xl flex items-center justify-center border border-border"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.05 }}
            >
              <RuleTooltipButton
                tooltip="Close Menu"
                onClick={(e) => {
                  e.stopPropagation();
                  setSidebarOpen(false);
                }}
                className="w-full h-full flex items-center rounded-lg justify-center transition-colors hover:bg-accent cursor-pointer focus:outline-none"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </RuleTooltipButton>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className={`w-80 relative`}
        variants={cardEntrance}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.3 }}
      >
        <motion.div
          className="flex justify-center relative"
          variants={snapFadeUp}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.15 }}
          onMouseDown={handleHeaderMouseDown}
          style={{ cursor: isDragging ? "grabbing" : "grab" }}
        >
          <div
            className={`bg-card/95 border rounded-t-xl px-8 py-2 pt-1 relative ${
              isRuleSelected ? "border-jungle-green-400" : "border-border"
            } `}
          >
            <span className="text-foreground text-sm tracking-widest">
              Rule {ruleIndex}
            </span>
          </div>
        </motion.div>

        <motion.div
          className={`
            bg-card/95 border-2 rounded-xl overflow-hidden -mt-2 relative
            ${isRuleSelected ? "border-jungle-green-400" : "border-border"}
            ${isPaletteDragging && isOver ? "ring-2 ring-jungle-green-400/70" : ""}
          `}
          style={{ pointerEvents: "auto" }}
          variants={snapFadeUp}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.18, delay: 0.05 }}
        >
          <div
            className="bg-background/60 px-3 py-2 border-b border-border"
            onMouseDown={handleHeaderMouseDown}
            style={{ cursor: isDragging ? "grabbing" : "grab" }}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSidebarOpen(!sidebarOpen);
                      }}
                      className="p-1 text-muted-foreground hover:bg-accent rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      transition={{ duration: 0.05 }}
                    >
                      <List className="h-4 w-4" />
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    sideOffset={6}
                    className="text-xs"
                  >
                    {sidebarOpen ? "Close Rule Menu" : "Open Rule Menu"}
                  </TooltipContent>
                </Tooltip>
                <RuleTooltipButton
                  tooltip="Save Rule as Template"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSaveRuleTemplate(rule.id);
                  }}
                  className="p-1 text-jungle-green-400 hover:bg-jungle-green-500/15 rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-jungle-green-400/40"
                >
                  <BookmarksSimple className="h-4 w-4" />
                </RuleTooltipButton>
              </div>
              <motion.div
                className="flex items-center gap-3"
                variants={quickFade}
                initial="initial"
                animate="animate"
                transition={{ duration: 0.12, delay: 0.08 }}
              >
                {totalConditions > 0 && (
                  <span className="text-muted-foreground text-xs inline-flex items-center gap-1">
                    <Flask className="h-3 w-3 text-balatro-blue" />
                    {totalConditions}
                  </span>
                )}
                {totalEffects > 0 && (
                  <span className="text-muted-foreground text-xs inline-flex items-center gap-1">
                    <PuzzlePiece className="h-3 w-3 text-balatro-green" />
                    {totalEffects}
                  </span>
                )}
                <div className="flex items-center gap-2">
                  {rule.conditionGroups.length > 0 && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <RuleTooltipButton
                        tooltip="Add Condition Group"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddConditionGroup(rule.id);
                        }}
                        className="w-6 h-6 bg-card rounded-md flex items-center justify-center border-2 border-jungle-green-400/40 hover:bg-jungle-green-500/15 transition-colors cursor-pointer"
                      >
                        <Plus className="h-3 w-3 text-jungle-green-400" />
                      </RuleTooltipButton>
                    </div>
                  )}
                  <div onClick={(e) => e.stopPropagation()}>
                    <RuleTooltipButton
                      tooltip="Add Loop Group"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddLoop(rule.id);
                      }}
                      className="w-6 h-6 bg-card rounded-md flex items-center justify-center border-2 border-balatro-blue/40 hover:bg-balatro-blue/15 transition-colors cursor-pointer"
                    >
                      <ArrowCounterClockwise className="h-3 w-3 text-balatro-blue" />
                    </RuleTooltipButton>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <RuleTooltipButton
                      tooltip="Add Random Group"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddRandomGroup(rule.id);
                      }}
                      className="w-6 h-6 bg-card rounded-md flex items-center justify-center border-2 border-balatro-green/40 hover:bg-balatro-green/15 transition-colors cursor-pointer"
                    >
                      <DiceFive className="h-3.5 w-3.5 text-balatro-green" />
                    </RuleTooltipButton>
                  </div>
                  {itemType === "joker" && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <RuleTooltipButton
                        tooltip={
                          (rule.blueprintCompatible ?? true)
                            ? "Copied by Blueprint"
                            : "Not Copied by Blueprint"
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleBlueprintCompatibility(rule.id);
                        }}
                        className={`w-6 h-6 bg-card rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                          (rule.blueprintCompatible ?? true)
                            ? "border-2 border-balatro-blue/40 hover:bg-balatro-blue/15"
                            : "border-2 border-destructive/40 hover:bg-destructive/15"
                        }`}
                      >
                        <Infinity
                          className={`h-3.5 w-3.5 ${
                            (rule.blueprintCompatible ?? true)
                              ? "text-balatro-blue"
                              : "text-balatro-red"
                          }`}
                        />
                      </RuleTooltipButton>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </div>

          <motion.div
            className="p-4 space-y-3"
            variants={quickFade}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.15, delay: 0.1 }}
          >
            <motion.div
              variants={snapFadeUp}
              initial="initial"
              animate="animate"
              transition={{ duration: 0.12, delay: 0.12 }}
              className="flex justify-center"
              data-rb-context="trigger"
              data-rule-id={rule.id}
            >
              <BlockComponent
                type="trigger"
                label={triggerLabel}
                isSelected={isItemSelected("trigger")}
                onIconClick={() =>
                  onPreviewBlockCode?.({
                    type: "trigger",
                    ruleId: rule.id,
                  })
                }
                onClick={(e) => {
                  e?.stopPropagation();
                  onSelectRuleCard(rule.id, !!(e?.ctrlKey || e?.metaKey));
                }}
                variant="palette"
              />
            </motion.div>

            {(rule.conditionGroups.length > 0 ||
              rule.effects.length > 0 ||
              rule.randomGroups.length > 0 ||
              rule.loops.length > 0) && (
              <motion.div
                className="flex justify-center"
                variants={quickFade}
                initial="initial"
                animate="animate"
                transition={{ duration: 0.1, delay: 0.15 }}
              >
                <CaretDown className="h-5 w-5 text-muted-foreground" />
              </motion.div>
            )}

            {rule.conditionGroups.length > 0 && (
              <motion.div
                variants={quickFade}
                initial="initial"
                animate="animate"
                transition={{ duration: 0.1, delay: 0.17 }}
                className="space-y-3"
              >
                {shouldRenderSingleConditionDirectly &&
                singleCondition &&
                singleConditionGroup ? (
                  <SortableContext
                    items={[singleCondition.id]}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      <Condition
                        condition={singleCondition}
                        ruleId={rule.id}
                        groupId={singleConditionGroup.id}
                        isSelected={isItemSelected(
                          "condition",
                          singleCondition.id,
                          singleConditionGroup.id,
                        )}
                        isNegated={singleCondition.negate}
                        onSelect={() =>
                          onSelectItem({
                            type: "condition",
                            ruleId: rule.id,
                            itemId: singleCondition.id,
                            groupId: singleConditionGroup.id,
                          })
                        }
                        onDelete={() =>
                          onDeleteCondition(rule.id, singleCondition.id)
                        }
                        parameterCount={getParameterCount(
                          singleCondition.params,
                        )}
                        dynamicTitle={generateConditionTitle(singleCondition)}
                        itemType={itemType}
                        onPreviewCode={() =>
                          onPreviewBlockCode?.({
                            type: "condition",
                            ruleId: rule.id,
                            itemId: singleCondition.id,
                            groupId: singleConditionGroup.id,
                          })
                        }
                        scale={scale}
                      />
                    </div>
                  </SortableContext>
                ) : (
                  rule.conditionGroups.map((group, index) =>
                    renderConditionGroup(group, index),
                  )
                )}
              </motion.div>
            )}

            {(rule.effects.length > 0 ||
              rule.randomGroups.length > 0 ||
              rule.loops.length > 0) &&
              rule.conditionGroups.length > 0 && (
                <motion.div
                  className="flex justify-center"
                  variants={quickFade}
                  initial="initial"
                  animate="animate"
                  transition={{ duration: 0.1, delay: 0.2 }}
                >
                  <CaretDown className="h-5 w-5 text-zinc-400" />
                </motion.div>
              )}

            <motion.div
              className="space-y-3"
              variants={quickFade}
              initial="initial"
              animate="animate"
              transition={{ duration: 0.1, delay: 0.22 }}
            >
              <SortableContext
                items={rule.effects.map((e) => e.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {rule.effects.map((effect) => (
                    <div key={effect.id}>
                      <Effect
                        effect={effect}
                        ruleId={rule.id}
                        isSelected={isItemSelected("effect", effect.id)}
                        onSelect={() =>
                          onSelectItem({
                            type: "effect",
                            ruleId: rule.id,
                            itemId: effect.id,
                          })
                        }
                        onDelete={() => onDeleteEffect(rule.id, effect.id)}
                        parameterCount={getParameterCount(effect.params)}
                        dynamicTitle={generateEffectTitle(effect)}
                        itemType={itemType}
                        onPreviewCode={() =>
                          onPreviewBlockCode?.({
                            type: "effect",
                            ruleId: rule.id,
                            itemId: effect.id,
                          })
                        }
                        scale={scale}
                      />
                    </div>
                  ))}
                </div>
              </SortableContext>
            </motion.div>

            <motion.div
              className="space-y-3"
              variants={quickFade}
              initial="initial"
              animate="animate"
              transition={{ duration: 0.1, delay: 0.24 }}
            >
              {rule.randomGroups.map((group) => renderRandomGroup(group))}
            </motion.div>
            <motion.div
              className="space-y-3"
              variants={quickFade}
              initial="initial"
              animate="animate"
              transition={{ duration: 0.1, delay: 0.24 }}
            >
              {rule.loops.map((group) => renderLoopGroup(group))}
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
};

const affectsRule = (selectedItem: SelectedItem, ruleId: string) => {
  return selectedItem?.ruleId === ruleId;
};

const areRuleCardPropsEqual = (prev: RuleCardProps, next: RuleCardProps) => {
  if (prev.rule !== next.rule) return false;
  if (prev.ruleIndex !== next.ruleIndex) return false;
  if (prev.isRuleSelected !== next.isRuleSelected) return false;
  if (prev.selectedRuleCount !== next.selectedRuleCount) return false;
  if (prev.item !== next.item) return false;
  if (prev.itemType !== next.itemType) return false;
  if (prev.scale !== next.scale) return false;
  if (prev.isPaletteDragging !== next.isPaletteDragging) return false;

  const prevSelectedAffectsRule = affectsRule(prev.selectedItem, prev.rule.id);
  const nextSelectedAffectsRule = affectsRule(next.selectedItem, next.rule.id);
  if (prevSelectedAffectsRule !== nextSelectedAffectsRule) return false;

  if (prevSelectedAffectsRule && nextSelectedAffectsRule) {
    if (prev.selectedItem?.type !== next.selectedItem?.type) return false;
    if (prev.selectedItem?.itemId !== next.selectedItem?.itemId) return false;
    if (prev.selectedItem?.groupId !== next.selectedItem?.groupId) return false;
    if (prev.selectedItem?.randomGroupId !== next.selectedItem?.randomGroupId)
      return false;
    if (prev.selectedItem?.loopGroupId !== next.selectedItem?.loopGroupId)
      return false;
  }

  return true;
};

export default React.memo(RuleCard, areRuleCardPropsEqual);
