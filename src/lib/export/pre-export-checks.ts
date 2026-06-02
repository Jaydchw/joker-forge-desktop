import type { ProjectData } from "@/lib/services/storage";
import type {
  BaseGameObject,
  ConsumableData,
  ConsumableSetData,
  DeckData,
  EditionData,
  JokerData,
  RarityData,
  SoundData,
  VoucherData,
} from "@/lib/core/types";
import type { NavigationTarget } from "@/lib/app/navigation-target";

export interface PreExportIssue {
  id: string;
  message: string;
  target?: NavigationTarget;
}

type IdentifierItem = { id: string; name?: string };

type CheckContext = {
  data: ProjectData;
  issues: PreExportIssue[];
};

const IDENTIFIER_REGEX = /^[A-Za-z0-9_]+$/;
const HEX_COLOR_REGEX = /^[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;
const VANILLA_RARITY_KEYS = new Set(["common", "uncommon", "rare", "legendary"]);
const VANILLA_CONSUMABLE_SETS = new Set(["Tarot", "Planet", "Spectral"]);

const createIssueId = (): string =>
  `pre_export_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const normalizeIdentifier = (value: string | undefined | null): string =>
  String(value || "").trim().toLowerCase();

const pushIssue = (
  issues: PreExportIssue[],
  message: string,
  target?: NavigationTarget,
) => {
  issues.push({ id: createIssueId(), message, ...(target ? { target } : {}) });
};

const formatItemName = (item: IdentifierItem, fallback: string): string =>
  item.name && item.name.trim() ? item.name.trim() : fallback;

const checkMetadata = ({ data, issues }: CheckContext) => {
  const { metadata } = data;

  if (!metadata.id.trim()) {
    pushIssue(issues, "Metadata: Mod ID is required.", {
      path: "/metadata",
      editor: "info",
    });
  } else if (!IDENTIFIER_REGEX.test(metadata.id.trim())) {
    pushIssue(
      issues,
      "Metadata: Mod ID must only use letters, numbers, or underscores.",
      { path: "/metadata", editor: "info" },
    );
  }

  if (!metadata.prefix.trim()) {
    pushIssue(issues, "Metadata: Prefix is required.", {
      path: "/metadata",
      editor: "info",
    });
  } else if (!IDENTIFIER_REGEX.test(metadata.prefix.trim())) {
    pushIssue(
      issues,
      "Metadata: Prefix must only use letters, numbers, or underscores.",
      { path: "/metadata", editor: "info" },
    );
  }

  if (!metadata.name.trim()) {
    pushIssue(issues, "Metadata: Mod name is required.", {
      path: "/metadata",
      editor: "info",
    });
  }
};

const maybeCheckObjectKeySmodsPattern = (
  issues: PreExportIssue[],
  config: {
    label: string;
    path: string;
    itemId: string;
    itemName: string;
    objectKey: string;
    objectTypePrefix: string;
    modPrefix: string;
  },
) => {
  const key = config.objectKey.trim().toLowerCase();
  if (!key) return;

  const typedPrefix = `${config.objectTypePrefix}_`;
  if (key.startsWith(typedPrefix)) {
    pushIssue(
      issues,
      `${config.label}: "${config.itemName}" key "${config.objectKey}" should not start with "${typedPrefix}" because SMODS adds that automatically.`,
      {
        path: config.path,
        itemId: config.itemId,
        editor: "info",
      },
    );
  }

  const modPrefix = `${config.modPrefix.trim().toLowerCase()}_`;
  if (modPrefix !== "_" && key.startsWith(modPrefix)) {
    pushIssue(
      issues,
      `${config.label}: "${config.itemName}" key "${config.objectKey}" should not start with "${modPrefix}" because your mod prefix is applied automatically.`,
      {
        path: config.path,
        itemId: config.itemId,
        editor: "info",
      },
    );
  }
};

const checkBaseObjectCollection = (
  context: CheckContext,
  options: {
    label: string;
    path: string;
    items: BaseGameObject[];
    objectTypePrefix: string;
  },
) => {
  const { issues, data } = context;
  const keyMap = new Map<string, BaseGameObject[]>();

  options.items.forEach((item) => {
    const displayName = formatItemName(item, item.id);
    const rawKey = (item.objectKey || "").trim();
    const normalizedKey = normalizeIdentifier(rawKey);

    if (!rawKey) {
      pushIssue(
        issues,
        `${options.label}: "${displayName}" is missing Object Key.`,
        {
          path: options.path,
          itemId: item.id,
          editor: "info",
        },
      );
    } else if (!IDENTIFIER_REGEX.test(rawKey)) {
      pushIssue(
        issues,
        `${options.label}: "${displayName}" has an invalid Object Key "${rawKey}".`,
        {
          path: options.path,
          itemId: item.id,
          editor: "info",
        },
      );
    } else {
      maybeCheckObjectKeySmodsPattern(issues, {
        label: options.label,
        path: options.path,
        itemId: item.id,
        itemName: displayName,
        objectKey: rawKey,
        objectTypePrefix: options.objectTypePrefix,
        modPrefix: data.metadata.prefix,
      });
    }

    if (!item.name?.trim()) {
      pushIssue(
        issues,
        `${options.label}: item "${item.id}" is missing Name.`,
        {
          path: options.path,
          itemId: item.id,
          editor: "info",
        },
      );
    }

    if (!Array.isArray(item.rules) && item.rules !== undefined) {
      pushIssue(
        issues,
        `${options.label}: "${displayName}" has broken rule data (rules must be an array).`,
        {
          path: options.path,
          itemId: item.id,
          editor: "rules",
        },
      );
    }

    if (!normalizedKey) return;
    const duplicates = keyMap.get(normalizedKey) || [];
    duplicates.push(item);
    keyMap.set(normalizedKey, duplicates);
  });

  keyMap.forEach((duplicates, key) => {
    if (duplicates.length < 2) return;
    duplicates.forEach((item) => {
      const displayName = formatItemName(item, item.id);
      const otherNames = duplicates
        .filter((candidate) => candidate.id !== item.id)
        .map((candidate) => `"${formatItemName(candidate, candidate.id)}"`)
        .slice(0, 3)
        .join(", ");
      pushIssue(
        issues,
        `${options.label}: "${displayName}" shares duplicate Object Key "${key}" with ${otherNames}.`,
        {
          path: options.path,
          itemId: item.id,
          editor: "info",
        },
      );
    });
  });
};

const checkSimpleKeyCollection = <T extends IdentifierItem>(
  issues: PreExportIssue[],
  config: {
    label: string;
    path: string;
    keyLabel: string;
    getKey: (item: T) => string;
    getValueLabel: (item: T) => string;
    checkExtra?: (item: T) => string | null;
    supportsItemNavigation?: boolean;
  },
  items: T[],
) => {
  const keyMap = new Map<string, T[]>();
  const toTarget = (itemId: string): NavigationTarget => ({
    path: config.path,
    ...(config.supportsItemNavigation === false
      ? {}
      : { itemId, editor: "info" as const }),
  });

  items.forEach((item) => {
    const rawKey = config.getKey(item).trim();
    const key = normalizeIdentifier(rawKey);
    const valueLabel = config.getValueLabel(item);

    if (!rawKey) {
      pushIssue(
        issues,
        `${config.label}: "${valueLabel}" is missing ${config.keyLabel}.`,
        toTarget(item.id),
      );
    } else if (!IDENTIFIER_REGEX.test(rawKey)) {
      pushIssue(
        issues,
        `${config.label}: "${valueLabel}" has invalid ${config.keyLabel} "${rawKey}".`,
        toTarget(item.id),
      );
    }

    if (config.checkExtra) {
      const extraMessage = config.checkExtra(item);
      if (extraMessage) {
        pushIssue(issues, extraMessage, toTarget(item.id));
      }
    }

    if (!key) return;
    const duplicates = keyMap.get(key) || [];
    duplicates.push(item);
    keyMap.set(key, duplicates);
  });

  keyMap.forEach((duplicates, key) => {
    if (duplicates.length < 2) return;
    duplicates.forEach((item) => {
      const valueLabel = config.getValueLabel(item);
      const others = duplicates
        .filter((candidate) => candidate.id !== item.id)
        .map((candidate) => `"${config.getValueLabel(candidate)}"`)
        .slice(0, 3)
        .join(", ");
      pushIssue(
        issues,
        `${config.label}: "${valueLabel}" shares duplicate ${config.keyLabel} "${key}" with ${others}.`,
        toTarget(item.id),
      );
    });
  });
};

const checkConsumableSetReferences = ({ data, issues }: CheckContext) => {
  const customSetKeys = new Set(
    data.consumableSets.map((set) => normalizeIdentifier(set.key)),
  );

  data.consumables.forEach((item: ConsumableData) => {
    const setValue = String(item.set || "").trim();
    if (!setValue) return;
    if (VANILLA_CONSUMABLE_SETS.has(setValue)) return;
    if (customSetKeys.has(normalizeIdentifier(setValue))) return;

    pushIssue(
      issues,
      `Consumables: "${formatItemName(item, item.id)}" uses unknown set "${setValue}".`,
      {
        path: "/consumables",
        itemId: item.id,
        editor: "info",
      },
    );
  });
};

const checkDeckConfigKeys = ({ data, issues }: CheckContext) => {
  data.decks.forEach((deck: DeckData) => {
    const deckName = formatItemName(deck, deck.id);

    (deck.Config_vouchers || []).forEach((voucherKey) => {
      const value = String(voucherKey || "").trim();
      if (!value) return;
      if (value.startsWith("v_")) return;
      pushIssue(
        issues,
        `Decks: "${deckName}" has voucher key "${value}" but SMODS expects voucher keys to start with "v_".`,
        {
          path: "/decks",
          itemId: deck.id,
          editor: "info",
        },
      );
    });

    (deck.Config_consumables || []).forEach((consumableKey) => {
      const value = String(consumableKey || "").trim();
      if (!value) return;
      if (value.startsWith("c_")) return;
      pushIssue(
        issues,
        `Decks: "${deckName}" has consumable key "${value}" but SMODS expects consumable keys to start with "c_".`,
        {
          path: "/decks",
          itemId: deck.id,
          editor: "info",
        },
      );
    });
  });
};

const checkVoucherRequirements = ({ data, issues }: CheckContext) => {
  data.vouchers.forEach((voucher: VoucherData) => {
    const value = String(voucher.requires || "").trim();
    if (!value) return;
    if (value.startsWith("v_")) return;

    pushIssue(
      issues,
      `Vouchers: "${formatItemName(voucher, voucher.id)}" has requires="${value}" but SMODS voucher keys should start with "v_".`,
      {
        path: "/vouchers",
        itemId: voucher.id,
        editor: "info",
      },
    );
  });
};

const checkJokerRarityReferences = ({ data, issues }: CheckContext) => {
  const modPrefix = normalizeIdentifier(data.metadata.prefix);
  const customRarityKeys = new Set(
    data.rarities.map((rarity) => normalizeIdentifier(rarity.key)),
  );
  const customRarityExportKeys = new Set(
    [...customRarityKeys].map((key) =>
      modPrefix ? `${modPrefix}_${key}` : key,
    ),
  );

  data.jokers.forEach((joker: JokerData) => {
    if (typeof joker.rarity !== "string") return;
    const rarity = joker.rarity.trim();
    if (!rarity) return;
    const normalized = normalizeIdentifier(rarity);
    if (VANILLA_RARITY_KEYS.has(normalized)) return;
    const matchesRawCustomKey = customRarityKeys.has(normalized);
    const matchesExportedCustomKey = customRarityExportKeys.has(normalized);
    if (matchesRawCustomKey || matchesExportedCustomKey) {
      if (
        modPrefix &&
        matchesExportedCustomKey &&
        !matchesRawCustomKey &&
        normalized.startsWith(`${modPrefix}_`)
      ) {
        const baseKey = normalized.slice(modPrefix.length + 1);
        pushIssue(
          issues,
          `Jokers: "${formatItemName(joker, joker.id)}" rarity "${rarity}" already includes "${modPrefix}_". Prefer "${baseKey}" to avoid prefix confusion in exports.`,
          {
            path: "/jokers",
            itemId: joker.id,
            editor: "info",
          },
        );
      }
      return;
    }

    pushIssue(
      issues,
      `Jokers: "${formatItemName(joker, joker.id)}" uses unknown rarity key "${rarity}".`,
      {
        path: "/jokers",
        itemId: joker.id,
        editor: "info",
      },
    );
  });
};

const checkEditionShaderKeys = ({ data, issues }: CheckContext) => {
  data.editions.forEach((edition: EditionData) => {
    const shader = String(edition.shader || "").trim();
    if (!shader || shader === "false") return;
    if (IDENTIFIER_REGEX.test(shader)) return;

    pushIssue(
      issues,
      `Editions: "${formatItemName(edition, edition.id)}" has shader "${shader}" with invalid characters.`,
      {
        path: "/editions",
        itemId: edition.id,
        editor: "info",
      },
    );
  });
};

const checkConsumableSetColors = ({ data, issues }: CheckContext) => {
  data.consumableSets.forEach((set: ConsumableSetData) => {
    if (!HEX_COLOR_REGEX.test(String(set.primary_colour || "").replace("#", ""))) {
      pushIssue(
        issues,
        `Consumable Sets: "${set.name || set.id}" has invalid primary color "${set.primary_colour}".`,
        {
          path: "/consumable-sets",
          itemId: set.id,
          editor: "info",
        },
      );
    }
    if (
      !HEX_COLOR_REGEX.test(String(set.secondary_colour || "").replace("#", ""))
    ) {
      pushIssue(
        issues,
        `Consumable Sets: "${set.name || set.id}" has invalid secondary color "${set.secondary_colour}".`,
        {
          path: "/consumable-sets",
          itemId: set.id,
          editor: "info",
        },
      );
    }
  });
};

export const runPreExportChecks = (data: ProjectData): PreExportIssue[] => {
  const issues: PreExportIssue[] = [];
  const context: CheckContext = { data, issues };

  checkMetadata(context);

  checkBaseObjectCollection(context, {
    label: "Jokers",
    path: "/jokers",
    items: data.jokers,
    objectTypePrefix: "j",
  });
  checkBaseObjectCollection(context, {
    label: "Consumables",
    path: "/consumables",
    items: data.consumables,
    objectTypePrefix: "c",
  });
  checkBaseObjectCollection(context, {
    label: "Vouchers",
    path: "/vouchers",
    items: data.vouchers,
    objectTypePrefix: "v",
  });
  checkBaseObjectCollection(context, {
    label: "Decks",
    path: "/decks",
    items: data.decks,
    objectTypePrefix: "b",
  });
  checkBaseObjectCollection(context, {
    label: "Enhancements",
    path: "/enhancements",
    items: data.enhancements,
    objectTypePrefix: "m",
  });
  checkBaseObjectCollection(context, {
    label: "Seals",
    path: "/seals",
    items: data.seals,
    objectTypePrefix: "s",
  });
  checkBaseObjectCollection(context, {
    label: "Editions",
    path: "/editions",
    items: data.editions,
    objectTypePrefix: "e",
  });
  checkBaseObjectCollection(context, {
    label: "Boosters",
    path: "/boosters",
    items: data.boosters,
    objectTypePrefix: "p",
  });

  checkSimpleKeyCollection<SoundData>(
    issues,
    {
      label: "Sounds",
      path: "/sounds",
      keyLabel: "key",
      getKey: (item) => item.key,
      getValueLabel: (item) => item.key || item.id,
      supportsItemNavigation: false,
      checkExtra: (item) => {
        if (!item.soundString?.trim()) {
          return `Sounds: "${item.key || item.id}" is missing an uploaded MP3 or OGG filename.`;
        }
        if (!item.audioDataUrl?.trim()) {
          return `Sounds: "${item.key || item.id}" is missing uploaded MP3 or OGG data.`;
        }
        const modPrefix = String(data.metadata.prefix || "").trim().toLowerCase();
        const key = String(item.key || "").trim().toLowerCase();
        if (modPrefix && key.startsWith(`${modPrefix}_`)) {
          return `Sounds: "${item.key}" should not start with "${modPrefix}_" because sound keys are already prefixed automatically.`;
        }
        return null;
      },
    },
    data.sounds,
  );

  checkSimpleKeyCollection<RarityData>(
    issues,
    {
      label: "Rarities",
      path: "/rarities",
      keyLabel: "key",
      getKey: (item) => item.key,
      getValueLabel: (item) => item.name || item.id,
      checkExtra: (item) => {
        const modPrefix = normalizeIdentifier(data.metadata.prefix);
        const key = normalizeIdentifier(item.key);
        if (modPrefix && key.startsWith(`${modPrefix}_`)) {
          return `Rarities: "${item.name || item.id}" key "${item.key}" should not start with "${modPrefix}_" because joker rarity references are already prefixed during export.`;
        }
        return null;
      },
    },
    data.rarities,
  );

  checkSimpleKeyCollection<ConsumableSetData>(
    issues,
    {
      label: "Consumable Sets",
      path: "/consumable-sets",
      keyLabel: "key",
      getKey: (item) => item.key,
      getValueLabel: (item) => item.name || item.id,
      checkExtra: (item) => {
        const key = String(item.key || "").trim().toLowerCase();
        if (key.startsWith("c_")) {
          return `Consumable Sets: "${item.name || item.id}" key "${item.key}" should not start with "c_" because SMODS builds that prefix automatically.`;
        }
        return null;
      },
    },
    data.consumableSets,
  );

  checkConsumableSetReferences(context);
  checkDeckConfigKeys(context);
  checkVoucherRequirements(context);
  checkJokerRarityReferences(context);
  checkEditionShaderKeys(context);
  checkConsumableSetColors(context);

  return issues;
};
