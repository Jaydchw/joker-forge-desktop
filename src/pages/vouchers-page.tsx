import { useState, useCallback, useMemo } from "react";
import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCard } from "@/components/pages/generic-item-card";
import { GenericItemCardCompact } from "@/components/pages/generic-item-card-compact";
import { useProjectData, useModName } from "@/lib/storage";
import { Rule, VoucherData } from "@/lib/types";
import {
  PencilSimple,
  Sparkle,
  Trash,
  Image as ImageIcon,
  TextT,
  LockKey,
  LockOpen,
  Lock,
  Eye,
  EyeSlash,
  Copy,
  Bookmark,
  Prohibit,
  VideoCamera,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  GenericItemDialog,
  DialogTab,
} from "@/components/pages/generic-item-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { BalatroCard } from "@/components/balatro/balatro-card";
import {
  COMPARISON_OPERATORS,
  CUSTOM_SHADERS,
  VANILLA_SHADERS,
} from "@/lib/balatro-utils";
import {
  unlockTriggerOptions,
  vouchersUnlockOptions,
} from "@/lib/unlock-utils";
import { getRandomPlaceholder } from "@/lib/placeholder-assets.ts";
import { PlaceholderPickerDialog } from "@/components/pages/placeholder-picker-dialog";
import { RuleBuilder } from "@/components/rule-builder";
import { processBalatroCardImage } from "@/lib/media/image-processing-utils";
import { ItemShowcaseDialog } from "@/components/pages/item-showcase-dialog";

export default function VouchersPage() {
  const { data, updateVouchers, isHydrating } = useProjectData();
  const modName = useModName();
  const [editingItem, setEditingItem] = useState<VoucherData | null>(null);
  const [ruleEditingItem, setRuleEditingItem] = useState<VoucherData | null>(
    null,
  );
  const [showcaseItem, setShowcaseItem] = useState<VoucherData | null>(null);
  const [isPlaceholderPickerOpen, setIsPlaceholderPickerOpen] = useState(false);
  const [placeholderTargetId, setPlaceholderTargetId] = useState<string | null>(
    null,
  );

  const processVoucherImage = processBalatroCardImage;

  const handleUpdate = useCallback(
    (id: string, updates: Partial<VoucherData>) => {
      updateVouchers(
        data.vouchers.map((v) =>
          v.id === id
            ? {
                ...v,
                ...updates,
                draw_shader_sprite:
                  updates.draw_shader_sprite === ""
                    ? false
                    : updates.draw_shader_sprite,
              }
            : v,
        ),
      );
    },
    [data.vouchers, updateVouchers],
  );

  const handleCreate = useCallback(async () => {
    const placeholder = await getRandomPlaceholder("voucher");
    const newVoucher: VoucherData = {
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
    updateVouchers([...data.vouchers, newVoucher]);
  }, [data.vouchers, updateVouchers]);

  const handleDelete = useCallback(
    (id: string) => updateVouchers(data.vouchers.filter((v) => v.id !== id)),
    [data.vouchers, updateVouchers],
  );

  const {
    isDialogOpen: isDeleteDialogOpen,
    pendingLabel: pendingDeleteLabel,
    requestDelete,
    confirmDelete,
    handleOpenChange: handleDeleteDialogChange,
  } = useConfirmDelete(handleDelete);

  const voucherDialogTabs: DialogTab<VoucherData>[] = useMemo(
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
                processFile: processVoucherImage,
              },
              {
                id: "overlayImage",
                type: "image",
                label: "Overlay Sprite",
                description: "Optional overlay layer",
                processFile: processVoucherImage,
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
                placeholder: "Voucher Name",
                className: "col-span-2",
                validate: (val) => (!val ? "Name is required" : null),
              },
              {
                id: "objectKey",
                type: "text",
                label: "Object Key",
                placeholder: "v_name",
                className: "col-span-2",
              },
              {
                id: "cost",
                type: "number",
                label: "Cost ($)",
                min: 0,
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
                id: "requires_activetor",
                type: "switch",
                label: "Requires Voucher",
              },
              {
                id: "can_repeat_soul",
                type: "switch",
                label: "Can Repeat Soul",
              },
            ],
          },
          {
            id: "req_voucher",
            label: "Requirement",
            fields: [
              {
                id: "requires",
                type: "text",
                label: "Required Voucher ID",
                placeholder: "v_overstock_norm",
                hidden: (item) => !item.requires_activetor,
              },
            ],
          },
          {
            id: "unlock",
            label: "Unlock Requirements",
            fields: [
              {
                id: "unlockTrigger",
                type: "select",
                label: "Trigger",
                options: [
                  { label: "None", value: "" },
                  ...unlockTriggerOptions,
                ],
                hidden: (item) => item.unlocked,
              },
              {
                id: "unlockOperator",
                type: "select",
                label: "Operator",
                options: COMPARISON_OPERATORS.map((op) => ({
                  value: op.value,
                  label: op.label,
                })),
                hidden: (item) => item.unlocked || !item.unlockTrigger,
              },
              {
                id: "unlockCount",
                type: "number",
                label: "Amount",
                min: 0,
                hidden: (item) => item.unlocked || !item.unlockTrigger,
              },
              {
                id: "unlockProperties",
                type: "custom",
                label: "Properties",
                hidden: (item) => item.unlocked || !item.unlockTrigger,
                render: (value, onChange, item) => {
                  const props = Array.isArray(value) ? value : [];
                  const currentTrigger = item.unlockTrigger || "";
                  const availableOptions =
                    vouchersUnlockOptions[currentTrigger]?.categories || [];
                  const addPropertyHidden =
                    (currentTrigger === "career_stat" && props.length > 0) ||
                    !currentTrigger ||
                    currentTrigger === "chip_score";

                  return (
                    <div className="space-y-3 bg-muted/20 p-4 rounded-lg border border-border/50">
                      {props.map((prop: any, idx: number) => {
                        const selectedCategory = availableOptions.find(
                          (c: any) => c.value === prop.category,
                        );
                        const propertyOptions = selectedCategory?.options || [];

                        return (
                          <div key={idx} className="flex gap-2 items-center">
                            <div className="flex-1">
                              <select
                                value={prop.category}
                                onChange={(e) => {
                                  const newProps = [...props];
                                  newProps[idx] = {
                                    ...newProps[idx],
                                    category: e.target.value,
                                    property: "",
                                  };
                                  onChange(newProps);
                                }}
                                className="w-full h-9 bg-background border rounded px-2 text-sm"
                              >
                                <option value="">Select Category</option>
                                {availableOptions.map((opt: any) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="flex-1">
                              <select
                                value={prop.property}
                                onChange={(e) => {
                                  const newProps = [...props];
                                  newProps[idx] = {
                                    ...newProps[idx],
                                    property: e.target.value,
                                  };
                                  onChange(newProps);
                                }}
                                className="w-full h-9 bg-background border rounded px-2 text-sm"
                              >
                                <option value="">Select Property</option>
                                {propertyOptions.map((opt: any) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                              onClick={() =>
                                onChange(
                                  props.filter(
                                    (_: any, i: number) => i !== idx,
                                  ),
                                )
                              }
                            >
                              <Trash className="h-4 w-4" weight="bold" />
                            </Button>
                          </div>
                        );
                      })}
                      {!addPropertyHidden && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            onChange([...props, { category: "", property: "" }])
                          }
                          className="w-full border-dashed"
                        >
                          <Sparkle className="mr-2 h-4 w-4" /> Add Property
                        </Button>
                      )}
                    </div>
                  );
                },
              },
              {
                id: "unlockDescription",
                type: "textarea",
                label: "Unlock Text",
                placeholder: "Describe how to unlock this voucher...",
                hidden: (item) => item.unlocked,
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
        id: "settings",
        label: "Advanced",
        icon: LockKey,
        groups: [
          {
            id: "shader",
            label: "Custom Shader",
            fields: [
              {
                id: "draw_shader_sprite",
                type: "select",
                label: "Shader",
                options: [
                  { value: "", label: "None" },
                  ...VANILLA_SHADERS.map((shader) => ({
                    value: shader.key,
                    label: shader.label,
                  })),
                  ...CUSTOM_SHADERS.map((shader) => ({
                    value: shader.key,
                    label: shader.label,
                  })),
                ],
                description: "Applies shader effect to the sprite",
              },
            ],
          },
        ],
      },
    ],
    [processVoucherImage],
  );

  const searchProps = useMemo(
    () => ({
      searchFn: (item: VoucherData, term: string) =>
        item.name.toLowerCase().includes(term),
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

  const renderPreview = useCallback(
    (item: VoucherData | null) => (
      <BalatroCard type="voucher" data={item || {}} size="lg" />
    ),
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
            onClick: () => requestDelete(item.id, item.name),
          },
        ]}
      />
    ),
    [handleUpdate, requestDelete],
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
    [requestDelete, data.vouchers, updateVouchers],
  );

  return (
    <>
      <GenericItemPage<VoucherData>
        title="Vouchers"
        subtitle={modName}
        items={data.vouchers}
        isLoading={isHydrating}
        onAddNew={handleCreate}
        addNewLabel="Create Voucher"
        searchProps={searchProps}
        sortOptions={sortOptions}
        renderCard={renderCard}
        renderCompactCard={renderCompactCard}
      />
      <GenericItemDialog
        open={!!editingItem}
        onOpenChange={(open) => !open && setEditingItem(null)}
        item={editingItem}
        title={`Edit ${editingItem?.name || "Voucher"}`}
        description="Modify voucher properties."
        tabs={voucherDialogTabs}
        onSave={handleUpdate}
        renderPreview={renderPreview}
        showPlaceholderPicker
        placeholderCategory="voucher"
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
