import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCard } from "@/components/pages/generic-item-card";
import { useProjectData, useModName } from "@/lib/storage";
import { SealData } from "@/lib/types";
import { Stamp, PencilSimple, Sparkle, Trash } from "@phosphor-icons/react";
import { formatBalatroText } from "@/lib/balatro-text-formatter";

export default function SealsPage() {
  const { data, updateSeals } = useProjectData();
  const modName = useModName();

  const handleUpdate = (id: string, updates: Partial<SealData>) => {
    updateSeals(
      data.seals.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    );
  };

  const handleCreate = () => {
    const newSeal: SealData = {
      id: crypto.randomUUID(),
      objectType: "seal",
      name: "New Seal",
      description: "Effect",
      imagePreview: "",
      objectKey: "new_seal",
      badge_colour: "HEX",
      unlocked: true,
      discovered: true,
      rules: [],
      orderValue: data.seals.length + 1,
    };
    updateSeals([...data.seals, newSeal]);
  };

  const handleDelete = (id: string) =>
    updateSeals(data.seals.filter((s) => s.id !== id));

  return (
    <GenericItemPage<SealData>
      title="Seals"
      subtitle={modName}
      items={data.seals}
      onAddNew={handleCreate}
      addNewLabel="Create Seal"
      searchProps={{
        searchFn: (item, term) => item.name.toLowerCase().includes(term),
      }}
      sortOptions={[
        {
          label: "Name",
          value: "name",
          sortFn: (a, b) => a.name.localeCompare(b.name),
        },
      ]}
      renderCard={(item) => (
        <GenericItemCard
          key={item.id}
          name={item.name}
          description={formatBalatroText(item.description)}
          idValue={item.orderValue}
          onUpdate={(updates) => handleUpdate(item.id, updates)}
          image={
            item.imagePreview ? (
              <img
                src={item.imagePreview}
                className="w-full h-full object-contain [image-rendering:pixelated]"
              />
            ) : (
              <Stamp className="h-20 w-20 text-muted-foreground/20" />
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
