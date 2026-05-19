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
} from "@/lib/services/storage";
import { EditionData, Rule } from "@/lib/core/types";
import { fuzzyMatchAny } from "@/lib/core/search";
import {
  Palette,
  PencilSimple,
  Sparkle,
  Trash,
  LockOpen,
  Lock,
  Eye,
  EyeSlash,
  Copy,
  Prohibit,
  ShoppingBag,
  VideoCamera,
  DownloadSimple,
  BookmarksSimple,
} from "@phosphor-icons/react";
import { BalatroCard } from "@/components/balatro/balatro-card";
import { RuleBuilder } from "@/components/rule-builder";
import { ItemShowcaseDialog } from "@/components/pages/item-showcase-dialog";
import { exportSingleItemRust } from "@/lib/export/rust-codegen-export";
import { collectGlobalVariables } from "@/lib/app/global-user-variables";
import {
  generateDescriptionFromRules,
  shouldOverwriteDescriptionOnRuleSave,
} from "@/lib/rules/auto-description";
import { applyItemUpdatesWithOrderSwap } from "@/lib/items/item-order";
import {
  instantiateItemFromTemplate,
  useTemplateStore,
  type ItemTemplateEntry,
} from "@/lib/content/templates";
import { TemplatePickerDialog } from "@/components/templates/template-picker-dialog";
import { pushGlobalAlert } from "@/lib/app/global-alerts-bus";
import { EditEditionDialog } from "@/components/edit-dialogs";
import { getItemLocVarsFromUserVariables } from "@/lib/description/description-loc-vars";

export default function EditionsPage() {
  const { data, updateEditions, isHydrating } = useProjectData();
  const modName = useModName();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editingItem, setEditingItem] = useState<EditionData | null>(null);
  const [ruleEditingItem, setRuleEditingItem] = useState<EditionData | null>(
    null,
  );
  const [showcaseItem, setShowcaseItem] = useState<EditionData | null>(null);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const { createItemTemplate, getItemTemplatesForType } = useTemplateStore();
  const editionTemplates = useMemo(
    () => getItemTemplatesForType("edition"),
    [getItemTemplatesForType],
  );

  const handleUpdate = useCallback(
    (id: string, updates: Partial<EditionData>) => {
      const normalizedUpdates = {
        ...updates,
        shader: updates.shader === "" ? false : updates.shader,
      };
      updateEditions((previous) =>
        applyItemUpdatesWithOrderSwap(previous, id, normalizedUpdates),
      );
    },
    [updateEditions],
  );

  const handleInfoSave = useCallback(
    (id: string, updates: Partial<EditionData>) => {
      handleUpdate(id, updates);
    },
    [handleUpdate],
  );

  const handleRulesSave = useCallback(
    (rules: Rule[]) => {
      if (!ruleEditingItem) return;
      const updates: Partial<EditionData> = { rules };
      if (
        shouldOverwriteDescriptionOnRuleSave(
          ruleEditingItem.description,
          ruleEditingItem.rules,
          "edition",
        )
      ) {
        updates.description = generateDescriptionFromRules(rules, "edition");
      }
      handleUpdate(ruleEditingItem.id, updates);
    },
    [handleUpdate, ruleEditingItem],
  );

  useEffect(() => {
    const activityItemId = searchParams.get("activityItemId");
    const activityEditor = searchParams.get("activityEditor");
    if (!activityItemId || !activityEditor) return;

    const target = data.editions.find((item) => item.id === activityItemId);
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
  }, [data.editions, searchParams, setSearchParams]);

  const createBaseEdition = useCallback((): EditionData => {
    return {
      id: crypto.randomUUID(),
      objectType: "edition",
      name: "New Edition",
      description: "Effect",
      objectKey: "new_edition",
      unlocked: true,
      discovered: true,
      rules: [],
      weight: 10,
      sound: "",
      orderValue: data.editions.length + 1,
      image: "",
    };
  }, [data.editions.length]);

  const handleCreate = useCallback(() => {
    const newEdition = createBaseEdition();
    updateEditions([...data.editions, newEdition]);
    if (getAutoOpenNewItemDialogEnabled()) {
      setEditingItem(newEdition);
    }
  }, [createBaseEdition, data.editions, updateEditions]);

  const handleCreateFromTemplate = useCallback(
    (template: ItemTemplateEntry) => {
      const baseEdition = createBaseEdition();
      const templatedEdition = instantiateItemFromTemplate(
        baseEdition,
        template,
      );
      updateEditions([...data.editions, templatedEdition]);
      if (getAutoOpenNewItemDialogEnabled()) {
        setEditingItem(templatedEdition);
      }
      pushGlobalAlert({
        type: "success",
        title: "Template Applied",
        message: `Created Edition from \"${template.name}\".`,
      });
    },
    [createBaseEdition, data.editions, updateEditions],
  );

  const handleDelete = useCallback(
    (id: string) => updateEditions(data.editions.filter((e) => e.id !== id)),
    [data.editions, updateEditions],
  );

  const handleExport = useCallback(
    async (item: EditionData) => {
      try {
        await exportSingleItemRust(
          item as any,
          "edition",
          data.metadata.prefix,
          {
            globalUserVariables: collectGlobalVariables(data).map(
              (entry) => entry.variable,
            ),
          },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        window.alert(`Edition export failed: ${message}`);
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
      searchFn: (item: EditionData, term: string) =>
        fuzzyMatchAny([item.name], term),
    }),
    [],
  );

  const sortOptions = useMemo(
    () => [
      {
        label: "Name",
        value: "name",
        sortFn: (a: EditionData, b: EditionData) =>
          a.name.localeCompare(b.name),
      },
    ],
    [],
  );

  const renderCard = useCallback(
    (item: EditionData) => (
      <GenericItemCard
        key={item.id}
        name={item.name}
        description={item.description}
        locVars={getItemLocVarsFromUserVariables(item)}
        idValue={item.orderValue}
        imageLayers={item.imageLayers}
        onUpdate={(updates) => handleUpdate(item.id, updates)}
        onDuplicate={() => {
          const duplicatedItem: EditionData = {
            ...item,
            id: crypto.randomUUID(),
            name: `${item.name} (Copy)`,
            objectKey: `${item.objectKey}_copy`,
            orderValue: data.editions.length + 1,
          };
          updateEditions([...data.editions, duplicatedItem]);
        }}
        image={<Palette className="h-20 w-20 text-muted-foreground/20" />}
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
          {
            id: "no_collection",
            label: item.no_collection ? "Hidden Collection" : "In Collection",
            icon: <Prohibit className="h-4 w-4" weight="regular" />,
            isActive: item.no_collection === true,
            variant: "default",
            onClick: () =>
              handleUpdate(item.id, { no_collection: !item.no_collection }),
          },
          {
            id: "in_shop",
            label: item.in_shop ? "In Shop" : "Not in Shop",
            icon: <ShoppingBag className="h-4 w-4" weight="regular" />,
            isActive: item.in_shop === true,
            variant: "success",
            onClick: () => handleUpdate(item.id, { in_shop: !item.in_shop }),
          },
          {
            id: "shader",
            label: item.shader ? "Shader" : "No Shader",
            icon: <Sparkle className="h-4 w-4" weight="regular" />,
            isActive: !!item.shader,
            variant: "purple",
            onClick: () => {},
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
                itemType: "edition",
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
    (item: EditionData) => (
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
                itemType: "edition",
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
              const duplicatedEdition: EditionData = {
                ...item,
                id: crypto.randomUUID(),
                name: `${item.name} (Copy)`,
                objectKey: `${item.objectKey}_copy`,
                orderValue: data.editions.length + 1,
              };
              updateEditions([...data.editions, duplicatedEdition]);
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
      data.editions,
      updateEditions,
    ],
  );

  return (
    <>
      <GenericItemPage<EditionData>
        title="Editions"
        subtitle={modName}
        items={data.editions}
        isLoading={isHydrating}
        onAddNew={handleCreate}
        onAddFromTemplate={
          editionTemplates.length > 0
            ? () => setIsTemplatePickerOpen(true)
            : undefined
        }
        addNewLabel="Create Edition"
        addFromTemplateLabel="Create Edition from Template"
        searchProps={searchProps}
        sortOptions={sortOptions}
        renderCard={renderCard}
        renderCompactCard={renderCompactCard}
      />
      <TemplatePickerDialog
        open={isTemplatePickerOpen}
        onOpenChange={setIsTemplatePickerOpen}
        title="Create Edition from Template"
        description="Select an Edition template to start from."
        templates={editionTemplates}
        onUseTemplate={(template) =>
          handleCreateFromTemplate(template as ItemTemplateEntry)
        }
      />
      <EditEditionDialog
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
          onUpdateItem={(updates: Partial<EditionData>) => {
            handleUpdate(ruleEditingItem.id, updates as Partial<EditionData>);
            setRuleEditingItem((prev) =>
              prev ? { ...prev, ...updates } : prev,
            );
          }}
          itemType="card"
        />
      )}
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleDeleteDialogChange}
        title="Delete this edition?"
        description={
          <span>
            You are about to delete{" "}
            <span className="font-semibold text-foreground">
              {pendingDeleteLabel || "this edition"}
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
        title={showcaseItem?.name || "Edition"}
        fileNameBase={showcaseItem?.name || "edition"}
        onOpenChange={(open) => {
          if (!open) {
            setShowcaseItem(null);
          }
        }}
      >
        {showcaseItem && (
          <BalatroCard
            type="edition"
            data={{
              ...showcaseItem,
              shader:
                showcaseItem.shader === "" ? undefined : showcaseItem.shader,
            }}
            editionBadgeColor={showcaseItem.badge_colour}
            size="lg"
          />
        )}
      </ItemShowcaseDialog>
    </>
  );
}



