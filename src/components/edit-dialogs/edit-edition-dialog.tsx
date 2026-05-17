import { useCallback, useMemo } from "react";
import { BalatroCard } from "@/components/balatro/balatro-card";
import {
  GenericItemDialog,
  type DialogTab,
} from "@/components/pages/generic-item-dialog";
import { GenericDialogColorPicker } from "@/components/ui/generic-dialog-color-picker";
import { CUSTOM_SHADERS, SOUNDS, VANILLA_SHADERS } from "@/lib/balatro/balatro-utils";
import type { EditionData } from "@/lib/core/types";
import { Gear, Image as ImageIcon, TextT } from "@phosphor-icons/react";

interface EditEditionDialogProps {
  editingItem: EditionData | null;
  setEditingItem: (item: EditionData | null) => void;
  onSave: (id: string, updates: Partial<EditionData>) => void;
}

export function EditEditionDialog({
  editingItem,
  setEditingItem,
  onSave,
}: EditEditionDialogProps) {
  const editionDialogTabs: DialogTab<EditionData>[] = useMemo(
    () => [
      {
        id: "properties",
        label: "Properties",
        icon: ImageIcon,
        groups: [
          {
            id: "basic",
            label: "Basic Data",
            className: "grid grid-cols-2 gap-6",
            fields: [
              {
                id: "name",
                type: "text",
                label: "Name",
                placeholder: "Edition Name",
                className: "col-span-2",
                validate: (val) => (!val ? "Name is required" : null),
              },
              {
                id: "objectKey",
                type: "text",
                label: "Object Key",
                placeholder: "e_edition",
                className: "col-span-2",
              },
              {
                id: "shader",
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
              },
              {
                id: "extra_cost",
                type: "number",
                label: "Extra Cost",
                min: 0,
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
            id: "flags",
            label: "State",
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
                id: "in_shop",
                type: "switch",
                label: "Appears in Shop",
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
            id: "shader_flags",
            label: "Shader Options",
            className: "grid grid-cols-2 gap-6",
            fields: [
              {
                id: "apply_to_float",
                type: "switch",
                label: "Apply to Floating Sprites",
              },
              {
                id: "disable_shadow",
                type: "switch",
                label: "Disable Shadow",
              },
              {
                id: "disable_base_shader",
                type: "switch",
                label: "Disable Base Shader",
              },
            ],
          },
          {
            id: "badge",
            label: "Badge Color",
            fields: [
              {
                id: "badge_colour",
                type: "custom",
                render: (value, onChange) => (
                  <GenericDialogColorPicker
                    value={value}
                    onChange={onChange}
                    defaultColor="#FFAA00"
                    valueMode="with-hash"
                    placeholder="#FFAA00"
                  />
                ),
              },
            ],
          },
          {
            id: "sound",
            label: "Sound",
            className: "grid grid-cols-2 gap-6",
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
                step: 0.1,
              },
              {
                id: "volume",
                type: "number",
                label: "Volume",
                step: 0.1,
              },
            ],
          },
        ],
      },
    ],
    [],
  );

  const renderPreview = useCallback(
    (item: EditionData | null) => (
      <BalatroCard
        type="edition"
        data={{
          ...item,
          shader: item?.shader === "" ? undefined : item?.shader,
        }}
        editionBadgeColor={item?.badge_colour}
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
      title={`Edit ${editingItem?.name || "Edition"}`}
      description="Modify edition properties."
      tabs={editionDialogTabs}
      onSave={onSave}
      renderPreview={renderPreview}
    />
  );
}
