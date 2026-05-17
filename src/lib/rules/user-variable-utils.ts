import type { ItemData } from "@/components/rule-builder/rule-builder";
import type { Rule } from "@/components/rule-builder/types";
import type { JokerData, UserVariable } from "@/lib/core/types";

interface VariableOption {
  value: string;
  label: string;
  valueType?: string;
}

interface VariableUsageDetail {
  variableName: string;
  ruleIndex: number;
  fieldPath: string;
}

const getUserVariables = (
  item: Partial<JokerData> | Partial<ItemData>,
): UserVariable[] => {
  if (
    !item ||
    !("userVariables" in item) ||
    !Array.isArray((item as { userVariables?: UserVariable[] }).userVariables)
  ) {
    return [];
  }

  return (item as { userVariables: UserVariable[] }).userVariables;
};

const appendByType = (
  options: VariableOption[],
  joker: Partial<JokerData>,
  type: UserVariable["type"],
): VariableOption[] => {
  const merged = [...options];
  const seen = new Set(options.map((option) => option.value.toLowerCase()));

  for (const variable of getUserVariables(joker)) {
    const matchesType = !variable.type ? type === "number" : variable.type === type;
    if (!matchesType) {
      continue;
    }

    const normalized = variable.name.toLowerCase();
    if (seen.has(normalized)) {
      continue;
    }

    merged.push({
      value: variable.name,
      label: variable.name,
      valueType: "user_var",
    });
    seen.add(normalized);
  }

  return merged;
};

export const getAllVariables = (joker: Partial<JokerData>): UserVariable[] => {
  return getUserVariables(joker);
};

export const getNumberVariables = (
  joker: Partial<JokerData>,
): UserVariable[] => {
  return getUserVariables(joker).filter((v) => !v.type || v.type === "number");
};

export const addNumberVariablesToOptions = (
  options: VariableOption[],
  joker: Partial<JokerData>,
): VariableOption[] => appendByType(options, joker, "number");

export const addSuitVariablesToOptions = (
  options: VariableOption[],
  joker: Partial<JokerData>,
): VariableOption[] => appendByType(options, joker, "suit");

export const addRankVariablesToOptions = (
  options: VariableOption[],
  joker: Partial<JokerData>,
): VariableOption[] => appendByType(options, joker, "rank");

export const addPokerHandVariablesToOptions = (
  options: VariableOption[],
  joker: Partial<JokerData>,
): VariableOption[] => appendByType(options, joker, "pokerhand");

export const addKeyVariablesToOptions = (
  options: VariableOption[],
  joker: Partial<JokerData>,
): VariableOption[] => appendByType(options, joker, "key");

export const addTextVariablesToOptions = (
  options: VariableOption[],
  joker: Partial<JokerData>,
): VariableOption[] => appendByType(options, joker, "text");

const collectParamUsages = (
  params: Record<string, { value: unknown; valueType?: string }> | undefined,
  ruleIndex: number,
  fieldPath: string,
  variableNames: Set<string>,
  result: VariableUsageDetail[],
) => {
  if (!params) {
    return;
  }

  Object.entries(params).forEach(([key, payload]) => {
    if (!payload) {
      return;
    }

    const value = payload.value;
    const isUserVar =
      payload.valueType === "user_var" && typeof value === "string";
    const isImplicitVar = typeof value === "string" && variableNames.has(value);

    if (isUserVar || isImplicitVar) {
      result.push({
        variableName: String(value),
        ruleIndex,
        fieldPath: `${fieldPath}.${key}`,
      });
    }
  });
};

export const getVariableUsageDetails = (
  item: Partial<ItemData> & { rules?: Rule[]; userVariables?: UserVariable[] },
): VariableUsageDetail[] => {
  const rules = Array.isArray(item?.rules) ? item.rules : [];
  const variableNames = new Set(getUserVariables(item).map((v) => v.name));
  const result: VariableUsageDetail[] = [];

  rules.forEach((rule, ruleIndex) => {
    rule.conditionGroups?.forEach((group, groupIndex) => {
      group.conditions?.forEach((condition, conditionIndex) => {
        collectParamUsages(
          condition.params,
          ruleIndex,
          `conditionGroups.${groupIndex}.conditions.${conditionIndex}`,
          variableNames,
          result,
        );
      });
    });

    rule.effects?.forEach((effect, effectIndex) => {
      collectParamUsages(
        effect.params,
        ruleIndex,
        `effects.${effectIndex}`,
        variableNames,
        result,
      );
    });

    rule.randomGroups?.forEach((group, groupIndex) => {
      collectParamUsages(
        {
          chance_numerator: group.chance_numerator,
          chance_denominator: group.chance_denominator,
        },
        ruleIndex,
        `randomGroups.${groupIndex}`,
        variableNames,
        result,
      );

      group.effects?.forEach((effect, effectIndex) => {
        collectParamUsages(
          effect.params,
          ruleIndex,
          `randomGroups.${groupIndex}.effects.${effectIndex}`,
          variableNames,
          result,
        );
      });
    });

    rule.loops?.forEach((loop, loopIndex) => {
      collectParamUsages(
        { repetitions: loop.repetitions },
        ruleIndex,
        `loops.${loopIndex}`,
        variableNames,
        result,
      );

      loop.effects?.forEach((effect, effectIndex) => {
        collectParamUsages(
          effect.params,
          ruleIndex,
          `loops.${loopIndex}.effects.${effectIndex}`,
          variableNames,
          result,
        );
      });
    });
  });

  return result;
};
