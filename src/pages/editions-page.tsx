import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCard } from "@/components/pages/generic-item-card";
import { useProjectData, useModName } from "@/lib/storage";
import { EditionData } from "@/lib/types";
import { Palette, PencilSimple, Sparkle, Trash } from "@phosphor-icons/react";
import { formatBalatroText } from "@/lib/balatro-text-formatter";

export default function EditionsPage() {
  const { data, updateEditions } = useProjectData();
  const modName = useModName();

  const handleUpdate = (id: string, updates: Partial<EditionData>) => {
    updateEditions(
      data.editions.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    );
  };

  const handleCreate = () => {
    const newEdition: EditionData = {
      id: crypto.randomUUID(),
      objectType: "edition",
      name: "New Edition",
      description: "Effect",
      objectKey: "new_edition",
      unlocked: true,
      discovered: true,
      rules: [],
      weight: 10,
      sound: "",
      orderValue: data.editions.length + 1,
      imagePreview: "",
    };
    updateEditions([...data.editions, newEdition]);
  };

  const handleDelete = (id: string) =>
    updateEditions(data.editions.filter((e) => e.id !== id));

  return (
    <GenericItemPage<EditionData>
      title="Editions"
      subtitle={modName}
      items={data.editions}
      onAddNew={handleCreate}
      addNewLabel="Create Edition"
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
          image={<Palette className="h-20 w-20 text-muted-foreground/20" />}
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
