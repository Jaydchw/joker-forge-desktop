import type { Rule } from "./types";

export const getRuleName = (rule: { name?: unknown }): string | undefined =>
  typeof rule.name === "string" ? rule.name.trim() || undefined : undefined;

export const getRuleLabel = (rule: { name?: unknown }, number: number): string => {
  const name = getRuleName(rule);
  return name ? `Rule ${number} — ${name}` : `Rule ${number}`;
};

export function setRuleName(rules: Rule[], ruleId: string, value: string): Rule[] {
  const index = rules.findIndex((rule) => rule.id === ruleId);
  if (index < 0) return rules;
  const name = value.trim() || undefined;
  if (rules[index].name === name) return rules;
  const { name: _, ...rule } = rules[index];
  const next = [...rules];
  next[index] = name ? { ...rule, name } : rule;
  return next;
}
