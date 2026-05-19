import { useState, useCallback, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCard } from "@/components/pages/generic-item-card";
import { GenericItemCardCompact } from "@/components/pages/generic-item-card-compact";
import {
  useProjectData,
  useModName,
  getAutoOpenNewItemDialogEnabled,
} from "@/lib/services/storage";
import { ConsumableData, Rule } from "@/lib/core/types";
import { fuzzyMatchAny } from "@/lib/core/search";
import {
  PencilSimple,
  Sparkle,
  Trash,
  LockOpen,
  Lock,
  Copy,
  Eye,
  EyeSlash,
  VideoCamera,
  DownloadSimple,
  BookmarksSimple,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { BalatroCard } from "@/components/balatro/balatro-card";
import {
  getConsumableSetByKey,
  getConsumableSetDropdownOptions,
  getCustomConsumableSetData,
} from "@/lib/balatro/balatro-utils";
import { getRandomPlaceholder } from "@/lib/content/placeholder-assets.ts";
import { PlaceholderPickerDialog } from "@/components/pages/placeholder-picker-dialog";
import { RuleBuilder } from "@/components/rule-builder";
import { ItemShowcaseDialog } from "@/components/pages/item-showcase-dialog";
import { applyItemUpdatesWithOrderSwap } from "@/lib/items/item-order";
import { exportSingleItemRust } from "@/lib/export/rust-codegen-export";
import { collectGlobalVariables } from "@/lib/app/global-user-variables";
import {
  generateDescriptionFromRules,
  shouldOverwriteDescriptionOnRuleSave,
} from "@/lib/rules/auto-description";
import {
  instantiateItemFromTemplate,
  useTemplateStore,
  type ItemTemplateEntry,
} from "@/lib/content/templates";
import { TemplatePickerDialog } from "@/components/templates/template-picker-dialog";
import { pushGlobalAlert } from "@/lib/app/global-alerts-bus";
import { EditConsumableDialog } from "@/components/edit-dialogs";
import { getItemLocVarsFromUserVariables } from "@/lib/description/description-loc-vars";

export default function ConsumablesPage() {
  const { data, updateConsumables, isHydrating } = useProjectData();
  const modName = useModName();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editingItem, setEditingItem] = useState<ConsumableData | null>(null);
  const [ruleEditingItem, setRuleEditingItem] = useState<ConsumableData | null>(
    null,
  );
  const [showcaseItem, setShowcaseItem] = useState<ConsumableData | null>(null);
  const [isPlaceholderPickerOpen, setIsPlaceholderPickerOpen] = useState(false);
  const [placeholderTargetId, setPlaceholderTargetId] = useState<string | null>(
    null,
  );
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const { createItemTemplate, getItemTemplatesForType } = useTemplateStore();
  const consumableTemplates = useMemo(
    () => getItemTemplatesForType("consumable"),
    [getItemTemplatesForType],
  );

  const handleUpdate = useCallback(
    (id: string, updates: Partial<ConsumableData>) =>
      updateConsumables((previous) =>
        applyItemUpdatesWithOrderSwap(previous, id, updates),
      ),
    [updateConsumables],
  );

  const handleInfoSave = useCallback(
    (id: string, updates: Partial<ConsumableData>) => {
      handleUpdate(id, updates);
    },
    [handleUpdate],
  );

  const handleRulesSave = useCallback(
    (rules: Rule[]) => {
      if (!ruleEditingItem) return;
      const updates: Partial<ConsumableData> = { rules };
      if (
        shouldOverwriteDescriptionOnRuleSave(
          ruleEditingItem.description,
          ruleEditingItem.rules,
          "consumable",
        )
      ) {
        updates.description = generateDescriptionFromRules(rules, "consumable");
      }
      handleUpdate(ruleEditingItem.id, updates);
    },
    [handleUpdate, ruleEditingItem],
  );

  useEffect(() => {
    const activityItemId = searchParams.get("activityItemId");
    const activityEditor = searchParams.get("activityEditor");
    if (!activityItemId || !activityEditor) return;

    const target = data.consumables.find((item) => item.id === activityItemId);
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
  }, [data.consumables, searchParams, setSearchParams]);

  const createBaseConsumable =
    useCallback(async (): Promise<ConsumableData> => {
      const placeholder = await getRandomPlaceholder("consumable");
      return {
        id: crypto.randomUUID(),
        objectType: "consumable",
        name: "New Tarot",
        description: "Effect",
        image: placeholder?.src || "",
        placeholderCreditIndex: placeholder?.index,
        placeholderCategory: placeholder?.category,
        orderValue: data.consumables.length + 1,
        set: "Tarot",
        cost: 3,
        unlocked: true,
        discovered: true,
        rules: [],
        objectKey: "new_tarot",
      };
    }, [data.consumables.length]);

  const handleCreate = useCallback(async () => {
    const newConsumable = await createBaseConsumable();
    updateConsumables([...data.consumables, newConsumable]);
    if (getAutoOpenNewItemDialogEnabled()) {
      setEditingItem(newConsumable);
    }
  }, [createBaseConsumable, data.consumables, updateConsumables]);

  const handleCreateFromTemplate = useCallback(
    async (template: ItemTemplateEntry) => {
      const baseConsumable = await createBaseConsumable();
      const templatedConsumable = instantiateItemFromTemplate(
        baseConsumable,
        template,
      );
      updateConsumables([...data.consumables, templatedConsumable]);
      if (getAutoOpenNewItemDialogEnabled()) {
        setEditingItem(templatedConsumable);
      }
      pushGlobalAlert({
        type: "success",
        title: "Template Applied",
        message: `Created Consumable from \"${template.name}\".`,
      });
    },
    [createBaseConsumable, data.consumables, updateConsumables],
  );

  const handleDelete = useCallback(
    (id: string) =>
      updateConsumables(data.consumables.filter((c) => c.id !== id)),
    [data.consumables, updateConsumables],
  );

  const handleExport = useCallback(
    async (item: ConsumableData) => {
      try {
        await exportSingleItemRust(
          item as any,
          "consumable",
          data.metadata.prefix,
          {
            globalUserVariables: collectGlobalVariables(data).map(
              (entry) => entry.variable,
            ),
          },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        window.alert(`Consumable export failed: ${message}`);
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

  const getCurrentSetName = useCallback(
    (setKey: string): string => {
      const set = getConsumableSetByKey(setKey, data.consumableSets);
      return set?.label || setKey;
    },
    [data.consumableSets],
  );

  const getCurrentSetColor = useCallback(
    (setKey: string): string => {
      const custom = getCustomConsumableSetData(setKey, data.consumableSets);
      if (custom?.primary_colour) {
        return custom.primary_colour.startsWith("#")
          ? custom.primary_colour
          : `#${custom.primary_colour}`;
      }
      return setKey === "Tarot"
        ? "#b26cbb"
        : setKey === "Planet"
          ? "#13afce"
          : setKey === "Spectral"
            ? "#4584fa"
            : "#666666";
    },
    [data.consumableSets],
  );

  const searchProps = useMemo(
    () => ({
      searchFn: (item: ConsumableData, term: string) =>
        fuzzyMatchAny([item.name], term),
    }),
    [],
  );

  const sortOptions = useMemo(
    () => [
      {
        label: "Set",
        value: "set",
        sortFn: (a: ConsumableData, b: ConsumableData) =>
          a.set.localeCompare(b.set),
      },
      {
        label: "Name",
        value: "name",
        sortFn: (a: ConsumableData, b: ConsumableData) =>
          a.name.localeCompare(b.name),
      },
    ],
    [],
  );

  const filterOptions = useMemo(
    () => [
      {
        id: "set",
        label: "Type",
        options: getConsumableSetDropdownOptions(data.consumableSets),
        predicate: (item: ConsumableData, val: string) =>
          String(item.set) === String(val),
      },
    ],
    [data.consumableSets],
  );

  const renderCard = useCallback(
    (item: ConsumableData) => (
      <GenericItemCard
        key={item.id}
        name={item.name}
        description={item.description}
        locVars={getItemLocVarsFromUserVariables(item)}
        cost={item.cost}
        idValue={item.orderValue}
        consumableSet={item.set}
        imageLayers={item.imageLayers}
        overlayImage={item.overlayImage}
        hasManualEdits={Boolean((item as { customCode?: unknown }).customCode)}
        onUpdate={(updates) => handleUpdate(item.id, updates)}
        onDuplicate={() => {
          const duplicatedItem: ConsumableData = {
            ...item,
            id: crypto.randomUUID(),
            name: `${item.name} (Copy)`,
            objectKey: `${item.objectKey}_copy`,
            orderValue: data.consumables.length + 1,
          };
          updateConsumables([...data.consumables, duplicatedItem]);
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
        badges={
          <Badge
            variant="secondary"
            className="font-bold uppercase tracking-wider"
          >
            {item.set}
          </Badge>
        }
        properties={[
          {
            id: "unlocked",
            label: item.unlocked ? "Unlocked" : "Locked",
            icon: item.unlocked ? (
              <LockOpen className="h-4 w-4" weight="regular" />
            ) : (
              <Lock className="h-4 w-4" weight="regular" />
            ),
            isActive: item.unlocked ?? true,
            variant: "warning",
            onClick: () => handleUpdate(item.id, { unlocked: !item.unlocked }),
          },
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
        ]}
        actions={[
          {
            id: "edit",
            label: "Edit",
            icon: <PencilSimple className="h-4 w-4" />,
            onClick: () => setEditingItem(item),
          },
          {
            id: "rules",
            label: "Rules",
            icon: <Sparkle className="h-4 w-4" />,
            badgeCount: item.rules?.length ?? 0,
            onClick: () => {
              setEditingItem(null);
              setRuleEditingItem(item);
            },
          },
          {
            id: "showcase",
            label: "Showcase",
            icon: <VideoCamera className="h-4 w-4" />,
            onClick: () => setShowcaseItem(item),
          },
          {
            id: "export",
            label: "Export Code",
            icon: <DownloadSimple className="h-4 w-4" weight="regular" />,
            onClick: () => handleExport(item),
          },
          {
            id: "saveTemplate",
            label: "Save as Template",
            icon: <BookmarksSimple className="h-4 w-4" weight="regular" />,
            onClick: () => {
              createItemTemplate({
                name: `${item.name} Template`,
                itemType: "consumable",
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
    [createItemTemplate, handleUpdate, requestDelete, handleExport],
  );

  const renderCompactCard = useCallback(
    (item: ConsumableData) => (
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
            label: "Edit Info",
            icon: <PencilSimple weight="bold" />,
            onClick: () => setEditingItem(item),
            variant: "secondary",
          },
          {
            id: "rules",
            label: "Edit Rules",
            icon: <Sparkle weight="bold" />,
            onClick: () => {
              setEditingItem(null);
              setRuleEditingItem(item);
            },
            variant: "outline",
          },
          {
            id: "showcase",
            label: "Showcase",
            icon: <VideoCamera weight="regular" />,
            onClick: () => setShowcaseItem(item),
            variant: "ghost",
          },
          {
            id: "export",
            label: "Export Code",
            icon: <DownloadSimple weight="regular" />,
            onClick: () => handleExport(item),
            variant: "ghost",
          },
          {
            id: "saveTemplate",
            label: "Save as Template",
            icon: <BookmarksSimple weight="regular" />,
            onClick: () => {
              createItemTemplate({
                name: `${item.name} Template`,
                itemType: "consumable",
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
              const duplicatedConsumable: ConsumableData = {
                ...item,
                id: crypto.randomUUID(),
                name: `${item.name} (Copy)`,
                objectKey: `${item.objectKey}_copy`,
                orderValue: data.consumables.length + 1,
              };
              updateConsumables([...data.consumables, duplicatedConsumable]);
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
    [
      createItemTemplate,
      requestDelete,
      handleExport,
      data.consumables,
      updateConsumables,
    ],
  );

  return (
    <>
      <GenericItemPage<ConsumableData>
        title="Consumables"
        subtitle={modName}
        items={data.consumables}
        isLoading={isHydrating}
        onAddNew={handleCreate}
        onAddFromTemplate={
          consumableTemplates.length > 0
            ? () => setIsTemplatePickerOpen(true)
            : undefined
        }
        addNewLabel="Create Consumable"
        addFromTemplateLabel="Create Consumable from Template"
        searchProps={searchProps}
        sortOptions={sortOptions}
        filterOptions={filterOptions}
        renderCard={renderCard}
        renderCompactCard={renderCompactCard}
      />
      <TemplatePickerDialog
        open={isTemplatePickerOpen}
        onOpenChange={setIsTemplatePickerOpen}
        title="Create Consumable from Template"
        description="Select a Consumable template to start from."
        templates={consumableTemplates}
        onUseTemplate={(template) =>
          handleCreateFromTemplate(template as ItemTemplateEntry)
        }
      />
      <EditConsumableDialog
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
          onUpdateItem={(updates: Partial<ConsumableData>) => {
            handleUpdate(
              ruleEditingItem.id,
              updates as Partial<ConsumableData>,
            );
            setRuleEditingItem((prev) =>
              prev
                ? { ...prev, ...(updates as Partial<ConsumableData>) }
                : prev,
            );
          }}
          itemType="consumable"
        />
      )}
      <PlaceholderPickerDialog
        open={isPlaceholderPickerOpen}
        onOpenChange={setIsPlaceholderPickerOpen}
        initialCategory="consumable"
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
        title="Delete this consumable?"
        description={
          <span>
            You are about to delete{" "}
            <span className="font-semibold text-foreground">
              {pendingDeleteLabel || "this consumable"}
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
        title={showcaseItem?.name || "Consumable"}
        fileNameBase={showcaseItem?.name || "consumable"}
        onOpenChange={(open) => {
          if (!open) {
            setShowcaseItem(null);
          }
        }}
      >
        {showcaseItem && (
          <BalatroCard
            type="consumable"
            data={showcaseItem}
            size="lg"
            setName={getCurrentSetName(showcaseItem.set)}
            setColor={getCurrentSetColor(showcaseItem.set)}
            showCost
          />
        )}
      </ItemShowcaseDialog>
    </>
  );
}



