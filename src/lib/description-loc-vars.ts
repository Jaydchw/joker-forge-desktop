import type { BaseGameObject, UserVariable } from "@/lib/types";
import { buildDescriptionVariableTokens } from "@/lib/rules/description-variable-registry";
import type { Rule } from "@/components/rule-builder/types";

export const getVariableDisplayValue = (variable: UserVariable): string => {
  if (variable.type === "suit") return variable.initialSuit || "Spades";
  if (variable.type === "rank") return variable.initialRank || "Ace";
  if (variable.type === "key") return variable.initialKey || "none";
  if (variable.type === "text") return variable.initialText || "Hello";
  if (variable.type === "pokerhand") {
    return variable.initialPokerHand || "High Card";
  }
  return variable.initialValue?.toString() || "0";
};

export const getItemLocVarsFromUserVariables = (
  item: Partial<BaseGameObject> | null | undefined,
): { vars: string[] } | undefined => {
  if (!item) return undefined;

  const userVariables = Array.isArray(item.userVariables) ? item.userVariables : [];
  const userVarMap = new Map(
    userVariables.map((variable) => [variable.name.trim().toLowerCase(), variable]),
  );
  const randomGroups = (Array.isArray(item.rules)
    ? item.rules.flatMap((rule) => rule.randomGroups || [])
    : []) as Array<
    Rule["randomGroups"][number]
  >;
  const asDisplayValue = (value: unknown): string => {
    if (value === undefined || value === null) return "0";
    return String(value);
  };

  const tokens = buildDescriptionVariableTokens({
    rules: item.rules,
    userVariables,
    locVars: (item as { locVars?: { vars?: Array<string | number> } }).locVars,
  });
  if (tokens.length === 0) return undefined;

  const vars = tokens.map((token) => {
    if (token.category === "loc") {
      return token.source;
    }

    if (token.source.startsWith("card.ability.extra.")) {
      const extraName = token.source.replace("card.ability.extra.", "").trim();
      const userVar = userVarMap.get(extraName.toLowerCase());
      if (userVar) {
        return getVariableDisplayValue(userVar);
      }

      const probabilityMatch = extraName.match(
        /^probability_(numerator|denominator)(\d+)$/,
      );
      if (probabilityMatch) {
        const [, part, indexText] = probabilityMatch;
        const groupIndex = Number.parseInt(indexText, 10);
        const group = randomGroups[groupIndex];
        if (group) {
          return part === "numerator"
            ? asDisplayValue(group.chance_numerator?.value)
            : asDisplayValue(group.chance_denominator?.value);
        }
      }
    }

    return token.label || token.source;
  });

  return {
    vars,
  };
};
