import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCard } from "@/components/pages/generic-item-card";
import { getItemLocVarsFromUserVariables } from "@/lib/description-loc-vars";
import { RuleBuilder } from "@/components/rule-builder";
import { useProjectData } from "@/lib/storage";
import { useVanillaReforgedData } from "@/lib/vanilla-reforged";
import { SealData } from "@/lib/types";
import { fuzzyMatchAny } from "@/lib/search";
import { slugify } from "@/lib/balatro-utils";
import { Copy, Prohibit, Sparkle } from "@phosphor-icons/react";

export default function VanillaReforgedSealsPage() {
  const navigate = useNavigate();
  const { data: reforged, isLoading, error } = useVanillaReforgedData();
  const { data, updateSeals } = useProjectData();
  const [ruleViewingItem, setRuleViewingItem] = useState<SealData | null>(null);

  const items = reforged?.seals ?? [];
  const subtitle = reforged?.metadata?.display_name || "Vanilla Reforged";

  const handleCopy = useCallback(
    (item: SealData) => {
      const baseKey = item.objectKey || slugify(item.name);
      const duplicated: SealData = {
        ...item,
        id: crypto.randomUUID(),
        name: `${item.name} (Copy)`,
        objectKey: `${baseKey}_copy`,
        orderValue: data.seals.length + 1,
      };
      updateSeals([...data.seals, duplicated]);
      navigate("/seals");
    },
    [data.seals, navigate, updateSeals],
  );

  const searchProps = useMemo(
    () => ({
      placeholder: "Search vanilla seals...",
      searchFn: (item: SealData, term: string) =>
        fuzzyMatchAny([item.name, item.description], term),
    }),
    [],
  );

  const sortOptions = useMemo(
    () => [
      {
        label: "Order",
        value: "order",
        sortFn: (a: SealData, b: SealData) => a.orderValue - b.orderValue,
      },
      {
        label: "Name",
        value: "name",
        sortFn: (a: SealData, b: SealData) => a.name.localeCompare(b.name),
      },
    ],
    [],
  );

  const renderCard = useCallback(
    (item: SealData) => (
      <GenericItemCard
        key={item.id}
        reforged
        name={item.name}
        description={item.description}
        locVars={getItemLocVarsFromUserVariables(item)}
        idValue={item.orderValue}
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
            id: "no_collection",
            label: item.no_collection ? "Hidden Collection" : "In Collection",
            icon: <Prohibit className="h-4 w-4" weight="regular" />,
            isActive: item.no_collection === true,
            variant: "default",
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
      <GenericItemPage<SealData>
        isLoading={isLoading}
        title="Vanilla Seals"
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
          itemType="card"
          reforged
        />
      )}
    </>
  );
}



