import { useCallback, useMemo } from "react";
import { BalatroCard } from "@/components/balatro/balatro-card";
import {
  GenericItemDialog,
  type DialogTab,
} from "@/components/pages/generic-item-dialog";
import { processBalatroCardImage } from "@/lib/media/image-processing-utils";
import type { EnhancementData } from "@/lib/core/types";
import { Image as ImageIcon, TextT } from "@phosphor-icons/react";

interface EditEnhancementDialogProps {
  editingItem: EnhancementData | null;
  setEditingItem: (item: EnhancementData | null) => void;
  onSave: (id: string, updates: Partial<EnhancementData>) => void;
}

export function EditEnhancementDialog({
  editingItem,
  setEditingItem,
  onSave,
}: EditEnhancementDialogProps) {
  const processEnhancementImage = processBalatroCardImage;
  const enhancementDialogTabs: DialogTab<EnhancementData>[] = useMemo(
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
                processFile: processEnhancementImage,
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
                placeholder: "Enhancement Name",
                className: "col-span-2",
                validate: (val) => (!val ? "Name is required" : null),
              },
              {
                id: "objectKey",
                type: "text",
                label: "Object Key",
                placeholder: "m_enhancement",
                className: "col-span-2",
              },
            ],
          },
          {
            id: "weight",
            label: "Appearance Weight",
            fields: [
              {
                id: "weight",
                type: "custom",
                render: (value, onChange) => (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={20}
                        step={0.25}
                        value={typeof value === "number" ? value : 0}
                        onChange={(e) => onChange(parseFloat(e.target.value))}
                        className="flex-1 h-2 bg-muted rounded appearance-none cursor-pointer"
                      />
                      <input
                        type="number"
                        min={0}
                        max={20}
                        step={0.25}
                        value={typeof value === "number" ? value : 0}
                        onChange={(e) =>
                          onChange(parseFloat(e.target.value) || 0)
                        }
                        className="w-20 h-9 px-2 rounded border bg-background text-sm"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Higher values appear more frequently.
                    </p>
                  </div>
                ),
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
                id: "any_suit",
                type: "switch",
                label: "Works with Any Suit",
              },
              {
                id: "replace_base_card",
                type: "switch",
                label: "Replaces Base Card",
              },
              {
                id: "always_scores",
                type: "switch",
                label: "Always Scores",
              },
              {
                id: "no_rank",
                type: "switch",
                label: "Remove Rank",
              },
              {
                id: "no_suit",
                type: "switch",
                label: "Remove Suit",
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
                label: "Effect Description",
                validate: (val) => (!val ? "Description is required" : null),
              },
            ],
          },
        ],
      },
    ],
    [processEnhancementImage],
  );

  const renderPreview = useCallback(
    (item: EnhancementData | null) => (
      <BalatroCard
        type="enhancement"
        data={item || {}}
        enhancementReplaceBase={item?.replace_base_card === true}
        size="lg"
      />
    ),
    [],
  );

  return (
    <GenericItemDialog
      open={!!editingItem}
      onOpenChange={(open) => !open && setEditingItem(null)}
      item={editingItem}
      title={`Edit ${editingItem?.name || "Enhancement"}`}
      description="Modify enhancement properties."
      tabs={enhancementDialogTabs}
      onSave={onSave}
      showPlaceholderPicker
      placeholderCategory="enhancement"
      renderPreview={renderPreview}
    />
  );
}
