import type {
  Condition,
  ConditionGroup,
  ConditionParameter,
  Effect,
  EffectParameter,
  Rule,
} from "../../components/rule-builder/types";
import { isParameterVisible } from "../../components/rule-builder/parameter-visibility";
import type { LiveCodeCatalog } from "./live-code-fields";

export interface LiveCodeExplanation {
  segmentId: string;
  title: string;
  summary: string;
  lines: string[];
  ruleId: string;
  blockType: "rule" | "trigger" | "condition" | "effect";
}

type Parameter = ConditionParameter | EffectParameter;
type Node = Condition | Effect;

const readableId = (value: string): string => value.replace(/_/g, " ");

const describeValue = (value: unknown): string => {
  if (value === undefined || value === null) return "Not set";
  if (typeof value === "string") {
    // Preserve the full expression, including scaling, instead of suggesting
    // that a dynamic value is a fixed number or only the variable's name.
    if (value.startsWith("GAMEVAR:")) return `Game variable ${value.slice(8)}`;
    if (value.startsWith("RANGE:")) return `Range ${value.slice(6)}`;
    return value || '""';
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(describeValue).join(", ");
  return typeof value === "object" ? JSON.stringify(value) : String(value);
};

const describeParameter = (parameter: Parameter, node: Node): string => {
  const value = node.params[parameter.id]?.value ?? parameter.default;
  let options: Array<{ value: string; label: string }> | undefined;
  try {
    options = typeof parameter.options === "function"
      ? parameter.options(node.params) : parameter.options;
  } catch {
    options = undefined;
  }
  const option = options?.find((entry) => Object.is(entry.value, value));
  if (option) return option.label;
  if (parameter.type === "checkbox" && "checkboxOptions" in parameter
    && parameter.checkboxOptions && Array.isArray(value)) {
    const selected = parameter.checkboxOptions.filter((_, index) => value[index] === true);
    return selected.length ? selected.map((entry) => entry.label).join(", ") : "None";
  }
  return describeValue(value);
};

interface NodeDescription {
  summary: string;
  lines: string[];
}

const describeNode = (node: Node, label: string, parameters: Parameter[]): NodeDescription => {
  const visible = parameters.filter((parameter) => isParameterVisible(parameter, parameters, node.params));
  const operator = visible.find((parameter) => parameter.id === "operator");
  const value = visible.find((parameter) => parameter.id === "value");
  const consumed = new Set<string>();
  let summary = label;
  if (operator && value) {
    summary += ` ${describeParameter(operator, node)} ${describeParameter(value, node)}`;
    consumed.add(operator.id);
    consumed.add(value.id);
  } else if (value) {
    summary += ` ${describeParameter(value, node)}`;
    consumed.add(value.id);
  }
  const extra = visible.filter((parameter) => !consumed.has(parameter.id))
    .map((parameter) => `${parameter.label}: ${describeParameter(parameter, node)}`);
  const lines = [summary, ...extra.map((text) => `  ${text}`)];
  if (extra.length) summary += ` (${extra.join(", ")})`;
  return { summary, lines };
};

const operatorLabel = (operator?: string): string => operator?.toLowerCase() === "or" ? "OR" : "AND";

const cacheLookup = <T>(lookup: (id: string) => T): ((id: string) => T) => {
  const cache = new Map<string, T>();
  return (id) => {
    if (!cache.has(id)) cache.set(id, lookup(id));
    return cache.get(id) as T;
  };
};

const combineConditions = (group: ConditionGroup, catalog: LiveCodeCatalog): string | undefined => {
  let combined: string | undefined;
  group.conditions.forEach((condition, index) => {
    const definition = catalog.getCondition(condition.type);
    const text = definition
      ? describeNode(condition, definition.label, definition.params).summary
      : `Unavailable condition: ${readableId(condition.type)}`;
    const clause = condition.negate ? `NOT (${text})` : text;
    combined = combined === undefined ? clause
      : `(${combined} ${operatorLabel(group.conditions[index - 1].operator ?? group.operator)} ${clause})`;
  });
  return combined;
};

const describeConditionChain = (rule: Rule, catalog: LiveCodeCatalog): string | undefined => {
  let combined: string | undefined;
  let precedingOperator: string | undefined;
  for (const group of rule.conditionGroups) {
    const clause = combineConditions(group, catalog);
    if (clause === undefined) continue;
    combined = combined === undefined ? clause : `(${combined} ${operatorLabel(precedingOperator)} ${clause})`;
    precedingOperator = group.operator;
  }
  return combined;
};

export function buildLiveCodeExplanations(
  rules: Rule[], catalog: LiveCodeCatalog, itemType = "joker",
): Record<string, LiveCodeExplanation> {
  const currentCatalog: LiveCodeCatalog = {
    getTrigger: cacheLookup(catalog.getTrigger),
    getCondition: cacheLookup(catalog.getCondition),
    getEffect: cacheLookup(catalog.getEffect),
  };
  const effectDescriptions = new Map<Effect, NodeDescription>();
  const explanations: Record<string, LiveCodeExplanation> = {};
  rules.forEach((rule, ruleIndex) => {
    const ruleLabel = `Rule ${ruleIndex + 1}`;
    const trigger = currentCatalog.getTrigger(rule.trigger);
    const triggerLabel = trigger?.label[itemType] ?? trigger?.label.joker
      ?? `Unavailable trigger: ${readableId(rule.trigger)}`;
    const conditionChain = describeConditionChain(rule, currentCatalog);
    const prefix = [triggerLabel, ...(conditionChain ? [`If ${conditionChain}`] : [])];
    const describeEffect = (effect: Effect): NodeDescription => {
      const cached = effectDescriptions.get(effect);
      if (cached !== undefined) return cached;
      const definition = currentCatalog.getEffect(effect.type);
      const text = definition ? describeNode(effect, definition.label, definition.params)
        : { summary: `Unavailable effect: ${readableId(effect.type)}`, lines: [`Unavailable effect: ${readableId(effect.type)}`] };
      effectDescriptions.set(effect, text);
      return text;
    };
    const add = (segmentId: string, blockType: LiveCodeExplanation["blockType"], title: string,
      summary: string, lines: string[]) => {
      explanations[segmentId] = { segmentId, title, summary, lines, ruleId: rule.id, blockType };
    };
    const outcome: string[] = rule.effects.map((effect) => describeEffect(effect).summary);
    const outcomeLines: string[] = rule.effects.flatMap((effect) => describeEffect(effect).lines);
    const addEffect = (effect: Effect, context?: string, contextTitle?: string) => {
      const definition = currentCatalog.getEffect(effect.type);
      if (!definition) return;
      add(`effect:${rule.id}:${effect.id}`, "effect",
        [ruleLabel, contextTitle, definition.label].filter(Boolean).join(" → "),
        [...prefix, ...(context ? [context] : []), describeEffect(effect).summary].join(" → "),
        [...prefix, ...(context ? [context] : []), ...describeEffect(effect).lines]);
    };
    rule.effects.forEach((effect) => addEffect(effect));
    rule.randomGroups.forEach((group, index) => {
      const chance = `Chance ${describeValue(group.chance_numerator.value)} in ${describeValue(group.chance_denominator.value)}`;
      outcome.push(`${chance} → ${group.effects.map((effect) => describeEffect(effect).summary).join("; ") || "No effects"}`);
      outcomeLines.push(chance, ...group.effects.flatMap((effect) => describeEffect(effect).lines).map((line) => `  ${line}`));
      if (!group.effects.length) outcomeLines.push("  No effects");
      group.effects.forEach((effect) => addEffect(effect, chance, `Chance Group ${index + 1}`));
    });
    rule.loops.forEach((group, index) => {
      const repetitions = `Repeat ${describeValue(group.repetitions.value)} times`;
      outcome.push(`${repetitions} → ${group.effects.map((effect) => describeEffect(effect).summary).join("; ") || "No effects"}`);
      outcomeLines.push(repetitions, ...group.effects.flatMap((effect) => describeEffect(effect).lines).map((line) => `  ${line}`));
      if (!group.effects.length) outcomeLines.push("  No effects");
      group.effects.forEach((effect) => addEffect(effect, repetitions, `Loop ${index + 1}`));
    });
    const ruleSummary = [...prefix, outcome.join("; ") || "No effects"].join(" → ");
    const ruleLines = [...prefix, ...(outcomeLines.length ? outcomeLines : ["No effects"])];
    add(`rule:${rule.id}`, "rule", ruleLabel, ruleSummary, ruleLines);
    if (trigger) add(`trigger:${rule.id}`, "trigger", `${ruleLabel} → ${triggerLabel}`,
      ruleSummary, ruleLines);
    rule.conditionGroups.forEach((group, groupIndex) => {
      group.conditions.forEach((condition) => {
        const definition = currentCatalog.getCondition(condition.type);
        if (!definition) return;
        add(`condition:${rule.id}:${condition.id}`, "condition",
          `${ruleLabel} → Condition Group ${groupIndex + 1} → ${definition.label}`,
          ruleSummary, ruleLines);
      });
    });
  });
  return explanations;
}
