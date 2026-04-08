import { useState, useCallback, useMemo } from "react";
import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCard } from "@/components/pages/generic-item-card";
import { GenericItemCardCompact } from "@/components/pages/generic-item-card-compact";
import { useProjectData, useModName } from "@/lib/storage";
import { DeckData, Rule } from "@/lib/types";
import {
  PencilSimple,
  Sparkle,
  Trash,
  Image as ImageIcon,
  TextT,
  Gear,
  LockOpen,
  Lock,
  Eye,
  Copy,
  EyeSlash,
  Prohibit,
  CurrencyDollar,
  Smiley,
  SmileySad,
  Shuffle,
  VideoCamera,
} from "@phosphor-icons/react";
import {
  GenericItemDialog,
  DialogTab,
} from "@/components/pages/generic-item-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { BalatroCard } from "@/components/balatro/balatro-card";
import { Input } from "@/components/ui/input";
import { getRandomPlaceholder } from "@/lib/placeholder-assets.ts";
import { PlaceholderPickerDialog } from "@/components/pages/placeholder-picker-dialog";
import { RuleBuilder } from "@/components/rule-builder";
import { processBalatroCardImage } from "@/lib/media/image-processing-utils";
import { ItemShowcaseDialog } from "@/components/pages/item-showcase-dialog";

export default function DecksPage() {
  const { data, updateDecks, isHydrating } = useProjectData();
  const modName = useModName();
  const [editingItem, setEditingItem] = useState<DeckData | null>(null);
  const [ruleEditingItem, setRuleEditingItem] = useState<DeckData | null>(null);
  const [showcaseItem, setShowcaseItem] = useState<DeckData | null>(null);
  const [isPlaceholderPickerOpen, setIsPlaceholderPickerOpen] = useState(false);
  const [placeholderTargetId, setPlaceholderTargetId] = useState<string | null>(
    null,
  );

  const processDeckImage = processBalatroCardImage;

  const handleUpdate = useCallback(
    (id: string, updates: Partial<DeckData>) => {
      updateDecks(
        data.decks.map((d) => (d.id === id ? { ...d, ...updates } : d)),
      );
    },
    [data.decks, updateDecks],
  );

  const handleCreate = useCallback(async () => {
    const placeholder = await getRandomPlaceholder("deck");
    const newDeck: DeckData = {
      id: crypto.randomUUID(),
      objectType: "deck",
      name: "New Deck",
      description: "Deck description",
      image: placeholder?.src || "",
      placeholderCreditIndex: placeholder?.index,
      placeholderCategory: placeholder?.category,
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

  const {
    isDialogOpen: isDeleteDialogOpen,
    pendingLabel: pendingDeleteLabel,
    requestDelete,
    confirmDelete,
    handleOpenChange: handleDeleteDialogChange,
  } = useConfirmDelete(handleDelete);

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
        description={deck.description}
        idValue={deck.orderValue}
        onUpdate={(updates) => handleUpdate(deck.id, updates)}
        onDuplicate={() => {
          const duplicatedItem: DeckData = {
            ...deck,
            id: crypto.randomUUID(),
            name: `${deck.name} (Copy)`,
            objectKey: `${deck.objectKey}_copy`,
            orderValue: data.decks.length + 1,
          };
          updateDecks([...data.decks, duplicatedItem]);
        }}
        image={
          deck.image ? (
            <img
              src={deck.image}
              className="w-full h-full object-contain [image-rendering:pixelated]"
            />
          ) : (
            <div className="text-muted-foreground/30 text-xs font-bold uppercase tracking-widest border-2 border-dashed border-border p-4 rounded-lg">
              No Image
            </div>
          )
        }
        showPlaceholderPickerButton
        onOpenPlaceholderPicker={() => {
          setPlaceholderTargetId(deck.id);
          setIsPlaceholderPickerOpen(true);
        }}
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
            onClick: () => {
              setEditingItem(null);
              setRuleEditingItem(deck);
            },
          },
          {
            id: "showcase",
            label: "Showcase",
            icon: <VideoCamera className="h-4 w-4" />,
            onClick: () => setShowcaseItem(deck),
          },
          {
            id: "duplicate",
            label: "Duplicate",
            icon: <Copy className="h-5 w-5" weight="regular" />,
            onClick: () => { },
            variant: "ghost",
          },
          {
            id: "delete",
            label: "Delete",
            icon: <Trash className="h-4 w-4" />,
            variant: "destructive",
            onClick: () => requestDelete(deck.id, deck.name),
          },
        ]}
      />
    ),
    [handleUpdate, requestDelete],
  );

const renderCompactCard = useCallback(
    (deck: DeckData) => (
      <GenericItemCardCompact
        name={deck.name}
        overlayImage={deck.overlayImage}
        image={
          deck.image ? (
            <img
              src={deck.image}
              className="w-full h-full object-contain [image-rendering:pixelated]"
              alt={deck.name}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground/30 text-xs font-bold uppercase tracking-widest border-2 border-dashed border-border/30 rounded-xl m-2">
              No Image
            </div>
          )
        }
        actions={[
          {
            id: "edit",
            label: "Edit Info",
            icon: <PencilSimple weight="bold" />,
            onClick: () => setEditingItem(deck),
            variant: "secondary",
          },
          {
            id: "rules",
            label: "Edit Rules",
            icon: <Sparkle weight="bold" />,
            onClick: () => {
              setEditingItem(null);
              setRuleEditingItem(deck);
            },
            variant: "outline",
          },
          {
            id: "showcase",
            label: "Showcase",
            icon: <VideoCamera weight="regular" />,
            onClick: () => setShowcaseItem(deck),
            variant: "ghost",
          },
          {
            id: "duplicate",
            label: "Duplicate",
            icon: <Copy weight="regular" />,
            onClick: () => {
              const duplicatedDeck: DeckData = {
                ...deck,
                id: crypto.randomUUID(),
                name: `${deck.name} (Copy)`,
                objectKey: `${deck.objectKey}_copy`,
                orderValue: data.decks.length + 1,
              };
              updateDecks([...data.decks, duplicatedDeck]);
            },
            variant: "ghost",
          },
          {
            id: "delete",
            label: "Delete",
            icon: <Trash weight="bold" />,
            variant: "destructive",
            onClick: () => requestDelete(deck.id, deck.name),
          },
        ]}
      />
    ),
    [requestDelete, data.decks, updateDecks],
  );

  return (
    <>
      <GenericItemPage<DeckData>
        title="Decks"
        subtitle={modName}
        items={data.decks}
        isLoading={isHydrating}
        onAddNew={handleCreate}
        addNewLabel="Create Deck"
        searchProps={searchProps}
        sortOptions={sortOptions}
        renderCard={renderCard}
        renderCompactCard={renderCompactCard}
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
        showPlaceholderPicker
        placeholderCategory="deck"
      />
      {ruleEditingItem && (
        <RuleBuilder
          isOpen={true}
          onClose={() => setRuleEditingItem(null)}
          existingRules={ruleEditingItem.rules ?? []}
          onSave={(rules: Rule[]) =>
            handleUpdate(ruleEditingItem.id, {
              rules,
            })
          }
          item={ruleEditingItem}
          onUpdateItem={(updates: Partial<DeckData>) => {
            handleUpdate(ruleEditingItem.id, updates as Partial<DeckData>);
            setRuleEditingItem((prev) =>
              prev ? { ...prev, ...(updates as Partial<DeckData>) } : prev,
            );
          }}
          itemType="deck"
        />
      )}
      <PlaceholderPickerDialog
        open={isPlaceholderPickerOpen}
        onOpenChange={setIsPlaceholderPickerOpen}
        initialCategory="deck"
        onSelect={(entry) => {
          if (!placeholderTargetId) return;
          handleUpdate(placeholderTargetId, {
            image: entry.src,
            placeholderCreditIndex: entry.index,
            placeholderCategory: entry.category,
          });
        }}
      />
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleDeleteDialogChange}
        title="Delete this deck?"
        description={
          <span>
            You are about to delete{" "}
            <span className="font-semibold text-foreground">
              {pendingDeleteLabel || "this deck"}
            </span>
            . This action cannot be undone.
          </span>
        }
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={confirmDelete}
      />

      <ItemShowcaseDialog
        open={!!showcaseItem}
        title={showcaseItem?.name || "Deck"}
        fileNameBase={showcaseItem?.name || "deck"}
        onOpenChange={(open) => {
          if (!open) {
            setShowcaseItem(null);
          }
        }}
      >
        {showcaseItem && (
          <BalatroCard type="deck" data={showcaseItem} size="lg" />
        )}
      </ItemShowcaseDialog>
    </>
  );
}
