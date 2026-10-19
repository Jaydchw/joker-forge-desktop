import type { Rule } from "./types";

export function applyRuleOrder(rules: Rule[], orderedRuleIds: string[]): Rule[] {
  if (orderedRuleIds.length !== rules.length || new Set(orderedRuleIds).size !== rules.length) return rules;
  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  if (byId.size !== rules.length || orderedRuleIds.some((id) => !byId.has(id))) return rules;
  if (rules.every((rule, index) => rule.id === orderedRuleIds[index])) return rules;
  return orderedRuleIds.map((id) => byId.get(id)!);
}

export function moveRuleToPosition(rules: Rule[], ruleId: string, position: number): Rule[] {
  if (!Number.isInteger(position) || position < 1 || position > rules.length) return rules;
  const from = rules.findIndex((rule) => rule.id === ruleId);
  const to = position - 1;
  if (from < 0 || from === to) return rules;
  const next = [...rules];
  const [rule] = next.splice(from, 1);
  next.splice(to, 0, rule);
  return next;
}

export function hasRuleOrderChanged(previous: Rule[], next: Rule[]): boolean {
  const previousIds = new Set(previous.map((rule) => rule.id));
  const nextIds = new Set(next.map((rule) => rule.id));
  const before = previous.filter((rule) => nextIds.has(rule.id));
  const after = next.filter((rule) => previousIds.has(rule.id));
  return before.some((rule, index) => rule.id !== after[index]?.id);
}
