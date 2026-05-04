import { useCallback, useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCardMini } from "@/components/pages/generic-item-card-mini";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useModName, useProjectData } from "@/lib/storage";
import { slugify } from "@/lib/balatro-utils";
import { ConsumableSetData } from "@/lib/types";
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
import { EditConsumableSetDialog } from "@/components/edit-dialogs";

const DEFAULT_SET_COLOR = "666666";

const buildSetKey = (name: string): string => {
  const next = slugify(name);
  return next.startsWith("booster_") ? "custom_set" : next;
};

const normalizeHex = (value: string | undefined | null): string => {
  const raw = String(value || DEFAULT_SET_COLOR).replace("#", "");
  const clean = raw.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
  return `#${clean.padEnd(6, "0")}`;
};

export default function ConsumableSetsPage() {
  const { data, updateConsumableSets, isHydrating } = useProjectData();
  const modName = useModName();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editingItem, setEditingItem] = useState<ConsumableSetData | null>(
    null,
  );
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const { createItemTemplate, getItemTemplatesForType } = useTemplateStore();
  const consumableSetTemplates = useMemo(
    () => getItemTemplatesForType("consumableSet"),
    [getItemTemplatesForType],
  );

  const handleUpdate = useCallback(
    (id: string, updates: Partial<ConsumableSetData>) => {
      updateConsumableSets(
        data.consumableSets.map((set) =>
          set.id === id
            ? {
                ...set,
                ...updates,
                key: (updates.key || set.key || "").replace("#", ""),
                primary_colour: (
                  updates.primary_colour ||
                  set.primary_colour ||
                  ""
                )
                  .replace("#", "")
                  .toUpperCase(),
                secondary_colour: (
                  updates.secondary_colour ||
                  set.secondary_colour ||
                  ""
                )
                  .replace("#", "")
                  .toUpperCase(),
              }
            : set,
        ),
      );
    },
    [data.consumableSets, updateConsumableSets],
  );

  const handleInfoSave = useCallback(
    (id: string, updates: Partial<ConsumableSetData>) => {
      handleUpdate(id, updates);
    },
    [handleUpdate],
  );

  useEffect(() => {
    const activityItemId = searchParams.get("activityItemId");
    const activityEditor = searchParams.get("activityEditor");
    if (!activityItemId || activityEditor !== "info") return;

    const target = data.consumableSets.find(
      (item) => item.id === activityItemId,
    );
    if (!target) return;

    setEditingItem(target);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("activityItemId");
    nextParams.delete("activityEditor");
    setSearchParams(nextParams, { replace: true });
  }, [data.consumableSets, searchParams, setSearchParams]);

  const createBaseConsumableSet = useCallback((): ConsumableSetData => {
    return {
      id: crypto.randomUUID(),
      key: "new_set",
      name: "New Set",
      primary_colour: DEFAULT_SET_COLOR,
      secondary_colour: DEFAULT_SET_COLOR,
      shop_rate: 1,
      collection_rows: [4, 5],
      collection_name: "New Set Cards",
    };
  }, []);

  const handleCreate = useCallback(() => {
    const newSet = createBaseConsumableSet();
    updateConsumableSets([...data.consumableSets, newSet]);
    setEditingItem(newSet);
  }, [createBaseConsumableSet, data.consumableSets, updateConsumableSets]);

  const handleCreateFromTemplate = useCallback(
    (template: ItemTemplateEntry) => {
      const baseSet = createBaseConsumableSet();
      const templatedSet = instantiateItemFromTemplate(baseSet, template);
      updateConsumableSets([...data.consumableSets, templatedSet]);
      setEditingItem(templatedSet);
      pushGlobalAlert({
        type: "success",
        title: "Template Applied",
        message: `Created Consumable Set from \"${template.name}\".`,
      });
    },
    [createBaseConsumableSet, data.consumableSets, updateConsumableSets],
  );

  const handleDelete = useCallback(
    (id: string) =>
      updateConsumableSets(data.consumableSets.filter((set) => set.id !== id)),
    [data.consumableSets, updateConsumableSets],
  );

  const {
    isDialogOpen: isDeleteDialogOpen,
    pendingLabel: pendingDeleteLabel,
    requestDelete,
    confirmDelete,
    handleOpenChange: handleDeleteDialogChange,
  } = useConfirmDelete(handleDelete);

  const handleDuplicate = useCallback(
    (set: ConsumableSetData) => {
      const name = `${set.name} Copy`;
      const duplicated: ConsumableSetData = {
        ...set,
        id: crypto.randomUUID(),
        name,
        key: buildSetKey(name),
      };
      updateConsumableSets([...data.consumableSets, duplicated]);
    },
    [data.consumableSets, updateConsumableSets],
  );

  const sortOptions = useMemo(
    () => [
      {
        label: "Name",
        value: "name",
        sortFn: (a: ConsumableSetData, b: ConsumableSetData) =>
          a.name.localeCompare(b.name),
      },
      {
        label: "Key",
        value: "key",
        sortFn: (a: ConsumableSetData, b: ConsumableSetData) =>
          a.key.localeCompare(b.key),
      },
    ],
    [],
  );

  const searchProps = useMemo(
    () => ({
      placeholder: "Search sets by name or key...",
      searchFn: (item: ConsumableSetData, term: string) =>
        item.name.toLowerCase().includes(term) ||
        item.key.toLowerCase().includes(term),
    }),
    [],
  );

  const renderCard = useCallback(
    (item: ConsumableSetData) => (
      <GenericItemCardMini
        title={item.name}
        subtitle={item.key}
        accentColor={normalizeHex(item.primary_colour)}
        badgePreview={{
          label: item.name,
          color: normalizeHex(item.primary_colour),
        }}
        onTitleSave={(value) =>
          handleUpdate(item.id, {
            name: value,
            key: buildSetKey(value),
            collection_name: `${value} Cards`,
          })
        }
        fields={[
          {
            id: "shop_rate",
            label: "Shop Rate",
            value: item.shop_rate,
            editable: true,
            type: "number",
            step: 0.1,
            onSave: (value) =>
              handleUpdate(item.id, { shop_rate: Number(value) }),
            formatter: (value) => Number(value || 0).toFixed(1),
          },
          {
            id: "rows",
            label: "Rows",
            value: `${item.collection_rows?.[0] ?? 4} / ${
              item.collection_rows?.[1] ?? 5
            }`,
          },
          {
            id: "collection",
            label: "Collection",
            value: item.collection_name,
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
                itemType: "consumableSet",
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
      <GenericItemPage<ConsumableSetData>
        title="Consumable Sets"
        subtitle={modName}
        items={data.consumableSets}
        isLoading={isHydrating}
        onAddNew={handleCreate}
        onAddFromTemplate={
          consumableSetTemplates.length > 0
            ? () => setIsTemplatePickerOpen(true)
            : undefined
        }
        addNewLabel="Create Set"
        addFromTemplateLabel="Create Set from Template"
        searchProps={searchProps}
        sortOptions={sortOptions}
        renderCard={renderCard}
      />
      <TemplatePickerDialog
        open={isTemplatePickerOpen}
        onOpenChange={setIsTemplatePickerOpen}
        title="Create Consumable Set from Template"
        description="Select a Consumable Set template to start from."
        templates={consumableSetTemplates}
        onUseTemplate={(template) =>
          handleCreateFromTemplate(template as ItemTemplateEntry)
        }
      />
      <EditConsumableSetDialog
        editingItem={editingItem}
        setEditingItem={setEditingItem}
        onSave={handleInfoSave}
      />
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleDeleteDialogChange}
        title="Delete this set?"
        description={
          <span>
            You are about to delete{" "}
            <span className="font-semibold text-foreground">
              {pendingDeleteLabel || "this set"}
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
