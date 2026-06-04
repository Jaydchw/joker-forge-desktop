type OrderedItem = {
  id: string;
  orderValue?: number;
};

type UpdatePayload = {
  idValue?: number;
  orderValue?: number;
  [key: string]: unknown;
};

const applyOrderValueInsertionAtIndex = <T extends OrderedItem>(
  items: T[],
  targetIndex: number,
  targetOrderValue: number,
): T[] => {
  const item = items[targetIndex];
  if (!item) return items;

  const currentOrderValue = item.orderValue;
  const occupiedOrderValues = new Set(
    items
      .filter((_, index) => index !== targetIndex)
      .map((entry) => entry.orderValue)
      .filter((value): value is number => typeof value === "number"),
  );
  const orderValuesToShift = new Set<number>();

  for (
    let value = targetOrderValue;
    occupiedOrderValues.has(value);
    value += 1
  ) {
    orderValuesToShift.add(value);
  }

  return items.map((entry, index) => {
    if (index === targetIndex) {
      return { ...entry, orderValue: targetOrderValue } as T;
    }

    if (
      entry.orderValue !== undefined &&
      currentOrderValue !== targetOrderValue &&
      orderValuesToShift.has(entry.orderValue)
    ) {
      return { ...entry, orderValue: entry.orderValue + 1 } as T;
    }

    return entry;
  });
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

  const normalizedUpdates = { ...updates, orderValue: targetOrderValue };
  delete normalizedUpdates.idValue;

  return applyOrderValueInsertionAtIndex(
    items,
    items.indexOf(item),
    targetOrderValue,
  ).map((entry) => {
    if (entry.id !== id) return entry;
    return { ...entry, ...normalizedUpdates } as T;
  });
}

export function ensureUniqueItemOrderValues<T extends OrderedItem>(
  items: T[],
): T[] {
  let normalized = items;
  const occupiedOrderValues = new Set<number>();

  for (let index = 0; index < normalized.length; index += 1) {
    const orderValue = normalized[index].orderValue;
    if (typeof orderValue !== "number") continue;

    if (!occupiedOrderValues.has(orderValue)) {
      occupiedOrderValues.add(orderValue);
      continue;
    }

    normalized = applyOrderValueInsertionAtIndex(
      normalized,
      index,
      orderValue + 1,
    );
    occupiedOrderValues.clear();
    normalized.forEach((entry, seenIndex) => {
      if (seenIndex > index) return;
      if (typeof entry.orderValue === "number") {
        occupiedOrderValues.add(entry.orderValue);
      }
    });
  }

  return normalized;
}
