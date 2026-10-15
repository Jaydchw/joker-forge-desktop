import type { BlockMarkerTarget } from "./block-markers";
import type { Rule, SelectedItem } from "./types";

type BlockSelection = NonNullable<SelectedItem>;

export const getBlockSelectionKey = (selection: BlockSelection): string => {
  switch (selection.type) {
    case "trigger":
      return JSON.stringify([selection.type, selection.ruleId]);
    case "condition":
      return JSON.stringify([selection.type, selection.ruleId, selection.groupId ?? null, selection.itemId ?? null]);
    case "effect":
      return JSON.stringify([
        selection.type, selection.ruleId, selection.randomGroupId ?? null,
        selection.loopGroupId ?? null, selection.itemId ?? null,
      ]);
    case "randomgroup":
      return JSON.stringify([selection.type, selection.ruleId, selection.randomGroupId ?? null]);
    case "loopgroup":
      return JSON.stringify([selection.type, selection.ruleId, selection.loopGroupId ?? null]);
  }
};

export const getBlockSelectionFromContext = (target: BlockMarkerTarget): BlockSelection | null => {
  if (!target.ruleId) return null;
  const { ruleId } = target;
  switch (target.type) {
    case "trigger":
      return { type: "trigger", ruleId };
    case "condition":
      return target.itemId ? { type: "condition", ruleId, groupId: target.groupId, itemId: target.itemId } : null;
    case "condition-group":
      return target.groupId ? { type: "condition", ruleId, groupId: target.groupId } : null;
    case "effect":
      return target.itemId ? {
        type: "effect", ruleId, itemId: target.itemId,
        randomGroupId: target.randomGroupId, loopGroupId: target.loopGroupId,
      } : null;
    case "random-group":
    case "randomgroup":
      return target.randomGroupId ? { type: "randomgroup", ruleId, randomGroupId: target.randomGroupId } : null;
    case "loop-group":
    case "loopgroup":
      return target.loopGroupId ? { type: "loopgroup", ruleId, loopGroupId: target.loopGroupId } : null;
    default:
      return null;
  }
};

export const getBlockMarkerTarget = (selection: BlockSelection): BlockMarkerTarget => {
  if (selection.type === "condition" && !selection.itemId) {
    return { type: "condition-group", ruleId: selection.ruleId, groupId: selection.groupId };
  }
  return selection;
};

export const toggleBlockSelection = (
  previous: readonly BlockSelection[], selection: BlockSelection,
): BlockSelection[] => {
  const key = getBlockSelectionKey(selection);
  const exists = previous.some((candidate) => getBlockSelectionKey(candidate) === key);
  return exists
    ? previous.filter((candidate) => getBlockSelectionKey(candidate) !== key)
    : [...previous, selection];
};

const isBlockSelectionValid = (rule: Rule, selection: BlockSelection): boolean => {
  switch (selection.type) {
    case "trigger":
      return true;
    case "condition": {
      const groups = selection.groupId
        ? rule.conditionGroups.filter((group) => group.id === selection.groupId)
        : rule.conditionGroups;
      if (!selection.itemId) return !!selection.groupId && groups.length > 0;
      return groups.some((group) => group.conditions.some((condition) => condition.id === selection.itemId));
    }
    case "effect": {
      if (!selection.itemId || (selection.randomGroupId && selection.loopGroupId)) return false;
      const effects = selection.randomGroupId
        ? rule.randomGroups.find((group) => group.id === selection.randomGroupId)?.effects
        : selection.loopGroupId
          ? rule.loops.find((group) => group.id === selection.loopGroupId)?.effects
          : rule.effects;
      return !!effects?.some((effect) => effect.id === selection.itemId);
    }
    case "randomgroup":
      return !!selection.randomGroupId && rule.randomGroups.some((group) => group.id === selection.randomGroupId);
    case "loopgroup":
      return !!selection.loopGroupId && rule.loops.some((group) => group.id === selection.loopGroupId);
  }
};

export const pruneBlockSelections = (
  rules: Rule[], selections: readonly BlockSelection[],
): BlockSelection[] => {
  const rulesById = new Map(rules.map((rule) => [rule.id, rule]));
  const remaining = selections.filter((selection) => {
    const rule = rulesById.get(selection.ruleId);
    return !!rule && isBlockSelectionValid(rule, selection);
  });
  // Callers keep this array in React state; preserve its identity when nothing was removed.
  return remaining.length === selections.length ? selections as BlockSelection[] : remaining;
};
