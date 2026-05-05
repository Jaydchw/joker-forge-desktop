import type { BaseGameObject, UserVariable } from "@/lib/types";
import type { ProjectData } from "@/lib/storage";

export interface GlobalVariableEntry {
  variable: UserVariable;
  ownerItemId: string;
  ownerItemType: string;
  ownerItemName: string;
}

const getRuleBuilderItems = (data: ProjectData): BaseGameObject[] => [
  ...data.jokers,
  ...data.consumables,
  ...data.vouchers,
  ...data.decks,
  ...data.enhancements,
  ...data.seals,
  ...data.editions,
];

export const collectGlobalVariables = (
  data: ProjectData,
  options?: { excludeItemId?: string },
): GlobalVariableEntry[] => {
  const out: GlobalVariableEntry[] = [];
  const seen = new Set<string>();
  const excludeItemId = options?.excludeItemId;

  for (const item of getRuleBuilderItems(data)) {
    if (excludeItemId && item.id === excludeItemId) {
      continue;
    }

    const variables = Array.isArray(item.userVariables) ? item.userVariables : [];
    for (const variable of variables) {
      if (!variable?.isGlobal || !variable.name?.trim()) {
        continue;
      }

      const normalized = variable.name.trim().toLowerCase();
      if (seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);

      out.push({
        variable,
        ownerItemId: item.id,
        ownerItemType: item.objectType,
        ownerItemName: item.name,
      });
    }
  }

  return out;
};

export const mergeItemVariablesWithGlobals = <
  T extends { userVariables?: UserVariable[] },
>(
  item: T,
  globalVariables: UserVariable[],
): T => {
  const localVariables = Array.isArray(item.userVariables) ? item.userVariables : [];
  const merged: UserVariable[] = [];
  const seen = new Set<string>();

  for (const variable of localVariables) {
    const normalized = variable.name.trim().toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    merged.push(variable);
  }

  for (const variable of globalVariables) {
    const normalized = variable.name.trim().toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    merged.push(variable);
  }

  return {
    ...item,
    userVariables: merged,
  };
};
