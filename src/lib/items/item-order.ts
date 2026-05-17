type OrderedItem = {
  id: string;
  orderValue?: number;
};

type UpdatePayload = {
  idValue?: number;
  orderValue?: number;
  [key: string]: unknown;
};

export function applyItemUpdatesWithOrderSwap<T extends OrderedItem>(
  items: T[],
  id: string,
  updates: UpdatePayload,
): T[] {
  const item = items.find((entry) => entry.id === id);
  if (!item) return items;

  const targetOrderValue =
    typeof updates.idValue === "number"
      ? updates.idValue
      : typeof updates.orderValue === "number"
        ? updates.orderValue
        : undefined;

  if (targetOrderValue === undefined) {
    return items.map((entry) =>
      entry.id === id ? ({ ...entry, ...updates } as T) : entry,
    );
  }

  const currentOrderValue = item.orderValue;
  const normalizedUpdates = { ...updates, orderValue: targetOrderValue };
  delete normalizedUpdates.idValue;

  return items.map((entry) => {
    if (entry.id === id) {
      return { ...entry, ...normalizedUpdates } as T;
    }

    if (
      currentOrderValue !== undefined &&
      entry.orderValue === targetOrderValue
    ) {
      return { ...entry, orderValue: currentOrderValue } as T;
    }

    return entry;
  });
}
