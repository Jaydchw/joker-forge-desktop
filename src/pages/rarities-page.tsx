import { useCallback, useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCardMini } from "@/components/pages/generic-item-card-mini";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useModName, useProjectData } from "@/lib/storage";
import { slugify } from "@/lib/balatro-utils";
import { RarityData } from "@/lib/types";
import { fuzzyMatchAny } from "@/lib/search";
import {
  BookmarksSimple,
  Copy,
  PencilSimple,
  Trash,
} from "@phosphor-icons/react";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import {
  instantiateItemFromTemplate,
  useTemplateStore,
  type ItemTemplateEntry,
} from "@/lib/templates";
import { TemplatePickerDialog } from "@/components/templates/template-picker-dialog";
import { pushGlobalAlert } from "@/lib/global-alerts-bus";
import { EditRarityDialog } from "@/components/edit-dialogs";

const DEFAULT_BADGE_COLOR = "6A7A8B";
const buildRarityKey = (name: string): string => {
  const next = slugify(name);
  return next.startsWith("booster_") ? "custom_rarity" : next;
};

const normalizeHex = (value: string | undefined | null): string => {
  const raw = String(value || DEFAULT_BADGE_COLOR).replace("#", "");
  const clean = raw.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
  return `#${clean.padEnd(6, "0")}`;
};

export default function RaritiesPage() {
  const { data, updateRarities, isHydrating } = useProjectData();
  const modName = useModName();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editingItem, setEditingItem] = useState<RarityData | null>(null);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const { createItemTemplate, getItemTemplatesForType } = useTemplateStore();
  const rarityTemplates = useMemo(
    () => getItemTemplatesForType("rarity"),
    [getItemTemplatesForType],
  );

  const handleUpdate = useCallback(
    (id: string, updates: Partial<RarityData>) => {
      updateRarities(
        data.rarities.map((rarity) =>
          rarity.id === id
            ? {
                ...rarity,
                ...updates,
                key: (updates.key || rarity.key || "").replace("#", ""),
                badge_colour: (
                  updates.badge_colour ||
                  rarity.badge_colour ||
                  ""
                )
                  .replace("#", "")
                  .toUpperCase(),
              }
            : rarity,
        ),
      );
    },
    [data.rarities, updateRarities],
  );

  const handleInfoSave = useCallback(
    (id: string, updates: Partial<RarityData>) => {
      handleUpdate(id, updates);
    },
    [handleUpdate],
  );

  useEffect(() => {
    const activityItemId = searchParams.get("activityItemId");
    const activityEditor = searchParams.get("activityEditor");
    if (!activityItemId || activityEditor !== "info") return;

    const target = data.rarities.find((item) => item.id === activityItemId);
    if (!target) return;

    setEditingItem(target);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("activityItemId");
    nextParams.delete("activityEditor");
    setSearchParams(nextParams, { replace: true });
  }, [data.rarities, searchParams, setSearchParams]);

  const createBaseRarity = useCallback((): RarityData => {
    return {
      id: crypto.randomUUID(),
      key: "new_rarity",
      name: "New Rarity",
      badge_colour: DEFAULT_BADGE_COLOR,
      default_weight: 0.1,
    };
  }, []);

  const handleCreate = useCallback(() => {
    const newRarity = createBaseRarity();
    updateRarities([...data.rarities, newRarity]);
    setEditingItem(newRarity);
  }, [createBaseRarity, data.rarities, updateRarities]);

  const handleCreateFromTemplate = useCallback(
    (template: ItemTemplateEntry) => {
      const baseRarity = createBaseRarity();
      const templatedRarity = instantiateItemFromTemplate(baseRarity, template);
      updateRarities([...data.rarities, templatedRarity]);
      setEditingItem(templatedRarity);
      pushGlobalAlert({
        type: "success",
        title: "Template Applied",
        message: `Created Rarity from \"${template.name}\".`,
      });
    },
    [createBaseRarity, data.rarities, updateRarities],
  );

  const handleDelete = useCallback(
    (id: string) =>
      updateRarities(data.rarities.filter((rarity) => rarity.id !== id)),
    [data.rarities, updateRarities],
  );

  const {
    isDialogOpen: isDeleteDialogOpen,
    pendingLabel: pendingDeleteLabel,
    requestDelete,
    confirmDelete,
    handleOpenChange: handleDeleteDialogChange,
  } = useConfirmDelete(handleDelete);

  const handleDuplicate = useCallback(
    (rarity: RarityData) => {
      const name = `${rarity.name} Copy`;
      const duplicated: RarityData = {
        ...rarity,
        id: crypto.randomUUID(),
        name,
        key: buildRarityKey(name),
      };
      updateRarities([...data.rarities, duplicated]);
    },
    [data.rarities, updateRarities],
  );

  const sortOptions = useMemo(
    () => [
      {
        label: "Name",
        value: "name",
        sortFn: (a: RarityData, b: RarityData) => a.name.localeCompare(b.name),
      },
      {
        label: "Weight",
        value: "weight",
        sortFn: (a: RarityData, b: RarityData) =>
          a.default_weight - b.default_weight,
      },
      {
        label: "Key",
        value: "key",
        sortFn: (a: RarityData, b: RarityData) => a.key.localeCompare(b.key),
      },
    ],
    [],
  );

  const searchProps = useMemo(
    () => ({
      placeholder: "Search rarities by name or key...",
      searchFn: (item: RarityData, term: string) =>
        fuzzyMatchAny([item.name, item.key], term),
    }),
    [],
  );

  const renderCard = useCallback(
    (item: RarityData) => (
      <GenericItemCardMini
        title={item.name}
        subtitle={item.key}
        accentColor={normalizeHex(item.badge_colour)}
        badgePreview={{
          label: item.name,
          color: normalizeHex(item.badge_colour),
        }}
        onTitleSave={(value) =>
          handleUpdate(item.id, {
            name: value,
            key: buildRarityKey(value),
          })
        }
        fields={[
          {
            id: "weight",
            label: "Weight",
            value: item.default_weight,
            editable: true,
            type: "number",
            step: 0.001,
            onSave: (value) =>
              handleUpdate(item.id, { default_weight: Number(value) }),
            formatter: (value) => Number(value || 0).toFixed(3),
          },
          {
            id: "color",
            label: "Badge",
            value: `#${item.badge_colour.replace("#", "")}`,
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
            id: "duplicate",
            label: "Duplicate",
            icon: <Copy className="h-4 w-4" />,
            onClick: () => handleDuplicate(item),
            variant: "outline",
          },
          {
            id: "saveTemplate",
            label: "Save as Template",
            icon: <BookmarksSimple className="h-4 w-4" />,
            onClick: () => {
              createItemTemplate({
                name: `${item.name} Template`,
                itemType: "rarity",
                payload: item as unknown as Record<string, unknown>,
              });
              pushGlobalAlert({
                type: "success",
                title: "Template Saved",
                message: `Saved \"${item.name}\" as a template.`,
              });
            },
            variant: "outline",
          },
          {
            id: "delete",
            label: "Delete",
            icon: <Trash className="h-4 w-4" />,
            onClick: () => requestDelete(item.id, item.name),
            variant: "destructive",
          },
        ]}
      />
    ),
    [
      createItemTemplate,
      handleDelete,
      handleDuplicate,
      handleUpdate,
      requestDelete,
    ],
  );

  return (
    <>
      <GenericItemPage<RarityData>
        title="Rarities"
        subtitle={modName}
        items={data.rarities}
        isLoading={isHydrating}
        onAddNew={handleCreate}
        onAddFromTemplate={
          rarityTemplates.length > 0
            ? () => setIsTemplatePickerOpen(true)
            : undefined
        }
        addNewLabel="Create Rarity"
        addFromTemplateLabel="Create Rarity from Template"
        searchProps={searchProps}
        sortOptions={sortOptions}
        renderCard={renderCard}
      />
      <TemplatePickerDialog
        open={isTemplatePickerOpen}
        onOpenChange={setIsTemplatePickerOpen}
        title="Create Rarity from Template"
        description="Select a Rarity template to start from."
        templates={rarityTemplates}
        onUseTemplate={(template) =>
          handleCreateFromTemplate(template as ItemTemplateEntry)
        }
      />
      <EditRarityDialog
        editingItem={editingItem}
        setEditingItem={setEditingItem}
        onSave={handleInfoSave}
      />
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleDeleteDialogChange}
        title="Delete this rarity?"
        description={
          <span>
            You are about to delete{" "}
            <span className="font-semibold text-foreground">
              {pendingDeleteLabel || "this rarity"}
            </span>
            . This action cannot be undone.
          </span>
        }
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={confirmDelete}
      />
    </>
  );
}



