import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCard } from "@/components/pages/generic-item-card";
import { useProjectData, useModName } from "@/lib/storage";
import { SoundData } from "@/lib/types";
import { SpeakerHigh, PencilSimple, Trash } from "@phosphor-icons/react";

export default function SoundsPage() {
  const { data, updateSounds } = useProjectData();
  const modName = useModName();

  const handleUpdate = (id: string, updates: Partial<SoundData>) => {
    updateSounds(
      data.sounds.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    );
  };

  const handleCreate = () => {
    const newSound: SoundData = {
      id: crypto.randomUUID(),
      key: "new_sound",
      soundString: "sound_data",
      volume: 1,
      pitch: 1,
    };
    updateSounds([...data.sounds, newSound]);
  };

  const handleDelete = (id: string) =>
    updateSounds(data.sounds.filter((s) => s.id !== id));

  return (
    <GenericItemPage<SoundData>
      title="Sounds"
      subtitle={modName}
      items={data.sounds}
      onAddNew={handleCreate}
      addNewLabel="Create Sound"
      searchProps={{
        searchFn: (item, term) => item.key.toLowerCase().includes(term),
      }}
      sortOptions={[
        {
          label: "Key",
          value: "key",
          sortFn: (a, b) => a.key.localeCompare(b.key),
        },
      ]}
      renderCard={(item) => (
        <GenericItemCard
          key={item.id}
          name={item.key}
          description={`Volume: ${item.volume} | Pitch: ${item.pitch}`}
          onUpdate={(updates) => handleUpdate(item.id, { key: updates.name })}
          image={<SpeakerHigh className="h-20 w-20 text-muted-foreground/20" />}
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
