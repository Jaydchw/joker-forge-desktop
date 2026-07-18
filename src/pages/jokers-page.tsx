import { useState, useCallback, useMemo, useEffect, useRef } from "react";
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
import { JokerData, Rule } from "@/lib/core/types";
import { fuzzyMatchAny } from "@/lib/core/search";
import {
  getRarityBadgeColor,
  getRarityDisplayName,
  getRarityDropdownOptions,
} from "@/lib/balatro/balatro-utils";
import {
  Star,
  Clock,
  Lightning,
  CurrencyDollar,
  Prohibit,
  Lock,
  LockOpen,
  Eye,
  EyeSlash,
  PencilSimple,
  Sparkle,
  VideoCamera,
  DownloadSimple,
  Copy,
  Trash,
  WarningCircle,
  ClockCountdown,
  Tag,
  BookmarksSimple,
} from "@phosphor-icons/react";
import { BalatroCard } from "@/components/balatro/balatro-card";
import { getRandomPlaceholder } from "@/lib/content/placeholder-assets.ts";
import { PlaceholderPickerDialog } from "@/components/pages/placeholder-picker-dialog";
import { RuleBuilder } from "@/components/rule-builder";
import { exportSingleJokerRust } from "@/lib/export/rust-codegen-export";
import { collectGlobalVariables } from "@/lib/app/global-user-variables";
import { getAllVariables } from "@/lib/rules/user-variable-utils";
import {
  generateDescriptionFromRules,
  shouldOverwriteDescriptionOnRuleSave,
} from "@/lib/rules/auto-description";
import { ItemShowcaseDialog } from "@/components/pages/item-showcase-dialog";
import { applyItemUpdatesWithOrderSwap } from "@/lib/items/item-order";
import {
  instantiateItemFromTemplate,
  useTemplateStore,
  type ItemTemplateEntry,
} from "@/lib/content/templates";
import { TemplatePickerDialog } from "@/components/templates/template-picker-dialog";
import { pushGlobalAlert } from "@/lib/app/global-alerts-bus";
import { EditJokerDialog } from "@/components/edit-dialogs";
import {
  getItemLocVarsFromUserVariables,
  getVariableDisplayValue,
} from "@/lib/description/description-loc-vars";

export default function JokersPage() {
  const { data, updateJokers, isHydrating } = useProjectData();
  const dataRef = useRef(data);
  dataRef.current = data;
  const modName = useModName();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editingItem, setEditingItem] = useState<JokerData | null>(null);
  const [ruleEditingItem, setRuleEditingItem] = useState<JokerData | null>(
    null,
  );
  const [showcaseItem, setShowcaseItem] = useState<JokerData | null>(null);
  const [isPlaceholderPickerOpen, setIsPlaceholderPickerOpen] = useState(false);
  const [placeholderTargetId, setPlaceholderTargetId] = useState<string | null>(
    null,
  );
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const { createItemTemplate, getItemTemplatesForType } = useTemplateStore();
  const jokerTemplates = useMemo(
    () => getItemTemplatesForType("joker"),
    [getItemTemplatesForType],
  );

  // 2. Stable Handlers
  const handleUpdate = useCallback(
    (id: string, updates: Partial<JokerData>) =>
      updateJokers((previous) =>
        applyItemUpdatesWithOrderSwap(previous, id, updates),
      ),
    [updateJokers],
  );

  const handleInfoSave = useCallback(
    (id: string, updates: Partial<JokerData>) => {
      handleUpdate(id, updates);
    },
    [handleUpdate],
  );

  const handleRulesSave = useCallback(
    (rules: Rule[]) => {
      if (!ruleEditingItem) return;
      const updates: Partial<JokerData> = { rules };
      if (
        shouldOverwriteDescriptionOnRuleSave(
          ruleEditingItem.description,
          ruleEditingItem.rules,
          "joker",
        )
      ) {
        updates.description = generateDescriptionFromRules(rules, "joker");
      }
      handleUpdate(ruleEditingItem.id, updates);
    },
    [handleUpdate, ruleEditingItem],
  );

  useEffect(() => {
    const activityItemId = searchParams.get("activityItemId");
    const activityEditor = searchParams.get("activityEditor");
    if (!activityItemId || !activityEditor) return;

    const target = data.jokers.find((joker) => joker.id === activityItemId);
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
  }, [data.jokers, searchParams, setSearchParams]);

  const createBaseJoker = useCallback(async (): Promise<JokerData> => {
    const placeholder = await getRandomPlaceholder("joker");
    return {
      id: crypto.randomUUID(),
      objectType: "joker",
      name: "New Joker",
      description: "Effect description",
      rarity: 1,
      cost: 4,
      orderValue: data.jokers.length + 1,
      blueprint_compat: true,
      eternal_compat: true,
      unlocked: true,
      discovered: true,
      appears_in_shop: true,
      image: placeholder?.src || "",
      placeholderCreditIndex: placeholder?.index,
      placeholderCategory: placeholder?.category,
      objectKey: "new_joker",
      cardAppearance: {},
      rules: [],
      pools: [],
    };
  }, [data.jokers.length]);

  const handleCreate = useCallback(async () => {
    const newJoker = await createBaseJoker();
    updateJokers([...data.jokers, newJoker]);
    if (getAutoOpenNewItemDialogEnabled()) {
      setEditingItem(newJoker);
    }
  }, [createBaseJoker, data.jokers, updateJokers]);

  const handleCreateFromTemplate = useCallback(
    async (template: ItemTemplateEntry) => {
      const baseJoker = await createBaseJoker();
      const templatedJoker = instantiateItemFromTemplate(baseJoker, template);
      updateJokers([...data.jokers, templatedJoker]);
      if (getAutoOpenNewItemDialogEnabled()) {
        setEditingItem(templatedJoker);
      }
      pushGlobalAlert({
        type: "success",
        title: "Template Applied",
        message: `Created Joker from \"${template.name}\".`,
      });
    },
    [createBaseJoker, data.jokers, updateJokers],
  );

  const handleDelete = useCallback(
    (id: string) => {
      updateJokers((previous) => previous.filter((j) => j.id !== id));
    },
    [updateJokers],
  );

  const handleExport = useCallback(
    async (joker: JokerData) => {
      try {
        const currentData = dataRef.current;
        await exportSingleJokerRust(joker as any, currentData.metadata.prefix, {
          globalUserVariables: collectGlobalVariables(currentData).map(
            (entry) => entry.variable,
          ),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/not\s+implemented/i.test(message)) {
          window.alert(
            "Joker export failed: some selected rules are not implemented yet.",
          );
          return;
        }
        window.alert(`Joker export failed: ${message}`);
      }
    },
    [],
  );

  const {
    isDialogOpen: isDeleteDialogOpen,
    pendingLabel: pendingDeleteLabel,
    requestDelete,
    confirmDelete,
    handleOpenChange: handleDeleteDialogChange,
  } = useConfirmDelete(handleDelete);

  const rarityOptions = useMemo(() => getRarityDropdownOptions(), []);
  const showcasePreviewJoker = useMemo(() => {
    if (!showcaseItem) {
      return null;
    }

    const locVars = getAllVariables(showcaseItem).map(getVariableDisplayValue);
    return {
      ...showcaseItem,
      locVars: {
        vars: locVars,
      },
    } as JokerData;
  }, [showcaseItem]);

  // 4. Stable Props for Search/Sort/Filter
  const searchProps = useMemo(
    () => ({
      searchFn: (item: JokerData, term: string) =>
        fuzzyMatchAny([item.name, item.description], term),
    }),
    [],
  );

  const sortOptions = useMemo(
    () => [
      {
        label: "ID Order",
        value: "orderValue",
        sortFn: (a: JokerData, b: JokerData) => a.orderValue - b.orderValue,
      },
      {
        label: "Name",
        value: "name",
        sortFn: (a: JokerData, b: JokerData) => a.name.localeCompare(b.name),
      },
      {
        label: "Cost",
        value: "cost",
        sortFn: (a: JokerData, b: JokerData) => (a.cost || 0) - (b.cost || 0),
      },
      {
        label: "Rarity",
        value: "rarity",
        sortFn: (a: JokerData, b: JokerData) =>
          Number(a.rarity) - Number(b.rarity),
      },
    ],
    [],
  );

  const filterOptions = useMemo(
    () => [
      {
        id: "rarity",
        label: "Rarity",
        options: rarityOptions,
        predicate: (item: JokerData, val: any) =>
          String(item.rarity) === String(val),
      },
    ],
    [rarityOptions],
  );

  // 5. Stable Render Card Function
  // CRITICAL: This was missing 'useCallback'.
  // Without this, every time 'editingItem' changed, this function was recreated,
  // causing GenericItemPage to re-render ALL cards in the background.
  const renderCard = useCallback(
    (joker: JokerData) => (
      <GenericItemCard
        key={joker.id}
        name={joker.name}
        description={joker.description}
        locVars={getItemLocVarsFromUserVariables(joker)}
        cost={joker.cost}
        idValue={joker.orderValue}
        rarity={joker.rarity}
        imageLayers={joker.imageLayers}
        overlayImage={joker.overlayImage}
        hasManualEdits={Boolean((joker as { customCode?: unknown }).customCode)}
        onUpdate={(updates) => handleUpdate(joker.id, updates)}
        onDuplicate={() => {
          const duplicatedJoker: JokerData = {
            ...joker,
            id: crypto.randomUUID(),
            name: `${joker.name} (Copy)`,
            objectKey: `${joker.objectKey}_copy`,
            orderValue: 0,
          };
          updateJokers((previous) => [
            ...previous,
            { ...duplicatedJoker, orderValue: previous.length + 1 },
          ]);
        }}
        image={
          <div className="w-full h-full relative group cursor-pointer rounded-lg overflow-hidden flex items-center justify-center">
            {joker.image ? (
              <img
                src={joker.image}
                className="w-full h-full object-contain [image-rendering:pixelated]"
                alt={joker.name}
              />
            ) : (
              <div className="text-muted-foreground/30 text-xs font-bold uppercase tracking-widest border-2 border-dashed border-border p-4 rounded-lg">
                No Image
              </div>
            )}
          </div>
        }
        showPlaceholderPickerButton
        onOpenPlaceholderPicker={() => {
          setPlaceholderTargetId(joker.id);
          setIsPlaceholderPickerOpen(true);
        }}
        properties={[
          {
            id: "eternal",
            label: joker.eternal_compat ? "Eternal Compatible" : "No Eternal",
            icon: (
              <Star
                className="h-4 w-4"
                weight={joker.eternal_compat ? "fill" : "regular"}
              />
            ),
            isActive: joker.eternal_compat,
            variant: "purple",
            onClick: () =>
              handleUpdate(joker.id, {
                eternal_compat: !joker.eternal_compat,
              }),
          },
          {
            id: "perishable",
            label: joker.perishable_compat
              ? "Perishable Compatible"
              : "No Perishable",
            icon: <Clock className="h-4 w-4" weight="regular" />,
            isActive: !!joker.perishable_compat,
            variant: "warning",
            onClick: () =>
              handleUpdate(joker.id, {
                perishable_compat: !joker.perishable_compat,
              }),
          },
          {
            id: "blueprint",
            label: joker.blueprint_compat
              ? "Blueprint Compatible"
              : "No Blueprint",
            icon: (
              <Lightning
                className="h-4 w-4"
                weight={joker.blueprint_compat ? "fill" : "regular"}
              />
            ),
            isActive: joker.blueprint_compat,
            variant: "info",
            onClick: () =>
              handleUpdate(joker.id, {
                blueprint_compat: !joker.blueprint_compat,
              }),
          },
          {
            id: "shop",
            label: joker.appears_in_shop
              ? "Appears in Shop"
              : "Hidden from Shop",
            icon: joker.appears_in_shop ? (
              <CurrencyDollar className="h-4 w-4" weight="regular" />
            ) : (
              <Prohibit className="h-4 w-4" weight="regular" />
            ),
            isActive: joker.appears_in_shop,
            variant: "success",
            onClick: () =>
              handleUpdate(joker.id, {
                appears_in_shop: !joker.appears_in_shop,
              }),
          },
          {
            id: "unlocked",
            label: joker.unlocked ? "Unlocked" : "Locked",
            icon: joker.unlocked ? (
              <LockOpen className="h-4 w-4" weight="regular" />
            ) : (
              <Lock className="h-4 w-4" weight="regular" />
            ),
            isActive: joker.unlocked,
            variant: "warning",
            onClick: () =>
              handleUpdate(joker.id, { unlocked: !joker.unlocked }),
          },
          {
            id: "discovered",
            label: joker.discovered ? "Discovered" : "Undiscovered",
            icon: joker.discovered ? (
              <Eye className="h-4 w-4" weight="regular" />
            ) : (
              <EyeSlash className="h-4 w-4" weight="regular" />
            ),
            isActive: joker.discovered,
            variant: "default",
            onClick: () =>
              handleUpdate(joker.id, { discovered: !joker.discovered }),
          },
          {
            id: "force_eternal",
            label: joker.force_eternal ? "Force Eternal" : "Normal Eternal",
            icon: <WarningCircle className="h-4 w-4" weight="regular" />,
            isActive: joker.force_eternal === true,
            variant: "purple",
            onClick: () =>
              handleUpdate(joker.id, {
                force_eternal: !joker.force_eternal,
              }),
          },
          {
            id: "force_perishable",
            label: joker.force_perishable
              ? "Force Perishable"
              : "Normal Perishable",
            icon: <ClockCountdown className="h-4 w-4" weight="regular" />,
            isActive: joker.force_perishable === true,
            variant: "warning",
            onClick: () =>
              handleUpdate(joker.id, {
                force_perishable: !joker.force_perishable,
              }),
          },
          {
            id: "force_rental",
            label: joker.force_rental ? "Force Rental" : "Normal Rental",
            icon: <Tag className="h-4 w-4" weight="regular" />,
            isActive: joker.force_rental === true,
            variant: "info",
            onClick: () =>
              handleUpdate(joker.id, {
                force_rental: !joker.force_rental,
              }),
          },
        ]}
        actions={[
          {
            id: "edit",
            label: "Edit Info",
            icon: <PencilSimple className="h-5 w-5" weight="bold" />,
            onClick: () => setEditingItem(joker),
            variant: "secondary",
          },
          {
            id: "rules",
            label: "Edit Rules",
            icon: <Sparkle className="h-5 w-5" weight="bold" />,
            badgeCount: joker.rules?.length ?? 0,
            onClick: () => {
              setEditingItem(null);
              setRuleEditingItem(joker);
            },
            variant: "outline",
          },
          {
            id: "showcase",
            label: "Showcase",
            icon: <VideoCamera className="h-5 w-5" weight="regular" />,
            onClick: () => setShowcaseItem(joker),
            variant: "ghost",
          },
          {
            id: "export",
            label: "Export Code",
            icon: <DownloadSimple className="h-5 w-5" weight="regular" />,
            onClick: () => handleExport(joker),
            variant: "ghost",
          },
          {
            id: "saveTemplate",
            label: "Save as Template",
            icon: <BookmarksSimple className="h-5 w-5" weight="regular" />,
            onClick: () => {
              createItemTemplate({
                name: `${joker.name} Template`,
                itemType: "joker",
                payload: joker as unknown as Record<string, unknown>,
              });
              pushGlobalAlert({
                type: "success",
                title: "Template Saved",
                message: `Saved \"${joker.name}\" as a template.`,
              });
            },
            variant: "ghost",
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
            icon: <Trash className="h-5 w-5" weight="bold" />,
            variant: "destructive",
            onClick: () => requestDelete(joker.id, joker.name),
          },
        ]}
      />
    ),
    [
      createItemTemplate,
      handleExport,
      handleUpdate,
      requestDelete,
      updateJokers,
    ],
  );

  const renderCompactCard = useCallback(
    (joker: JokerData) => (
      <GenericItemCardCompact
        name={joker.name}
        overlayImage={joker.overlayImage}
        image={
          joker.image ? (
            <img
              src={joker.image}
              className="w-full h-full object-contain [image-rendering:pixelated]"
              alt={joker.name}
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
            onClick: () => setEditingItem(joker),
            variant: "secondary",
          },
          {
            id: "rules",
            label: "Edit Rules",
            icon: <Sparkle weight="bold" />,
            onClick: () => {
              setEditingItem(null);
              setRuleEditingItem(joker);
            },
            variant: "outline",
          },
          {
            id: "showcase",
            label: "Showcase",
            icon: <VideoCamera weight="regular" />,
            onClick: () => setShowcaseItem(joker),
            variant: "ghost",
          },
          {
            id: "export",
            label: "Export Code",
            icon: <DownloadSimple weight="regular" />,
            onClick: () => handleExport(joker),
            variant: "ghost",
          },
          {
            id: "saveTemplate",
            label: "Save as Template",
            icon: <BookmarksSimple weight="regular" />,
            onClick: () => {
              createItemTemplate({
                name: `${joker.name} Template`,
                itemType: "joker",
                payload: joker as unknown as Record<string, unknown>,
              });
              pushGlobalAlert({
                type: "success",
                title: "Template Saved",
                message: `Saved \"${joker.name}\" as a template.`,
              });
            },
            variant: "ghost",
          },
          {
            id: "duplicate",
            label: "Duplicate",
            icon: <Copy weight="regular" />,
            onClick: () => {
              const duplicatedJoker: JokerData = {
                ...joker,
                id: crypto.randomUUID(),
                name: `${joker.name} (Copy)`,
                objectKey: `${joker.objectKey}_copy`,
                orderValue: 0,
              };
              updateJokers((previous) => [
                ...previous,
                { ...duplicatedJoker, orderValue: previous.length + 1 },
              ]);
            },
            variant: "ghost",
          },
          {
            id: "delete",
            label: "Delete",
            icon: <Trash weight="bold" />,
            variant: "destructive",
            onClick: () => requestDelete(joker.id, joker.name),
          },
        ]}
      />
    ),
    [
      createItemTemplate,
      handleExport,
      requestDelete,
      updateJokers,
    ],
  );

  return (
    <>
      <GenericItemPage<JokerData>
        title="Jokers"
        subtitle={modName}
        items={data.jokers}
        isLoading={isHydrating}
        onAddNew={handleCreate}
        onAddFromTemplate={
          jokerTemplates.length > 0
            ? () => setIsTemplatePickerOpen(true)
            : undefined
        }
        addNewLabel="Create Joker"
        addFromTemplateLabel="Create Joker from Template"
        searchProps={searchProps}
        sortOptions={sortOptions}
        filterOptions={filterOptions}
        renderCard={renderCard}
        renderCompactCard={renderCompactCard}
      />
      <TemplatePickerDialog
        open={isTemplatePickerOpen}
        onOpenChange={setIsTemplatePickerOpen}
        title="Create Joker from Template"
        description="Select a Joker template to start from."
        templates={jokerTemplates}
        onUseTemplate={(template) =>
          handleCreateFromTemplate(template as ItemTemplateEntry)
        }
      />

      <EditJokerDialog
        editingItem={editingItem}
        setEditingItem={setEditingItem}
        onSave={handleInfoSave}
        modPrefix={data.metadata.prefix}
      />
      {ruleEditingItem && (
        <RuleBuilder
          isOpen={true}
          onClose={() => setRuleEditingItem(null)}
          existingRules={ruleEditingItem.rules ?? []}
          onSave={handleRulesSave}
          item={ruleEditingItem}
          onUpdateItem={(updates: Partial<JokerData>) => {
            handleUpdate(ruleEditingItem.id, updates as Partial<JokerData>);
            setRuleEditingItem((prev) =>
              prev ? { ...prev, ...(updates as Partial<JokerData>) } : prev,
            );
          }}
          itemType="joker"
        />
      )}
      <PlaceholderPickerDialog
        open={isPlaceholderPickerOpen}
        onOpenChange={setIsPlaceholderPickerOpen}
        initialCategory="joker"
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
        title="Delete this joker?"
        description={
          <span>
            You are about to delete{" "}
            <span className="font-semibold text-foreground">
              {pendingDeleteLabel || "this joker"}
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
        title={showcaseItem?.name || "Joker"}
        fileNameBase={showcaseItem?.name || "joker"}
        onOpenChange={(open) => {
          if (!open) {
            setShowcaseItem(null);
          }
        }}
      >
        {showcasePreviewJoker && (
          <BalatroCard
            type="joker"
            data={showcasePreviewJoker}
            size="lg"
            rarityName={getRarityDisplayName(showcasePreviewJoker.rarity)}
            rarityColor={getRarityBadgeColor(showcasePreviewJoker.rarity)}
            showCost
          />
        )}
      </ItemShowcaseDialog>
    </>
  );
}



