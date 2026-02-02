import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCard } from "@/components/pages/generic-item-card";
import { useProjectData, useModName } from "@/lib/storage";
import { DeckData } from "@/lib/types";
import {
  Cards,
  PencilSimple,
  Sparkle,
  DownloadSimple,
  Trash,
} from "@phosphor-icons/react";
import { formatBalatroText } from "@/lib/balatro-text-formatter";

export default function DecksPage() {
  const { data, updateDecks } = useProjectData();
  const modName = useModName();

  const handleUpdate = (id: string, updates: Partial<DeckData>) => {
    updateDecks(
      data.decks.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    );
  };

  const handleCreate = () => {
    const newDeck: DeckData = {
      id: crypto.randomUUID(),
      objectType: "deck",
      name: "New Deck",
      description: "Deck description",
      imagePreview: "",
      objectKey: "new_deck",
      unlocked: true,
      discovered: true,
      rules: [],
      orderValue: data.decks.length + 1,
    };
    updateDecks([...data.decks, newDeck]);
  };

  const handleDelete = (id: string) => {
    updateDecks(data.decks.filter((d) => d.id !== id));
  };

  return (
    <GenericItemPage<DeckData>
      title="Decks"
      subtitle={modName}
      items={data.decks}
      onAddNew={handleCreate}
      addNewLabel="Create Deck"
      searchProps={{
        searchFn: (item, term) => item.name.toLowerCase().includes(term),
      }}
      sortOptions={[
        {
          label: "ID Order",
          value: "orderValue",
          sortFn: (a, b) => a.orderValue - b.orderValue,
        },
        {
          label: "Name",
          value: "name",
          sortFn: (a, b) => a.name.localeCompare(b.name),
        },
      ]}
      renderCard={(deck) => (
        <GenericItemCard
          key={deck.id}
          name={deck.name}
          description={formatBalatroText(deck.description)}
          idValue={deck.orderValue}
          onUpdate={(updates) => handleUpdate(deck.id, updates)}
          image={
            deck.imagePreview ? (
              <img
                src={deck.imagePreview}
                className="w-full h-full object-contain [image-rendering:pixelated]"
              />
            ) : (
              <Cards className="h-20 w-20 text-muted-foreground/20" />
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
              id: "export",
              label: "Code",
              icon: <DownloadSimple className="h-4 w-4" />,
              onClick: () => {},
            },
            {
              id: "delete",
              label: "Delete",
              icon: <Trash className="h-4 w-4" />,
              variant: "destructive",
              onClick: () => handleDelete(deck.id),
            },
          ]}
        />
      )}
    />
  );
}
