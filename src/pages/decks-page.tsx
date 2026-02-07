import { useState, useCallback, useMemo } from "react";
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
  Image as ImageIcon,
  TextT,
  Gear,
  LockOpen,
  Lock,
  Eye,
  EyeSlash,
  Prohibit,
  CurrencyDollar,
  Smiley,
  SmileySad,
  Shuffle,
} from "@phosphor-icons/react";
import { formatBalatroText } from "@/lib/balatro-text-formatter";
import {
  GenericItemDialog,
  DialogTab,
} from "@/components/pages/generic-item-dialog";
import { BalatroCard } from "@/components/balatro/balatro-card";
import { Input } from "@/components/ui/input";

export default function DecksPage() {
  const { data, updateDecks } = useProjectData();
  const modName = useModName();
  const [editingItem, setEditingItem] = useState<DeckData | null>(null);

  const processDeckImage = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          if (img.width === 71 && img.height === 95) {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            canvas.width = 142;
            canvas.height = 190;
            if (ctx) {
              ctx.imageSmoothingEnabled = false;
              ctx.drawImage(img, 0, 0, 142, 190);
              resolve(canvas.toDataURL("image/png"));
            } else {
              reject(new Error("Canvas context failed"));
            }
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  const handleUpdate = useCallback(
    (id: string, updates: Partial<DeckData>) => {
      updateDecks(
        data.decks.map((d) => (d.id === id ? { ...d, ...updates } : d)),
      );
    },
    [data.decks, updateDecks],
  );

  const handleCreate = useCallback(() => {
    const newDeck: DeckData = {
      id: crypto.randomUUID(),
      objectType: "deck",
      name: "New Deck",
      description: "Deck description",
      image: "",
      objectKey: "new_deck",
      unlocked: true,
      discovered: true,
      rules: [],
      orderValue: data.decks.length + 1,
    };
    updateDecks([...data.decks, newDeck]);
  }, [data.decks, updateDecks]);

  const handleDelete = useCallback(
    (id: string) => updateDecks(data.decks.filter((d) => d.id !== id)),
    [data.decks, updateDecks],
  );

  const deckDialogTabs: DialogTab<DeckData>[] = useMemo(
    () => [
      {
        id: "visual",
        label: "Visual & Data",
        icon: ImageIcon,
        groups: [
          {
            id: "assets",
            label: "Assets",
            className: "grid grid-cols-2 gap-6",
            fields: [
              {
                id: "image",
                type: "image",
                label: "Main Sprite",
                description: "71x95px (auto-upscaled) or 142x190px",
                processFile: processDeckImage,
              },
            ],
          },
          {
            id: "data",
            label: "Basic Data",
            className: "grid grid-cols-2 gap-6",
            fields: [
              {
                id: "name",
                type: "text",
                label: "Name",
                placeholder: "Deck Name",
                className: "col-span-2",
                validate: (val) => (!val ? "Name is required" : null),
              },
              {
                id: "objectKey",
                type: "text",
                label: "Object Key",
                placeholder: "b_deck",
                className: "col-span-2",
              },
            ],
          },
          {
            id: "properties",
            label: "Properties",
            className: "grid grid-cols-2 gap-6",
            fields: [
              {
                id: "unlocked",
                type: "switch",
                label: "Unlocked by Default",
              },
              {
                id: "discovered",
                type: "switch",
                label: "Discovered by Default",
              },
              {
                id: "no_collection",
                type: "switch",
                label: "Hidden from Collection",
              },
              {
                id: "no_interest",
                type: "switch",
                label: "No Interest",
              },
              {
                id: "no_faces",
                type: "switch",
                label: "No Face Cards",
              },
              {
                id: "erratic_deck",
                type: "switch",
                label: "Erratic Deck",
              },
            ],
          },
        ],
      },
      {
        id: "description",
        label: "Description",
        icon: TextT,
        groups: [
          {
            id: "desc",
            fields: [
              {
                id: "description",
                type: "rich-textarea",
                label: "Description",
                validate: (val) => (!val ? "Description is required" : null),
              },
            ],
          },
        ],
      },
      {
        id: "advanced",
        label: "Advanced",
        icon: Gear,
        groups: [
          {
            id: "starting",
            label: "Starting Items",
            fields: [
              {
                id: "Config_vouchers",
                type: "custom",
                label: "Starting Vouchers",
                render: (value, onChange) => (
                  <div className="space-y-2">
                    <Input
                      value={Array.isArray(value) ? value.join(", ") : ""}
                      onChange={(e) =>
                        onChange(
                          e.target.value
                            .split(",")
                            .map((s: string) => s.trim())
                            .filter(Boolean),
                        )
                      }
                      placeholder="v_overstock_norm, v_paint_brush..."
                    />
                  </div>
                ),
              },
              {
                id: "Config_consumables",
                type: "custom",
                label: "Starting Consumables",
                render: (value, onChange) => (
                  <div className="space-y-2">
                    <Input
                      value={Array.isArray(value) ? value.join(", ") : ""}
                      onChange={(e) =>
                        onChange(
                          e.target.value
                            .split(",")
                            .map((s: string) => s.trim())
                            .filter(Boolean),
                        )
                      }
                      placeholder="c_fool, c_death..."
                    />
                  </div>
                ),
              },
            ],
          },
        ],
      },
    ],
    [processDeckImage],
  );

  const searchProps = useMemo(
    () => ({
      searchFn: (item: DeckData, term: string) =>
        item.name.toLowerCase().includes(term),
    }),
    [],
  );

  const sortOptions = useMemo(
    () => [
      {
        label: "ID Order",
        value: "orderValue",
        sortFn: (a: DeckData, b: DeckData) => a.orderValue - b.orderValue,
      },
      {
        label: "Name",
        value: "name",
        sortFn: (a: DeckData, b: DeckData) => a.name.localeCompare(b.name),
      },
    ],
    [],
  );

  const renderPreview = useCallback(
    (item: DeckData | null) => (
      <BalatroCard type="deck" data={item || {}} size="lg" />
    ),
    [],
  );

  const renderCard = useCallback(
    (deck: DeckData) => (
      <GenericItemCard
        key={deck.id}
        name={deck.name}
        description={formatBalatroText(deck.description)}
        idValue={deck.orderValue}
        onUpdate={(updates) => handleUpdate(deck.id, updates)}
        image={
          deck.image ? (
            <img
              src={deck.image}
              className="w-full h-full object-contain [image-rendering:pixelated]"
            />
          ) : (
            <Cards className="h-20 w-20 text-muted-foreground/20" />
          )
        }
        properties={[
          {
            id: "unlocked",
            label: deck.unlocked ? "Unlocked" : "Locked",
            icon: deck.unlocked ? (
              <LockOpen className="h-4 w-4" weight="regular" />
            ) : (
              <Lock className="h-4 w-4" weight="regular" />
            ),
            isActive: deck.unlocked ?? true,
            variant: "warning",
            onClick: () => handleUpdate(deck.id, { unlocked: !deck.unlocked }),
          },
          {
            id: "discovered",
            label: deck.discovered ? "Discovered" : "Hidden",
            icon: deck.discovered ? (
              <Eye className="h-4 w-4" weight="regular" />
            ) : (
              <EyeSlash className="h-4 w-4" weight="regular" />
            ),
            isActive: deck.discovered ?? true,
            variant: "info",
            onClick: () =>
              handleUpdate(deck.id, { discovered: !deck.discovered }),
          },
          {
            id: "no_collection",
            label: deck.no_collection ? "Hidden Collection" : "In Collection",
            icon: <Prohibit className="h-4 w-4" weight="regular" />,
            isActive: deck.no_collection === true,
            variant: "default",
            onClick: () =>
              handleUpdate(deck.id, { no_collection: !deck.no_collection }),
          },
          {
            id: "no_interest",
            label: deck.no_interest ? "No Interest" : "Earns Interest",
            icon: <CurrencyDollar className="h-4 w-4" weight="regular" />,
            isActive: deck.no_interest === true,
            variant: "warning",
            onClick: () =>
              handleUpdate(deck.id, { no_interest: !deck.no_interest }),
          },
          {
            id: "no_faces",
            label: deck.no_faces ? "No Faces" : "Has Faces",
            icon: deck.no_faces ? (
              <SmileySad className="h-4 w-4" weight="regular" />
            ) : (
              <Smiley className="h-4 w-4" weight="regular" />
            ),
            isActive: deck.no_faces === true,
            variant: "warning",
            onClick: () => handleUpdate(deck.id, { no_faces: !deck.no_faces }),
          },
          {
            id: "erratic_deck",
            label: deck.erratic_deck ? "Erratic" : "Normal",
            icon: <Shuffle className="h-4 w-4" weight="regular" />,
            isActive: deck.erratic_deck === true,
            variant: "purple",
            onClick: () =>
              handleUpdate(deck.id, { erratic_deck: !deck.erratic_deck }),
          },
        ]}
        actions={[
          {
            id: "edit",
            label: "Edit",
            icon: <PencilSimple className="h-4 w-4" />,
            onClick: () => setEditingItem(deck),
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
    ),
    [handleUpdate, handleDelete],
  );

  return (
    <>
      <GenericItemPage<DeckData>
        title="Decks"
        subtitle={modName}
        items={data.decks}
        onAddNew={handleCreate}
        addNewLabel="Create Deck"
        searchProps={searchProps}
        sortOptions={sortOptions}
        renderCard={renderCard}
      />
      <GenericItemDialog
        open={!!editingItem}
        onOpenChange={(open) => !open && setEditingItem(null)}
        item={editingItem}
        title={`Edit ${editingItem?.name || "Deck"}`}
        description="Modify deck properties."
        tabs={deckDialogTabs}
        onSave={handleUpdate}
        renderPreview={renderPreview}
      />
    </>
  );
}
