import type { BaseGameObject, UserVariable } from "@/lib/core/types";
import { buildDescriptionVariableTokens } from "@/lib/rules/description-variable-registry";
export { getVariableDisplayValue } from "@/lib/rules/description-variable-registry";

export const getItemLocVarsFromUserVariables = (
  item: Partial<BaseGameObject> | null | undefined,
  globalVariables: UserVariable[] = [],
): { vars: string[] } | undefined => {
  if (!item) return undefined;

  const tokens = buildDescriptionVariableTokens(item, globalVariables);
  if (tokens.length === 0) return undefined;

  return {
    vars: tokens.map((token) => token.previewValue ?? token.label),
  };
};
