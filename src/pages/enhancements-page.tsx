import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCard } from "@/components/pages/generic-item-card";
import { useProjectData, useModName } from "@/lib/storage";
import { EnhancementData } from "@/lib/types";
import { Star, PencilSimple, Sparkle, Trash } from "@phosphor-icons/react";
import { formatBalatroText } from "@/lib/balatro-text-formatter";

export default function EnhancementsPage() {
  const { data, updateEnhancements } = useProjectData();
  const modName = useModName();

  const handleUpdate = (id: string, updates: Partial<EnhancementData>) => {
    updateEnhancements(
      data.enhancements.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    );
  };

  const handleCreate = () => {
    const newEnhancement: EnhancementData = {
      id: crypto.randomUUID(),
      objectType: "enhancement",
      name: "New Enhancement",
      description: "Effect",
      image: "",
      objectKey: "new_enhancement",
      unlocked: true,
      discovered: true,
      rules: [],
      weight: 5,
      orderValue: data.enhancements.length + 1,
    };
    updateEnhancements([...data.enhancements, newEnhancement]);
  };

  const handleDelete = (id: string) =>
    updateEnhancements(data.enhancements.filter((e) => e.id !== id));

  return (
    <GenericItemPage<EnhancementData>
      title="Enhancements"
      subtitle={modName}
      items={data.enhancements}
      onAddNew={handleCreate}
      addNewLabel="Create Enhancement"
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
            item.image ? (
              <img
                src={item.image}
                className="w-full h-full object-contain [image-rendering:pixelated]"
              />
            ) : (
              <Star className="h-20 w-20 text-muted-foreground/20" />
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
