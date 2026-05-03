import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCard } from "@/components/pages/generic-item-card";
import { RuleBuilder } from "@/components/rule-builder";
import { useProjectData } from "@/lib/storage";
import { useVanillaReforgedData } from "@/lib/vanilla-reforged";
import { EditionData } from "@/lib/types";
import { slugify } from "@/lib/balatro-utils";
import { Copy, Prohibit, Storefront, Sparkle } from "@phosphor-icons/react";

export default function VanillaReforgedEditionsPage() {
  const navigate = useNavigate();
  const { data: reforged, isLoading, error } = useVanillaReforgedData();
  const { data, updateEditions } = useProjectData();
  const [ruleViewingItem, setRuleViewingItem] = useState<EditionData | null>(
    null,
  );

  const items = reforged?.editions ?? [];
  const subtitle = reforged?.metadata?.display_name || "Vanilla Reforged";

  const handleCopy = useCallback(
    (item: EditionData) => {
      const baseKey = item.objectKey || slugify(item.name);
      const duplicated: EditionData = {
        ...item,
        id: crypto.randomUUID(),
        name: `${item.name} (Copy)`,
        objectKey: `${baseKey}_copy`,
        orderValue: data.editions.length + 1,
      };
      updateEditions([...data.editions, duplicated]);
      navigate("/editions");
    },
    [data.editions, navigate, updateEditions],
  );

  const searchProps = useMemo(
    () => ({
      placeholder: "Search vanilla editions...",
      searchFn: (item: EditionData, term: string) =>
        item.name.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term),
    }),
    [],
  );

  const sortOptions = useMemo(
    () => [
      {
        label: "Order",
        value: "order",
        sortFn: (a: EditionData, b: EditionData) => a.orderValue - b.orderValue,
      },
      {
        label: "Name",
        value: "name",
        sortFn: (a: EditionData, b: EditionData) =>
          a.name.localeCompare(b.name),
      },
    ],
    [],
  );

  const renderCard = useCallback(
    (item: EditionData) => (
      <GenericItemCard
        key={item.id}
        reforged
        name={item.name}
        description={item.description}
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
            id: "in_shop",
            label: item.in_shop ? "Appears in Shop" : "Hidden from Shop",
            icon: <Storefront className="h-4 w-4" weight="regular" />,
            isActive: item.in_shop ?? true,
            variant: "success",
            onClick: () => {},
          },
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
      <GenericItemPage<EditionData>
        isLoading={isLoading}
        title="Vanilla Editions"
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
