import { useCallback, useMemo } from "react";
import { BalatroCard } from "@/components/balatro/balatro-card";
import {
  GenericItemDialog,
  type DialogTab,
} from "@/components/pages/generic-item-dialog";
import { GenericDialogColorPicker } from "@/components/ui/generic-dialog-color-picker";
import { SOUNDS } from "@/lib/balatro/balatro-utils";
import { processBalatroCardImage } from "@/lib/media/image-processing-utils";
import type { SealData } from "@/lib/core/types";
import { Image as ImageIcon, Palette, TextT } from "@phosphor-icons/react";

interface EditSealDialogProps {
  editingItem: SealData | null;
  setEditingItem: (item: SealData | null) => void;
  onSave: (id: string, updates: Partial<SealData>) => void;
}

export function EditSealDialog({
  editingItem,
  setEditingItem,
  onSave,
}: EditSealDialogProps) {
  const processSealImage = processBalatroCardImage;
  const sealDialogTabs: DialogTab<SealData>[] = useMemo(
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
                processFile: processSealImage,
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
                placeholder: "Seal Name",
                className: "col-span-2",
                validate: (val) => (!val ? "Name is required" : null),
              },
              {
                id: "objectKey",
                type: "text",
                label: "Object Key",
                placeholder: "seal_name",
                className: "col-span-2",
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
        id: "badge",
        label: "Badge",
        icon: Palette,
        groups: [
          {
            id: "colors",
            label: "Badge Color",
            fields: [
              {
                id: "badge_colour",
                type: "custom",
                render: (value, onChange) => (
                  <GenericDialogColorPicker
                    value={value}
                    onChange={onChange}
                    defaultColor="#000000"
                    valueMode="with-hash"
                    placeholder="#000000"
                  />
                ),
              },
            ],
          },
          {
            id: "audio",
            label: "Sound",
            className: "grid grid-cols-2 gap-4",
            fields: [
              {
                id: "sound",
                type: "select",
                label: "Sound Effect",
                options: SOUNDS().map((sound) => ({
                  value: sound.key,
                  label: sound.label,
                })),
              },
              {
                id: "pitch",
                type: "number",
                label: "Pitch",
                placeholder: "1.0",
                step: 0.1,
              },
              {
                id: "volume",
                type: "number",
                label: "Volume",
                placeholder: "1.0",
                step: 0.1,
              },
            ],
          },
        ],
      },
    ],
    [processSealImage],
  );

  const renderPreview = useCallback(
    (item: SealData | null) => (
      <BalatroCard
        type="seal"
        data={item || {}}
        isSeal={true}
        sealBadgeColor={item?.badge_colour}
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
      title={`Edit ${editingItem?.name || "Seal"}`}
      description="Modify seal properties."
      tabs={sealDialogTabs}
      onSave={onSave}
      renderPreview={renderPreview}
      showPlaceholderPicker
      placeholderCategory="seal"
    />
  );
}
