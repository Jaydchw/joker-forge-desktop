import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCard } from "@/components/pages/generic-item-card";
import { useProjectData, useModName } from "@/lib/storage";
import { BoosterData } from "@/lib/types";
import { Package, PencilSimple, Trash } from "@phosphor-icons/react";
import { formatBalatroText } from "@/lib/balatro-text-formatter";

export default function BoostersPage() {
  const { data, updateBoosters } = useProjectData();
  const modName = useModName();

  const handleUpdate = (id: string, updates: Partial<BoosterData>) => {
    updateBoosters(
      data.boosters.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    );
  };

  const handleCreate = () => {
    const newBooster: BoosterData = {
      id: crypto.randomUUID(),
      objectType: "booster",
      name: "Standard Pack",
      description: "Choose 1 of 3",
      orderValue: data.boosters.length + 1,
      imagePreview: "",
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
  };

  const handleDelete = (id: string) =>
    updateBoosters(data.boosters.filter((b) => b.id !== id));

  return (
    <GenericItemPage<BoosterData>
      title="Boosters"
      subtitle={modName}
      items={data.boosters}
      onAddNew={handleCreate}
      addNewLabel="Create Pack"
      searchProps={{
        searchFn: (item, term) => item.name.toLowerCase().includes(term),
      }}
      sortOptions={[
        {
          label: "Name",
          value: "name",
          sortFn: (a, b) => a.name.localeCompare(b.name),
        },
        { label: "Cost", value: "cost", sortFn: (a, b) => a.cost - b.cost },
      ]}
      renderCard={(item) => (
        <GenericItemCard
          key={item.id}
          name={item.name}
          description={formatBalatroText(item.description)}
          cost={item.cost}
          idValue={item.orderValue}
          onUpdate={(updates) => handleUpdate(item.id, updates)}
          image={
            item.imagePreview ? (
              <img
                src={item.imagePreview}
                className="w-full h-full object-contain [image-rendering:pixelated]"
              />
            ) : (
              <Package className="h-20 w-20 text-muted-foreground/20" />
            )
          }
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
      )}
    />
  );
}
