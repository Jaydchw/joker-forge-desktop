import { useCallback, useMemo } from "react";
import { BalatroCard } from "@/components/balatro/balatro-card";
import {
  GenericItemDialog,
  type DialogTab,
} from "@/components/pages/generic-item-dialog";
import {
  getConsumableSetByKey,
  getConsumableSetDropdownOptions,
  getCustomConsumableSetData,
} from "@/lib/balatro-utils";
import { processBalatroCardImage } from "@/lib/media/image-processing-utils";
import { useProjectData } from "@/lib/storage";
import type { ConsumableData } from "@/lib/types";
import { Image as ImageIcon, TextT } from "@phosphor-icons/react";

interface EditConsumableDialogProps {
  editingItem: ConsumableData | null;
  setEditingItem: (item: ConsumableData | null) => void;
  onSave: (id: string, updates: Partial<ConsumableData>) => void;
}

export function EditConsumableDialog({
  editingItem,
  setEditingItem,
  onSave,
}: EditConsumableDialogProps) {
  const { data } = useProjectData();
  const processConsumableImage = processBalatroCardImage;

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

  const consumableDialogTabs: DialogTab<ConsumableData>[] = useMemo(
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
                processFile: processConsumableImage,
              },
              {
                id: "overlayImage",
                type: "image",
                label: "Overlay Sprite",
                description: "Optional overlay layer",
                processFile: processConsumableImage,
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
                placeholder: "Consumable Name",
                className: "col-span-2",
                validate: (val) => (!val ? "Name is required" : null),
              },
              {
                id: "objectKey",
                type: "text",
                label: "Object Key",
                placeholder: "c_tarot_name",
                description: "Internal ID",
                className: "col-span-2",
              },
              {
                id: "set",
                type: "select",
                label: "Set",
                options: getConsumableSetDropdownOptions(data.consumableSets),
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
            id: "props",
            label: "Properties",
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
                id: "hidden",
                type: "switch",
                label: "Hidden",
              },
              {
                id: "can_repeat_soul",
                type: "switch",
                label: "Can Repeat Soul",
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
                placeholder: "Description...",
                validate: (val) => (!val ? "Description is required" : null),
              },
            ],
          },
        ],
      },
    ],
    [data.consumableSets, processConsumableImage],
  );

  const renderPreview = useCallback(
    (item: ConsumableData | null) => {
      if (!item) return null;
      return (
        <BalatroCard
          type="consumable"
          data={item}
          setName={getCurrentSetName(item.set)}
          setColor={getCurrentSetColor(item.set)}
        />
      );
    },
    [getCurrentSetName, getCurrentSetColor],
  );

  return (
    <GenericItemDialog
      open={!!editingItem}
      onOpenChange={(open) => !open && setEditingItem(null)}
      item={editingItem}
      title={`Edit ${editingItem?.name || "Consumable"}`}
      description="Modify consumable properties."
      tabs={consumableDialogTabs}
      onSave={onSave}
      renderPreview={renderPreview}
      showPlaceholderPicker
      placeholderCategory="consumable"
    />
  );
}
