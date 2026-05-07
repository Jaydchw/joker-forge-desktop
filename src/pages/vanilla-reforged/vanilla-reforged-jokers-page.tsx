import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCard } from "@/components/pages/generic-item-card";
import { RuleBuilder } from "@/components/rule-builder";
import { useProjectData } from "@/lib/storage";
import { useVanillaReforgedData } from "@/lib/vanilla-reforged";
import { JokerData } from "@/lib/types";
import { fuzzyMatchAny } from "@/lib/search";
import { slugify } from "@/lib/balatro-utils";
import {
  Copy,
  Eye,
  EyeSlash,
  Lightning,
  Lock,
  LockOpen,
  Prohibit,
  Sparkle,
  Star,
  Clock,
  CurrencyDollar,
} from "@phosphor-icons/react";

export default function VanillaReforgedJokersPage() {
  const navigate = useNavigate();
  const { data: reforged, isLoading, error } = useVanillaReforgedData();
  const { data, updateJokers } = useProjectData();
  const [ruleViewingItem, setRuleViewingItem] = useState<JokerData | null>(
    null,
  );

  const items = reforged?.jokers ?? [];
  const subtitle = reforged?.metadata?.display_name || "Vanilla Reforged";

  const handleCopy = useCallback(
    (joker: JokerData) => {
      const baseKey = joker.objectKey || slugify(joker.name);
      const duplicated: JokerData = {
        ...joker,
        id: crypto.randomUUID(),
        name: `${joker.name} (Copy)`,
        objectKey: `${baseKey}_copy`,
        orderValue: data.jokers.length + 1,
      };
      updateJokers([...data.jokers, duplicated]);
      navigate("/jokers");
    },
    [data.jokers, navigate, updateJokers],
  );

  const searchProps = useMemo(
    () => ({
      placeholder: "Search vanilla jokers...",
      searchFn: (item: JokerData, term: string) =>
        fuzzyMatchAny([item.name, item.description], term),
    }),
    [],
  );

  const sortOptions = useMemo(
    () => [
      {
        label: "Order",
        value: "order",
        sortFn: (a: JokerData, b: JokerData) => a.orderValue - b.orderValue,
      },
      {
        label: "Name",
        value: "name",
        sortFn: (a: JokerData, b: JokerData) => a.name.localeCompare(b.name),
      },
      {
        label: "Cost",
        value: "cost",
        sortFn: (a: JokerData, b: JokerData) => (a.cost || 0) - (b.cost || 0),
      },
      {
        label: "Rarity",
        value: "rarity",
        sortFn: (a: JokerData, b: JokerData) =>
          Number(a.rarity) - Number(b.rarity),
      },
    ],
    [],
  );

  const renderCard = useCallback(
    (joker: JokerData) => (
      <GenericItemCard
        key={joker.id}
        reforged
        name={joker.name}
        description={joker.description}
        cost={joker.cost}
        idValue={joker.orderValue}
        rarity={joker.rarity}
        onUpdate={() => {}}
        image={
          joker.image ? (
            <img
              src={joker.image}
              className="w-full h-full object-contain [image-rendering:pixelated]"
              alt={joker.name}
            />
          ) : (
            <div className="text-muted-foreground/30 text-xs font-bold uppercase tracking-widest border-2 border-dashed border-border p-4 rounded-lg">
              No Image
            </div>
          )
        }
        properties={[
          {
            id: "eternal",
            label: joker.eternal_compat ? "Eternal Compatible" : "No Eternal",
            icon: (
              <Star
                className="h-4 w-4"
                weight={joker.eternal_compat ? "fill" : "regular"}
              />
            ),
            isActive: joker.eternal_compat,
            variant: "purple",
            onClick: () => {},
          },
          {
            id: "perishable",
            label: joker.perishable_compat
              ? "Perishable Compatible"
              : "No Perishable",
            icon: <Clock className="h-4 w-4" weight="regular" />,
            isActive: !!joker.perishable_compat,
            variant: "warning",
            onClick: () => {},
          },
          {
            id: "blueprint",
            label: joker.blueprint_compat
              ? "Blueprint Compatible"
              : "No Blueprint",
            icon: (
              <Lightning
                className="h-4 w-4"
                weight={joker.blueprint_compat ? "fill" : "regular"}
              />
            ),
            isActive: joker.blueprint_compat,
            variant: "info",
            onClick: () => {},
          },
          {
            id: "shop",
            label: joker.appears_in_shop
              ? "Appears in Shop"
              : "Hidden from Shop",
            icon: joker.appears_in_shop ? (
              <CurrencyDollar className="h-4 w-4" weight="regular" />
            ) : (
              <Prohibit className="h-4 w-4" weight="regular" />
            ),
            isActive: joker.appears_in_shop,
            variant: "success",
            onClick: () => {},
          },
          {
            id: "unlocked",
            label: joker.unlocked ? "Unlocked" : "Locked",
            icon: joker.unlocked ? (
              <LockOpen className="h-4 w-4" weight="regular" />
            ) : (
              <Lock className="h-4 w-4" weight="regular" />
            ),
            isActive: joker.unlocked,
            variant: "warning",
            onClick: () => {},
          },
          {
            id: "discovered",
            label: joker.discovered ? "Discovered" : "Undiscovered",
            icon: joker.discovered ? (
              <Eye className="h-4 w-4" weight="regular" />
            ) : (
              <EyeSlash className="h-4 w-4" weight="regular" />
            ),
            isActive: joker.discovered,
            variant: "info",
            onClick: () => {},
          },
        ]}
        actions={[
          {
            id: "rules",
            label: "View Rules",
            icon: <Sparkle className="h-4 w-4" />,
            badgeCount: joker.rules?.length ?? 0,
            variant: "outline",
            onClick: () => setRuleViewingItem(joker),
          },
          {
            id: "duplicate",
            label: "Copy to Project",
            icon: <Copy className="h-4 w-4" />,
            onClick: () => handleCopy(joker),
          },
        ]}
      />
    ),
    [handleCopy],
  );

  if (error) {
    return (
      <div className="max-w-7xl mx-auto pb-20 text-destructive">{error}</div>
    );
  }

  return (
    <>
      <GenericItemPage<JokerData>
        isLoading={isLoading}
        title="Vanilla Jokers"
        subtitle={subtitle}
        items={items}
        searchProps={searchProps}
        sortOptions={sortOptions}
        renderCard={renderCard}
        reforged
      />
      {ruleViewingItem && (
        <RuleBuilder
          isOpen={true}
          onClose={() => setRuleViewingItem(null)}
          existingRules={ruleViewingItem.rules ?? []}
          onSave={() => {}}
          item={ruleViewingItem}
          onUpdateItem={() => {}}
          itemType="joker"
          reforged
        />
      )}
    </>
  );
}



