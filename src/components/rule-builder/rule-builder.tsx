import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  TransformWrapper,
  TransformComponent,
  ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  DragStartEvent,
  DragEndEvent,
  type CollisionDetection,
  closestCenter,
  pointerWithin,
  rectIntersection,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import type {
  GlobalEffectTypeDefinition,
  Rule,
  Condition,
  Effect,
  RandomGroup,
  GlobalConditionTypeDefinition,
  LoopGroup,
  SelectedItem,
  ConditionParameter,
  EffectParameter,
} from "./types";
import RuleCard from "./rule-card";
import BlockComponent from "./block-component";
import FloatingDock from "./floating-dock";
import BlockPalette from "./block-palette";
import Variables from "./variables";
import Inspector from "./inspector";
import LiveCodePanel from "./live-code-panel";
import HistoryPanel from "./history-panel";
import {
  compileSingleItemLuaWithSegments,
  type PreviewCompileItemType,
} from "@/lib/export/rust-codegen-export";
import {
  mergeWithGeneratedSegments,
  type CodeSegment,
} from "@/lib/content/code-sections";
import type { CustomCodeState } from "@/lib/core/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  CheckCircle,
  Copy,
  CornersIn,
  Eye,
  GridFour,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  Plus,
  BookmarksSimple,
  SquaresFour,
  Terminal,
  Trash,
  X,
} from "@phosphor-icons/react";
import {
  getConditionTypeById,
  getEffectTypeById,
  getTriggerById,
} from "./rule-catalog";
import GameVariables from "./game-variables";
import { GameVariable } from "@/lib/content/game-vars";
import { motion } from "framer-motion";
import { UserConfigContext } from "@/components/Contexts";
import { detectValueType } from "@/lib/rules/value-type-utils";
import { usePanelState } from "./panel-state";
import {
  getSelectedCondition,
  getSelectedEffect,
  getSelectedLoopGroup,
  getSelectedRandomGroup,
  getSelectedRule,
} from "./selection-utils";
import IconButton from "@/components/ui/icon-button";
import HelpTooltipIcon from "@/components/ui/help-tooltip-icon";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import ItemTypeBadge from "./item-type-badge";
import { CustomContextMenu, type ContextMenuGroupConfig } from "@/components/ui/custom-context-menu";
import { cn } from "@/lib/core/utils";
import {
  getRuleBuilderSettings,
  setRuleBuilderSettings,
  type RuleBuilderSettings,
  useProjectData,
} from "@/lib/services/storage";
import { collectGlobalVariables } from "@/lib/app/global-user-variables";
import {
  instantiateRuleFromTemplate,
  useTemplateStore,
  type RuleTemplateEntry,
  type RuleTemplateItemType,
} from "@/lib/content/templates";
import { TemplatePickerDialog } from "@/components/templates/template-picker-dialog";
import { pushGlobalAlert } from "@/lib/app/global-alerts-bus";

export type ItemData = any;
type ItemType = "joker" | "consumable" | "card" | "voucher" | "deck";

type SnippetNodeParams = Record<string, unknown>;
const RULE_HISTORY_LIMIT = 64;

type LiveCodeBlockPreviewTarget = {
  type: "trigger" | "condition" | "effect";
  ruleId: string;
  itemId?: string;
  groupId?: string;
};

type RuleBuilderContextTarget = {
  type:
    | "canvas"
    | "rule"
    | "trigger"
    | "condition"
    | "effect"
    | "condition-group"
    | "random-group"
    | "loop-group";
  ruleId?: string;
  itemId?: string;
  groupId?: string;
  randomGroupId?: string;
  loopGroupId?: string;
};

const isSameContextTarget = (
  a: RuleBuilderContextTarget | null,
  b: RuleBuilderContextTarget | null,
): boolean =>
  a?.type === b?.type &&
  a?.ruleId === b?.ruleId &&
  a?.itemId === b?.itemId &&
  a?.groupId === b?.groupId &&
  a?.randomGroupId === b?.randomGroupId &&
  a?.loopGroupId === b?.loopGroupId;

type SelectionRect = {
  startClientX: number;
  startClientY: number;
  currentClientX: number;
  currentClientY: number;
};

type WorldPoint = {
  x: number;
  y: number;
};

const toSnippetParams = (
  params: Record<string, { value: unknown; valueType?: string }>,
): SnippetNodeParams => {
  return Object.fromEntries(
    Object.entries(params || {}).map(([key, value]) => [key, value?.value]),
  );
};

const cloneRulesSnapshot = (source: Rule[]): Rule[] => {
  return JSON.parse(JSON.stringify(source)) as Rule[];
};

const resolveParameterDefaultValue = (
  param: ConditionParameter | EffectParameter,
  parentValues: Record<string, { value: unknown; valueType?: string }>,
): unknown => {
  if (param.default !== undefined) return param.default;

  if (param.type !== "select" || !param.options) {
    return undefined;
  }

  let options:
    | Array<{ value: string; label: string; valueType?: string }>
    | undefined;

  if (typeof param.options === "function") {
    options = param.options(parentValues);
  } else {
    options = param.options;
  }

  return options?.[0]?.value;
};

const coerceLegacyTriggerId = (
  triggerId: string,
  itemType: ItemType,
): string => {
  // Legacy Vanilla Reforged payloads use historical trigger ids that no longer
  // match the active rule catalog.
  if (triggerId === "card_held") return "card_held_in_hand";
  if (triggerId === "voucher_used" || triggerId === "deck_selected") {
    return "card_used";
  }
  // For consumables, the builder trigger is "card_used" (this consumable),
  // while "consumable_used" is the Joker-facing trigger (any consumable).
  if (itemType === "consumable" && triggerId === "consumable_used") {
    return "card_used";
  }
  return triggerId;
};

const getDefaultTriggerForItemType = (itemType: ItemType): string => {
  if (itemType === "consumable" || itemType === "voucher" || itemType === "deck") {
    return "card_used";
  }
  return "hand_played";
};

const normalizeParamsForDefinition = (
  params: Record<string, { value: unknown; valueType?: string }> | undefined,
  definitionParams: Array<ConditionParameter | EffectParameter>,
): Record<string, { value: unknown; valueType?: string }> => {
  const sourceParams = params ?? {};
  const normalizedParams: Record<string, { value: unknown; valueType?: string }> =
    { ...sourceParams };

  for (const param of definitionParams) {
    const existing = sourceParams[param.id];
    if (
      existing !== undefined &&
      typeof existing === "object" &&
      existing !== null &&
      "value" in existing
    ) {
      const existingValue = existing.value;
      const hasConcreteValue = existingValue !== undefined;
      const fallbackValue = resolveParameterDefaultValue(param, normalizedParams);
      const resolvedValue = hasConcreteValue ? existingValue : fallbackValue;
      normalizedParams[param.id] = {
        ...existing,
        value: resolvedValue,
        valueType:
          existing.valueType !== undefined
            ? existing.valueType
            : detectValueType(resolvedValue),
      };
      continue;
    }

    const defaultValue = resolveParameterDefaultValue(param, normalizedParams);
    normalizedParams[param.id] = {
      value: defaultValue,
      valueType: detectValueType(defaultValue),
    };
  }

  return normalizedParams;
};

const normalizeConditionFromCatalog = (condition: Condition): Condition => {
  const definition = getConditionTypeById(condition.type);
  if (!definition) return condition;
  return {
    ...condition,
    params: normalizeParamsForDefinition(condition.params, definition.params),
  };
};

const normalizeEffectFromCatalog = (effect: Effect): Effect => {
  const definition = getEffectTypeById(effect.type);
  if (!definition) return effect;
  return {
    ...effect,
    params: normalizeParamsForDefinition(effect.params, definition.params),
  };
};

const normalizeRuleForBuilder = (
  rule: Rule,
  itemType: ItemType,
  removeUnknownBlocks: boolean,
): Rule => {
  const aliasTrigger = coerceLegacyTriggerId(rule.trigger, itemType);
  const triggerDefinition = getTriggerById(aliasTrigger);
  const triggerSupportsItem =
    !!triggerDefinition &&
    triggerDefinition.objectUsers.includes(itemType) &&
    !!triggerDefinition.label?.[itemType];
  const trigger = triggerSupportsItem
    ? aliasTrigger
    : getDefaultTriggerForItemType(itemType);

  const conditionGroups = (rule.conditionGroups || []).map((group) => {
    const normalizedConditions = (group.conditions || [])
      .map((condition: Condition) => normalizeConditionFromCatalog(condition))
      .filter((condition) =>
        removeUnknownBlocks ? !!getConditionTypeById(condition.type) : true,
      );

    return {
      ...group,
      operator: group.operator === "or" ? "or" : "and",
      conditions: normalizedConditions,
    };
  });

  const normalizeEffectsArray = (effects: Effect[] = []) =>
    effects
      .map((effect) => normalizeEffectFromCatalog(effect))
      .filter((effect) =>
        removeUnknownBlocks ? !!getEffectTypeById(effect.type) : true,
      );

  return {
    ...rule,
    trigger,
    conditionGroups,
    effects: normalizeEffectsArray(rule.effects || []),
    randomGroups: (rule.randomGroups || []).map((group: RandomGroup) => ({
      ...group,
      effects: normalizeEffectsArray(group.effects || []),
    })),
    loops: (rule.loops || []).map((group: LoopGroup) => ({
      ...group,
      effects: normalizeEffectsArray(group.effects || []),
    })),
  };
};

interface RuleBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rules: any[]) => void;
  existingRules: any[];
  item: ItemData;
  onUpdateItem: (updates: Partial<ItemData>) => void;
  itemType: ItemType;
  reforged?: boolean;
}

const RuleBuilder: React.FC<RuleBuilderProps> = ({
  isOpen,
  onClose,
  onSave,
  existingRules = [],
  item,
  onUpdateItem,
  itemType,
  reforged = false,
}) => {
  const isReadOnly = reforged;
  const { userConfig } = useContext(UserConfigContext);
  const { data } = useProjectData();
  const { createRuleTemplate, getRuleTemplatesForType } = useTemplateStore();
  const [ruleBuilderSettings, setRuleBuilderSettingsState] =
    useState<RuleBuilderSettings>(() => getRuleBuilderSettings());
  const [isRuleTemplatePickerOpen, setIsRuleTemplatePickerOpen] =
    useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteConfirmTitle, setDeleteConfirmTitle] = useState("Confirm Delete");
  const [deleteConfirmDescription, setDeleteConfirmDescription] =
    useState<string>("This action cannot be undone.");
  const [pendingDeleteAction, setPendingDeleteAction] = useState<
    (() => void) | null
  >(null);

  const requestDeleteConfirmation = useCallback(
    (title: string, description: string, action: () => void) => {
      setDeleteConfirmTitle(title);
      setDeleteConfirmDescription(description);
      setPendingDeleteAction(() => action);
      setIsDeleteConfirmOpen(true);
    },
    [],
  );

  const confirmPendingDelete = useCallback(() => {
    const action = pendingDeleteAction;
    setIsDeleteConfirmOpen(false);
    setPendingDeleteAction(null);
    if (action) {
      action();
    }
  }, [pendingDeleteAction]);

  const [activeId, setActiveId] = useState<string | null>(null);

  const [inspectorIsOpen, setInspectorIsOpen] = useState(false);

  const [isFirstSelection, setIsFirstSelection] = useState(true);

  const getConditionType = getConditionTypeById;
  const getEffectType = getEffectTypeById;

  const [rules, setRules] = useState<Rule[]>([]);
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  const [panState, setPanState] = useState({ x: 0, y: 0, scale: 1 });
  const [gridSnapping, setGridSnapping] = useState<boolean>(
    getRuleBuilderSettings().defaultGridSnap ?? userConfig.defaultGridSnap ?? false,
  );
  const { panels, togglePanel, updatePanelPosition } = usePanelState();

  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const [showNoRulesMessage, setShowNoRulesMessage] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const builderViewportRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<ReactZoomPanPinchRef>(null);

  const [selectedGameVariable, setSelectedGameVariable] =
    useState<GameVariable | null>(null);
  const [addVariableRequest, setAddVariableRequest] = useState<{
    type: "number" | "suit" | "rank" | "pokerhand" | "key" | "text";
    nonce: number;
  } | null>(null);
  const [liveCodeSnippet, setLiveCodeSnippet] = useState<string>(
    "Live item code will appear here.",
  );
  const [liveCodeTitle, setLiveCodeTitle] = useState<string>("Item Preview");
  const [liveCodeStatusMessage, setLiveCodeStatusMessage] = useState<
    string | undefined
  >();
  const [liveCodeIsError, setLiveCodeIsError] = useState(false);
  const [liveCodeErrorDetails, setLiveCodeErrorDetails] = useState<
    string | undefined
  >();
  const [liveCodeIsLoading, setLiveCodeIsLoading] = useState(false);
  const [liveCodePreviewTarget, setLiveCodePreviewTarget] =
    useState<LiveCodeBlockPreviewTarget | null>(null);
  const [liveCodeWidthPercent, setLiveCodeWidthPercent] = useState<number>(50);
  const [isLiveCodeContextMenu, setIsLiveCodeContextMenu] = useState(false);
  const [contextTarget, setContextTarget] = useState<RuleBuilderContextTarget>({
    type: "canvas",
  });
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
  const [hoveredContextTarget, setHoveredContextTarget] =
    useState<RuleBuilderContextTarget | null>(null);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(
    null,
  );
  const [isDragSelecting, setIsDragSelecting] = useState(false);
  const [isMiddlePanning, setIsMiddlePanning] = useState(false);
  const [lastContextWorldPoint, setLastContextWorldPoint] =
    useState<WorldPoint | null>(null);
  const middlePanStartRef = useRef<{
    clientX: number;
    clientY: number;
    originX: number;
    originY: number;
    scale: number;
  } | null>(null);
  const historyPastRef = useRef<Rule[][]>([]);
  const historyFutureRef = useRef<Rule[][]>([]);
  const historyPrevRulesRef = useRef<Rule[]>([]);
  const suppressHistoryRef = useRef(false);
  const copiedRulesRef = useRef<Rule[]>([]);
  const pasteOffsetStepRef = useRef(1);

  // Custom code editor state
  const [customCode, setCustomCode] = useState<CustomCodeState | undefined>(
    item.customCode,
  );
  const lastGeneratedCleanRef = useRef<string>("");
  const lastSegmentsRef = useRef<CodeSegment[]>(
    item.customCode?.segments ?? [],
  );
  const prevRulesSnapshotRef = useRef<string>("");
  const customCodeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const customCodeRef = useRef(customCode);
  const pendingEditorCodeRef = useRef<string | null>(null);
  customCodeRef.current = customCode;
  const globalUserVariables = useMemo(
    () => collectGlobalVariables(data).map((entry) => entry.variable),
    [data],
  );
  const openVariablesPanel = useCallback(
    (
      preferredType?: "number" | "suit" | "rank" | "pokerhand" | "key" | "text",
    ) => {
      if (preferredType) {
        setAddVariableRequest({
          type: preferredType,
          nonce: Date.now(),
        });
      }

      if (!panels.variables?.isVisible) {
        togglePanel("variables");
      }
    },
    [panels.variables?.isVisible, togglePanel],
  );

  // Stable item reference that excludes customCode to prevent regeneration loops.
  // When onUpdateItem({ customCode }) fires, the parent rerenders with a new item
  // object, but we don't want that to trigger a fresh compilation.
  const itemCodegenKey = useMemo(() => {
    const { customCode: _, ...rest } = item;
    return JSON.stringify(rest);
  }, [item]);
  const itemWithoutCustomCode = useMemo(() => {
    const { customCode: _, ...rest } = item;
    return rest;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemCodegenKey]);

  const previewItemType = useMemo<PreviewCompileItemType>(() => {
    const objectType = String(itemWithoutCustomCode?.objectType || "")
      .trim()
      .toLowerCase();

    if (
      objectType === "enhancement" ||
      objectType === "seal" ||
      objectType === "edition"
    ) {
      return objectType;
    }

    if (
      objectType === "joker" ||
      objectType === "consumable" ||
      objectType === "voucher" ||
      objectType === "deck"
    ) {
      return objectType;
    }

    if (itemType === "card") {
      return "enhancement";
    }

    return itemType;
  }, [itemType, itemWithoutCustomCode]);

  const ruleTemplateItemType = useMemo<RuleTemplateItemType>(() => {
    if (itemType === "joker") return "joker";
    if (itemType === "consumable") return "consumable";
    if (itemType === "voucher") return "voucher";
    if (itemType === "deck") return "deck";
    return "card";
  }, [itemType]);

  const availableRuleTemplates = useMemo(
    () => getRuleTemplatesForType(ruleTemplateItemType),
    [getRuleTemplatesForType, ruleTemplateItemType],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const draggedPaletteBlockPreview = useMemo(() => {
    if (!activeId?.startsWith("palette:")) return null;
    const parts = activeId.split(":");
    const blockType = parts[1] as "trigger" | "condition" | "effect";
    const blockId = parts.slice(2).join(":");

    if (blockType === "trigger") {
      const trigger = getTriggerById(blockId);
      return {
        blockType,
        label: trigger?.label?.[itemType] || blockId,
      };
    }

    if (blockType === "condition") {
      const condition = getConditionType(blockId);
      return {
        blockType,
        label: condition?.label || blockId,
      };
    }

    const effect = getEffectType(blockId);
    return {
      blockType,
      label: effect?.label || blockId,
    };
  }, [activeId, getConditionType, getEffectType, itemType]);

  const collisionDetectionStrategy = useCallback<CollisionDetection>(
    (args) => {
      const activeId = String(args.active.id);
      if (activeId.startsWith("palette:")) {
        const pointerHits = pointerWithin(args);
        if (pointerHits.length > 0) return pointerHits;
        const intersectionHits = rectIntersection(args);
        if (intersectionHits.length > 0) return intersectionHits;
      }
      return closestCenter(args);
    },
    [],
  );

  const formatLiveCodeErrorDetails = useCallback((error: unknown): string => {
    if (error instanceof Error) {
      const lines: string[] = [];
      lines.push(`Name: ${error.name}`);
      lines.push(`Message: ${error.message}`);
      if (error.stack) {
        const stackPreview = error.stack
          .split("\n")
          .slice(0, 8)
          .join("\n")
          .trim();
        if (stackPreview) {
          lines.push("Stack:");
          lines.push(stackPreview);
        }
      }
      return lines.join("\n");
    }

    if (typeof error === "string") {
      return `Message: ${error}`;
    }

    try {
      return `Message: ${JSON.stringify(error, null, 2)}`;
    } catch {
      return "Message: Unknown error (could not serialize error payload).";
    }
  }, []);

  // Handle user edits in the code editor (debounced auto-save)
  const handleCodeChange = useCallback(
    (newCode: string) => {
      if (!lastGeneratedCleanRef.current) return;
      pendingEditorCodeRef.current = newCode;

      // Keep the displayed snippet in sync so the external-update effect
      // in LiveCodePanel doesn't overwrite the user's edits on re-render.
      setLiveCodeSnippet(newCode);

      if (customCodeDebounceRef.current) {
        clearTimeout(customCodeDebounceRef.current);
      }

      customCodeDebounceRef.current = setTimeout(() => {
        const hasChanges =
          newCode.trim() !== lastGeneratedCleanRef.current.trim();

        const newCustomCode: CustomCodeState | undefined = hasChanges
          ? {
              fullCode: newCode,
              lastGeneratedCode: lastGeneratedCleanRef.current,
              segments: lastSegmentsRef.current,
            }
          : undefined;

        setCustomCode(newCustomCode);
        onUpdateItem({ customCode: newCustomCode });
        pendingEditorCodeRef.current = null;
      }, 300);
    },
    [onUpdateItem],
  );

  // Reset all custom code back to generated
  const handleResetCustomCode = useCallback(() => {
    if (customCodeDebounceRef.current) {
      clearTimeout(customCodeDebounceRef.current);
    }
    setCustomCode(undefined);
    pendingEditorCodeRef.current = null;
    onUpdateItem({ customCode: undefined });
    if (lastGeneratedCleanRef.current) {
      setLiveCodeSnippet(lastGeneratedCleanRef.current);
    }
  }, [onUpdateItem]);

  const handleSaveAndClose = useCallback(() => {
    if (!isReadOnly) {
      onSave(rules);
    }
    onClose();
  }, [isReadOnly, onSave, onClose, rules]);

  const handleSelectItem = useCallback((item: NonNullable<SelectedItem>) => {
    setSelectedItem(item);
    setSelectedRuleIds([item.ruleId]);
  }, []);

  const setSingleSelectedRule = useCallback((ruleId: string | null) => {
    if (!ruleId) {
      setSelectedRuleIds([]);
      setSelectedItem(null);
      return;
    }

    setSelectedRuleIds([ruleId]);
    setSelectedItem({ type: "trigger", ruleId });
  }, []);

  const clearRuleSelection = useCallback(() => {
    setSelectedRuleIds([]);
    setSelectedItem(null);
  }, []);

  const selectAllRules = useCallback(() => {
    const allRuleIds = rules.map((rule) => rule.id);
    setSelectedRuleIds(allRuleIds);
    setSelectedItem(
      allRuleIds.length === 1
        ? { type: "trigger", ruleId: allRuleIds[0] }
        : null,
    );
  }, [rules]);

  const handleSelectRuleCard = useCallback(
    (ruleId: string, additive: boolean) => {
      if (!additive) {
        setSingleSelectedRule(ruleId);
        return;
      }

      setSelectedRuleIds((prev) => {
        const exists = prev.includes(ruleId);
        const next = exists
          ? prev.filter((id) => id !== ruleId)
          : [...prev, ruleId];

        if (next.length === 1) {
          setSelectedItem({ type: "trigger", ruleId: next[0] });
        } else {
          setSelectedItem(null);
        }

        return next;
      });
    },
    [setSingleSelectedRule],
  );

  const handleUndo = useCallback(() => {
    const past = historyPastRef.current;
    if (past.length === 0) return;

    const previous = past[past.length - 1];
    historyPastRef.current = past.slice(0, -1);
    historyFutureRef.current = [
      ...historyFutureRef.current,
      cloneRulesSnapshot(rules),
    ].slice(-RULE_HISTORY_LIMIT);
    suppressHistoryRef.current = true;
    const snapshot = cloneRulesSnapshot(previous);
    historyPrevRulesRef.current = snapshot;
    setRules(snapshot);
  }, [rules]);

  const handleRedo = useCallback(() => {
    const future = historyFutureRef.current;
    if (future.length === 0) return;

    const next = future[future.length - 1];
    historyFutureRef.current = future.slice(0, -1);
    historyPastRef.current = [
      ...historyPastRef.current,
      cloneRulesSnapshot(rules),
    ].slice(-RULE_HISTORY_LIMIT);
    suppressHistoryRef.current = true;
    const snapshot = cloneRulesSnapshot(next);
    historyPrevRulesRef.current = snapshot;
    setRules(snapshot);
  }, [rules]);

  const restoreHistoryAt = useCallback(
    (targetIndex: number) => {
      const past = historyPastRef.current;
      const future = historyFutureRef.current;
      const timeline = [...past, rules, ...future.slice().reverse()];
      const currentIndex = past.length;

      if (
        targetIndex < 0 ||
        targetIndex >= timeline.length ||
        targetIndex === currentIndex
      ) {
        return;
      }

      const target = cloneRulesSnapshot(timeline[targetIndex]);
      const newPast = timeline
        .slice(0, targetIndex)
        .map((snapshot) => cloneRulesSnapshot(snapshot))
        .slice(-RULE_HISTORY_LIMIT);
      const futureChronological = timeline
        .slice(targetIndex + 1)
        .map((snapshot) => cloneRulesSnapshot(snapshot));
      const newFuture = futureChronological
        .reverse()
        .slice(0, RULE_HISTORY_LIMIT);

      historyPastRef.current = newPast;
      historyFutureRef.current = newFuture;
      suppressHistoryRef.current = true;
      historyPrevRulesRef.current = target;
      setRules(target);
    },
    [rules],
  );

  const handleRecenter = () => {
    if (transformRef.current) {
      transformRef.current.resetTransform();
      setPanState({ x: 0, y: 0, scale: 1 });
    }
  };

  const handleAutoLayoutRules = useCallback(() => {
    setRules((prevRules) => {
      if (prevRules.length < 2) return prevRules;

      const minX = Math.min(...prevRules.map((rule) => rule.position?.x || 0));
      const minY = Math.min(...prevRules.map((rule) => rule.position?.y || 0));
      const originX = minX;
      const originY = minY;

      const columns = Math.ceil(Math.sqrt(prevRules.length));
      const cardWidth = 320;
      const colGap = 64;
      const rowGap = 56;
      const colStride = cardWidth + colGap;

      const estimateRuleCardHeight = (rule: Rule) => {
        const conditionCount = rule.conditionGroups.reduce(
          (sum, group) => sum + group.conditions.length,
          0,
        );
        const randomEffectCount = rule.randomGroups.reduce(
          (sum, group) => sum + group.effects.length,
          0,
        );
        const loopEffectCount = rule.loops.reduce(
          (sum, group) => sum + group.effects.length,
          0,
        );

        const estimated =
          260 +
          conditionCount * 84 +
          rule.conditionGroups.length * 28 +
          rule.effects.length * 78 +
          randomEffectCount * 78 +
          loopEffectCount * 78 +
          rule.randomGroups.length * 56 +
          rule.loops.length * 56;

        return Math.max(340, Math.min(estimated, 1100));
      };

      const rowCount = Math.ceil(prevRules.length / columns);
      const rowHeights = Array.from<number>({ length: rowCount }).fill(0);

      prevRules.forEach((rule, index) => {
        const row = Math.floor(index / columns);
        rowHeights[row] = Math.max(
          rowHeights[row],
          estimateRuleCardHeight(rule),
        );
      });

      const rowOffsets = Array.from<number>({ length: rowCount }).fill(0);
      for (let row = 1; row < rowCount; row += 1) {
        rowOffsets[row] = rowOffsets[row - 1] + rowHeights[row - 1] + rowGap;
      }

      return prevRules.map((rule, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);
        const rawX = originX + col * colStride;
        const rawY = originY + rowOffsets[row];

        const x = gridSnapping ? Math.round(rawX / 20) * 20 : rawX;
        const y = gridSnapping ? Math.round(rawY / 20) * 20 : rawY;

        return {
          ...rule,
          position: { x, y },
        };
      });
    });
  }, [gridSnapping]);

  const handleGridZoomChange = (direction: "in" | "out") => {
    if (!transformRef.current) return;
    if (direction === "in") {
      transformRef.current.zoomIn(0.25);
    } else {
      transformRef.current.zoomOut(0.25);
    }
  };

  const createConditionFromType = (conditionType: string): Condition => {
    const conditionTypeData = getConditionType(conditionType);
    const defaultParams: Record<
      string,
      { value: unknown; valueType?: string }
    > = {};

    if (conditionTypeData) {
      conditionTypeData.params.forEach((param) => {
        const defaultValue = resolveParameterDefaultValue(param, defaultParams);
        defaultParams[param.id] = {
          value: defaultValue,
          valueType: detectValueType(defaultValue),
        };
      });
    }

    return {
      id: crypto.randomUUID(),
      type: conditionType,
      negate: false,
      params: defaultParams,
    };
  };

  const createEffectFromType = (effectType: string): Effect => {
    const effectTypeData = getEffectType(effectType);
    const defaultParams: Record<
      string,
      { value: unknown; valueType?: string }
    > = {};

    if (effectTypeData) {
      effectTypeData.params.forEach((param) => {
        const defaultValue = resolveParameterDefaultValue(param, defaultParams);
        defaultParams[param.id] = {
          value: defaultValue,
          valueType: detectValueType(defaultValue),
        };
      });
    }

    return {
      id: crypto.randomUUID(),
      type: effectType,
      params: defaultParams,
    };
  };

  const getCenterPosition = () => {
    const screenCenterX =
      (typeof window !== "undefined" ? window.innerWidth : 1200) / 2;
    const screenCenterY =
      (typeof window !== "undefined" ? window.innerHeight : 800) / 2;
    const transformCenterX = screenCenterX - panState.x;
    const transformCenterY = screenCenterY - panState.y;
    return {
      x: transformCenterX - 160,
      y: transformCenterY - 200,
    };
  };

  useEffect(() => {
    if (isOpen) {
      const normalizedRules = existingRules.map((rule) =>
        normalizeRuleForBuilder(rule, itemType, reforged),
      );
      const initialSnapshot = cloneRulesSnapshot(normalizedRules);
      historyPastRef.current = [];
      historyFutureRef.current = [];
      historyPrevRulesRef.current = initialSnapshot;
      suppressHistoryRef.current = true;
      setRules(initialSnapshot);
      setSelectedItem(null);
      setSelectedRuleIds([]);
      setSelectionRect(null);
      setIsDragSelecting(false);
      setSelectedGameVariable(null);
      setLiveCodePreviewTarget(null);
      setLiveCodeWidthPercent(50);
      setIsInitialLoadComplete(true);
      setIsFirstSelection(true);

      // Reset the no rules message state
      setShowNoRulesMessage(false);

      // If there are no existing rules, delay showing the message
      if (existingRules.length === 0) {
        const timer = setTimeout(() => {
          setShowNoRulesMessage(true);
        }, 200); // 800ms delay

        return () => clearTimeout(timer);
      }
    } else {
      // Reset states when closing
      setIsInitialLoadComplete(false);
      setShowNoRulesMessage(false);
      setSelectedRuleIds([]);
      setSelectionRect(null);
      setIsDragSelecting(false);
    }
  }, [isOpen, existingRules]);

  useEffect(() => {
    if (!isOpen) return;

    if (suppressHistoryRef.current) {
      suppressHistoryRef.current = false;
      historyPrevRulesRef.current = cloneRulesSnapshot(rules);
      return;
    }

    const previous = historyPrevRulesRef.current;
    if (previous === rules) return;

    historyPastRef.current = [
      ...historyPastRef.current,
      cloneRulesSnapshot(previous),
    ].slice(-RULE_HISTORY_LIMIT);
    historyFutureRef.current = [];
    historyPrevRulesRef.current = cloneRulesSnapshot(rules);
  }, [isOpen, rules]);

  useEffect(() => {
    setSelectedGameVariable(null);
  }, [selectedItem]);

  const getLiveCodeSelectedText = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return "";
    }

    const selectedText = selection.toString();
    if (!selectedText.trim()) {
      return "";
    }

    const liveCodeRoot = modalRef.current?.querySelector(
      "[data-rb-live-code='true']",
    );
    if (!liveCodeRoot) {
      return "";
    }

    const range = selection.getRangeAt(0);
    const commonAncestor = range.commonAncestorContainer;
    const commonElement =
      commonAncestor.nodeType === Node.TEXT_NODE
        ? commonAncestor.parentElement
        : (commonAncestor as HTMLElement);

    if (!commonElement || !liveCodeRoot.contains(commonElement)) {
      return "";
    }

    return selectedText;
  }, []);

  const handleCopyLiveCodeSelection = useCallback(async () => {
    const selectedText = getLiveCodeSelectedText();
    if (!selectedText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(selectedText);
    } catch {
      document.execCommand("copy");
    }
  }, [getLiveCodeSelectedText]);

  const normalizeShortcutKey = useCallback((key: string): string => {
    const normalized = key.toLowerCase();
    if (normalized === "escape") return "esc";
    if (normalized === "backspace") return "delete";
    if (normalized === " ") return "space";
    return normalized;
  }, []);

  const shortcutMatches = useCallback(
    (event: KeyboardEvent, shortcut: string): boolean => {
      const parts = shortcut
        .toLowerCase()
        .split("+")
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.length === 0) return false;

      const wantsCtrl = parts.includes("ctrl");
      const wantsMeta = parts.includes("meta");
      const wantsShift = parts.includes("shift");
      const wantsAlt = parts.includes("alt");
      const keyPart =
        parts.find(
          (part) =>
            part !== "ctrl" &&
            part !== "meta" &&
            part !== "shift" &&
            part !== "alt",
        ) ?? "";
      const normalizedEventKey = normalizeShortcutKey(event.key);

      if (wantsCtrl !== (event.ctrlKey || event.metaKey)) return false;
      if (wantsMeta !== event.metaKey) return false;
      if (wantsShift !== event.shiftKey) return false;
      if (wantsAlt !== event.altKey) return false;

      if (keyPart === "plus") {
        return normalizedEventKey === "+" || normalizedEventKey === "=";
      }

      return normalizedEventKey === normalizeShortcutKey(keyPart);
    },
    [normalizeShortcutKey],
  );

  useEffect(() => {
    if (!isOpen) return;
    const settings = getRuleBuilderSettings();
    setRuleBuilderSettingsState(settings);
    setGridSnapping(settings.defaultGridSnap);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const handleKeyPress = (event: KeyboardEvent) => {
        const isCodeMirrorTarget =
          event.target instanceof HTMLElement &&
          !!event.target.closest(".cm-editor");

        if (isCodeMirrorTarget) {
          return;
        }

        const isEditableTarget =
          event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement ||
          (event.target instanceof HTMLElement &&
            event.target.isContentEditable);

        if (isEditableTarget) {
          return;
        }

        if (
          shortcutMatches(event, ruleBuilderSettings.shortcuts.copySelection) &&
          getLiveCodeSelectedText()
        ) {
          // Allow native copy to handle selected live code text.
          return;
        }

        if (shortcutMatches(event, ruleBuilderSettings.shortcuts.autoLayout)) {
          event.preventDefault();
          handleAutoLayoutRules();
          return;
        }
        if (shortcutMatches(event, ruleBuilderSettings.shortcuts.undo)) {
          event.preventDefault();
          handleUndo();
          return;
        }
        if (shortcutMatches(event, ruleBuilderSettings.shortcuts.redo)) {
          event.preventDefault();
          handleRedo();
          return;
        }
        if (shortcutMatches(event, ruleBuilderSettings.shortcuts.selectAll)) {
          event.preventDefault();
          selectAllRules();
          return;
        }
        if (
          shortcutMatches(event, ruleBuilderSettings.shortcuts.copySelection) &&
          selectedRuleIds.length > 0
        ) {
          event.preventDefault();
          copySelectedRules();
          return;
        }
        if (
          shortcutMatches(event, ruleBuilderSettings.shortcuts.pasteSelection) &&
          copiedRulesRef.current.length > 0
        ) {
          event.preventDefault();
          pasteCopiedRules();
          return;
        }
        if (
          shortcutMatches(event, ruleBuilderSettings.shortcuts.duplicateSelection)
        ) {
          if (selectedRuleIds.length > 1) {
            event.preventDefault();
            duplicateSelectedRules();
            return;
          }
          if (selectedRuleIds.length === 1) {
            event.preventDefault();
            duplicateRule(selectedRuleIds[0]);
            return;
          }
        }

        if (shortcutMatches(event, ruleBuilderSettings.shortcuts.deleteSelection)) {
          if (selectedRuleIds.length > 1) {
            event.preventDefault();
            deleteSelectedRules();
            return;
          }
          if (selectedRuleIds.length === 1) {
            event.preventDefault();
            deleteRule(selectedRuleIds[0]);
            return;
          }
        }

        if (
          shortcutMatches(event, ruleBuilderSettings.shortcuts.clearSelection) &&
          selectedRuleIds.length > 0
        ) {
          event.preventDefault();
          clearRuleSelection();
          return;
        }

        if (
          shortcutMatches(event, ruleBuilderSettings.shortcuts.toggleBlockPalette)
        ) {
          togglePanel("blockPalette");
          return;
        }
        if (
          shortcutMatches(event, ruleBuilderSettings.shortcuts.toggleVariables) &&
          itemType === "joker"
        ) {
          togglePanel("variables");
          return;
        }
        if (
          shortcutMatches(event, ruleBuilderSettings.shortcuts.toggleGameVariables)
        ) {
          togglePanel("gameVariables");
          return;
        }
        if (
          shortcutMatches(event, ruleBuilderSettings.shortcuts.toggleInspector)
        ) {
          togglePanel("inspector");
          return;
        }
        if (
          shortcutMatches(event, ruleBuilderSettings.shortcuts.toggleLiveCode)
        ) {
          togglePanel("liveCode");
          return;
        }
        if (shortcutMatches(event, ruleBuilderSettings.shortcuts.toggleHistory)) {
          togglePanel("history");
          return;
        }
        if (shortcutMatches(event, ruleBuilderSettings.shortcuts.toggleGridSnap)) {
          setGridSnapping((prev) => {
            const next = !prev;
            setRuleBuilderSettings({
              ...ruleBuilderSettings,
              defaultGridSnap: next,
            });
            setRuleBuilderSettingsState((existing) => ({
              ...existing,
              defaultGridSnap: next,
            }));
            return next;
          });
          return;
        }
        if (shortcutMatches(event, ruleBuilderSettings.shortcuts.zoomIn)) {
          handleGridZoomChange("in");
          return;
        }
        if (shortcutMatches(event, ruleBuilderSettings.shortcuts.zoomOut)) {
          handleGridZoomChange("out");
          return;
        }
      };

      document.addEventListener("keydown", handleKeyPress);
      return () => {
        document.removeEventListener("keydown", handleKeyPress);
      };
    }
  }, [
    getLiveCodeSelectedText,
    handleRedo,
    handleSaveAndClose,
    handleAutoLayoutRules,
    handleUndo,
    clearRuleSelection,
    isOpen,
    itemType,
    ruleBuilderSettings,
    shortcutMatches,
    selectAllRules,
    selectedRuleIds,
    togglePanel,
  ]);

  useEffect(() => {
    if (!selectedItem) return;

    if (inspectorIsOpen) {
      if (!panels.inspector.isVisible) {
        togglePanel("inspector");
      }
      setInspectorIsOpen(false);
    } else if (isFirstSelection && ruleBuilderSettings.openInspectorOnFirstSelection) {
      if (!panels.inspector.isVisible) {
        togglePanel("inspector");
      }
      setIsFirstSelection(false);
    }
  }, [
    selectedItem,
    inspectorIsOpen,
    isFirstSelection,
    panels.inspector.isVisible,
    ruleBuilderSettings.openInspectorOnFirstSelection,
    togglePanel,
  ]);

  const generateAutoTitle = (
    item: Condition | Effect,
    typeDefinition: GlobalConditionTypeDefinition | GlobalEffectTypeDefinition,
    isCondition: boolean,
  ): string => {
    if (
      isCondition &&
      typeDefinition.id === "check_flag" &&
      "negate" in item &&
      item.negate
    ) {
      return "Check Flag False";
    }

    const baseLabel = typeDefinition.label;
    const params: Record<string, unknown> = {};
    Object.entries(item.params).map(([key, object]) => {
      params[key] = object.value;
    });

    if (!params || Object.keys(params).length === 0) {
      return baseLabel;
    }

    const prefix = isCondition ? "If " : "";
    const skipValues = [
      "none",
      "dont_change",
      "no_edition",
      "remove",
      "any",
      "specific",
    ];
    const processedParams = new Set<string>();

    let title = "";

    if (params.operator && params !== undefined) {
      const operatorMap: Record<string, string> = {
        equals: "=",
        not_equals: "≠",
        greater_than: ">",
        less_than: "<",
        greater_equals: "≥",
        less_equals: "≤",
      };
      const op =
        params.operator &&
        Object.prototype.hasOwnProperty.call(
          operatorMap,
          params.operator as string,
        )
          ? operatorMap[params.operator as string]
          : params.operator;

      let valueDisplay = params.value;
      if (
        typeDefinition.id === "player_money" ||
        typeDefinition.id === "add_dollars"
      ) {
        valueDisplay = `$${params.value}`;
      }

      title = `${prefix}${baseLabel
        .replace("Player ", "")
        .replace("Remaining ", "")} ${op} ${valueDisplay}`;
      processedParams.add("operator");
      processedParams.add("value");
    } else if (params.value !== undefined && !params.operator) {
      title = `${prefix}${baseLabel} = ${params.value}`;
      processedParams.add("value");
    } else if (params.specific_rank || params.rank_group) {
      const rank = params.specific_rank || params.rank_group;
      title = `${prefix}Card Rank = ${rank}`;
      processedParams.add("specific_rank");
      processedParams.add("rank_group");
    } else if (params.specific_suit || params.suit_group) {
      const suit = params.specific_suit || params.suit_group;
      title = `${prefix}Card Suit = ${suit}`;
      processedParams.add("specific_suit");
      processedParams.add("suit_group");
    } else if (!isCondition && params.operation && params.value !== undefined) {
      const operationMap: { [key: string]: string } = {
        add: "+",
        subtract: "-",
        set: "Set to",
      };
      const op = operationMap[params.operation as string] || params.operation;
      const target = baseLabel
        .replace("Edit ", "")
        .replace("Add ", "")
        .replace("Apply ", "");
      title = `${op} ${params.value} ${target}`;
      processedParams.add("operation");
      processedParams.add("value");
    } else if (!isCondition) {
      if (params.value !== undefined && baseLabel.startsWith("Add")) {
        let valueDisplay = params.value;
        if (typeDefinition.id === "add_dollars") {
          valueDisplay = `$${params.value}`;
        }
        title = `Add ${valueDisplay} ${baseLabel.replace("Add ", "")}`;
        processedParams.add("value");
      } else if (params.value !== undefined && baseLabel.startsWith("Apply")) {
        title = `Apply ${params.value}x ${baseLabel
          .replace("Apply x", "")
          .replace("Apply ", "")}`;
        processedParams.add("value");
      } else if (params.repetitions !== undefined) {
        title = `Retrigger ${params.repetitions}x`;
        processedParams.add("repetitions");
      } else if (
        typeDefinition.id === "level_up_hand" &&
        params.value !== undefined
      ) {
        title = `Level Up Hand ${params.value}x`;
        processedParams.add("value");
      } else {
        title = baseLabel;
      }
    } else {
      title = baseLabel;
    }
    const additionalParams: string[] = [];

    Object.entries(params).forEach(([key, value]) => {
      if (processedParams.has(key) || value === undefined || value === null) {
        return;
      }
      const stringValue =
        typeof value === "string"
          ? value
          : typeof value === "number" || typeof value === "boolean"
            ? String(value)
            : "";
      if (!stringValue || skipValues.includes(stringValue)) {
        return;
      }
      if (
        key === "suit" ||
        key === "rank" ||
        key === "enhancement" ||
        key === "seal" ||
        key === "edition"
      ) {
        if (stringValue === "random") {
          additionalParams.push("random " + key);
        } else {
          additionalParams.push(stringValue);
        }
      } else if (key === "joker_type" && stringValue === "random") {
        additionalParams.push("random joker");
      } else if (key === "joker_key" && stringValue !== "j_joker") {
        additionalParams.push(stringValue);
      } else if (key === "rarity" && stringValue !== "random") {
        additionalParams.push(stringValue);
      } else if (key === "is_negative" && stringValue === "negative") {
        additionalParams.push("negative");
      } else if (key === "tarot_card" && stringValue !== "random") {
        additionalParams.push(stringValue.replace("_", " "));
      } else if (key === "planet_card" && stringValue !== "random") {
        additionalParams.push(stringValue.replace("_", " "));
      } else if (key === "spectral_card" && stringValue !== "random") {
        additionalParams.push(stringValue.replace("_", " "));
      } else if (key === "consumable_type" && stringValue !== "random") {
        additionalParams.push(stringValue);
      } else if (key === "specific_card" && stringValue !== "random") {
        additionalParams.push(stringValue.replace("_", " "));
      } else if (key === "specific_tag") {
        additionalParams.push(stringValue.replace("_", " "));
      } else if (key === "selection_method" && stringValue !== "random") {
        additionalParams.push(stringValue + " selection");
      } else if (key === "position" && stringValue !== "first") {
        additionalParams.push(stringValue + " position");
      } else if (key === "hand_selection" && stringValue !== "current") {
        additionalParams.push(stringValue + " hand");
      } else if (key === "specific_hand") {
        additionalParams.push(stringValue.toLowerCase());
      } else if (key === "card_scope" && stringValue !== "scoring") {
        additionalParams.push(stringValue + " cards");
      } else if (key === "quantifier" && stringValue !== "all") {
        additionalParams.push(stringValue.replace("_", " "));
      } else if (key === "count" && !title.includes(stringValue)) {
        additionalParams.push(stringValue + " cards");
      } else if (key === "property_type") {
        additionalParams.push("by " + stringValue);
      } else if (key === "size_type" && stringValue !== "remaining") {
        additionalParams.push(stringValue);
      } else if (key === "blind_type") {
        additionalParams.push(stringValue + " blind");
      } else if (key === "card_index" && stringValue !== "any") {
        if (stringValue === "1") additionalParams.push("1st card");
        else if (stringValue === "2") additionalParams.push("2nd card");
        else if (stringValue === "3") additionalParams.push("3rd card");
        else if (stringValue === "4") additionalParams.push("4th card");
        else if (stringValue === "5") additionalParams.push("5th card");
        else additionalParams.push(stringValue + " card");
      } else if (key === "card_rank" && stringValue !== "any") {
        additionalParams.push("rank " + stringValue);
      } else if (key === "card_suit" && stringValue !== "any") {
        additionalParams.push("suit " + stringValue);
      } else if (
        key === "new_rank" ||
        key === "new_suit" ||
        key === "new_enhancement" ||
        key === "new_seal" ||
        key === "new_edition"
      ) {
        const cleanKey = key.replace("new_", "");
        additionalParams.push("→ " + cleanKey + " " + stringValue);
      }
    });

    if (additionalParams.length > 0) {
      title += ", " + additionalParams.join(", ");
    }

    return title;
  };

  const updateRulePosition = (
    ruleId: string,
    position: { x: number; y: number },
    options?: { snap?: boolean },
  ) => {
    const shouldSnap = options?.snap ?? true;
    const snappedPosition =
      shouldSnap && gridSnapping
        ? {
            x: Math.round(position.x / 20) * 20,
            y: Math.round(position.y / 20) * 20,
          }
        : position;
    setRules((prev) => {
      const targetRule = prev.find((rule) => rule.id === ruleId);
      if (!targetRule) return prev;

      if (selectedRuleIds.length > 1 && selectedRuleIdSet.has(ruleId)) {
        const current = targetRule.position || { x: 0, y: 0 };
        const deltaX = snappedPosition.x - current.x;
        const deltaY = snappedPosition.y - current.y;
        return prev.map((rule) =>
          selectedRuleIdSet.has(rule.id)
            ? {
                ...rule,
                position: {
                  x: (rule.position?.x || 0) + deltaX,
                  y: (rule.position?.y || 0) + deltaY,
                },
              }
            : rule,
        );
      }

      return prev.map((rule) =>
        rule.id === ruleId ? { ...rule, position: snappedPosition } : rule,
      );
    });
  };

  const duplicateRule = (ruleId: string) => {
    if (selectedRuleIds.length > 1 && selectedRuleIdSet.has(ruleId)) {
      duplicateSelectedRules();
      return;
    }

    const newRuleId = crypto.randomUUID();
    setRules((prevRules) => {
      const ruleToDuplicate = prevRules.find((r) => r.id === ruleId);
      if (!ruleToDuplicate) {
        return prevRules;
      }

      const newRule = {
        ...ruleToDuplicate,
        id: newRuleId,
        position: {
          x: (ruleToDuplicate.position?.x || 0) + 30,
          y: (ruleToDuplicate.position?.y || 0) + 30,
        },
        conditionGroups: ruleToDuplicate.conditionGroups.map((group) => ({
          ...group,
          id: crypto.randomUUID(),
          conditions: group.conditions.map((condition) => ({
            ...condition,
            id: crypto.randomUUID(),
          })),
        })),
        effects: ruleToDuplicate.effects.map((effect) => ({
          ...effect,
          id: crypto.randomUUID(),
        })),
        randomGroups: ruleToDuplicate.randomGroups.map((group) => ({
          ...group,
          id: crypto.randomUUID(),
        })),
        loops: ruleToDuplicate.loops.map((group) => ({
          ...group,
          id: crypto.randomUUID(),
        })),
      };
      setSelectedItem({ type: "trigger", ruleId: newRuleId });
      return [...prevRules, newRule];
    });
  };

  const handleSaveRuleAsTemplate = useCallback(
    (ruleId: string) => {
      const targetRule = rules.find((rule) => rule.id === ruleId);
      if (!targetRule) return;

      const templateName = `Rule ${rules.findIndex((rule) => rule.id === ruleId) + 1} Template`;
      createRuleTemplate({
        name: templateName,
        itemType: ruleTemplateItemType,
        rule: targetRule,
      });
      pushGlobalAlert({
        type: "success",
        title: "Template Saved",
        message: `Saved \"${templateName}\".`,
      });
    },
    [createRuleTemplate, ruleTemplateItemType, rules],
  );

  const handleUseRuleTemplate = (
    template: (typeof availableRuleTemplates)[number],
  ) => {
    const centerPos = getCenterPosition();
    const newRule = instantiateRuleFromTemplate(template, centerPos);
    setRules((prev) => [...prev, newRule]);
    setSelectedItem({ type: "trigger", ruleId: newRule.id });
    pushGlobalAlert({
      type: "success",
      title: "Rule Added",
      message: `Created a new rule from \"${template.name}\".`,
    });
  };

  const duplicateCondition = (
    ruleId: string,
    groupId: string,
    conditionId: string,
  ) => {
    const duplicatedConditionId = crypto.randomUUID();

    setRules((prev) =>
      prev.map((rule) => {
        if (rule.id !== ruleId) return rule;

        return {
          ...rule,
          conditionGroups: rule.conditionGroups.map((group) => {
            if (group.id !== groupId) return group;

            const conditionIndex = group.conditions.findIndex(
              (condition) => condition.id === conditionId,
            );

            if (conditionIndex === -1) return group;

            const original = group.conditions[conditionIndex];
            const duplicate: Condition = {
              ...original,
              id: duplicatedConditionId,
              params: JSON.parse(JSON.stringify(original.params)),
            };

            const conditions = [...group.conditions];
            conditions.splice(conditionIndex + 1, 0, duplicate);

            return {
              ...group,
              conditions,
            };
          }),
        };
      }),
    );

    setSelectedItem({
      type: "condition",
      ruleId,
      groupId,
      itemId: duplicatedConditionId,
    });
  };

  const duplicateEffect = (
    ruleId: string,
    effectId: string,
    randomGroupId?: string,
    loopGroupId?: string,
  ) => {
    const duplicatedEffectId = crypto.randomUUID();

    setRules((prev) =>
      prev.map((rule) => {
        if (rule.id !== ruleId) return rule;

        if (randomGroupId) {
          return {
            ...rule,
            randomGroups: rule.randomGroups.map((group) => {
              if (group.id !== randomGroupId) return group;

              const effectIndex = group.effects.findIndex(
                (effect) => effect.id === effectId,
              );
              if (effectIndex === -1) return group;

              const original = group.effects[effectIndex];
              const duplicate: Effect = {
                ...original,
                id: duplicatedEffectId,
                params: JSON.parse(JSON.stringify(original.params)),
              };

              const effects = [...group.effects];
              effects.splice(effectIndex + 1, 0, duplicate);

              return {
                ...group,
                effects,
              };
            }),
          };
        }

        if (loopGroupId) {
          return {
            ...rule,
            loops: rule.loops.map((group) => {
              if (group.id !== loopGroupId) return group;

              const effectIndex = group.effects.findIndex(
                (effect) => effect.id === effectId,
              );
              if (effectIndex === -1) return group;

              const original = group.effects[effectIndex];
              const duplicate: Effect = {
                ...original,
                id: duplicatedEffectId,
                params: JSON.parse(JSON.stringify(original.params)),
              };

              const effects = [...group.effects];
              effects.splice(effectIndex + 1, 0, duplicate);

              return {
                ...group,
                effects,
              };
            }),
          };
        }

        const effectIndex = rule.effects.findIndex(
          (effect) => effect.id === effectId,
        );
        if (effectIndex === -1) return rule;

        const original = rule.effects[effectIndex];
        const duplicate: Effect = {
          ...original,
          id: duplicatedEffectId,
          params: JSON.parse(JSON.stringify(original.params)),
        };

        const effects = [...rule.effects];
        effects.splice(effectIndex + 1, 0, duplicate);

        return {
          ...rule,
          effects,
        };
      }),
    );

    setSelectedItem({
      type: "effect",
      ruleId,
      itemId: duplicatedEffectId,
      randomGroupId,
      loopGroupId,
    });
  };

  const addTrigger = (triggerId: string) => {
    const centerPos = getCenterPosition();
    const newRule: Rule = {
      id: crypto.randomUUID(),
      trigger: triggerId,
      blueprintCompatible: true,
      conditionGroups: [],
      effects: [],
      randomGroups: [],
      loops: [],
      position: centerPos,
    };
    setRules((prev) => [...prev, newRule]);
    setSelectedItem({ type: "trigger", ruleId: newRule.id });
  };

  const addCondition = useCallback(
    (conditionType: string) => {
      if (!selectedItem) return;

      const newCondition: Condition = createConditionFromType(conditionType);

      let targetGroupId = selectedItem.groupId;

      setRules((prev) => {
        return prev.map((rule) => {
          if (rule.id === selectedItem.ruleId) {
            if (selectedItem.groupId && selectedItem.type === "condition") {
              return {
                ...rule,
                conditionGroups: rule.conditionGroups.map((group) =>
                  group.id === selectedItem.groupId
                    ? {
                        ...group,
                        conditions: [...group.conditions, newCondition],
                      }
                    : group,
                ),
              };
            }
            if (rule.conditionGroups.length === 0) {
              const newGroupId = crypto.randomUUID();
              targetGroupId = newGroupId;
              return {
                ...rule,
                conditionGroups: [
                  {
                    id: newGroupId,
                    operator: "and",
                    conditions: [newCondition],
                  },
                ],
              };
            } else {
              targetGroupId = rule.conditionGroups[0].id;
              return {
                ...rule,
                conditionGroups: rule.conditionGroups.map((group, index) => {
                  if (index === 0) {
                    return {
                      ...group,
                      conditions: [...group.conditions, newCondition],
                    };
                  }
                  return group;
                }),
              };
            }
          }
          return rule;
        });
      });
      setSelectedItem({
        type: "condition",
        ruleId: selectedItem.ruleId,
        itemId: newCondition.id,
        groupId: targetGroupId,
      });
    },
    [selectedItem],
  );

  const addConditionGroup = (ruleId: string) => {
    const newGroup = {
      id: crypto.randomUUID(),
      operator: "and" as const,
      conditions: [],
    };
    setRules((prev) =>
      prev.map((rule) => {
        if (rule.id === ruleId) {
          return {
            ...rule,
            conditionGroups: [...rule.conditionGroups, newGroup],
          };
        }
        return rule;
      }),
    );
    setSelectedItem({
      type: "condition",
      ruleId: ruleId,
      groupId: newGroup.id,
    });
  };

  const performDeleteConditionGroup = (ruleId: string, groupId: string) => {
    setRules((prev) =>
      prev.map((rule) => {
        if (rule.id === ruleId) {
          return {
            ...rule,
            conditionGroups: rule.conditionGroups.filter(
              (group) => group.id !== groupId,
            ),
          };
        }
        return rule;
      }),
    );
    if (selectedItem && selectedItem.groupId === groupId) {
      setSelectedItem({ type: "trigger", ruleId });
    }
  };
  const deleteConditionGroup = (ruleId: string, groupId: string) => {
    if (ruleBuilderSettings.confirmDeleteBlock) {
      requestDeleteConfirmation(
        "Delete this condition group?",
        "This block will be removed from the rule.",
        () => performDeleteConditionGroup(ruleId, groupId),
      );
      return;
    }
    performDeleteConditionGroup(ruleId, groupId);
  };

  const toggleGroupOperator = (ruleId: string, groupId: string) => {
    setRules((prev) =>
      prev.map((rule) => {
        if (rule.id === ruleId) {
          return {
            ...rule,
            conditionGroups: rule.conditionGroups.map((group) => {
              if (group.id === groupId) {
                return {
                  ...group,
                  operator: group.operator === "and" ? "or" : "and",
                };
              }
              return group;
            }),
          };
        }
        return rule;
      }),
    );
  };

  const addRandomGroup = (ruleId: string) => {
    const newGroup: RandomGroup = {
      id: crypto.randomUUID(),
      chance_numerator: { value: 1, valueType: "number" },
      chance_denominator: { value: 4, valueType: "number" },
      respect_probability_effects: true,
      custom_key: "",
      effects: [],
    };
    setRules((prev) =>
      prev.map((rule) => {
        if (rule.id === ruleId) {
          return {
            ...rule,
            randomGroups: [...rule.randomGroups, newGroup],
          };
        }
        return rule;
      }),
    );
    setSelectedItem({
      type: "randomgroup",
      ruleId: ruleId,
      randomGroupId: newGroup.id,
    });
  };

  const addLoopGroup = (ruleId: string) => {
    const newLoop: LoopGroup = {
      id: crypto.randomUUID(),
      repetitions: { value: 1, valueType: "number" },
      effects: [],
    };
    setRules((prev) =>
      prev.map((rule) => {
        if (rule.id === ruleId) {
          return {
            ...rule,
            loops: [...rule.loops, newLoop],
          };
        }
        return rule;
      }),
    );
    setSelectedItem({
      type: "loopgroup",
      ruleId: ruleId,
      loopGroupId: newLoop.id,
    });
  };

  const toggleBlueprintCompatibility = (ruleId: string) => {
    setRules((prev) =>
      prev.map((rule) => {
        if (rule.id === ruleId) {
          return {
            ...rule,
            blueprintCompatible: !rule.blueprintCompatible,
          };
        }
        return rule;
      }),
    );
  };

  const performDeleteRandomGroup = (ruleId: string, randomGroupId: string) => {
    setRules((prev) =>
      prev.map((rule) => {
        if (rule.id === ruleId) {
          const groupToDelete = rule.randomGroups.find(
            (g) => g.id === randomGroupId,
          );
          return {
            ...rule,
            randomGroups: rule.randomGroups.filter(
              (group) => group.id !== randomGroupId,
            ),
            effects: groupToDelete
              ? [...rule.effects, ...groupToDelete.effects]
              : rule.effects,
          };
        }
        return rule;
      }),
    );
    if (selectedItem && selectedItem.randomGroupId === randomGroupId) {
      setSelectedItem({ type: "trigger", ruleId });
    }
  };
  const deleteRandomGroup = (ruleId: string, randomGroupId: string) => {
    if (ruleBuilderSettings.confirmDeleteBlock) {
      requestDeleteConfirmation(
        "Delete this random group?",
        "This block will be removed from the rule.",
        () => performDeleteRandomGroup(ruleId, randomGroupId),
      );
      return;
    }
    performDeleteRandomGroup(ruleId, randomGroupId);
  };

  const performDeleteLoopGroup = (ruleId: string, loopGroupId: string) => {
    setRules((prev) =>
      prev.map((rule) => {
        if (rule.id === ruleId) {
          const groupToDelete = rule.loops.find((g) => g.id === loopGroupId);
          return {
            ...rule,
            loops: rule.loops.filter((group) => group.id !== loopGroupId),
            effects: groupToDelete
              ? [...rule.effects, ...groupToDelete.effects]
              : rule.effects,
          };
        }
        return rule;
      }),
    );
    if (selectedItem && selectedItem.loopGroupId === loopGroupId) {
      setSelectedItem({ type: "trigger", ruleId });
    }
  };
  const deleteLoopGroup = (ruleId: string, loopGroupId: string) => {
    if (ruleBuilderSettings.confirmDeleteBlock) {
      requestDeleteConfirmation(
        "Delete this loop group?",
        "This block will be removed from the rule.",
        () => performDeleteLoopGroup(ruleId, loopGroupId),
      );
      return;
    }
    performDeleteLoopGroup(ruleId, loopGroupId);
  };

  const updateRandomGroup = (
    ruleId: string,
    randomGroupId: string,
    updates: Partial<RandomGroup>,
  ) => {
    setRules((prev) =>
      prev.map((rule) => {
        if (rule.id === ruleId) {
          return {
            ...rule,
            randomGroups: rule.randomGroups.map((group) =>
              group.id === randomGroupId ? { ...group, ...updates } : group,
            ),
          };
        }
        return rule;
      }),
    );
  };

  const updateLoopGroup = (
    ruleId: string,
    loopGroupId: string,
    updates: Partial<LoopGroup>,
  ) => {
    setRules((prev) =>
      prev.map((rule) => {
        if (rule.id === ruleId) {
          return {
            ...rule,
            loops: rule.loops.map((group) =>
              group.id === loopGroupId ? { ...group, ...updates } : group,
            ),
          };
        }
        return rule;
      }),
    );
  };

  const createRandomGroupFromEffect = (ruleId: string, effectId: string) => {
    const newGroup: RandomGroup = {
      id: crypto.randomUUID(),
      chance_numerator: { value: 1, valueType: "number" },
      chance_denominator: { value: 4, valueType: "number" },
      respect_probability_effects: true,
      custom_key: "",
      effects: [],
    };
    setRules((prev) =>
      prev.map((rule) => {
        if (rule.id !== ruleId) return rule;
        let movedEffect: Effect | null = null;
        const updatedRule = { ...rule };

        updatedRule.effects = rule.effects.filter((effect) => {
          if (effect.id === effectId) {
            movedEffect = effect;
            return false;
          }
          return true;
        });

        updatedRule.randomGroups = rule.randomGroups.map((group) => ({
          ...group,
          effects: group.effects.filter((effect) => {
            if (effect.id === effectId) {
              movedEffect = effect;
              return false;
            }
            return true;
          }),
        }));

        if (movedEffect) {
          newGroup.effects = [movedEffect];
          updatedRule.randomGroups = [...updatedRule.randomGroups, newGroup];
        }

        return updatedRule;
      }),
    );
    setSelectedItem({
      type: "randomgroup",
      ruleId: ruleId,
      randomGroupId: newGroup.id,
    });
  };

  const createLoopGroupFromEffect = (ruleId: string, effectId: string) => {
    const newGroup: LoopGroup = {
      id: crypto.randomUUID(),
      repetitions: { value: 1, valueType: "number" },
      effects: [],
    };
    setRules((prev) =>
      prev.map((rule) => {
        if (rule.id !== ruleId) return rule;
        let movedEffect: Effect | null = null;
        const updatedRule = { ...rule };

        updatedRule.effects = rule.effects.filter((effect) => {
          if (effect.id === effectId) {
            movedEffect = effect;
            return false;
          }
          return true;
        });

        updatedRule.loops = rule.loops.map((group) => ({
          ...group,
          effects: group.effects.filter((effect) => {
            if (effect.id === effectId) {
              movedEffect = effect;
              return false;
            }
            return true;
          }),
        }));

        if (movedEffect) {
          newGroup.effects = [movedEffect];
          updatedRule.loops = [...updatedRule.loops, newGroup];
        }

        return updatedRule;
      }),
    );
    setSelectedItem({
      type: "randomgroup",
      ruleId: ruleId,
      randomGroupId: newGroup.id,
    });
  };

  const addEffect = (effectType: string) => {
    if (!selectedItem) return;

    const newEffect: Effect = createEffectFromType(effectType);

    setRules((prev) =>
      prev.map((rule) => {
        if (rule.id === selectedItem.ruleId) {
          if (selectedItem.randomGroupId) {
            return {
              ...rule,
              randomGroups: rule.randomGroups.map((group) =>
                group.id === selectedItem.randomGroupId
                  ? { ...group, effects: [...group.effects, newEffect] }
                  : group,
              ),
            };
          } else if (selectedItem.loopGroupId) {
            return {
              ...rule,
              loops: rule.loops.map((group) =>
                group.id === selectedItem.loopGroupId
                  ? { ...group, effects: [...group.effects, newEffect] }
                  : group,
              ),
            };
          } else {
            return {
              ...rule,
              effects: [...rule.effects, newEffect],
            };
          }
        }
        return rule;
      }),
    );
    setSelectedItem({
      type: "effect",
      ruleId: selectedItem.ruleId,
      itemId: newEffect.id,
      randomGroupId: selectedItem.randomGroupId,
    });
  };

  const updateCondition = (
    ruleId: string,
    conditionId: string,
    updates: Partial<Condition>,
  ) => {
    setRules((prev) =>
      prev.map((rule) => {
        if (rule.id === ruleId) {
          return {
            ...rule,
            conditionGroups: rule.conditionGroups.map((group) => ({
              ...group,
              conditions: group.conditions.map((condition) =>
                condition.id === conditionId
                  ? { ...condition, ...updates }
                  : condition,
              ),
            })),
          };
        }
        return rule;
      }),
    );
  };

  const updateEffect = (
    ruleId: string,
    effectId: string,
    updates: Partial<Effect>,
  ) => {
    setRules((prev) =>
      prev.map((rule) => {
        if (rule.id === ruleId) {
          const updatedRule = { ...rule };
          updatedRule.effects = rule.effects.map((effect) =>
            effect.id === effectId ? { ...effect, ...updates } : effect,
          );
          updatedRule.randomGroups = rule.randomGroups.map(
            (group) => ({
              ...group,
              effects: group.effects.map((effect) =>
                effect.id === effectId ? { ...effect, ...updates } : effect,
              ),
            }),
            (updatedRule.loops = rule.loops.map((group) => ({
              ...group,
              effects: group.effects.map((effect) =>
                effect.id === effectId ? { ...effect, ...updates } : effect,
              ),
            }))),
          );
          return updatedRule;
        }
        return rule;
      }),
    );
  };

  const performDeleteRule = (ruleId: string) => {
    if (selectedRuleIds.length > 1 && selectedRuleIdSet.has(ruleId)) {
      performDeleteSelectedRules();
      return;
    }

    setRules((prev) => prev.filter((rule) => rule.id !== ruleId));
    setSelectedRuleIds((prev) => prev.filter((id) => id !== ruleId));
    if (selectedItem && selectedItem.ruleId === ruleId) {
      setSelectedItem(null);
    }
  };
  const deleteRule = (ruleId: string) => {
    if (ruleBuilderSettings.confirmDeleteRule) {
      const isMulti = selectedRuleIds.length > 1 && selectedRuleIdSet.has(ruleId);
      requestDeleteConfirmation(
        isMulti ? `Delete ${selectedRuleIds.length} selected rules?` : "Delete this rule?",
        "This action cannot be undone.",
        () => performDeleteRule(ruleId),
      );
      return;
    }
    performDeleteRule(ruleId);
  };

  const performDeleteCondition = (ruleId: string, conditionId: string) => {
    setRules((prev) =>
      prev.map((rule) => {
        if (rule.id === ruleId) {
          return {
            ...rule,
            conditionGroups: rule.conditionGroups
              .map((group) => ({
                ...group,
                conditions: group.conditions.filter(
                  (condition) => condition.id !== conditionId,
                ),
              }))
              .filter((group) => group.conditions.length > 0),
          };
        }
        return rule;
      }),
    );
    if (selectedItem && selectedItem.itemId === conditionId) {
      setSelectedItem({ type: "trigger", ruleId });
    }
  };
  const deleteCondition = (ruleId: string, conditionId: string) => {
    if (ruleBuilderSettings.confirmDeleteBlock) {
      requestDeleteConfirmation(
        "Delete this condition block?",
        "This block will be removed from the rule.",
        () => performDeleteCondition(ruleId, conditionId),
      );
      return;
    }
    performDeleteCondition(ruleId, conditionId);
  };

  const performDeleteEffect = (ruleId: string, effectId: string) => {
    setRules((prev) =>
      prev.map((rule) => {
        if (rule.id === ruleId) {
          return {
            ...rule,
            effects: rule.effects.filter((effect) => effect.id !== effectId),
            randomGroups: rule.randomGroups.map((group) => ({
              ...group,
              effects: group.effects.filter((effect) => effect.id !== effectId),
            })),
            loops: rule.loops.map((group) => ({
              ...group,
              effects: group.effects.filter((effect) => effect.id !== effectId),
            })),
          };
        }
        return rule;
      }),
    );
    if (selectedItem && selectedItem.itemId === effectId) {
      setSelectedItem({ type: "trigger", ruleId });
    }
  };
  const deleteEffect = (ruleId: string, effectId: string) => {
    if (ruleBuilderSettings.confirmDeleteBlock) {
      requestDeleteConfirmation(
        "Delete this effect block?",
        "This block will be removed from the rule.",
        () => performDeleteEffect(ruleId, effectId),
      );
      return;
    }
    performDeleteEffect(ruleId, effectId);
  };

  const updateConditionOperator = (
    ruleId: string,
    conditionId: string,
    operator: "and" | "or",
  ) => {
    setRules((prev) =>
      prev.map((rule) => {
        if (rule.id === ruleId) {
          return {
            ...rule,
            conditionGroups: rule.conditionGroups.map((group) => ({
              ...group,
              conditions: group.conditions.map((condition) =>
                condition.id === conditionId
                  ? { ...condition, operator }
                  : condition,
              ),
            })),
          };
        }
        return rule;
      }),
    );
  };

  const getParameterCount = (
    params: Record<string, { value: unknown; valueType?: string }>,
  ): number => {
    return Object.keys(params).length;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const findRuleIdForDropTarget = useCallback(
    (overId: string): string | null => {
      if (!overId) return null;
      if (overId.startsWith("drop:rule:")) {
        return overId.split(":")[2] || null;
      }

      for (const rule of rules) {
        if (
          rule.conditionGroups.some((group) =>
            group.conditions.some((condition) => condition.id === overId),
          )
        ) {
          return rule.id;
        }
        if (rule.effects.some((effect) => effect.id === overId)) {
          return rule.id;
        }
        if (
          rule.randomGroups.some((group) =>
            group.effects.some((effect) => effect.id === overId),
          )
        ) {
          return rule.id;
        }
        if (
          rule.loops.some((group) =>
            group.effects.some((effect) => effect.id === overId),
          )
        ) {
          return rule.id;
        }
      }

      return null;
    },
    [rules],
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over, delta } = event;
    const activeId = active.id as string;

    if (activeId.startsWith("panel-")) {
      const panelId = activeId.replace("panel-", "");
      const currentPanel = panels[panelId];
      if (delta && currentPanel) {
        const newPosition = {
          x: Math.max(0, currentPanel.position.x + delta.x),
          y: Math.max(0, currentPanel.position.y + delta.y),
        };
        updatePanelPosition(panelId, newPosition);
      }
      setActiveId(null);
      return;
    }

    // Dragging from block palette to a rule card drop zone.
    if (activeId.startsWith("palette:")) {
      const overId = (over?.id as string | undefined) || "";
      const parts = activeId.split(":");
      const blockType = parts[1] as "trigger" | "condition" | "effect";
      const blockId = parts.slice(2).join(":");
      const ruleId = findRuleIdForDropTarget(overId);

      if (ruleId) {
        if (blockType === "trigger") {
          setRules((prev) =>
            prev.map((rule) =>
              rule.id === ruleId ? { ...rule, trigger: blockId } : rule,
            ),
          );
          setSelectedItem({ type: "trigger", ruleId });
        } else if (blockType === "condition") {
          const newCondition = createConditionFromType(blockId);
          let targetGroupId = "";

          setRules((prev) =>
            prev.map((rule) => {
              if (rule.id !== ruleId) return rule;

              const targetGroupIndex = rule.conditionGroups.findIndex((group) =>
                group.conditions.some((condition) => condition.id === overId),
              );

              if (targetGroupIndex >= 0) {
                const targetGroup = rule.conditionGroups[targetGroupIndex];
                const insertAt = Math.max(
                  0,
                  targetGroup.conditions.findIndex(
                    (condition) => condition.id === overId,
                  ),
                );
                targetGroupId = targetGroup.id;
                return {
                  ...rule,
                  conditionGroups: rule.conditionGroups.map((group, index) =>
                    index === targetGroupIndex
                      ? {
                          ...group,
                          conditions: [
                            ...group.conditions.slice(0, insertAt),
                            newCondition,
                            ...group.conditions.slice(insertAt),
                          ],
                        }
                      : group,
                  ),
                };
              }

              if (rule.conditionGroups.length === 0) {
                const newGroupId = crypto.randomUUID();
                targetGroupId = newGroupId;
                return {
                  ...rule,
                  conditionGroups: [
                    {
                      id: newGroupId,
                      operator: "and",
                      conditions: [newCondition],
                    },
                  ],
                };
              }

              targetGroupId = rule.conditionGroups[0].id;
              return {
                ...rule,
                conditionGroups: rule.conditionGroups.map((group, index) =>
                  index === 0
                    ? { ...group, conditions: [...group.conditions, newCondition] }
                    : group,
                ),
              };
            }),
          );

          setSelectedItem({
            type: "condition",
            ruleId,
            itemId: newCondition.id,
            groupId: targetGroupId,
          });
        } else if (blockType === "effect") {
          const newEffect = createEffectFromType(blockId);
          setRules((prev) =>
            prev.map((rule) => {
              if (rule.id !== ruleId) return rule;

              const topLevelEffectIndex = rule.effects.findIndex(
                (effect) => effect.id === overId,
              );
              if (topLevelEffectIndex >= 0) {
                return {
                  ...rule,
                  effects: [
                    ...rule.effects.slice(0, topLevelEffectIndex),
                    newEffect,
                    ...rule.effects.slice(topLevelEffectIndex),
                  ],
                };
              }

              return {
                ...rule,
                effects: [...rule.effects, newEffect],
              };
            }),
          );
          setSelectedItem({
            type: "effect",
            ruleId,
            itemId: newEffect.id,
          });
        }
      }
      setActiveId(null);
      return;
    }

    if (!over || active.id === over.id) {
      return;
    }

    const overId = over.id as string;

    setRules((currentRules) => {
      let activeRule: Rule | undefined;
      let containerWithActive: (Condition[] | Effect[]) | undefined;
      let containerWithOver: (Condition[] | Effect[]) | undefined;

      for (const rule of currentRules) {
        for (const group of rule.conditionGroups) {
          if (group.conditions.some((c) => c.id === activeId)) {
            activeRule = rule;
            containerWithActive = group.conditions;
          }
          if (group.conditions.some((c) => c.id === overId)) {
            containerWithOver = group.conditions;
          }
        }

        if (rule.effects.some((e) => e.id === activeId)) {
          activeRule = rule;
          containerWithActive = rule.effects;
        }
        if (rule.effects.some((e) => e.id === overId)) {
          containerWithOver = rule.effects;
        }

        for (const group of rule.randomGroups) {
          if (group.effects.some((e) => e.id === activeId)) {
            activeRule = rule;
            containerWithActive = group.effects;
          }
          if (group.effects.some((e) => e.id === overId)) {
            containerWithOver = group.effects;
          }
        }

        if (activeRule) break;
      }

      if (
        !activeRule ||
        !containerWithActive ||
        !containerWithOver ||
        containerWithActive !== containerWithOver
      ) {
        return currentRules;
      }

      const oldIndex = containerWithActive.findIndex((i) => i.id === activeId);
      const newIndex = containerWithOver.findIndex((i) => i.id === overId);

      if (oldIndex === -1 || newIndex === -1) {
        return currentRules;
      }

      let reorderedItems: Condition[] | Effect[];
      if (
        activeRule.conditionGroups.some(
          (group) => group.conditions === containerWithActive,
        )
      ) {
        reorderedItems = arrayMove(
          containerWithActive as Condition[],
          oldIndex,
          newIndex,
        );
      } else {
        reorderedItems = arrayMove(
          containerWithActive as Effect[],
          oldIndex,
          newIndex,
        );
      }

      return currentRules.map((rule) => {
        if (rule.id !== activeRule?.id) {
          return rule;
        }
        if (
          activeRule.conditionGroups.some(
            (group) => group.conditions === containerWithActive,
          )
        ) {
          return {
            ...rule,
            conditionGroups: rule.conditionGroups.map((group) =>
              group.conditions === containerWithActive
                ? { ...group, conditions: reorderedItems as Condition[] }
                : group,
            ),
          };
        } else if (rule.effects === containerWithActive) {
          return {
            ...rule,
            effects: reorderedItems as Effect[],
          };
        } else {
          return {
            ...rule,
            randomGroups: rule.randomGroups.map((group) =>
              group.effects === containerWithActive
                ? { ...group, effects: reorderedItems as Effect[] }
                : group,
            ),
          };
        }
      });
    });
  };

  const createAlternatingDotPattern = () => {
    const dotSize = 1.15;
    return `
      radial-gradient(circle, rgba(124, 149, 186, 0.42) ${dotSize}px, transparent ${dotSize}px)
    `;
  };

  const modeLabel = itemType.charAt(0).toUpperCase() + itemType.slice(1);

  const handleGameVariableApplied = useCallback(() => {
    setSelectedGameVariable(null);
  }, []);

  const selectedRule = getSelectedRule(rules, selectedItem);
  const selectedCondition = getSelectedCondition(rules, selectedItem);
  const selectedEffect = getSelectedEffect(rules, selectedItem);
  const selectedRandomGroup = getSelectedRandomGroup(rules, selectedItem);
  const selectedLoopGroup = getSelectedLoopGroup(rules, selectedItem);
  const liveCodeIsVisible = panels.liveCode?.isVisible ?? false;
  const historyTimeline = [
    ...historyPastRef.current,
    rules,
    ...historyFutureRef.current.slice().reverse(),
  ];
  const historyCurrentIndex = historyPastRef.current.length;
  const builderWidthPercent = liveCodeIsVisible
    ? Math.max(0, 100 - liveCodeWidthPercent)
    : 100;
  const selectedRuleIdSet = useMemo(
    () => new Set(selectedRuleIds),
    [selectedRuleIds],
  );
  const segmentIdFromContextTarget = useCallback(
    (
      target:
        | RuleBuilderContextTarget
        | {
            type: "trigger" | "condition" | "effect";
            ruleId: string;
            itemId?: string;
            groupId?: string;
          }
        | null
        | undefined,
    ): string | undefined => {
      if (!target?.ruleId) return undefined;

      if (target.type === "trigger") {
        return `trigger:${target.ruleId}`;
      }

      if (target.type === "condition" && target.itemId) {
        return `condition:${target.ruleId}:${target.itemId}`;
      }

      if (target.type === "effect" && target.itemId) {
        return `effect:${target.ruleId}:${target.itemId}`;
      }

      return undefined;
    },
    [],
  );

  const generateConditionTitleForCard = useCallback(
    (condition: Condition) => {
      const conditionType = getConditionType(condition.type);
      if (!conditionType) return condition.type;
      return generateAutoTitle(condition, conditionType, true);
    },
    [generateAutoTitle, getConditionType],
  );

  const generateEffectTitleForCard = useCallback(
    (effect: Effect) => {
      const effectType = getEffectType(effect.type);
      if (!effectType) return effect.type;
      return generateAutoTitle(effect, effectType, false);
    },
    [generateAutoTitle, getEffectType],
  );

  const handleRuleCardDoubleClick = useCallback(() => {
    setInspectorIsOpen(true);
  }, []);

  const handlePreviewBlockCode = useCallback(
    (target: {
      type: "trigger" | "condition" | "effect";
      ruleId: string;
      itemId?: string;
      groupId?: string;
    }) => {
      setLiveCodePreviewTarget(target);
      if (!liveCodeIsVisible) {
        togglePanel("liveCode");
      }
    },
    [liveCodeIsVisible, togglePanel],
  );

  const moveSelectedRulesByDelta = useCallback(
    (deltaX: number, deltaY: number) => {
      if (selectedRuleIds.length < 2) return;
      if (deltaX === 0 && deltaY === 0) return;

      const selectedSet = new Set(selectedRuleIds);
      setRules((prev) =>
        prev.map((rule) =>
          selectedSet.has(rule.id)
            ? {
                ...rule,
                position: {
                  x: (rule.position?.x || 0) + deltaX,
                  y: (rule.position?.y || 0) + deltaY,
                },
              }
            : rule,
        ),
      );
    },
    [selectedRuleIds],
  );

  const finalizeSelectedRulesDrag = useCallback(() => {
    if (!gridSnapping || selectedRuleIds.length < 2) return;

    const selectedSet = new Set(selectedRuleIds);
    setRules((prev) =>
      prev.map((rule) =>
        selectedSet.has(rule.id)
          ? {
              ...rule,
              position: {
                x: Math.round((rule.position?.x || 0) / 20) * 20,
                y: Math.round((rule.position?.y || 0) / 20) * 20,
              },
            }
          : rule,
      ),
    );
  }, [gridSnapping, selectedRuleIds]);

  const duplicateSelectedRules = useCallback(() => {
    if (selectedRuleIds.length === 0) return;

    const selectedSet = new Set(selectedRuleIds);
    const newRuleIds: string[] = [];

    setRules((prevRules) => {
      const duplicated = prevRules
        .filter((rule) => selectedSet.has(rule.id))
        .map((rule) => {
          const newRuleId = crypto.randomUUID();
          newRuleIds.push(newRuleId);
          return {
            ...rule,
            id: newRuleId,
            position: {
              x: (rule.position?.x || 0) + 30,
              y: (rule.position?.y || 0) + 30,
            },
            conditionGroups: rule.conditionGroups.map((group) => ({
              ...group,
              id: crypto.randomUUID(),
              conditions: group.conditions.map((condition) => ({
                ...condition,
                id: crypto.randomUUID(),
              })),
            })),
            effects: rule.effects.map((effect) => ({
              ...effect,
              id: crypto.randomUUID(),
            })),
            randomGroups: rule.randomGroups.map((group) => ({
              ...group,
              id: crypto.randomUUID(),
            })),
            loops: rule.loops.map((group) => ({
              ...group,
              id: crypto.randomUUID(),
            })),
          };
        });

      return [...prevRules, ...duplicated];
    });

    if (newRuleIds.length > 0) {
      setSelectedRuleIds(newRuleIds);
      setSelectedItem(
        newRuleIds.length === 1
          ? { type: "trigger", ruleId: newRuleIds[0] }
          : null,
      );
    }
  }, [selectedRuleIds]);

  const copySelectedRules = useCallback(() => {
    if (selectedRuleIds.length === 0) return;

    const selectedSet = new Set(selectedRuleIds);
    const copied = rules
      .filter((rule) => selectedSet.has(rule.id))
      .map((rule) => cloneRulesSnapshot([rule])[0]);

    copiedRulesRef.current = copied;
    pasteOffsetStepRef.current = 1;
  }, [rules, selectedRuleIds]);

  const pasteCopiedRules = useCallback(() => {
    if (copiedRulesRef.current.length === 0) return;

    const offset = 30 * pasteOffsetStepRef.current;
    const newRuleIds: string[] = [];

    const pastedRules = copiedRulesRef.current.map((rule) => {
      const newRuleId = crypto.randomUUID();
      newRuleIds.push(newRuleId);

      return {
        ...rule,
        id: newRuleId,
        position: {
          x: (rule.position?.x || 0) + offset,
          y: (rule.position?.y || 0) + offset,
        },
        conditionGroups: rule.conditionGroups.map((group) => ({
          ...group,
          id: crypto.randomUUID(),
          conditions: group.conditions.map((condition) => ({
            ...condition,
            id: crypto.randomUUID(),
          })),
        })),
        effects: rule.effects.map((effect) => ({
          ...effect,
          id: crypto.randomUUID(),
        })),
        randomGroups: rule.randomGroups.map((group) => ({
          ...group,
          id: crypto.randomUUID(),
          effects: group.effects.map((effect) => ({
            ...effect,
            id: crypto.randomUUID(),
          })),
        })),
        loops: rule.loops.map((group) => ({
          ...group,
          id: crypto.randomUUID(),
          effects: group.effects.map((effect) => ({
            ...effect,
            id: crypto.randomUUID(),
          })),
        })),
      };
    });

    setRules((prevRules) => [...prevRules, ...pastedRules]);
    setSelectedRuleIds(newRuleIds);
    setSelectedItem(
      newRuleIds.length === 1
        ? { type: "trigger", ruleId: newRuleIds[0] }
        : null,
    );

    pasteOffsetStepRef.current += 1;
  }, []);

  const performDeleteSelectedRules = useCallback(() => {
    if (selectedRuleIds.length === 0) return;
    const selectedSet = new Set(selectedRuleIds);
    setRules((prev) => prev.filter((rule) => !selectedSet.has(rule.id)));
    setSelectedRuleIds([]);
    setSelectedItem(null);
  }, [selectedRuleIds]);

  const deleteSelectedRules = useCallback(() => {
    if (selectedRuleIds.length === 0) return;
    if (ruleBuilderSettings.confirmDeleteRule) {
      requestDeleteConfirmation(
        `Delete ${selectedRuleIds.length} selected rules?`,
        "This action cannot be undone.",
        performDeleteSelectedRules,
      );
      return;
    }
    performDeleteSelectedRules();
  }, [
    performDeleteSelectedRules,
    requestDeleteConfirmation,
    ruleBuilderSettings.confirmDeleteRule,
    selectedRuleIds.length,
  ]);

  const moveSelectedRulesToContextPoint = useCallback(() => {
    if (selectedRuleIds.length === 0 || !lastContextWorldPoint) return;
    const selectedSet = new Set(selectedRuleIds);

    const selectedRules = rules.filter((rule) => selectedSet.has(rule.id));
    if (selectedRules.length === 0) return;

    const minX = Math.min(
      ...selectedRules.map((rule) => rule.position?.x || 0),
    );
    const minY = Math.min(
      ...selectedRules.map((rule) => rule.position?.y || 0),
    );
    const offsetX = lastContextWorldPoint.x - minX;
    const offsetY = lastContextWorldPoint.y - minY;

    setRules((prev) =>
      prev.map((rule) =>
        selectedSet.has(rule.id)
          ? {
              ...rule,
              position: {
                x: Math.round((rule.position?.x || 0) + offsetX),
                y: Math.round((rule.position?.y || 0) + offsetY),
              },
            }
          : rule,
      ),
    );
  }, [lastContextWorldPoint, rules, selectedRuleIds]);

  const handleCanvasMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!ruleBuilderSettings.enableDragBoxSelection) return;
      if (ruleBuilderSettings.enableLeftMousePan && !event.shiftKey) return;
      if (event.button !== 0) return;

      const target = event.target as HTMLElement;

      // Ignore background selection while a popper-based menu is open.
      // This prevents select item clicks from being interpreted as canvas clicks.
      if (
        document.querySelector(
          "[data-slot='select-content'][data-state='open'], [data-radix-popper-content-wrapper] [role='listbox']",
        )
      ) {
        return;
      }

      if (
        target.closest(
          "[data-rb-context], [data-rb-panel='true'], [data-rb-live-code='true']",
        )
      ) {
        return;
      }

      setIsDragSelecting(true);
      setSelectionRect({
        startClientX: event.clientX,
        startClientY: event.clientY,
        currentClientX: event.clientX,
        currentClientY: event.clientY,
      });
      setSelectedItem(null);
      setSelectedRuleIds([]);
    },
    [
      ruleBuilderSettings.enableDragBoxSelection,
      ruleBuilderSettings.enableLeftMousePan,
    ],
  );

  const handleViewportMouseDownCapture = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!ruleBuilderSettings.enableMiddleMousePan) return;
      if (event.button !== 1) return;

      event.preventDefault();
      event.stopPropagation();

      middlePanStartRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
        originX: panState.x,
        originY: panState.y,
        scale: panState.scale,
      };
      setIsMiddlePanning(true);
    },
    [panState.x, panState.y, panState.scale, ruleBuilderSettings.enableMiddleMousePan],
  );

  const handleViewportAuxClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.button !== 1) return;
      event.preventDefault();
    },
    [],
  );

  useEffect(() => {
    if (!isDragSelecting) return;

    const handleMouseMove = (event: MouseEvent) => {
      setSelectionRect((prev) =>
        prev
          ? {
              ...prev,
              currentClientX: event.clientX,
              currentClientY: event.clientY,
            }
          : prev,
      );
    };

    const handleMouseUp = () => {
      setIsDragSelecting(false);
      setSelectionRect((rect) => {
        if (!rect) return null;

        const left = Math.min(rect.startClientX, rect.currentClientX);
        const right = Math.max(rect.startClientX, rect.currentClientX);
        const top = Math.min(rect.startClientY, rect.currentClientY);
        const bottom = Math.max(rect.startClientY, rect.currentClientY);

        const ruleNodes = Array.from(
          document.querySelectorAll<HTMLElement>('[data-rb-context="rule"]'),
        );

        const intersectedRuleIds = ruleNodes
          .filter((node) => {
            const bounds = node.getBoundingClientRect();
            return !(
              bounds.right < left ||
              bounds.left > right ||
              bounds.bottom < top ||
              bounds.top > bottom
            );
          })
          .map((node) => node.dataset.ruleId)
          .filter((ruleId): ruleId is string => Boolean(ruleId));

        setSelectedRuleIds(intersectedRuleIds);
        if (intersectedRuleIds.length === 1) {
          setSelectedItem({
            type: "trigger",
            ruleId: intersectedRuleIds[0],
          });
        } else {
          setSelectedItem(null);
        }

        return null;
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragSelecting]);

  useEffect(() => {
    if (!isMiddlePanning) return;

    document.body.style.cursor = "grabbing";

    const handleMouseMove = (event: MouseEvent) => {
      const start = middlePanStartRef.current;
      if (!start) return;

      const deltaX = event.clientX - start.clientX;
      const deltaY = event.clientY - start.clientY;

      transformRef.current?.setTransform(
        start.originX + deltaX,
        start.originY + deltaY,
        start.scale,
        0,
      );
    };

    const stopMiddlePan = () => {
      setIsMiddlePanning(false);
      middlePanStartRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopMiddlePan);

    return () => {
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopMiddlePan);
    };
  }, [isMiddlePanning]);

  const resolveContextTarget = useCallback(
    (target: EventTarget | null): RuleBuilderContextTarget => {
      if (!(target instanceof HTMLElement)) {
        return { type: "canvas" };
      }

      const node = target.closest<HTMLElement>("[data-rb-context]");

      if (!node) {
        return { type: "canvas" };
      }

      const contextType = node.dataset.rbContext;
      const ruleId = node.dataset.ruleId;

      if (!contextType) {
        return { type: "canvas" };
      }

      return {
        type: contextType as RuleBuilderContextTarget["type"],
        ruleId,
        itemId: node.dataset.itemId,
        groupId: node.dataset.groupId,
        randomGroupId: node.dataset.randomGroupId,
        loopGroupId: node.dataset.loopGroupId,
      };
    },
    [],
  );

  const handleCanvasPointerMoveCapture = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const next = resolveContextTarget(event.target);
      const normalized = next.type === "canvas" ? null : next;

      setHoveredContextTarget((current) =>
        isSameContextTarget(current, normalized) ? current : normalized,
      );
    },
    [resolveContextTarget],
  );

  const handleCanvasPointerLeave = useCallback(() => {
    setHoveredContextTarget(null);
  }, []);

  const applyContextSelection = useCallback(
    (target: RuleBuilderContextTarget) => {
      if (!target.ruleId) return;

      if (
        selectedRuleIds.length > 1 &&
        selectedRuleIdSet.has(target.ruleId) &&
        (target.type === "rule" || target.type === "trigger")
      ) {
        return;
      }

      if (target.type === "rule" || target.type === "trigger") {
        setSelectedItem({ type: "trigger", ruleId: target.ruleId });
        setSelectedRuleIds([target.ruleId]);
        return;
      }

      if (target.type === "condition" && target.itemId) {
        setSelectedItem({
          type: "condition",
          ruleId: target.ruleId,
          itemId: target.itemId,
          groupId: target.groupId,
        });
        setSelectedRuleIds([target.ruleId]);
        return;
      }

      if (target.type === "effect" && target.itemId) {
        setSelectedItem({
          type: "effect",
          ruleId: target.ruleId,
          itemId: target.itemId,
          randomGroupId: target.randomGroupId,
          loopGroupId: target.loopGroupId,
        });
        setSelectedRuleIds([target.ruleId]);
        return;
      }

      if (target.type === "condition-group" && target.groupId) {
        setSelectedItem({
          type: "condition",
          ruleId: target.ruleId,
          groupId: target.groupId,
        });
        setSelectedRuleIds([target.ruleId]);
        return;
      }

      if (target.type === "random-group" && target.randomGroupId) {
        setSelectedItem({
          type: "randomgroup",
          ruleId: target.ruleId,
          randomGroupId: target.randomGroupId,
        });
        setSelectedRuleIds([target.ruleId]);
        return;
      }

      if (target.type === "loop-group" && target.loopGroupId) {
        setSelectedItem({
          type: "loopgroup",
          ruleId: target.ruleId,
          loopGroupId: target.loopGroupId,
        });
        setSelectedRuleIds([target.ruleId]);
      }
    },
    [selectedRuleIdSet, selectedRuleIds.length],
  );

  const handleRuleBuilderContextMenuCapture = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const isLiveCodeTarget =
        event.target instanceof HTMLElement &&
        !!event.target.closest("[data-rb-live-code='true']");

      setIsLiveCodeContextMenu(isLiveCodeTarget);

      if (isLiveCodeTarget) {
        return;
      }

      const nextTarget = resolveContextTarget(event.target);
      setContextTarget(nextTarget);

      const viewportRect = builderViewportRef.current?.getBoundingClientRect();
      if (viewportRect) {
        const localX = event.clientX - viewportRect.left;
        const localY = event.clientY - viewportRect.top;
        setLastContextWorldPoint({
          x: (localX - panState.x) / Math.max(panState.scale, 0.1),
          y: (localY - panState.y) / Math.max(panState.scale, 0.1),
        });
      }

      applyContextSelection(nextTarget);
    },
    [
      applyContextSelection,
      panState.scale,
      panState.x,
      panState.y,
      resolveContextTarget,
    ],
  );

  const handleContextDelete = useCallback(() => {
    if (!contextTarget.ruleId) return;

    switch (contextTarget.type) {
      case "rule":
      case "trigger":
        deleteRule(contextTarget.ruleId);
        break;
      case "condition":
        if (contextTarget.itemId) {
          deleteCondition(contextTarget.ruleId, contextTarget.itemId);
        }
        break;
      case "effect":
        if (contextTarget.itemId) {
          deleteEffect(contextTarget.ruleId, contextTarget.itemId);
        }
        break;
      case "condition-group":
        if (contextTarget.groupId) {
          deleteConditionGroup(contextTarget.ruleId, contextTarget.groupId);
        }
        break;
      case "random-group":
        if (contextTarget.randomGroupId) {
          deleteRandomGroup(contextTarget.ruleId, contextTarget.randomGroupId);
        }
        break;
      case "loop-group":
        if (contextTarget.loopGroupId) {
          deleteLoopGroup(contextTarget.ruleId, contextTarget.loopGroupId);
        }
        break;
      default:
        break;
    }
  }, [
    contextTarget,
    deleteCondition,
    deleteConditionGroup,
    deleteEffect,
    deleteLoopGroup,
    deleteRandomGroup,
    deleteRule,
  ]);

  const handleContextDuplicate = useCallback(() => {
    if (!contextTarget.ruleId) return;

    if (contextTarget.type === "rule" || contextTarget.type === "trigger") {
      duplicateRule(contextTarget.ruleId);
      return;
    }

    if (
      contextTarget.type === "condition" &&
      contextTarget.itemId &&
      contextTarget.groupId
    ) {
      duplicateCondition(
        contextTarget.ruleId,
        contextTarget.groupId,
        contextTarget.itemId,
      );
      return;
    }

    if (contextTarget.type === "effect" && contextTarget.itemId) {
      duplicateEffect(
        contextTarget.ruleId,
        contextTarget.itemId,
        contextTarget.randomGroupId,
        contextTarget.loopGroupId,
      );
    }
  }, [contextTarget, duplicateCondition, duplicateEffect, duplicateRule]);

  const handleContextPreview = useCallback(() => {
    if (!contextTarget.ruleId) return;

    if (contextTarget.type === "trigger") {
      setLiveCodePreviewTarget({
        type: "trigger",
        ruleId: contextTarget.ruleId,
      });
    }

    if (contextTarget.type === "condition" && contextTarget.itemId) {
      setLiveCodePreviewTarget({
        type: "condition",
        ruleId: contextTarget.ruleId,
        itemId: contextTarget.itemId,
        groupId: contextTarget.groupId,
      });
    }

    if (contextTarget.type === "effect" && contextTarget.itemId) {
      setLiveCodePreviewTarget({
        type: "effect",
        ruleId: contextTarget.ruleId,
        itemId: contextTarget.itemId,
      });
    }

    if (!liveCodeIsVisible) {
      togglePanel("liveCode");
    }
  }, [contextTarget, liveCodeIsVisible, togglePanel]);

  const canDeleteContextTarget =
    (contextTarget.type === "rule" && !!contextTarget.ruleId) ||
    (contextTarget.type === "trigger" && !!contextTarget.ruleId) ||
    (contextTarget.type === "condition" &&
      !!contextTarget.ruleId &&
      !!contextTarget.itemId) ||
    (contextTarget.type === "effect" &&
      !!contextTarget.ruleId &&
      !!contextTarget.itemId) ||
    (contextTarget.type === "condition-group" &&
      !!contextTarget.ruleId &&
      !!contextTarget.groupId) ||
    (contextTarget.type === "random-group" &&
      !!contextTarget.ruleId &&
      !!contextTarget.randomGroupId) ||
    (contextTarget.type === "loop-group" &&
      !!contextTarget.ruleId &&
      !!contextTarget.loopGroupId);

  const canDuplicateContextTarget =
    (contextTarget.type === "rule" && !!contextTarget.ruleId) ||
    (contextTarget.type === "trigger" && !!contextTarget.ruleId) ||
    (contextTarget.type === "condition" &&
      !!contextTarget.ruleId &&
      !!contextTarget.itemId &&
      !!contextTarget.groupId) ||
    (contextTarget.type === "effect" &&
      !!contextTarget.ruleId &&
      !!contextTarget.itemId);

  const canPreviewContextTarget =
    (contextTarget.type === "trigger" && !!contextTarget.ruleId) ||
    (contextTarget.type === "condition" &&
      !!contextTarget.ruleId &&
      !!contextTarget.itemId) ||
    (contextTarget.type === "effect" &&
      !!contextTarget.ruleId &&
      !!contextTarget.itemId);

  const hasBulkSelection = selectedRuleIds.length > 1;
  const selectedSegmentId = useMemo(() => {
    if (liveCodePreviewTarget) {
      return segmentIdFromContextTarget(liveCodePreviewTarget);
    }

    if (selectedItem?.ruleId) {
      if (selectedItem.type === "trigger") {
        return `trigger:${selectedItem.ruleId}`;
      }
      if (selectedItem.type === "condition" && selectedItem.itemId) {
        return `condition:${selectedItem.ruleId}:${selectedItem.itemId}`;
      }
      if (selectedItem.type === "effect" && selectedItem.itemId) {
        return `effect:${selectedItem.ruleId}:${selectedItem.itemId}`;
      }
      return `rule:${selectedItem.ruleId}`;
    }

    if (selectedRuleIds[0]) {
      return `rule:${selectedRuleIds[0]}`;
    }

    return undefined;
  }, [
    liveCodePreviewTarget,
    segmentIdFromContextTarget,
    selectedItem,
    selectedRuleIds,
  ]);

  const hoveredSegmentId =
    segmentIdFromContextTarget(hoveredContextTarget) ?? selectedSegmentId;

  const contextTargetTitle =
    contextTarget.type === "canvas"
      ? "Canvas"
      : contextTarget.type === "rule"
        ? "Rule"
        : contextTarget.type === "trigger"
          ? "Trigger"
          : contextTarget.type === "condition"
            ? "Condition"
            : contextTarget.type === "effect"
              ? "Effect"
              : contextTarget.type === "condition-group"
                ? "Condition Group"
                : contextTarget.type === "random-group"
                  ? "Random Group"
                  : "Loop Group";

  const hasLiveCodeSelectedText = getLiveCodeSelectedText().trim().length > 0;

  const clampPanelIntoViewport = useCallback(
    (panelId: string, widthPx: number) => {
      const panel = panels[panelId];
      if (!panel || !panel.isVisible) return;

      const headerHeight = 112;
      const viewportHeight =
        (modalRef.current?.clientHeight || window.innerHeight) - headerHeight;
      const maxX = Math.max(0, widthPx - panel.size.width - 12);
      const maxY = Math.max(0, viewportHeight - panel.size.height - 12);
      const clampedX = Math.min(Math.max(0, panel.position.x), maxX);
      const clampedY = Math.min(Math.max(0, panel.position.y), maxY);

      if (clampedX !== panel.position.x || clampedY !== panel.position.y) {
        updatePanelPosition(panelId, { x: clampedX, y: clampedY });
      }
    },
    [panels, updatePanelPosition],
  );

  const handleLiveCodeResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startWidth = liveCodeWidthPercent;
      const containerWidth = modalRef.current?.clientWidth || window.innerWidth;

      const onMouseMove = (event: MouseEvent) => {
        const deltaPercent = ((startX - event.clientX) / containerWidth) * 100;
        const nextWidth = Math.max(0, Math.min(70, startWidth + deltaPercent));
        setLiveCodeWidthPercent(nextWidth);

        const nextBuilderWidthPx = ((100 - nextWidth) / 100) * containerWidth;
        [
          "blockPalette",
          "variables",
          "inspector",
          "gameVariables",
          "history",
        ].forEach((panelId) =>
          clampPanelIntoViewport(panelId, nextBuilderWidthPx),
        );
      };

      const onMouseUp = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      };

      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [clampPanelIntoViewport, liveCodeWidthPercent],
  );

  useEffect(() => {
    if (!liveCodeIsVisible) {
      setLiveCodePreviewTarget(null);
    }
  }, [liveCodeIsVisible]);

  useEffect(() => {
    if (liveCodeIsVisible && liveCodeWidthPercent <= 1) {
      togglePanel("liveCode");
      setLiveCodeWidthPercent(50);
    }
  }, [liveCodeIsVisible, liveCodeWidthPercent, togglePanel]);

  useEffect(() => {
    if (!liveCodeIsVisible) return;
    const containerWidth = modalRef.current?.clientWidth || window.innerWidth;
    const builderWidthPx = (builderWidthPercent / 100) * containerWidth;
    [
      "blockPalette",
      "variables",
      "inspector",
      "gameVariables",
      "history",
    ].forEach((panelId) => clampPanelIntoViewport(panelId, builderWidthPx));
  }, [builderWidthPercent, clampPanelIntoViewport, liveCodeIsVisible]);

  useEffect(() => {
    if (!isOpen || !liveCodeIsVisible) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLiveCodeIsLoading(true);
      setLiveCodeIsError(false);
      setLiveCodeStatusMessage(undefined);
      setLiveCodeErrorDetails(undefined);

      try {
        if (liveCodePreviewTarget) {
          const targetRule = rules.find(
            (rule) => rule.id === liveCodePreviewTarget.ruleId,
          );

          if (!targetRule) {
            setLiveCodeTitle("Block Preview");
            setLiveCodeSnippet("-- unable to resolve selected block");
            setLiveCodeStatusMessage(
              "The selected block could not be resolved.",
            );
            setLiveCodeIsError(true);
            return;
          }

          let nodeType = "";
          let params: SnippetNodeParams = {};
          let title = "Block Preview";

          if (liveCodePreviewTarget.type === "trigger") {
            const triggerDef = getTriggerById(targetRule.trigger);
            const triggerLabel =
              triggerDef?.label?.en ??
              Object.values(triggerDef?.label ?? {})[0] ??
              targetRule.trigger;
            nodeType = `trigger.${targetRule.trigger}`;
            title = `Block Preview: Trigger - ${triggerLabel}`;
          }

          if (
            liveCodePreviewTarget.type === "condition" &&
            liveCodePreviewTarget.itemId
          ) {
            const targetCondition = targetRule.conditionGroups
              .flatMap((group) => group.conditions)
              .find(
                (condition) => condition.id === liveCodePreviewTarget.itemId,
              );

            if (!targetCondition) {
              setLiveCodeTitle("Block Preview");
              setLiveCodeSnippet("-- unable to resolve selected condition");
              setLiveCodeStatusMessage(
                "The selected block could not be resolved.",
              );
              setLiveCodeIsError(true);
              return;
            }

            const conditionDef = getConditionType(targetCondition.type);
            nodeType = `condition.${targetCondition.type}`;
            params = toSnippetParams(targetCondition.params);
            title = `Block Preview: Condition - ${conditionDef?.label ?? targetCondition.type}`;
          }

          if (
            liveCodePreviewTarget.type === "effect" &&
            liveCodePreviewTarget.itemId
          ) {
            const targetEffect = [
              ...targetRule.effects,
              ...targetRule.randomGroups.flatMap((group) => group.effects),
              ...targetRule.loops.flatMap((group) => group.effects),
            ].find((effect) => effect.id === liveCodePreviewTarget.itemId);

            if (!targetEffect) {
              setLiveCodeTitle("Block Preview");
              setLiveCodeSnippet("-- unable to resolve selected effect");
              setLiveCodeStatusMessage(
                "The selected block could not be resolved.",
              );
              setLiveCodeIsError(true);
              return;
            }

            const effectDef = getEffectType(targetEffect.type);
            nodeType = `effect.${targetEffect.type}`;
            params = toSnippetParams(targetEffect.params);
            title = `Block Preview: Effect - ${effectDef?.label ?? targetEffect.type}`;
          }

          if (!nodeType) {
            setLiveCodeTitle("Block Preview");
            setLiveCodeSnippet("-- snippet preview unavailable");
            setLiveCodeStatusMessage(
              "This selected block has not been coded in yet for live snippet preview.",
            );
            setLiveCodeIsError(false);
            return;
          }

          setLiveCodeTitle(title);

          const snippetCode = await invoke<string>(
            "compile_rulebuilder_node_snippet",
            {
              itemType: previewItemType,
              nodeType,
              params,
            },
          );

          if (cancelled) {
            return;
          }

          const normalizedSnippet = (snippetCode || "").toLowerCase();
          const isNotImplemented = normalizedSnippet.includes(
            "not yet implemented",
          );

          setLiveCodeSnippet(snippetCode || "-- no snippet output");
          setLiveCodeStatusMessage(
            isNotImplemented
              ? "This selected block has not been coded in yet for live snippet preview."
              : "Showing block preview. Click another block icon to switch, or keep editing to see full-item code by default.",
          );
          setLiveCodeIsError(false);
          return;
        }

        setLiveCodeTitle(
          `Item Preview: ${itemWithoutCustomCode.name || "Current Item"}`,
        );

        const freshCompiled = await compileSingleItemLuaWithSegments(
          { ...(itemWithoutCustomCode as any), rules },
          previewItemType,
          "mod",
          { includeLocTxt: true, globalUserVariables },
        );

        if (cancelled) {
          return;
        }

        const normalized = (freshCompiled.code || "").toLowerCase();
        const isNotImplemented = normalized.includes("not yet implemented");

        // Determine which rules changed since the last generation
        const currentRulesSnapshot = JSON.stringify(rules);
        const changedRuleIds = new Set<string>();
        if (
          prevRulesSnapshotRef.current &&
          prevRulesSnapshotRef.current !== currentRulesSnapshot
        ) {
          try {
            const prevRules = JSON.parse(
              prevRulesSnapshotRef.current,
            ) as Rule[];
            const prevMap = new Map(
              prevRules.map((r) => [r.id, JSON.stringify(r)]),
            );
            const currMap = new Map(
              rules.map((r) => [r.id, JSON.stringify(r)]),
            );

            // Rules that were modified or added
            for (const [id, serialized] of currMap) {
              if (!prevMap.has(id) || prevMap.get(id) !== serialized) {
                changedRuleIds.add(id);
              }
            }
            // Rules that were deleted
            for (const id of prevMap.keys()) {
              if (!currMap.has(id)) {
                changedRuleIds.add(id);
              }
            }
          } catch {
            // If snapshot parsing fails, treat all rules as changed
            rules.forEach((r) => changedRuleIds.add(r.id));
          }
        }
        prevRulesSnapshotRef.current = currentRulesSnapshot;

        const freshClean = freshCompiled.code;
        const freshSegments = freshCompiled.segments;

        let displayCode = freshClean || "-- no snippet output";

        const pendingEditorCode = pendingEditorCodeRef.current;
        const savedCustomCode = customCodeRef.current?.fullCode;
        const editableCurrentCode = pendingEditorCode ?? savedCustomCode;

        // If user has custom code (persisted or pending in-editor), merge with the new generation
        if (editableCurrentCode) {
          const oldSegments =
            customCodeRef.current?.segments ?? lastSegmentsRef.current;

          // On first load (no previous generation yet), use saved
          // lastGeneratedCode from the custom code state for comparison.
          // If the new generation is identical to what was last generated,
          // just display the user's saved code directly.
          const prevClean =
            lastGeneratedCleanRef.current ||
            customCodeRef.current?.lastGeneratedCode ||
            freshClean;

          if (prevClean === freshClean) {
            // Nothing changed in generation, show user's code as-is
            displayCode = editableCurrentCode;
          } else if (oldSegments.length > 0) {
            try {
              displayCode = mergeWithGeneratedSegments(
                editableCurrentCode,
                prevClean,
                oldSegments,
                freshClean,
                freshSegments,
                changedRuleIds,
              );

              // Persist the merged result
              const mergedCustom: CustomCodeState = {
                fullCode: displayCode,
                lastGeneratedCode: freshClean,
                segments: freshSegments,
              };
              setCustomCode(mergedCustom);
              onUpdateItem({ customCode: mergedCustom });
            } catch {
              displayCode = freshClean;
            }
          } else {
            // No section info available, show user's saved code
            displayCode = editableCurrentCode;
          }
        }

        lastGeneratedCleanRef.current = freshClean;
        lastSegmentsRef.current = freshSegments;

        setLiveCodeSnippet(displayCode);
        setLiveCodeStatusMessage(
          isNotImplemented
            ? "This item has not been fully coded in yet for live generation."
            : undefined,
        );
        setLiveCodeIsError(false);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setLiveCodeSnippet("-- failed to generate snippet");
        setLiveCodeStatusMessage(
          error instanceof Error
            ? error.message
            : "Failed to compile live snippet.",
        );
        setLiveCodeErrorDetails(formatLiveCodeErrorDetails(error));
        setLiveCodeIsError(true);
      } finally {
        if (!cancelled) {
          setLiveCodeIsLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [
    getConditionType,
    getEffectType,
    itemWithoutCustomCode,
    previewItemType,
    globalUserVariables,
    formatLiveCodeErrorDetails,
    isOpen,
    liveCodeIsVisible,
    liveCodePreviewTarget,
    rules,
  ]);

  const viewportBounds = builderViewportRef.current?.getBoundingClientRect();
  const selectionOverlayStyle =
    selectionRect && viewportBounds
      ? {
          left:
            Math.min(selectionRect.startClientX, selectionRect.currentClientX) -
            viewportBounds.left,
          top:
            Math.min(selectionRect.startClientY, selectionRect.currentClientY) -
            viewportBounds.top,
          width: Math.abs(
            selectionRect.currentClientX - selectionRect.startClientX,
          ),
          height: Math.abs(
            selectionRect.currentClientY - selectionRect.startClientY,
          ),
        }
      : null;

  const contextMenuGroups = useMemo((): ContextMenuGroupConfig[] => {
    const groups: ContextMenuGroupConfig[] = [];

    if (isLiveCodeContextMenu) {
      groups.push({
        label: "Live Code",
        items: [
          {
            label: "Copy Selected Text",
            icon: Copy,
            shortcut: "Ctrl+C",
            disabled: !hasLiveCodeSelectedText,
            onSelect: () => void handleCopyLiveCodeSelection(),
          },
        ],
        separator: true,
      });
    }

    if (hasBulkSelection) {
      groups.push({
        label: "Selection Actions",
        items: [
          {
            label: `Selected Rules: ${selectedRuleIds.length}`,
            show: true,
            disabled: true,
          },
          {
            label: "Move Selection Here",
            disabled: !lastContextWorldPoint,
            onSelect: moveSelectedRulesToContextPoint,
          },
          {
            label: "Duplicate Selection",
            icon: Copy,
            shortcut: "Ctrl+D",
            onSelect: duplicateSelectedRules,
          },
          {
            label: "Delete Selection",
            icon: Trash,
            shortcut: "Del",
            variant: "destructive",
            onSelect: deleteSelectedRules,
          },
          {
            label: "Clear Selection",
            shortcut: "Esc",
            onSelect: clearRuleSelection,
          },
        ],
      });
    } else {
      groups.push({
        label: `${contextTargetTitle} Actions`,
        items: [
          {
            label: "Undo",
            icon: ArrowCounterClockwise,
            shortcut: "Ctrl+Z",
            disabled: historyPastRef.current.length === 0,
            onSelect: handleUndo,
          },
          {
            label: "Redo",
            icon: ArrowClockwise,
            shortcut: "Ctrl+Y",
            disabled: historyFutureRef.current.length === 0,
            onSelect: handleRedo,
          },
        ],
        separator: true,
      });

      groups.push({
        items: [
          {
            label: "Recenter Canvas",
            onSelect: handleRecenter,
          },
          {
            label: "Auto Layout Rules",
            shortcut: "Ctrl+Shift+L",
            onSelect: handleAutoLayoutRules,
          },
        ],
        separator: true,
      });

      const selectionItems = [];
      if (contextTarget.ruleId) {
        selectionItems.push({
          label: "Select Rule",
          onSelect: () => setSingleSelectedRule(contextTarget.ruleId!),
        });
      }
      selectionItems.push({
        label: "Select All Rules",
        shortcut: "Ctrl+A",
        disabled: rules.length === 0,
        onSelect: selectAllRules,
      });
      groups.push({ items: selectionItems, separator: true });

      const actionItems = [];
      if (canPreviewContextTarget) {
        actionItems.push({
          label: "Preview Block Code",
          icon: Eye,
          onSelect: handleContextPreview,
        });
      }
      if (contextTarget.ruleId) {
        actionItems.push({
          label: "Add Condition Group",
          icon: Plus,
          onSelect: () => addConditionGroup(contextTarget.ruleId!),
        });
        actionItems.push({
          label: "Add Random Group",
          icon: Plus,
          onSelect: () => addRandomGroup(contextTarget.ruleId!),
        });
        actionItems.push({
          label: "Add Loop Group",
          icon: Plus,
          onSelect: () => addLoopGroup(contextTarget.ruleId!),
        });
      }
      if (itemType === "joker" && contextTarget.ruleId) {
        actionItems.push({
          label: "Toggle Blueprint Compatibility",
          onSelect: () => toggleBlueprintCompatibility(contextTarget.ruleId!),
        });
      }
      if (actionItems.length > 0) {
        groups.push({ items: actionItems, separator: true });
      }

      groups.push({
        items: [
          {
            label: "Duplicate",
            icon: Copy,
            shortcut: "Ctrl+D",
            disabled: !canDuplicateContextTarget,
            onSelect: handleContextDuplicate,
          },
          {
            label: "Delete",
            icon: Trash,
            shortcut: "Del",
            variant: "destructive",
            disabled: !canDeleteContextTarget,
            onSelect: handleContextDelete,
          },
        ],
      });
    }

    return groups;
  }, [
    isLiveCodeContextMenu,
    hasLiveCodeSelectedText,
    handleCopyLiveCodeSelection,
    hasBulkSelection,
    selectedRuleIds.length,
    lastContextWorldPoint,
    moveSelectedRulesToContextPoint,
    duplicateSelectedRules,
    deleteSelectedRules,
    clearRuleSelection,
    contextTargetTitle,
    handleUndo,
    handleRedo,
    handleRecenter,
    handleAutoLayoutRules,
    contextTarget.ruleId,
    selectAllRules,
    rules.length,
    canPreviewContextTarget,
    handleContextPreview,
    addConditionGroup,
    addRandomGroup,
    addLoopGroup,
    itemType,
    toggleBlueprintCompatibility,
    canDuplicateContextTarget,
    handleContextDuplicate,
    canDeleteContextTarget,
    handleContextDelete,
  ]);

  if (!isOpen) return null;
  return (
    <>
    <CustomContextMenu
      groups={contextMenuGroups}
      className="w-62 shadow-[0_24px_45px_-20px_rgba(0,0,0,0.78)]"
    >
      <div
        className="fixed inset-x-0 bottom-0 top-9 flex bg-background items-center justify-center z-[45]"
        onContextMenuCapture={handleRuleBuilderContextMenuCapture}
      >
        <div
          ref={modalRef}
          className="bg-background w-full h-full overflow-hidden flex flex-col"
        >
          <div className="bg-background/95 backdrop-blur-md border-b border-border shadow-sm z-50 px-4 py-3">
            <div className="flex flex-col gap-3 min-w-0 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
              <div className="flex items-center gap-2 min-w-0">
                <Terminal className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase shrink-0">
                  Rule Builder
                </span>
                <HelpTooltipIcon
                  content="Canvas edits are live against in-memory rule state. Unsaved changes can still influence preview/inspector behavior until you close or reload."
                  side="bottom"
                  iconClassName="h-3.5 w-3.5"
                />
                {isReadOnly && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] uppercase tracking-wider"
                  >
                    Read Only
                  </Badge>
                )}
                <span className="text-[11px] text-muted-foreground hidden xl:block truncate">
                  Pan: {Math.round(panState.x)}, {Math.round(panState.y)}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-self-center">
                <IconButton
                  icon={CornersIn}
                  onClick={handleRecenter}
                  tooltip="Recenter View"
                  className="cursor-pointer"
                />
                <IconButton
                  icon={SquaresFour}
                  onClick={handleAutoLayoutRules}
                  tooltip="Auto Layout Rules"
                  className="cursor-pointer"
                />
                <IconButton
                  icon={GridFour}
                  onClick={() => {
                    setGridSnapping((prev) => {
                      const next = !prev;
                      setRuleBuilderSettings({
                        ...ruleBuilderSettings,
                        defaultGridSnap: next,
                      });
                      setRuleBuilderSettingsState((existing) => ({
                        ...existing,
                        defaultGridSnap: next,
                      }));
                      return next;
                    });
                  }}
                  tooltip="Toggle Grid Snapping"
                  shortcut="S"
                  isActive={gridSnapping}
                  className={cn(
                    "cursor-pointer",
                    gridSnapping
                      ? "text-mint-light hover:text-mint-lighter"
                      : undefined
                  )}
                />
                <IconButton
                  icon={MagnifyingGlassMinus}
                  onClick={() => handleGridZoomChange("out")}
                  tooltip="Zoom Out"
                  shortcut="-"
                  className="cursor-pointer"
                />
                <IconButton
                  icon={MagnifyingGlassPlus}
                  onClick={() => handleGridZoomChange("in")}
                  tooltip="Zoom In"
                  shortcut="+"
                  className="cursor-pointer"
                />
                <span className="text-[11px] text-muted-foreground w-12 text-center">
                  {Math.round(panState.scale * 100)}%
                </span>
                <HelpTooltipIcon
                  content="Auto Layout and Recenter work on current rule positions, not semantic groups. Use them before fine manual placement if drag interactions start feeling inconsistent."
                  side="bottom"
                  iconClassName="h-3.5 w-3.5"
                />
                <div className="w-px h-5 bg-border" />
                {availableRuleTemplates.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsRuleTemplatePickerOpen(true)}
                    icon={<BookmarksSimple className="h-4 w-4" />}
                    className="text-xs cursor-pointer"
                  >
                    New Rule from Template
                  </Button>
                )}
                <Button
                  variant={isReadOnly ? "outline" : "default"}
                  size="sm"
                  onClick={handleSaveAndClose}
                  icon={
                    isReadOnly ? (
                      <X className="h-4 w-4" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )
                  }
                  className="text-xs cursor-pointer"
                >
                  {isReadOnly ? "Close" : "Save Changes"}
                </Button>
              </div>

              <div className="flex items-center gap-2 shrink-0 lg:justify-self-end">
                <span className="text-xs font-medium text-foreground/70 uppercase tracking-wide">
                  Mode
                </span>
                <span className="text-xs font-semibold text-foreground/90">
                  {modeLabel}
                </span>
                <HelpTooltipIcon
                  content="Mode changes trigger/effect catalogs and compile assumptions. A rule valid in one mode can become hidden or non-applicable when mode/context changes."
                  side="bottom"
                  iconClassName="h-3.5 w-3.5"
                />
                <ItemTypeBadge itemType={itemType} />
              </div>
            </div>
          </div>
          <div className="grow relative overflow-hidden">
            <div
              className={`h-full w-full ${liveCodeIsVisible ? "flex" : "block"}`}
            >
              <div
                ref={builderViewportRef}
                className={`relative h-full overflow-hidden ${
                  isMiddlePanning ? "cursor-grabbing" : "cursor-grab"
                }`}
                style={{ width: `${builderWidthPercent}%` }}
                onMouseDownCapture={handleViewportMouseDownCapture}
                onAuxClick={handleViewportAuxClick}
                onMouseDown={handleCanvasMouseDown}
              >
                <div
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{
                    backgroundImage: ruleBuilderSettings.showDotsBackground
                      ? createAlternatingDotPattern()
                      : "none",
                    backgroundSize: `${24 * panState.scale}px ${24 * panState.scale}px`,
                    backgroundPosition: `${panState.x}px ${panState.y}px`,
                    backgroundColor: "hsl(var(--background))",
                  }}
                />
                {isInitialLoadComplete &&
                  rules.length === 0 &&
                  showNoRulesMessage && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{
                        duration: 0.4,
                        ease: "easeOut",
                        delay: 0.1,
                      }}
                      className="absolute inset-0 flex items-center justify-center z-40"
                    >
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.3,
                          delay: 0.2,
                          ease: "easeOut",
                        }}
                        className="text-center bg-card/95 backdrop-blur-sm rounded-xl p-8 border border-border shadow-xl"
                      >
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.4, duration: 0.3 }}
                          className="text-foreground text-lg mb-3"
                        >
                          No Rules Created
                        </motion.div>
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.5, duration: 0.3 }}
                          className="text-muted-foreground text-sm max-w-md"
                        >
                          Select a trigger from the Block Palette to create
                          your first rule.
                        </motion.p>
                      </motion.div>
                    </motion.div>
                  )}
                <DndContext
                  sensors={sensors}
                  collisionDetection={collisionDetectionStrategy}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  modifiers={
                    activeId &&
                    (activeId.startsWith("panel-") ||
                      activeId.startsWith("palette:"))
                      ? []
                      : [restrictToVerticalAxis]
                  }
                >
                  <DragOverlay dropAnimation={null}>
                    {draggedPaletteBlockPreview ? (
                      <div className="w-71 opacity-95 shadow-2xl">
                        <BlockComponent
                          label={draggedPaletteBlockPreview.label}
                          type={draggedPaletteBlockPreview.blockType}
                          onClick={() => {}}
                          variant="palette"
                        />
                      </div>
                    ) : null}
                  </DragOverlay>
                  <TransformWrapper
                    ref={transformRef}
                    initialScale={1}
                    initialPositionX={0}
                    initialPositionY={0}
                    minScale={0.5}
                    maxScale={2.4}
                    smooth={false}
                    centerOnInit={false}
                    limitToBounds={false}
                    wheel={{
                      disabled: !ruleBuilderSettings.enableWheelZoom,
                      step: 0.25,
                      smoothStep: 0.25,
                      wheelDisabled: !ruleBuilderSettings.enableWheelZoom,
                    }}
                    pinch={{
                      disabled: !ruleBuilderSettings.enablePinchZoom,
                    }}
                    doubleClick={{
                      disabled: true,
                    }}
                    panning={{
                      allowLeftClickPan: ruleBuilderSettings.enableLeftMousePan,
                      allowRightClickPan: ruleBuilderSettings.enableRightMousePan,
                      allowMiddleClickPan: ruleBuilderSettings.enableMiddleMousePan,
                      wheelPanning: false,
                      velocityDisabled: true,
                    }}
                    onTransformed={(_, state) => {
                      setPanState({
                        x: state.positionX,
                        y: state.positionY,
                        scale: state.scale,
                      });
                    }}
                  >
                    <TransformComponent
                      wrapperClass="w-full h-full"
                      contentClass="relative"
                      wrapperStyle={{
                        width: "100%",
                        height: "100%",
                        overflow: "hidden",
                      }}
                      contentStyle={{
                        width: "5600px",
                        height: "3200px",
                      }}
                    >
                      <div
                        className="relative z-10"
                        onMouseMoveCapture={handleCanvasPointerMoveCapture}
                        onMouseLeave={handleCanvasPointerLeave}
                      >
                        <div className="p-6 min-h-full">
                          <div className="relative">
                            {rules.map((rule, index) => (
                              <div
                                key={rule.id}
                                className="absolute"
                                style={{
                                  left: rule.position?.x || 0,
                                  top: rule.position?.y || 0,
                                  zIndex:
                                    selectedItem?.ruleId === rule.id
                                      ? 50 + index
                                      : 20 + index,
                                }}
                              >
                                <RuleCard
                                  rule={rule}
                                  ruleIndex={index + 1}
                                  selectedItem={selectedItem}
                                  onSelectItem={handleSelectItem}
                                  onSelectRuleCard={handleSelectRuleCard}
                                  onDuplicateRule={duplicateRule}
                                  onSaveRuleTemplate={handleSaveRuleAsTemplate}
                                  onDeleteRule={deleteRule}
                                  onDeleteCondition={deleteCondition}
                                  onDeleteConditionGroup={
                                    deleteConditionGroup
                                  }
                                  onDeleteEffect={deleteEffect}
                                  onAddConditionGroup={addConditionGroup}
                                  onAddRandomGroup={addRandomGroup}
                                  onAddLoop={addLoopGroup}
                                  onToggleBlueprintCompatibility={
                                    toggleBlueprintCompatibility
                                  }
                                  onDeleteRandomGroup={deleteRandomGroup}
                                  onDeleteLoopGroup={deleteLoopGroup}
                                  onToggleGroupOperator={toggleGroupOperator}
                                  onUpdatePosition={updateRulePosition}
                                  onMoveSelectedRulesByDelta={
                                    moveSelectedRulesByDelta
                                  }
                                  onFinalizeMultiRuleDrag={
                                    finalizeSelectedRulesDrag
                                  }
                                  isRuleSelected={selectedRuleIdSet.has(
                                    rule.id,
                                  )}
                                  selectedRuleCount={selectedRuleIds.length}
                                  item={item as any}
                                  itemType={itemType}
                                  generateConditionTitle={
                                    generateConditionTitleForCard
                                  }
                                  generateEffectTitle={
                                    generateEffectTitleForCard
                                  }
                                  getParameterCount={getParameterCount}
                                  onUpdateConditionOperator={
                                    updateConditionOperator
                                  }
                                  onRuleDoubleClick={
                                    handleRuleCardDoubleClick
                                  }
                                  onPreviewBlockCode={handlePreviewBlockCode}
                                  scale={panState.scale}
                                  isPaletteDragging={
                                    !!activeId &&
                                    activeId.startsWith("palette:")
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </TransformComponent>
                  </TransformWrapper>

                  {selectionOverlayStyle ? (
                    <div
                      className="pointer-events-none absolute z-70 border border-primary/85 bg-primary/20 rounded-sm"
                      style={selectionOverlayStyle}
                    />
                  ) : null}

                  {panels.blockPalette.isVisible && (
                    <BlockPalette
                      position={panels.blockPalette.position}
                      selectedRule={selectedRule}
                      onAddTrigger={addTrigger}
                      onAddCondition={addCondition}
                      onAddEffect={addEffect}
                      onClose={() => togglePanel("blockPalette")}
                      onPositionChange={(position) =>
                        updatePanelPosition("blockPalette", position)
                      }
                      itemType={itemType}
                    />
                  )}
                  {panels.variables?.isVisible && (
                    <Variables
                      position={panels.variables.position}
                      item={item as any}
                      onUpdateItem={onUpdateItem}
                      onClose={() => togglePanel("variables")}
                      addVariableRequest={addVariableRequest}
                      onPositionChange={(position) =>
                        updatePanelPosition("variables", position)
                      }
                    />
                  )}
                  {panels.inspector.isVisible && (
                    <Inspector
                      position={panels.inspector.position}
                      joker={item as any}
                      selectedRule={selectedRule}
                      selectedCondition={selectedCondition}
                      selectedEffect={selectedEffect}
                      selectedRandomGroup={selectedRandomGroup}
                      selectedLoopGroup={selectedLoopGroup}
                      onUpdateCondition={updateCondition}
                      onUpdateEffect={updateEffect}
                      onUpdateRandomGroup={updateRandomGroup}
                      onUpdateLoopGroup={updateLoopGroup}
                      onUpdateJoker={
                        onUpdateItem as (updates: Partial<any>) => void
                      }
                      onClose={() => togglePanel("inspector")}
                      onPositionChange={(position) =>
                        updatePanelPosition("inspector", position)
                      }
                      onToggleVariablesPanel={openVariablesPanel}
                      onToggleGameVariablesPanel={() =>
                        togglePanel("gameVariables")
                      }
                      onCreateRandomGroupFromEffect={
                        createRandomGroupFromEffect
                      }
                      onCreateLoopGroupFromEffect={createLoopGroupFromEffect}
                      selectedGameVariable={selectedGameVariable}
                      onGameVariableApplied={handleGameVariableApplied}
                      selectedItem={selectedItem}
                      itemType={itemType}
                    />
                  )}

                  {panels.gameVariables.isVisible && (
                    <GameVariables
                      position={panels.gameVariables.position}
                      selectedGameVariable={selectedGameVariable}
                      onSelectGameVariable={setSelectedGameVariable}
                      onClose={() => togglePanel("gameVariables")}
                      onPositionChange={(position) =>
                        updatePanelPosition("gameVariables", position)
                      }
                    />
                  )}

                  {panels.history?.isVisible && (
                    <HistoryPanel
                      position={panels.history.position}
                      entries={historyTimeline}
                      currentIndex={historyCurrentIndex}
                      onRestoreAt={restoreHistoryAt}
                      onClose={() => togglePanel("history")}
                      onPositionChange={(position) =>
                        updatePanelPosition("history", position)
                      }
                    />
                  )}
                  <FloatingDock
                    panels={panels}
                    onTogglePanel={togglePanel}
                  />
                </DndContext>
              </div>

              {liveCodeIsVisible && (
                <LiveCodePanel
                  title={liveCodeTitle}
                  code={liveCodeSnippet}
                  isLoading={liveCodeIsLoading}
                  statusMessage={liveCodeStatusMessage}
                  isError={liveCodeIsError}
                  errorDetails={liveCodeErrorDetails}
                  widthPercent={liveCodeWidthPercent}
                  isBlockPreview={!!liveCodePreviewTarget}
                  onBackToItem={() => setLiveCodePreviewTarget(null)}
                  onStartResize={handleLiveCodeResizeStart}
                  onCodeChange={
                    !isReadOnly && !liveCodePreviewTarget
                      ? handleCodeChange
                      : undefined
                  }
                  onResetCustomCode={handleResetCustomCode}
                  hasCustomCode={!!customCode}
                  segments={lastSegmentsRef.current}
                  selectedSegmentId={
                    ruleBuilderSettings.enableLiveCodeHighlighting
                      ? selectedSegmentId
                      : undefined
                  }
                  hoveredSegmentId={
                    ruleBuilderSettings.enableLiveCodeHighlighting
                      ? hoveredSegmentId
                      : undefined
                  }
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </CustomContextMenu>
    <ConfirmDialog
      open={isDeleteConfirmOpen}
      onOpenChange={(open) => {
        setIsDeleteConfirmOpen(open);
        if (!open) {
          setPendingDeleteAction(null);
        }
      }}
      title={deleteConfirmTitle}
      description={deleteConfirmDescription}
      confirmLabel="Delete"
      confirmVariant="destructive"
      onConfirm={confirmPendingDelete}
    />
    <TemplatePickerDialog
      open={isRuleTemplatePickerOpen}
      onOpenChange={setIsRuleTemplatePickerOpen}
      title="Create Rule from Template"
      description={`Templates for ${ruleTemplateItemType} rules.`}
      templates={availableRuleTemplates}
      onUseTemplate={(template) =>
        handleUseRuleTemplate(template as RuleTemplateEntry)
      }
    />
    </>
  );
};

export default RuleBuilder;
