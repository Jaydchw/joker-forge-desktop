import type { Rule } from "./types";

export type ChanceGroupOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

const formatChanceValue = (value: number | string | undefined): string => {
  if (typeof value === "string" && value.startsWith("GAMEVAR:")) {
    return value.slice("GAMEVAR:".length).split("|")[0].replace(/_/g, " ");
  }
  if (typeof value === "string" && value.startsWith("RANGE:")) return "a range";
  return String(value ?? "?");
};

export function getChanceGroupOptions(
  rules: readonly Rule[],
  selectedGroupId?: string,
): ChanceGroupOption[] {
  const options = rules.flatMap((rule, ruleIndex) =>
    (rule.randomGroups ?? []).filter((group) => !!group.id).map((group, groupIndex) => ({
      value: group.id,
      label: `Rule ${ruleIndex + 1} · Chance ${groupIndex + 1} (${formatChanceValue(group.chance_numerator?.value)} in ${formatChanceValue(group.chance_denominator?.value)})`,
    })),
  );
  if (selectedGroupId && !options.some((option) => option.value === selectedGroupId)) {
    return [...options, {
      value: selectedGroupId,
      label: "Unavailable chance group",
      disabled: true,
    }];
  }
  return options;
}
