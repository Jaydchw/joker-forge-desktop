import { useCallback, useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCard } from "@/components/pages/generic-item-card";
import { GenericItemCardCompact } from "@/components/pages/generic-item-card-compact";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import {
  useProjectData,
  useModName,
  getAutoOpenNewItemDialogEnabled,
} from "@/lib/storage";
import { BoosterData } from "@/lib/types";
import {
  PencilSimple,
  Trash,
  Eye,
  EyeSlash,
  Hand,
  Play,
  Copy,
  VideoCamera,
  BookmarksSimple,
} from "@phosphor-icons/react";
import { BalatroCard } from "@/components/balatro/balatro-card";
import { getRandomPlaceholder } from "@/lib/placeholder-assets.ts";
import { PlaceholderPickerDialog } from "@/components/pages/placeholder-picker-dialog";
import { ItemShowcaseDialog } from "@/components/pages/item-showcase-dialog";
import { applyItemUpdatesWithOrderSwap } from "@/lib/item-order";
import {
  instantiateItemFromTemplate,
  useTemplateStore,
  type ItemTemplateEntry,
} from "@/lib/templates";
import { TemplatePickerDialog } from "@/components/templates/template-picker-dialog";
import { pushGlobalAlert } from "@/lib/global-alerts-bus";
import { EditBoosterDialog } from "@/components/edit-dialogs";

export default function BoostersPage() {
  const { data, updateBoosters, isHydrating } = useProjectData();
  const modName = useModName();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editingItem, setEditingItem] = useState<BoosterData | null>(null);
  const [showcaseItem, setShowcaseItem] = useState<BoosterData | null>(null);
  const [isPlaceholderPickerOpen, setIsPlaceholderPickerOpen] = useState(false);
  const [placeholderTargetId, setPlaceholderTargetId] = useState<string | null>(
    null,
  );
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const { createItemTemplate, getItemTemplatesForType } = useTemplateStore();
  const boosterTemplates = useMemo(
    () => getItemTemplatesForType("booster"),
    [getItemTemplatesForType],
  );

  const handleUpdate = useCallback(
    (id: string, updates: Partial<BoosterData>) =>
      updateBoosters(applyItemUpdatesWithOrderSwap(data.boosters, id, updates)),
    [data.boosters, updateBoosters],
  );

  const handleInfoSave = useCallback(
    (id: string, updates: Partial<BoosterData>) => {
      handleUpdate(id, updates);
    },
    [handleUpdate],
  );

  useEffect(() => {
    const activityItemId = searchParams.get("activityItemId");
    const activityEditor = searchParams.get("activityEditor");
    if (!activityItemId || activityEditor !== "info") return;

    const target = data.boosters.find((item) => item.id === activityItemId);
    if (!target) return;

    setEditingItem(target);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("activityItemId");
    nextParams.delete("activityEditor");
    setSearchParams(nextParams, { replace: true });
  }, [data.boosters, searchParams, setSearchParams]);

  const createBaseBooster = useCallback(async (): Promise<BoosterData> => {
    const placeholder = await getRandomPlaceholder("booster");
    return {
      id: crypto.randomUUID(),
      objectType: "booster",
      name: "Standard Pack",
      description: "Choose 1 of 3",
      orderValue: data.boosters.length + 1,
      image: placeholder?.src || "",
      placeholderCreditIndex: placeholder?.index,
      placeholderCategory: placeholder?.category,
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
  }, [data.boosters.length]);

  const handleCreate = useCallback(async () => {
    const newBooster = await createBaseBooster();
    updateBoosters([...data.boosters, newBooster]);
    if (getAutoOpenNewItemDialogEnabled()) {
      setEditingItem(newBooster);
    }
  }, [createBaseBooster, data.boosters, updateBoosters]);

  const handleCreateFromTemplate = useCallback(
    async (template: ItemTemplateEntry) => {
      const baseBooster = await createBaseBooster();
      const templatedBooster = instantiateItemFromTemplate(
        baseBooster,
        template,
      );
      updateBoosters([...data.boosters, templatedBooster]);
      if (getAutoOpenNewItemDialogEnabled()) {
        setEditingItem(templatedBooster);
      }
      pushGlobalAlert({
        type: "success",
        title: "Template Applied",
        message: `Created Booster from \"${template.name}\".`,
      });
    },
    [createBaseBooster, data.boosters, updateBoosters],
  );

  const handleDelete = useCallback(
    (id: string) => updateBoosters(data.boosters.filter((b) => b.id !== id)),
    [data.boosters, updateBoosters],
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
      searchFn: (item: BoosterData, term: string) =>
        item.name.toLowerCase().includes(term),
    }),
    [],
  );

  const sortOptions = useMemo(
    () => [
      {
        label: "Name",
        value: "name",
        sortFn: (a: BoosterData, b: BoosterData) =>
          a.name.localeCompare(b.name),
      },
      {
        label: "Cost",
        value: "cost",
        sortFn: (a: BoosterData, b: BoosterData) => a.cost - b.cost,
      },
    ],
    [],
  );

  const renderCard = useCallback(
    (item: BoosterData) => (
      <GenericItemCard
        key={item.id}
        name={item.name}
        description={item.description}
        cost={item.cost}
        idValue={item.orderValue}
        imageLayers={item.imageLayers}
        onUpdate={(updates) => handleUpdate(item.id, updates)}
        onDuplicate={() => {
          const duplicatedItem: BoosterData = {
            ...item,
            id: crypto.randomUUID(),
            name: `${item.name} (Copy)`,
            objectKey: `${item.objectKey}_copy`,
            orderValue: data.boosters.length + 1,
          };
          updateBoosters([...data.boosters, duplicatedItem]);
        }}
        image={
          item.image ? (
            <img
              src={item.image}
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
          setPlaceholderTargetId(item.id);
          setIsPlaceholderPickerOpen(true);
        }}
        properties={[
          {
            id: "discovered",
            label: item.discovered ? "Discovered" : "Hidden",
            icon: item.discovered ? (
              <Eye className="h-4 w-4" weight="regular" />
            ) : (
              <EyeSlash className="h-4 w-4" weight="regular" />
            ),
            isActive: item.discovered ?? true,
            variant: "info",
            onClick: () =>
              handleUpdate(item.id, { discovered: !item.discovered }),
          },
          {
            id: "draw_hand",
            label: item.draw_hand ? "Draws to Hand" : "Opens Normally",
            icon: <Hand className="h-4 w-4" weight="regular" />,
            isActive: item.draw_hand === true,
            variant: "success",
            onClick: () =>
              handleUpdate(item.id, { draw_hand: !item.draw_hand }),
          },
          {
            id: "instant_use",
            label: item.instant_use ? "Instant Use" : "Adds to Hand",
            icon: <Play className="h-4 w-4" weight="regular" />,
            isActive: item.instant_use === true,
            variant: "success",
            onClick: () =>
              handleUpdate(item.id, { instant_use: !item.instant_use }),
          },
        ]}
        actions={[
          {
            id: "edit",
            label: "Edit",
            icon: <PencilSimple className="h-4 w-4" />,
            onClick: () => setEditingItem(item),
          },
          {
            id: "showcase",
            label: "Showcase",
            icon: <VideoCamera className="h-4 w-4" />,
            onClick: () => setShowcaseItem(item),
          },
          {
            id: "saveTemplate",
            label: "Save as Template",
            icon: <BookmarksSimple className="h-4 w-4" weight="regular" />,
            onClick: () => {
              createItemTemplate({
                name: `${item.name} Template`,
                itemType: "booster",
                payload: item as unknown as Record<string, unknown>,
              });
              pushGlobalAlert({
                type: "success",
                title: "Template Saved",
                message: `Saved \"${item.name}\" as a template.`,
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
            onClick: () => requestDelete(item.id, item.name),
          },
        ]}
      />
    ),
    [createItemTemplate, handleUpdate, requestDelete],
  );

  const renderCompactCard = useCallback(
    (item: BoosterData) => (
      <GenericItemCardCompact
        name={item.name}
        overlayImage={item.overlayImage}
        image={
          item.image ? (
            <img
              src={item.image}
              className="w-full h-full object-contain [image-rendering:pixelated]"
              alt={item.name}
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
            label: "Edit",
            icon: <PencilSimple className="h-4 w-4" />,
            onClick: () => setEditingItem(item),
          },
          {
            id: "showcase",
            label: "Showcase",
            icon: <VideoCamera weight="regular" />,
            onClick: () => setShowcaseItem(item),
            variant: "ghost",
          },
          {
            id: "saveTemplate",
            label: "Save as Template",
            icon: <BookmarksSimple weight="regular" />,
            onClick: () => {
              createItemTemplate({
                name: `${item.name} Template`,
                itemType: "booster",
                payload: item as unknown as Record<string, unknown>,
              });
              pushGlobalAlert({
                type: "success",
                title: "Template Saved",
                message: `Saved \"${item.name}\" as a template.`,
              });
            },
            variant: "ghost",
          },
          {
            id: "duplicate",
            label: "Duplicate",
            icon: <Copy weight="regular" />,
            onClick: () => {
              const duplicatedBooster: BoosterData = {
                ...item,
                id: crypto.randomUUID(),
                name: `${item.name} (Copy)`,
                objectKey: `${item.objectKey}_copy`,
                orderValue: data.boosters.length + 1,
              };
              updateBoosters([...data.boosters, duplicatedBooster]);
            },
            variant: "ghost",
          },
          {
            id: "delete",
            label: "Delete",
            icon: <Trash weight="bold" />,
            variant: "destructive",
            onClick: () => requestDelete(item.id, item.name),
          },
        ]}
      />
    ),
    [createItemTemplate, requestDelete, data.boosters, updateBoosters],
  );

  return (
    <>
      <GenericItemPage<BoosterData>
        title="Boosters"
        subtitle={modName}
        items={data.boosters}
        isLoading={isHydrating}
        onAddNew={handleCreate}
        onAddFromTemplate={
          boosterTemplates.length > 0
            ? () => setIsTemplatePickerOpen(true)
            : undefined
        }
        addNewLabel="Create Pack"
        addFromTemplateLabel="Create Pack from Template"
        searchProps={searchProps}
        sortOptions={sortOptions}
        renderCard={renderCard}
        renderCompactCard={renderCompactCard}
      />
      <TemplatePickerDialog
        open={isTemplatePickerOpen}
        onOpenChange={setIsTemplatePickerOpen}
        title="Create Booster from Template"
        description="Select a Booster template to start from."
        templates={boosterTemplates}
        onUseTemplate={(template) =>
          handleCreateFromTemplate(template as ItemTemplateEntry)
        }
      />
      <EditBoosterDialog
        editingItem={editingItem}
        setEditingItem={setEditingItem}
        onSave={handleInfoSave}
      />
      <PlaceholderPickerDialog
        open={isPlaceholderPickerOpen}
        onOpenChange={setIsPlaceholderPickerOpen}
        initialCategory="booster"
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
        title="Delete this booster?"
        description={
          <span>
            You are about to delete{" "}
            <span className="font-semibold text-foreground">
              {pendingDeleteLabel || "this booster"}
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
        title={showcaseItem?.name || "Booster"}
        fileNameBase={showcaseItem?.name || "booster"}
        onOpenChange={(open) => {
          if (!open) {
            setShowcaseItem(null);
          }
        }}
      >
        {showcaseItem && (
          <BalatroCard type="booster" data={showcaseItem} size="lg" showCost />
        )}
      </ItemShowcaseDialog>
    </>
  );
}
