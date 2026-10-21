import type { CSSProperties } from "react";
import type { BlockMarkerColor, Rule } from "./types";

export const BLOCK_MARKER_COLORS = [
  { id: "red", label: "Red", color: "#f87171", tint: "rgba(248, 113, 113, 0.12)" },
  { id: "amber", label: "Amber", color: "#fbbf24", tint: "rgba(251, 191, 36, 0.12)" },
  { id: "green", label: "Green", color: "#4ade80", tint: "rgba(74, 222, 128, 0.12)" },
  { id: "cyan", label: "Cyan", color: "#22d3ee", tint: "rgba(34, 211, 238, 0.12)" },
  { id: "blue", label: "Blue", color: "#60a5fa", tint: "rgba(96, 165, 250, 0.12)" },
  { id: "violet", label: "Violet", color: "#a78bfa", tint: "rgba(167, 139, 250, 0.12)" },
  { id: "pink", label: "Pink", color: "#f472b6", tint: "rgba(244, 114, 182, 0.12)" },
] as const;

export const getBlockMarkerDefinition = (value: unknown) =>
  BLOCK_MARKER_COLORS.find((marker) => marker.id === value);

export const getBlockMarkerStyle = (value: unknown): CSSProperties | undefined => {
  const marker = getBlockMarkerDefinition(value);
  return marker ? {
    backgroundImage: `linear-gradient(${marker.tint}, ${marker.tint})`,
    borderRightColor: marker.color,
  } : undefined;
};

export type BlockMarkerTarget = {
  type: "canvas" | "rule" | "trigger" | "condition" | "effect" | "condition-group"
    | "random-group" | "loop-group" | "randomgroup" | "loopgroup";
  ruleId?: string;
  itemId?: string;
  groupId?: string;
  randomGroupId?: string;
  loopGroupId?: string;
};

type MarkerPath = Array<string | number>;

const markerPath = (rule: Rule, target: BlockMarkerTarget): MarkerPath | null => {
  if (target.type === "rule") return ["markerColor"];
  if (target.type === "trigger") return ["triggerMarkerColor"];
  if (target.type === "condition" || target.type === "condition-group") {
    const groupIndex = rule.conditionGroups.findIndex((group) =>
      target.groupId ? group.id === target.groupId
        : target.type === "condition" && group.conditions.some((condition) => condition.id === target.itemId));
    if (groupIndex < 0) return null;
    if (target.type === "condition-group") return ["conditionGroups", groupIndex, "markerColor"];
    const conditionIndex = rule.conditionGroups[groupIndex].conditions.findIndex((condition) => condition.id === target.itemId);
    return conditionIndex < 0 ? null : ["conditionGroups", groupIndex, "conditions", conditionIndex, "markerColor"];
  }
  if (target.type === "random-group" || target.type === "randomgroup") {
    const index = rule.randomGroups.findIndex((group) => group.id === target.randomGroupId);
    return index < 0 ? null : ["randomGroups", index, "markerColor"];
  }
  if (target.type === "loop-group" || target.type === "loopgroup") {
    const index = rule.loops.findIndex((group) => group.id === target.loopGroupId);
    return index < 0 ? null : ["loops", index, "markerColor"];
  }
  if (target.type === "effect") {
    let owner = rule.effects;
    let prefix: MarkerPath = [];
    if (target.randomGroupId) {
      const index = rule.randomGroups.findIndex((group) => group.id === target.randomGroupId);
      if (index < 0) return null;
      owner = rule.randomGroups[index].effects;
      prefix = ["randomGroups", index];
    } else if (target.loopGroupId) {
      const index = rule.loops.findIndex((group) => group.id === target.loopGroupId);
      if (index < 0) return null;
      owner = rule.loops[index].effects;
      prefix = ["loops", index];
    }
    const index = owner.findIndex((effect) => effect.id === target.itemId);
    return index < 0 ? null : [...prefix, "effects", index, "markerColor"];
  }
  return null;
};

const readPath = (value: unknown, path: MarkerPath): unknown => {
  for (const key of path) {
    if (!value || typeof value !== "object") return undefined;
    value = (value as Record<string | number, unknown>)[key];
  }
  return value;
};

export const getBlockMarkerColor = (rules: Rule[], target: BlockMarkerTarget | null): BlockMarkerColor | undefined => {
  const rule = target && rules.find((candidate) => candidate.id === target.ruleId);
  const path = rule && target ? markerPath(rule, target) : null;
  return path ? getBlockMarkerDefinition(readPath(rule, path))?.id : undefined;
};

const writePath = (value: unknown, path: MarkerPath, color: BlockMarkerColor | null): unknown => {
  const [key, ...remaining] = path;
  const copy: Record<string | number, unknown> = Array.isArray(value)
    ? [...value] as unknown as Record<string | number, unknown>
    : { ...value as Record<string, unknown> };
  if (remaining.length) copy[key] = writePath(readPath(value, [key]), remaining, color);
  else if (color === null) delete copy[key];
  else copy[key] = color;
  return copy;
};

export const updateBlockMarkerColor = (
  rules: Rule[], target: BlockMarkerTarget | null, color: BlockMarkerColor | null,
): Rule[] => {
  if (!target?.ruleId || (color !== null && !getBlockMarkerDefinition(color))) return rules;
  const index = rules.findIndex((rule) => rule.id === target.ruleId);
  if (index < 0) return rules;
  const path = markerPath(rules[index], target);
  if (!path) return rules;
  const previous = readPath(rules[index], path);
  if (previous === color || (color === null && previous === undefined)) return rules;
  const next = [...rules];
  next[index] = writePath(rules[index], path, color) as Rule;
  return next;
};

export const updateBlockMarkerColors = (
  rules: Rule[], targets: readonly BlockMarkerTarget[], color: BlockMarkerColor | null,
): Rule[] => {
  if (!targets.length || (color !== null && !getBlockMarkerDefinition(color))) return rules;
  const ruleIndexes = new Map(rules.map((rule, index) => [rule.id, index]));
  let next = rules;
  for (const target of targets) {
    if (!target.ruleId) continue;
    const index = ruleIndexes.get(target.ruleId);
    if (index === undefined) continue;
    const path = markerPath(next[index], target);
    if (!path) continue;
    const previous = readPath(next[index], path);
    if (previous === color || (color === null && previous === undefined)) continue;
    if (next === rules) next = [...rules];
    next[index] = writePath(next[index], path, color) as Rule;
  }
  return next;
};

export const updateRuleMarkerColors = (
  rules: Rule[], ruleIds: readonly string[], color: BlockMarkerColor | null,
): Rule[] => {
  if (color !== null && !getBlockMarkerDefinition(color)) return rules;
  const selectedIds = new Set(ruleIds);
  if (selectedIds.size === 0) return rules;
  let changed = false;
  const next = rules.map((rule) => {
    if (!selectedIds.has(rule.id) || rule.markerColor === color
      || (color === null && rule.markerColor === undefined)) return rule;
    changed = true;
    if (color === null) {
      const { markerColor: _, ...rest } = rule;
      return rest;
    }
    return { ...rule, markerColor: color };
  });
  return changed ? next : rules;
};

export const stripBlockMarkers = (rules: Rule[]): Rule[] => {
  const withoutMarker = <T extends { markerColor?: unknown }>(block: T): Omit<T, "markerColor"> => {
    const { markerColor: _, ...rest } = block;
    return rest;
  };
  return rules.map((rule) => {
    const { markerColor: _, triggerMarkerColor: __, ...rest } = rule;
    return {
      ...rest,
      conditionGroups: rule.conditionGroups.map((group) => ({
        ...withoutMarker(group), conditions: group.conditions.map(withoutMarker),
      })),
      effects: rule.effects.map(withoutMarker),
      randomGroups: rule.randomGroups.map((group) => ({
        ...withoutMarker(group), effects: group.effects.map(withoutMarker),
      })),
      loops: rule.loops.map((group) => ({
        ...withoutMarker(group), effects: group.effects.map(withoutMarker),
      })),
    };
  });
};
