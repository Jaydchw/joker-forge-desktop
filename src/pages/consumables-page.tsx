import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCard } from "@/components/pages/generic-item-card";
import { useProjectData, useModName } from "@/lib/storage";
import { ConsumableData } from "@/lib/types";
import { Flask, PencilSimple, Sparkle, Trash } from "@phosphor-icons/react";
import { formatBalatroText } from "@/lib/balatro-text-formatter";
import { Badge } from "@/components/ui/badge";

export default function ConsumablesPage() {
  const { data, updateConsumables } = useProjectData();
  const modName = useModName();

  const handleUpdate = (id: string, updates: Partial<ConsumableData>) => {
    updateConsumables(
      data.consumables.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    );
  };

  const handleCreate = () => {
    const newConsumable: ConsumableData = {
      id: crypto.randomUUID(),
      objectType: "consumable",
      name: "New Tarot",
      description: "Effect",
      image: "",
      orderValue: data.consumables.length + 1,
      set: "Tarot",
      cost: 3,
      unlocked: true,
      discovered: true,
      rules: [],
      objectKey: "new_tarot",
    };
    updateConsumables([...data.consumables, newConsumable]);
  };

  const handleDelete = (id: string) =>
    updateConsumables(data.consumables.filter((c) => c.id !== id));

  return (
    <GenericItemPage<ConsumableData>
      title="Consumables"
      subtitle={modName}
      items={data.consumables}
      onAddNew={handleCreate}
      addNewLabel="Create Consumable"
      searchProps={{
        searchFn: (item, term) => item.name.toLowerCase().includes(term),
      }}
      sortOptions={[
        {
          label: "Set",
          value: "set",
          sortFn: (a, b) => a.set.localeCompare(b.set),
        },
        {
          label: "Name",
          value: "name",
          sortFn: (a, b) => a.name.localeCompare(b.name),
        },
      ]}
      filterOptions={[
        {
          id: "set",
          label: "Type",
          options: [
            { label: "Tarot", value: "Tarot" },
            { label: "Planet", value: "Planet" },
            { label: "Spectral", value: "Spectral" },
          ],
          predicate: (item, val) => item.set === val,
        },
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
            item.image ? (
              <img
                src={item.image}
                className="w-full h-full object-contain [image-rendering:pixelated]"
              />
            ) : (
              <Flask className="h-20 w-20 text-muted-foreground/20" />
            )
          }
          badges={
            <Badge
              variant="secondary"
              className="font-bold uppercase tracking-wider"
            >
              {item.set}
            </Badge>
          }
          actions={[
            {
              id: "edit",
              label: "Edit",
              icon: <PencilSimple className="h-4 w-4" />,
              onClick: () => {},
            },
            {
              id: "rules",
              label: "Rules",
              icon: <Sparkle className="h-4 w-4" />,
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
