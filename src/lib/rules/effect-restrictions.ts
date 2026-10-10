const deckSelectionEffectLabels = new Map([
  ["create_consumable", "Create Consumable"],
  ["add_consumable", "Create Consumable"],
  ["redeem_voucher", "Redeem Voucher"],
]);

const normalizeId = (value: unknown): string =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

export function getEffectRestrictionForTrigger(
  effectType: string,
  triggerId: string,
  itemType: string,
): string | undefined {
  if (normalizeId(itemType) !== "deck"
    || !["card_used", "deck_selected"].includes(normalizeId(triggerId))) return;
  const effect = normalizeId(effectType);
  const label = deckSelectionEffectLabels.get(effect);
  if (!label) return;
  const startingItems = effect === "redeem_voucher" ? "vouchers" : "consumables";
  return `${label} cannot run when this deck is selected. Add starting ${startingItems} in the deck's Advanced settings, or move the effect to a later trigger.`;
}

export interface RuleEffectRestriction {
  ruleIndex: number;
  ruleId?: string;
  effectId?: string;
  effectType: string;
  message: string;
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;

export function getRuleEffectRestriction(
  rules: unknown,
  itemType: string,
): RuleEffectRestriction | undefined {
  if (normalizeId(itemType) !== "deck" || !Array.isArray(rules)) return;
  for (const [ruleIndex, rawRule] of rules.entries()) {
    const rule = asRecord(rawRule);
    if (!rule) continue;
    const groupedEffects = [rule.randomGroups, rule.random_groups, rule.loops, rule.loopGroups, rule.loop_groups]
      .flatMap((groups) => Array.isArray(groups) ? groups : [])
      .flatMap((group) => {
        const entries = asRecord(group)?.effects;
        return Array.isArray(entries) ? entries : [];
      });
    const effects = [...(Array.isArray(rule.effects) ? rule.effects : []), ...groupedEffects];
    for (const rawEffect of effects) {
      const effect = asRecord(rawEffect);
      if (!effect) continue;
      const effectType = normalizeId(effect.type ?? effect.effect_type ?? effect.effectType);
      const message = getEffectRestrictionForTrigger(effectType, normalizeId(rule.trigger), itemType);
      if (message) return {
        ruleIndex,
        ruleId: typeof rule.id === "string" ? rule.id : undefined,
        effectId: typeof effect.id === "string" ? effect.id : undefined,
        effectType,
        message: `Rule ${ruleIndex + 1}: ${message}`,
      };
    }
  }
}
