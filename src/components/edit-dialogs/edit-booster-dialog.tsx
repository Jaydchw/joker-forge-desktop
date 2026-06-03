import { useCallback, useMemo } from "react";
import { BalatroCard } from "@/components/balatro/balatro-card";
import {
  GenericItemDialog,
  type DialogTab,
} from "@/components/pages/generic-item-dialog";
import { GenericDialogColorPicker } from "@/components/ui/generic-dialog-color-picker";
import { processBalatroCardImage } from "@/lib/media/image-processing-utils";
import type { BoosterData } from "@/lib/core/types";
import { Gear, Image as ImageIcon, TextT } from "@phosphor-icons/react";

interface EditBoosterDialogProps {
  editingItem: BoosterData | null;
  setEditingItem: (item: BoosterData | null) => void;
  onSave: (id: string, updates: Partial<BoosterData>) => void;
}

export function EditBoosterDialog({
  editingItem,
  setEditingItem,
  onSave,
}: EditBoosterDialogProps) {
  const processBoosterImage = processBalatroCardImage;
  const boosterDialogTabs: DialogTab<BoosterData>[] = useMemo(
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
                processFile: processBoosterImage,
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
                placeholder: "Booster Name",
                className: "col-span-2",
                validate: (val) => (!val ? "Name is required" : null),
              },
              {
                id: "objectKey",
                type: "text",
                label: "Object Key",
                placeholder: "p_pack",
                className: "col-span-2",
              },
              {
                id: "booster_type",
                type: "select",
                label: "Booster Type",
                options: [
                  { value: "joker", label: "Joker Pack" },
                  { value: "consumable", label: "Consumable Pack" },
                  { value: "playing_card", label: "Playing Card Pack" },
                  { value: "voucher", label: "Voucher Pack" },
                ],
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
            id: "config",
            label: "Pack Settings",
            className: "grid grid-cols-2 gap-6",
            fields: [
              {
                id: "weight",
                type: "number",
                label: "Weight",
                min: 0,
                step: 0.05,
              },
              {
                id: "config.extra",
                type: "number",
                label: "Cards in Pack",
                min: 0,
              },
              {
                id: "config.choose",
                type: "number",
                label: "Cards to Choose",
                min: 0,
              },
            ],
          },
          {
            id: "props",
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
                id: "draw_hand",
                type: "switch",
                label: "Draw to Hand",
              },
              {
                id: "instant_use",
                type: "switch",
                label: "Instant Use",
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
        id: "advanced",
        label: "Advanced",
        icon: Gear,
        groups: [
          {
            id: "advanced_fields",
            label: "Advanced Settings",
            className: "grid grid-cols-2 gap-6",
            fields: [
              {
                id: "kind",
                type: "text",
                label: "Kind",
                placeholder: "e.g. Ephemeral",
              },
              {
                id: "group_key",
                type: "text",
                label: "Group Key",
                placeholder: "k_booster_group_mystical",
              },
              {
                id: "hidden",
                type: "switch",
                label: "Hidden from Collection",
              },
            ],
          },
          {
            id: "colors",
            label: "Pack Colors",
            fields: [
              {
                id: "background_colour",
                type: "custom",
                label: "Background Color",
                render: (value, onChange) => (
                  <GenericDialogColorPicker
                    value={value}
                    onChange={onChange}
                    defaultColor="#666666"
                    valueMode="without-hash"
                    placeholder="#666666"
                  />
                ),
              },
              {
                id: "special_colour",
                type: "custom",
                label: "Special Color",
                render: (value, onChange) => (
                  <GenericDialogColorPicker
                    value={value}
                    onChange={onChange}
                    defaultColor="#666666"
                    valueMode="without-hash"
                    placeholder="#666666"
                  />
                ),
              },
            ],
          },
        ],
      },
    ],
    [processBoosterImage],
  );

  const renderPreview = useCallback(
    (item: BoosterData | null) => (
      <BalatroCard type="booster" data={item || {}} size="lg" />
    ),
    [],
  );

  return (
    <GenericItemDialog
      open={!!editingItem}
      onOpenChange={(open) => !open && setEditingItem(null)}
      item={editingItem}
      title={`Edit ${editingItem?.name || "Booster"}`}
      description="Modify booster properties."
      tabs={boosterDialogTabs}
      onSave={onSave}
      showPlaceholderPicker
      placeholderCategory="booster"
      renderPreview={renderPreview}
    />
  );
}
