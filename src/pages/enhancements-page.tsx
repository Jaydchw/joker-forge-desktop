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
import { EnhancementData, Rule } from "@/lib/types";
import {
  Star,
  PencilSimple,
  Sparkle,
  Trash,
  LockOpen,
  Lock,
  Eye,
  EyeSlash,
  Copy,
  Prohibit,
  Heart,
  ShieldCheck,
  Hash,
  X,
  VideoCamera,
  DownloadSimple,
  BookmarksSimple,
} from "@phosphor-icons/react";
import { BalatroCard } from "@/components/balatro/balatro-card";
import { getRandomPlaceholder } from "@/lib/placeholder-assets.ts";
import { PlaceholderPickerDialog } from "@/components/pages/placeholder-picker-dialog";
import { RuleBuilder } from "@/components/rule-builder";
import { ItemShowcaseDialog } from "@/components/pages/item-showcase-dialog";
import { applyItemUpdatesWithOrderSwap } from "@/lib/item-order";
import { exportSingleItemRust } from "@/lib/rust-codegen-export";
import {
  instantiateItemFromTemplate,
  useTemplateStore,
  type ItemTemplateEntry,
} from "@/lib/templates";
import { TemplatePickerDialog } from "@/components/templates/template-picker-dialog";
import { pushGlobalAlert } from "@/lib/global-alerts-bus";
import { EditEnhancementDialog } from "@/components/edit-dialogs";

export default function EnhancementsPage() {
  const { data, updateEnhancements, isHydrating } = useProjectData();
  const modName = useModName();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editingItem, setEditingItem] = useState<EnhancementData | null>(null);
  const [ruleEditingItem, setRuleEditingItem] =
    useState<EnhancementData | null>(null);
  const [showcaseItem, setShowcaseItem] = useState<EnhancementData | null>(
    null,
  );
  const [isPlaceholderPickerOpen, setIsPlaceholderPickerOpen] = useState(false);
  const [placeholderTargetId, setPlaceholderTargetId] = useState<string | null>(
    null,
  );
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const { createItemTemplate, getItemTemplatesForType } = useTemplateStore();
  const enhancementTemplates = useMemo(
    () => getItemTemplatesForType("enhancement"),
    [getItemTemplatesForType],
  );

  const handleUpdate = useCallback(
    (id: string, updates: Partial<EnhancementData>) =>
      updateEnhancements(
        applyItemUpdatesWithOrderSwap(data.enhancements, id, updates),
      ),
    [data.enhancements, updateEnhancements],
  );

  const handleInfoSave = useCallback(
    (id: string, updates: Partial<EnhancementData>) => {
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

    const target = data.enhancements.find((item) => item.id === activityItemId);
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
  }, [data.enhancements, searchParams, setSearchParams]);

  const createBaseEnhancement =
    useCallback(async (): Promise<EnhancementData> => {
      const placeholder = await getRandomPlaceholder("enhancement");
      return {
        id: crypto.randomUUID(),
        objectType: "enhancement",
        name: "New Enhancement",
        description: "Effect",
        image: placeholder?.src || "",
        placeholderCreditIndex: placeholder?.index,
        placeholderCategory: placeholder?.category,
        objectKey: "new_enhancement",
        unlocked: true,
        discovered: true,
        rules: [],
        weight: 5,
        orderValue: data.enhancements.length + 1,
      };
    }, [data.enhancements.length]);

  const handleCreate = useCallback(async () => {
    const newEnhancement = await createBaseEnhancement();
    updateEnhancements([...data.enhancements, newEnhancement]);
    if (getAutoOpenNewItemDialogEnabled()) {
      setEditingItem(newEnhancement);
    }
  }, [createBaseEnhancement, data.enhancements, updateEnhancements]);

  const handleCreateFromTemplate = useCallback(
    async (template: ItemTemplateEntry) => {
      const baseEnhancement = await createBaseEnhancement();
      const templatedEnhancement = instantiateItemFromTemplate(
        baseEnhancement,
        template,
      );
      updateEnhancements([...data.enhancements, templatedEnhancement]);
      if (getAutoOpenNewItemDialogEnabled()) {
        setEditingItem(templatedEnhancement);
      }
      pushGlobalAlert({
        type: "success",
        title: "Template Applied",
        message: `Created Enhancement from \"${template.name}\".`,
      });
    },
    [createBaseEnhancement, data.enhancements, updateEnhancements],
  );

  const handleDelete = useCallback(
    (id: string) =>
      updateEnhancements(data.enhancements.filter((e) => e.id !== id)),
    [data.enhancements, updateEnhancements],
  );

  const handleExport = useCallback(
    async (item: EnhancementData) => {
      try {
        await exportSingleItemRust(
          item as any,
          "enhancement",
          data.metadata.prefix,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        window.alert(`Enhancement export failed: ${message}`);
      }
    },
    [data.metadata.prefix],
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
      searchFn: (item: EnhancementData, term: string) =>
        item.name.toLowerCase().includes(term),
    }),
    [],
  );

  const sortOptions = useMemo(
    () => [
      {
        label: "Name",
        value: "name",
        sortFn: (a: EnhancementData, b: EnhancementData) =>
          a.name.localeCompare(b.name),
      },
    ],
    [],
  );

  const renderCard = useCallback(
    (item: EnhancementData) => (
      <GenericItemCard
        key={item.id}
        name={item.name}
        description={item.description}
        idValue={item.orderValue}
        imageLayers={item.imageLayers}
        onUpdate={(updates) => handleUpdate(item.id, updates)}
        onDuplicate={() => {
          const duplicatedItem: EnhancementData = {
            ...item,
            id: crypto.randomUUID(),
            name: `${item.name} (Copy)`,
            objectKey: `${item.objectKey}_copy`,
            orderValue: data.enhancements.length + 1,
          };
          updateEnhancements([...data.enhancements, duplicatedItem]);
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
            id: "any_suit",
            label: item.any_suit ? "Any Suit" : "Suit Specific",
            icon: <Heart className="h-4 w-4" weight="regular" />,
            isActive: item.any_suit === true,
            variant: "purple",
            onClick: () => handleUpdate(item.id, { any_suit: !item.any_suit }),
          },
          {
            id: "replace_base_card",
            label: item.replace_base_card ? "Replaces Base" : "Normal Card",
            icon: <ShieldCheck className="h-4 w-4" weight="regular" />,
            isActive: item.replace_base_card === true,
            variant: "info",
            onClick: () =>
              handleUpdate(item.id, {
                replace_base_card: !item.replace_base_card,
              }),
          },
          {
            id: "no_rank",
            label: item.no_rank ? "No Rank" : "Has Rank",
            icon: <Hash className="h-4 w-4" weight="regular" />,
            isActive: item.no_rank === true,
            variant: "default",
            onClick: () => handleUpdate(item.id, { no_rank: !item.no_rank }),
          },
          {
            id: "no_suit",
            label: item.no_suit ? "No Suit" : "Has Suit",
            icon: <X className="h-4 w-4" weight="regular" />,
            isActive: item.no_suit === true,
            variant: "default",
            onClick: () => handleUpdate(item.id, { no_suit: !item.no_suit }),
          },
          {
            id: "always_scores",
            label: item.always_scores ? "Always Scores" : "Normal Scoring",
            icon: <Star className="h-4 w-4" weight="regular" />,
            isActive: item.always_scores === true,
            variant: "success",
            onClick: () =>
              handleUpdate(item.id, { always_scores: !item.always_scores }),
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
                itemType: "enhancement",
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
    (item: EnhancementData) => (
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
                itemType: "enhancement",
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
              const duplicatedEnhancement: EnhancementData = {
                ...item,
                id: crypto.randomUUID(),
                name: `${item.name} (Copy)`,
                objectKey: `${item.objectKey}_copy`,
                orderValue: data.enhancements.length + 1,
              };
              updateEnhancements([...data.enhancements, duplicatedEnhancement]);
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
      data.enhancements,
      updateEnhancements,
    ],
  );

  return (
    <>
      <GenericItemPage<EnhancementData>
        title="Enhancements"
        subtitle={modName}
        items={data.enhancements}
        isLoading={isHydrating}
        onAddNew={handleCreate}
        onAddFromTemplate={
          enhancementTemplates.length > 0
            ? () => setIsTemplatePickerOpen(true)
            : undefined
        }
        addNewLabel="Create Enhancement"
        addFromTemplateLabel="Create Enhancement from Template"
        searchProps={searchProps}
        sortOptions={sortOptions}
        renderCard={renderCard}
        renderCompactCard={renderCompactCard}
      />
      <TemplatePickerDialog
        open={isTemplatePickerOpen}
        onOpenChange={setIsTemplatePickerOpen}
        title="Create Enhancement from Template"
        description="Select an Enhancement template to start from."
        templates={enhancementTemplates}
        onUseTemplate={(template) =>
          handleCreateFromTemplate(template as ItemTemplateEntry)
        }
      />
      <EditEnhancementDialog
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
          onUpdateItem={(updates: Partial<EnhancementData>) => {
            handleUpdate(
              ruleEditingItem.id,
              updates as Partial<EnhancementData>,
            );
            setRuleEditingItem((prev) =>
              prev
                ? { ...prev, ...(updates as Partial<EnhancementData>) }
                : prev,
            );
          }}
          itemType="card"
        />
      )}
      <PlaceholderPickerDialog
        open={isPlaceholderPickerOpen}
        onOpenChange={setIsPlaceholderPickerOpen}
        initialCategory="enhancement"
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
        title="Delete this enhancement?"
        description={
          <span>
            You are about to delete{" "}
            <span className="font-semibold text-foreground">
              {pendingDeleteLabel || "this enhancement"}
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
        title={showcaseItem?.name || "Enhancement"}
        fileNameBase={showcaseItem?.name || "enhancement"}
        onOpenChange={(open) => {
          if (!open) {
            setShowcaseItem(null);
          }
        }}
      >
        {showcaseItem && (
          <BalatroCard
            type="card"
            data={showcaseItem}
            enhancementReplaceBase={showcaseItem.replace_base_card === true}
            size="lg"
          />
        )}
      </ItemShowcaseDialog>
    </>
  );
}
