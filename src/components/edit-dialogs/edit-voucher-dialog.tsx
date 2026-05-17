import { useCallback, useMemo } from "react";
import { BalatroCard } from "@/components/balatro/balatro-card";
import {
  GenericItemDialog,
  type DialogTab,
} from "@/components/pages/generic-item-dialog";
import { Button } from "@/components/ui/button";
import {
  COMPARISON_OPERATORS,
  CUSTOM_SHADERS,
  VANILLA_SHADERS,
} from "@/lib/balatro/balatro-utils";
import { processBalatroCardImage } from "@/lib/media/image-processing-utils";
import type { VoucherData } from "@/lib/core/types";
import {
  unlockTriggerOptions,
  vouchersUnlockOptions,
} from "@/lib/items/unlock-utils";
import {
  Image as ImageIcon,
  LockKey,
  Sparkle,
  TextT,
  Trash,
} from "@phosphor-icons/react";

interface EditVoucherDialogProps {
  editingItem: VoucherData | null;
  setEditingItem: (item: VoucherData | null) => void;
  onSave: (id: string, updates: Partial<VoucherData>) => void;
}

export function EditVoucherDialog({
  editingItem,
  setEditingItem,
  onSave,
}: EditVoucherDialogProps) {
  const processVoucherImage = processBalatroCardImage;
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

  const renderPreview = useCallback(
    (item: VoucherData | null) => (
      <BalatroCard type="voucher" data={item || {}} size="lg" />
    ),
    [],
  );

  return (
    <GenericItemDialog
      open={!!editingItem}
      onOpenChange={(open) => !open && setEditingItem(null)}
      item={editingItem}
      title={`Edit ${editingItem?.name || "Voucher"}`}
      description="Modify voucher properties."
      tabs={voucherDialogTabs}
      onSave={onSave}
      renderPreview={renderPreview}
      showPlaceholderPicker
      placeholderCategory="voucher"
    />
  );
}
