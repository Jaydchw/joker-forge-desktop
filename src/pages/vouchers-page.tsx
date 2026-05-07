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
import { Rule, VoucherData } from "@/lib/types";
import { fuzzyMatchAny } from "@/lib/search";
import {
  PencilSimple,
  Sparkle,
  Trash,
  LockOpen,
  Lock,
  Eye,
  EyeSlash,
  Copy,
  Bookmark,
  Prohibit,
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
import { exportSingleItemRust } from "@/lib/rust-codegen-export";
import { collectGlobalVariables } from "@/lib/global-user-variables";
import { applyItemUpdatesWithOrderSwap } from "@/lib/item-order";
import {
  instantiateItemFromTemplate,
  useTemplateStore,
  type ItemTemplateEntry,
} from "@/lib/templates";
import { TemplatePickerDialog } from "@/components/templates/template-picker-dialog";
import { pushGlobalAlert } from "@/lib/global-alerts-bus";
import { EditVoucherDialog } from "@/components/edit-dialogs";

export default function VouchersPage() {
  const { data, updateVouchers, isHydrating } = useProjectData();
  const modName = useModName();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editingItem, setEditingItem] = useState<VoucherData | null>(null);
  const [ruleEditingItem, setRuleEditingItem] = useState<VoucherData | null>(
    null,
  );
  const [showcaseItem, setShowcaseItem] = useState<VoucherData | null>(null);
  const [isPlaceholderPickerOpen, setIsPlaceholderPickerOpen] = useState(false);
  const [placeholderTargetId, setPlaceholderTargetId] = useState<string | null>(
    null,
  );
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const { createItemTemplate, getItemTemplatesForType } = useTemplateStore();
  const voucherTemplates = useMemo(
    () => getItemTemplatesForType("voucher"),
    [getItemTemplatesForType],
  );

  const handleUpdate = useCallback(
    (id: string, updates: Partial<VoucherData>) => {
      const normalizedUpdates = {
        ...updates,
        draw_shader_sprite:
          updates.draw_shader_sprite === ""
            ? false
            : updates.draw_shader_sprite,
      };
      updateVouchers(
        applyItemUpdatesWithOrderSwap(data.vouchers, id, normalizedUpdates),
      );
    },
    [data.vouchers, updateVouchers],
  );

  const handleInfoSave = useCallback(
    (id: string, updates: Partial<VoucherData>) => {
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

    const target = data.vouchers.find((item) => item.id === activityItemId);
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
  }, [data.vouchers, searchParams, setSearchParams]);

  const createBaseVoucher = useCallback(async (): Promise<VoucherData> => {
    const placeholder = await getRandomPlaceholder("voucher");
    return {
      id: crypto.randomUUID(),
      objectType: "voucher",
      name: "New Voucher",
      description: "Effect",
      image: placeholder?.src || "",
      placeholderCreditIndex: placeholder?.index,
      placeholderCategory: placeholder?.category,
      objectKey: "new_voucher",
      unlocked: true,
      discovered: true,
      cost: 10,
      rules: [],
      orderValue: data.vouchers.length + 1,
    };
  }, [data.vouchers.length]);

  const handleCreate = useCallback(async () => {
    const newVoucher = await createBaseVoucher();
    updateVouchers([...data.vouchers, newVoucher]);
    if (getAutoOpenNewItemDialogEnabled()) {
      setEditingItem(newVoucher);
    }
  }, [createBaseVoucher, data.vouchers, updateVouchers]);

  const handleCreateFromTemplate = useCallback(
    async (template: ItemTemplateEntry) => {
      const baseVoucher = await createBaseVoucher();
      const templatedVoucher = instantiateItemFromTemplate(
        baseVoucher,
        template,
      );
      updateVouchers([...data.vouchers, templatedVoucher]);
      if (getAutoOpenNewItemDialogEnabled()) {
        setEditingItem(templatedVoucher);
      }
      pushGlobalAlert({
        type: "success",
        title: "Template Applied",
        message: `Created Voucher from \"${template.name}\".`,
      });
    },
    [createBaseVoucher, data.vouchers, updateVouchers],
  );

  const handleDelete = useCallback(
    (id: string) => updateVouchers(data.vouchers.filter((v) => v.id !== id)),
    [data.vouchers, updateVouchers],
  );

  const handleExport = useCallback(
    async (item: VoucherData) => {
      try {
        await exportSingleItemRust(
          item as any,
          "voucher",
          data.metadata.prefix,
          {
            globalUserVariables: collectGlobalVariables(data).map(
              (entry) => entry.variable,
            ),
          },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        window.alert(`Voucher export failed: ${message}`);
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
      searchFn: (item: VoucherData, term: string) =>
        fuzzyMatchAny([item.name], term),
    }),
    [],
  );

  const sortOptions = useMemo(
    () => [
      {
        label: "Name",
        value: "name",
        sortFn: (a: VoucherData, b: VoucherData) =>
          a.name.localeCompare(b.name),
      },
      {
        label: "Cost",
        value: "cost",
        sortFn: (a: VoucherData, b: VoucherData) => a.cost - b.cost,
      },
    ],
    [],
  );

  const renderCard = useCallback(
    (item: VoucherData) => (
      <GenericItemCard
        key={item.id}
        name={item.name}
        description={item.description}
        cost={item.cost}
        idValue={item.orderValue}
        imageLayers={item.imageLayers}
        overlayImage={item.overlayImage}
        onUpdate={(updates) => handleUpdate(item.id, updates)}
        onDuplicate={() => {
          const duplicatedItem: VoucherData = {
            ...item,
            id: crypto.randomUUID(),
            name: `${item.name} (Copy)`,
            objectKey: `${item.objectKey}_copy`,
            orderValue: data.vouchers.length + 1,
          };
          updateVouchers([...data.vouchers, duplicatedItem]);
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
            id: "requires_activetor",
            label: item.requires_activetor ? "Requires Voucher" : "Independent",
            icon: <Bookmark className="h-4 w-4" weight="regular" />,
            isActive: item.requires_activetor !== false,
            variant: "info",
            onClick: () =>
              handleUpdate(item.id, {
                requires_activetor: !item.requires_activetor,
              }),
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
                itemType: "voucher",
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
    (item: VoucherData) => (
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
                itemType: "voucher",
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
              const duplicatedVoucher: VoucherData = {
                ...item,
                id: crypto.randomUUID(),
                name: `${item.name} (Copy)`,
                objectKey: `${item.objectKey}_copy`,
                orderValue: data.vouchers.length + 1,
              };
              updateVouchers([...data.vouchers, duplicatedVoucher]);
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
      data.vouchers,
      updateVouchers,
    ],
  );

  return (
    <>
      <GenericItemPage<VoucherData>
        title="Vouchers"
        subtitle={modName}
        items={data.vouchers}
        isLoading={isHydrating}
        onAddNew={handleCreate}
        onAddFromTemplate={
          voucherTemplates.length > 0
            ? () => setIsTemplatePickerOpen(true)
            : undefined
        }
        addNewLabel="Create Voucher"
        addFromTemplateLabel="Create Voucher from Template"
        searchProps={searchProps}
        sortOptions={sortOptions}
        renderCard={renderCard}
        renderCompactCard={renderCompactCard}
      />
      <TemplatePickerDialog
        open={isTemplatePickerOpen}
        onOpenChange={setIsTemplatePickerOpen}
        title="Create Voucher from Template"
        description="Select a Voucher template to start from."
        templates={voucherTemplates}
        onUseTemplate={(template) =>
          handleCreateFromTemplate(template as ItemTemplateEntry)
        }
      />
      <EditVoucherDialog
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
          onUpdateItem={(updates: Partial<VoucherData>) => {
            handleUpdate(ruleEditingItem.id, updates as Partial<VoucherData>);
            setRuleEditingItem((prev) =>
              prev ? { ...prev, ...updates } : prev,
            );
          }}
          itemType="voucher"
        />
      )}
      <PlaceholderPickerDialog
        open={isPlaceholderPickerOpen}
        onOpenChange={setIsPlaceholderPickerOpen}
        initialCategory="voucher"
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
        title="Delete this voucher?"
        description={
          <span>
            You are about to delete{" "}
            <span className="font-semibold text-foreground">
              {pendingDeleteLabel || "this voucher"}
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
        title={showcaseItem?.name || "Voucher"}
        fileNameBase={showcaseItem?.name || "voucher"}
        onOpenChange={(open) => {
          if (!open) {
            setShowcaseItem(null);
          }
        }}
      >
        {showcaseItem && (
          <BalatroCard type="voucher" data={showcaseItem} size="lg" showCost />
        )}
      </ItemShowcaseDialog>
    </>
  );
}



