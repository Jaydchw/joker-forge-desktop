import type { Condition, Rule, SelectedItem } from "./types";
import { getBlockSelectionKey } from "./block-selection";

export interface RuleCardMemoProps {
  rule: Rule;
  ruleIndex: number;
  selectedItem: SelectedItem;
  selectedBlocks?: readonly NonNullable<SelectedItem>[];
  onSelectItem: (item: NonNullable<SelectedItem>) => void;
  isRuleSelected: boolean;
  selectedRuleCount: number;
  item: unknown;
  itemType: string;
  scale: number;
  isPaletteDragging: boolean;
  generateConditionTitle: (condition: Condition) => string;
  onPreviewBlockCode?: (target: {
    type: "trigger" | "condition" | "effect";
    ruleId: string;
    itemId?: string;
    groupId?: string;
  }) => void;
  onMoveSelectedRulesByDelta: (deltaX: number, deltaY: number) => void;
  onFinalizeMultiRuleDrag: () => void;
}

const usesChanceGroupLabels = (rule: Rule): boolean => rule.conditionGroups.some((group) =>
  group.conditions.some((condition) => condition.type === "probability_succeeded"
    && condition.params.source?.value === "chance_group"));

const getRuleSelectionKeys = (props: RuleCardMemoProps): string[] => {
  const selections = props.selectedBlocks?.length
    ? props.selectedBlocks
    : props.selectedItem ? [props.selectedItem] : [];
  return [...new Set(selections
    .filter((selection) => selection.ruleId === props.rule.id)
    .map(getBlockSelectionKey))].sort();
};

export function areRuleCardPropsEqual(prev: RuleCardMemoProps, next: RuleCardMemoProps): boolean {
  if (prev.rule !== next.rule) return false;
  if (prev.ruleIndex !== next.ruleIndex) return false;
  if (prev.isRuleSelected !== next.isRuleSelected) return false;
  if (prev.selectedRuleCount !== next.selectedRuleCount) return false;
  if (prev.item !== next.item) return false;
  if (prev.itemType !== next.itemType) return false;
  if (prev.scale !== next.scale) return false;
  if (prev.isPaletteDragging !== next.isPaletteDragging) return false;
  if (prev.onSelectItem !== next.onSelectItem) return false;
  if (prev.onPreviewBlockCode !== next.onPreviewBlockCode) return false;
  if (prev.onMoveSelectedRulesByDelta !== next.onMoveSelectedRulesByDelta) return false;
  if (prev.onFinalizeMultiRuleDrag !== next.onFinalizeMultiRuleDrag) return false;
  if (prev.generateConditionTitle !== next.generateConditionTitle && usesChanceGroupLabels(next.rule)) return false;

  const prevSelectionKeys = getRuleSelectionKeys(prev);
  const nextSelectionKeys = getRuleSelectionKeys(next);
  if (prevSelectionKeys.length !== nextSelectionKeys.length) return false;
  if (prevSelectionKeys.some((key, index) => key !== nextSelectionKeys[index])) return false;
  return true;
}
