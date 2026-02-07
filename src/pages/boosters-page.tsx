import { useCallback, useMemo } from "react";
import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCard } from "@/components/pages/generic-item-card";
import { useProjectData, useModName } from "@/lib/storage";
import { BoosterData } from "@/lib/types";
import {
  Package,
  PencilSimple,
  Trash,
  Eye,
  EyeSlash,
  Hand,
  Play,
} from "@phosphor-icons/react";
import { formatBalatroText } from "@/lib/balatro-text-formatter";

export default function BoostersPage() {
  const { data, updateBoosters } = useProjectData();
  const modName = useModName();

  const handleUpdate = useCallback(
    (id: string, updates: Partial<BoosterData>) => {
      updateBoosters(
        data.boosters.map((b) => (b.id === id ? { ...b, ...updates } : b)),
      );
    },
    [data.boosters, updateBoosters],
  );

  const handleCreate = useCallback(() => {
    const newBooster: BoosterData = {
      id: crypto.randomUUID(),
      objectType: "booster",
      name: "Standard Pack",
      description: "Choose 1 of 3",
      orderValue: data.boosters.length + 1,
      image: "",
      cost: 4,
      weight: 1,
      draw_hand: true,
      instant_use: false,
      booster_type: "joker",
      config: { extra: 3, choose: 1 },
      card_rules: [],
      discovered: true,
      unlocked: true,
      objectKey: "new_pack",
    };
    updateBoosters([...data.boosters, newBooster]);
  }, [data.boosters, updateBoosters]);

  const handleDelete = useCallback(
    (id: string) => updateBoosters(data.boosters.filter((b) => b.id !== id)),
    [data.boosters, updateBoosters],
  );

  const searchProps = useMemo(
    () => ({
      searchFn: (item: BoosterData, term: string) =>
        item.name.toLowerCase().includes(term),
    }),
    [],
  );

  const sortOptions = useMemo(
    () => [
      {
        label: "Name",
        value: "name",
        sortFn: (a: BoosterData, b: BoosterData) =>
          a.name.localeCompare(b.name),
      },
      {
        label: "Cost",
        value: "cost",
        sortFn: (a: BoosterData, b: BoosterData) => a.cost - b.cost,
      },
    ],
    [],
  );

  const renderCard = useCallback(
    (item: BoosterData) => (
      <GenericItemCard
        key={item.id}
        name={item.name}
        description={formatBalatroText(item.description)}
        cost={item.cost}
        idValue={item.orderValue}
        onUpdate={(updates) => handleUpdate(item.id, updates)}
        image={
          item.image ? (
            <img
              src={item.image}
              className="w-full h-full object-contain [image-rendering:pixelated]"
            />
          ) : (
            <Package className="h-20 w-20 text-muted-foreground/20" />
          )
        }
        properties={[
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
            onClick: () =>
              handleUpdate(item.id, { discovered: !item.discovered }),
          },
          {
            id: "draw_hand",
            label: item.draw_hand ? "Draws to Hand" : "Opens Normally",
            icon: <Hand className="h-4 w-4" weight="regular" />,
            isActive: item.draw_hand === true,
            variant: "success",
            onClick: () =>
              handleUpdate(item.id, { draw_hand: !item.draw_hand }),
          },
          {
            id: "instant_use",
            label: item.instant_use ? "Instant Use" : "Adds to Hand",
            icon: <Play className="h-4 w-4" weight="regular" />,
            isActive: item.instant_use === true,
            variant: "success",
            onClick: () =>
              handleUpdate(item.id, { instant_use: !item.instant_use }),
          },
        ]}
        actions={[
          {
            id: "edit",
            label: "Edit",
            icon: <PencilSimple className="h-4 w-4" />,
            onClick: () => {},
          },
          {
            id: "delete",
            label: "Delete",
            icon: <Trash className="h-4 w-4" />,
            variant: "destructive",
            onClick: () => handleDelete(item.id),
          },
        ]}
      />
    ),
    [handleUpdate, handleDelete],
  );

  return (
    <GenericItemPage<BoosterData>
      title="Boosters"
      subtitle={modName}
      items={data.boosters}
      onAddNew={handleCreate}
      addNewLabel="Create Pack"
      searchProps={searchProps}
      sortOptions={sortOptions}
      renderCard={renderCard}
    />
  );
}
