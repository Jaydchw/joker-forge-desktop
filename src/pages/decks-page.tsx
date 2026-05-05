import { useState, useCallback, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCard } from "@/components/pages/generic-item-card";
import { GenericItemCardCompact } from "@/components/pages/generic-item-card-compact";
import {
  useProjectData,
  useModName,
  getAutoOpenNewItemDialogEnabled,
} from "@/lib/storage";
import { DeckData, Rule } from "@/lib/types";
import {
  PencilSimple,
  Sparkle,
  Trash,
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
  DownloadSimple,
  BookmarksSimple,
} from "@phosphor-icons/react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { BalatroCard } from "@/components/balatro/balatro-card";
import { getRandomPlaceholder } from "@/lib/placeholder-assets.ts";
import { PlaceholderPickerDialog } from "@/components/pages/placeholder-picker-dialog";
import { RuleBuilder } from "@/components/rule-builder";
import { ItemShowcaseDialog } from "@/components/pages/item-showcase-dialog";
import { applyItemUpdatesWithOrderSwap } from "@/lib/item-order";
import { exportSingleItemRust } from "@/lib/rust-codegen-export";
import { collectGlobalVariables } from "@/lib/global-user-variables";
import {
  instantiateItemFromTemplate,
  useTemplateStore,
  type ItemTemplateEntry,
} from "@/lib/templates";
import { TemplatePickerDialog } from "@/components/templates/template-picker-dialog";
import { pushGlobalAlert } from "@/lib/global-alerts-bus";
import { EditDeckDialog } from "@/components/edit-dialogs";

export default function DecksPage() {
  const { data, updateDecks, isHydrating } = useProjectData();
  const modName = useModName();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editingItem, setEditingItem] = useState<DeckData | null>(null);
  const [ruleEditingItem, setRuleEditingItem] = useState<DeckData | null>(null);
  const [showcaseItem, setShowcaseItem] = useState<DeckData | null>(null);
  const [isPlaceholderPickerOpen, setIsPlaceholderPickerOpen] = useState(false);
  const [placeholderTargetId, setPlaceholderTargetId] = useState<string | null>(
    null,
  );
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const { createItemTemplate, getItemTemplatesForType } = useTemplateStore();
  const deckTemplates = useMemo(
    () => getItemTemplatesForType("deck"),
    [getItemTemplatesForType],
  );

  const handleUpdate = useCallback(
    (id: string, updates: Partial<DeckData>) =>
      updateDecks(applyItemUpdatesWithOrderSwap(data.decks, id, updates)),
    [data.decks, updateDecks],
  );

  const handleInfoSave = useCallback(
    (id: string, updates: Partial<DeckData>) => {
      handleUpdate(id, updates);
    },
    [handleUpdate],
  );

  const handleRulesSave = useCallback(
    (rules: Rule[]) => {
      if (!ruleEditingItem) return;
      handleUpdate(ruleEditingItem.id, { rules });
    },
    [handleUpdate, ruleEditingItem],
  );

  useEffect(() => {
    const activityItemId = searchParams.get("activityItemId");
    const activityEditor = searchParams.get("activityEditor");
    if (!activityItemId || !activityEditor) return;

    const target = data.decks.find((item) => item.id === activityItemId);
    if (!target) return;

    if (activityEditor === "rules") {
      setEditingItem(null);
      setRuleEditingItem(target);
    } else {
      setRuleEditingItem(null);
      setEditingItem(target);
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("activityItemId");
    nextParams.delete("activityEditor");
    setSearchParams(nextParams, { replace: true });
  }, [data.decks, searchParams, setSearchParams]);

  const createBaseDeck = useCallback(async (): Promise<DeckData> => {
    const placeholder = await getRandomPlaceholder("deck");
    return {
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
  }, [data.decks.length]);

  const handleCreate = useCallback(async () => {
    const newDeck = await createBaseDeck();
    updateDecks([...data.decks, newDeck]);
    if (getAutoOpenNewItemDialogEnabled()) {
      setEditingItem(newDeck);
    }
  }, [createBaseDeck, data.decks, updateDecks]);

  const handleCreateFromTemplate = useCallback(
    async (template: ItemTemplateEntry) => {
      const baseDeck = await createBaseDeck();
      const templatedDeck = instantiateItemFromTemplate(baseDeck, template);
      updateDecks([...data.decks, templatedDeck]);
      if (getAutoOpenNewItemDialogEnabled()) {
        setEditingItem(templatedDeck);
      }
      pushGlobalAlert({
        type: "success",
        title: "Template Applied",
        message: `Created Deck from \"${template.name}\".`,
      });
    },
    [createBaseDeck, data.decks, updateDecks],
  );

  const handleDelete = useCallback(
    (id: string) => updateDecks(data.decks.filter((d) => d.id !== id)),
    [data.decks, updateDecks],
  );

  const handleExport = useCallback(
    async (item: DeckData) => {
      try {
        await exportSingleItemRust(item as any, "deck", data.metadata.prefix, {
          globalUserVariables: collectGlobalVariables(data).map(
            (entry) => entry.variable,
          ),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        window.alert(`Deck export failed: ${message}`);
      }
    },
    [data],
  );

  const {
    isDialogOpen: isDeleteDialogOpen,
    pendingLabel: pendingDeleteLabel,
    requestDelete,
    confirmDelete,
    handleOpenChange: handleDeleteDialogChange,
  } = useConfirmDelete(handleDelete);

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

  const renderCard = useCallback(
    (deck: DeckData) => (
      <GenericItemCard
        key={deck.id}
        name={deck.name}
        description={deck.description}
        idValue={deck.orderValue}
        imageLayers={deck.imageLayers}
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
            id: "export",
            label: "Export Code",
            icon: <DownloadSimple className="h-4 w-4" weight="regular" />,
            onClick: () => handleExport(deck),
          },
          {
            id: "saveTemplate",
            label: "Save as Template",
            icon: <BookmarksSimple className="h-4 w-4" weight="regular" />,
            onClick: () => {
              createItemTemplate({
                name: `${deck.name} Template`,
                itemType: "deck",
                payload: deck as unknown as Record<string, unknown>,
              });
              pushGlobalAlert({
                type: "success",
                title: "Template Saved",
                message: `Saved \"${deck.name}\" as a template.`,
              });
            },
          },
          {
            id: "duplicate",
            label: "Duplicate",
            icon: <Copy className="h-5 w-5" weight="regular" />,
            onClick: () => {},
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
    [createItemTemplate, handleUpdate, requestDelete, handleExport],
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
            id: "export",
            label: "Export Code",
            icon: <DownloadSimple weight="regular" />,
            onClick: () => handleExport(deck),
            variant: "ghost",
          },
          {
            id: "saveTemplate",
            label: "Save as Template",
            icon: <BookmarksSimple weight="regular" />,
            onClick: () => {
              createItemTemplate({
                name: `${deck.name} Template`,
                itemType: "deck",
                payload: deck as unknown as Record<string, unknown>,
              });
              pushGlobalAlert({
                type: "success",
                title: "Template Saved",
                message: `Saved \"${deck.name}\" as a template.`,
              });
            },
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
    [createItemTemplate, requestDelete, handleExport, data.decks, updateDecks],
  );

  return (
    <>
      <GenericItemPage<DeckData>
        title="Decks"
        subtitle={modName}
        items={data.decks}
        isLoading={isHydrating}
        onAddNew={handleCreate}
        onAddFromTemplate={
          deckTemplates.length > 0
            ? () => setIsTemplatePickerOpen(true)
            : undefined
        }
        addNewLabel="Create Deck"
        addFromTemplateLabel="Create Deck from Template"
        searchProps={searchProps}
        sortOptions={sortOptions}
        renderCard={renderCard}
        renderCompactCard={renderCompactCard}
      />
      <TemplatePickerDialog
        open={isTemplatePickerOpen}
        onOpenChange={setIsTemplatePickerOpen}
        title="Create Deck from Template"
        description="Select a Deck template to start from."
        templates={deckTemplates}
        onUseTemplate={(template) =>
          handleCreateFromTemplate(template as ItemTemplateEntry)
        }
      />
      <EditDeckDialog
        editingItem={editingItem}
        setEditingItem={setEditingItem}
        onSave={handleInfoSave}
      />
      {ruleEditingItem && (
        <RuleBuilder
          isOpen={true}
          onClose={() => setRuleEditingItem(null)}
          existingRules={ruleEditingItem.rules ?? []}
          onSave={handleRulesSave}
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
