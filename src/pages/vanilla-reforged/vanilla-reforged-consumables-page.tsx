import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCard } from "@/components/pages/generic-item-card";
import { getItemLocVarsFromUserVariables } from "@/lib/description-loc-vars";
import { RuleBuilder } from "@/components/rule-builder";
import { useProjectData } from "@/lib/storage";
import { useVanillaReforgedData } from "@/lib/vanilla-reforged";
import { ConsumableData } from "@/lib/types";
import { fuzzyMatchAny } from "@/lib/search";
import { slugify } from "@/lib/balatro-utils";
import {
  Copy,
  Eye,
  EyeSlash,
  Lock,
  LockOpen,
  Sparkle,
} from "@phosphor-icons/react";

export default function VanillaReforgedConsumablesPage() {
  const navigate = useNavigate();
  const { data: reforged, isLoading, error } = useVanillaReforgedData();
  const { data, updateConsumables } = useProjectData();
  const [ruleViewingItem, setRuleViewingItem] = useState<ConsumableData | null>(
    null,
  );

  const items = reforged?.consumables ?? [];
  const subtitle = reforged?.metadata?.display_name || "Vanilla Reforged";

  const handleCopy = useCallback(
    (item: ConsumableData) => {
      const baseKey = item.objectKey || slugify(item.name);
      const duplicated: ConsumableData = {
        ...item,
        id: crypto.randomUUID(),
        name: `${item.name} (Copy)`,
        objectKey: `${baseKey}_copy`,
        orderValue: data.consumables.length + 1,
      };
      updateConsumables([...data.consumables, duplicated]);
      navigate("/consumables");
    },
    [data.consumables, navigate, updateConsumables],
  );

  const searchProps = useMemo(
    () => ({
      placeholder: "Search vanilla consumables...",
      searchFn: (item: ConsumableData, term: string) =>
        fuzzyMatchAny([item.name, item.description], term),
    }),
    [],
  );

  const sortOptions = useMemo(
    () => [
      {
        label: "Order",
        value: "order",
        sortFn: (a: ConsumableData, b: ConsumableData) =>
          a.orderValue - b.orderValue,
      },
      {
        label: "Name",
        value: "name",
        sortFn: (a: ConsumableData, b: ConsumableData) =>
          a.name.localeCompare(b.name),
      },
      {
        label: "Cost",
        value: "cost",
        sortFn: (a: ConsumableData, b: ConsumableData) =>
          (a.cost || 0) - (b.cost || 0),
      },
    ],
    [],
  );

  const renderCard = useCallback(
    (item: ConsumableData) => (
      <GenericItemCard
        key={item.id}
        reforged
        name={item.name}
        description={item.description}
        locVars={getItemLocVarsFromUserVariables(item)}
        cost={item.cost}
        idValue={item.orderValue}
        consumableSet={item.set}
        onUpdate={() => {}}
        image={
          item.image ? (
            <img
              src={item.image}
              className="w-full h-full object-contain [image-rendering:pixelated]"
              alt={item.name}
            />
          ) : (
            <div className="text-muted-foreground/30 text-xs font-bold uppercase tracking-widest border-2 border-dashed border-border p-4 rounded-lg">
              No Image
            </div>
          )
        }
        properties={[
          {
            id: "unlocked",
            label: item.unlocked ? "Unlocked" : "Locked",
            icon: item.unlocked ? (
              <LockOpen className="h-4 w-4" weight="regular" />
            ) : (
              <Lock className="h-4 w-4" weight="regular" />
            ),
            isActive: item.unlocked ?? true,
            variant: "warning",
            onClick: () => {},
          },
          {
            id: "discovered",
            label: item.discovered ? "Discovered" : "Hidden",
            icon: item.discovered ? (
              <Eye className="h-4 w-4" weight="regular" />
            ) : (
              <EyeSlash className="h-4 w-4" weight="regular" />
            ),
            isActive: item.discovered ?? true,
            variant: "info",
            onClick: () => {},
          },
        ]}
        actions={[
          {
            id: "rules",
            label: "View Rules",
            icon: <Sparkle className="h-4 w-4" />,
            badgeCount: item.rules?.length ?? 0,
            variant: "outline",
            onClick: () => setRuleViewingItem(item),
          },
          {
            id: "duplicate",
            label: "Copy to Project",
            icon: <Copy className="h-4 w-4" />,
            onClick: () => handleCopy(item),
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
      <GenericItemPage<ConsumableData>
        isLoading={isLoading}
        title="Vanilla Consumables"
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
          itemType="consumable"
          reforged
        />
      )}
    </>
  );
}



