import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCard } from "@/components/pages/generic-item-card";
import { useProjectData } from "@/lib/storage";
import { useVanillaReforgedData } from "@/lib/vanilla-reforged";
import { BoosterData } from "@/lib/types";
import { slugify } from "@/lib/balatro-utils";
import { Copy, Eye, EyeSlash, Lock, LockOpen } from "@phosphor-icons/react";

export default function VanillaReforgedBoostersPage() {
  const navigate = useNavigate();
  const { data: reforged, isLoading, error } = useVanillaReforgedData();
  const { data, updateBoosters } = useProjectData();

  const items = reforged?.boosters ?? [];
  const subtitle = reforged?.metadata?.display_name || "Vanilla Reforged";

  const handleCopy = useCallback(
    (item: BoosterData) => {
      const baseKey = item.objectKey || slugify(item.name);
      const duplicated: BoosterData = {
        ...item,
        id: crypto.randomUUID(),
        name: `${item.name} (Copy)`,
        objectKey: `${baseKey}_copy`,
        orderValue: data.boosters.length + 1,
      };
      updateBoosters([...data.boosters, duplicated]);
      navigate("/boosters");
    },
    [data.boosters, navigate, updateBoosters],
  );

  const searchProps = useMemo(
    () => ({
      placeholder: "Search vanilla boosters...",
      searchFn: (item: BoosterData, term: string) =>
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
        sortFn: (a: BoosterData, b: BoosterData) => a.orderValue - b.orderValue,
      },
      {
        label: "Name",
        value: "name",
        sortFn: (a: BoosterData, b: BoosterData) =>
          a.name.localeCompare(b.name),
      },
      {
        label: "Cost",
        value: "cost",
        sortFn: (a: BoosterData, b: BoosterData) =>
          (a.cost || 0) - (b.cost || 0),
      },
    ],
    [],
  );

  const renderCard = useCallback(
    (item: BoosterData) => (
      <GenericItemCard
        key={item.id}
        reforged
        name={item.name}
        description={item.description}
        cost={item.cost}
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
    <GenericItemPage<BoosterData>
      isLoading={isLoading}
      title="Vanilla Booster Packs"
      subtitle={subtitle}
      items={items}
      searchProps={searchProps}
      sortOptions={sortOptions}
      renderCard={renderCard}
      reforged
    />
  );
}
