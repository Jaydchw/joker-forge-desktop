import { useMemo } from "react";
import { BadgePreview } from "@/components/balatro/badge-preview";
import { GenericItemDialogMini } from "@/components/pages/generic-item-dialog-mini";
import type { DialogTab } from "@/components/pages/generic-item-dialog";
import { GenericDialogColorPicker } from "@/components/ui/generic-dialog-color-picker";
import { Input } from "@/components/ui/input";
import { slugify } from "@/lib/balatro-utils";
import type { ConsumableSetData } from "@/lib/types";
import { Palette } from "@phosphor-icons/react";

const DEFAULT_SET_COLOR = "666666";

const buildSetKey = (name: string): string => {
  const next = slugify(name);
  return next.startsWith("booster_") ? "custom_set" : next;
};

const normalizeHex = (value: string | undefined | null): string => {
  const raw = String(value || DEFAULT_SET_COLOR).replace("#", "");
  const clean = raw.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
  return `#${clean.padEnd(6, "0")}`;
};

interface EditConsumableSetDialogProps {
  editingItem: ConsumableSetData | null;
  setEditingItem: (item: ConsumableSetData | null) => void;
  onSave: (id: string, updates: Partial<ConsumableSetData>) => void;
}

export function EditConsumableSetDialog({
  editingItem,
  setEditingItem,
  onSave,
}: EditConsumableSetDialogProps) {
  const setDialogTabs: DialogTab<ConsumableSetData>[] = useMemo(
    () => [
      {
        id: "details",
        label: "Details",
        icon: Palette,
        groups: [
          {
            id: "basics",
            label: "Basics",
            className: "grid grid-cols-2 gap-6",
            fields: [
              {
                id: "name",
                type: "custom",
                label: "Name",
                render: (value, onChange, _item, setField) => (
                  <Input
                    value={String(value || "")}
                    placeholder="Mystical"
                    onChange={(event) => {
                      const nextName = event.target.value;
                      onChange(nextName);
                      setField("key", buildSetKey(nextName));
                    }}
                  />
                ),
                validate: (val) => (!val ? "Name is required" : null),
              },
              {
                id: "key",
                type: "text",
                label: "Key",
                placeholder: "mystical",
                description: "Used as the set identifier",
              },
              {
                id: "collection_name",
                type: "text",
                label: "Collection Name",
                placeholder: "Mystical Cards",
              },
            ],
          },
          {
            id: "shop",
            label: "Shop",
            fields: [
              {
                id: "shop_rate",
                type: "slider",
                label: "Shop Rate",
                min: 0,
                step: 0.1,
              },
              {
                id: "collection_rows",
                type: "custom",
                label: "Collection Rows",
                render: (value, onChange) => {
                  const rows = Array.isArray(value) ? value : [4, 5];
                  const [row1, row2] = rows;
                  return (
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={row1 ?? 4}
                        onChange={(event) =>
                          onChange([Number(event.target.value) || 1, row2 ?? 5])
                        }
                        className="h-9"
                      />
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={row2 ?? 5}
                        onChange={(event) =>
                          onChange([row1 ?? 4, Number(event.target.value) || 1])
                        }
                        className="h-9"
                      />
                    </div>
                  );
                },
              },
            ],
          },
          {
            id: "colors",
            label: "Colors",
            fields: [
              {
                id: "primary_colour",
                type: "custom",
                label: "Primary Color",
                render: (value, onChange) => (
                  <GenericDialogColorPicker
                    value={value}
                    onChange={onChange}
                    defaultColor={`#${DEFAULT_SET_COLOR}`}
                    valueMode="without-hash"
                    placeholder={`#${DEFAULT_SET_COLOR}`}
                  />
                ),
              },
              {
                id: "secondary_colour",
                type: "custom",
                label: "Secondary Color",
                render: (value, onChange) => (
                  <GenericDialogColorPicker
                    value={value}
                    onChange={onChange}
                    defaultColor={`#${DEFAULT_SET_COLOR}`}
                    valueMode="without-hash"
                    placeholder={`#${DEFAULT_SET_COLOR}`}
                  />
                ),
              },
              {
                id: "set_badge",
                type: "custom",
                render: (_value, _onChange, item) => {
                  const color = normalizeHex(item.primary_colour);
                  return (
                    <div className="flex items-center justify-center py-4">
                      <BadgePreview label={item.name || "Set"} color={color} />
                    </div>
                  );
                },
              },
            ],
          },
        ],
      },
    ],
    [],
  );

  return (
    <GenericItemDialogMini
      open={!!editingItem}
      onOpenChange={(open) => !open && setEditingItem(null)}
      item={editingItem}
      title={`Edit ${editingItem?.name || "Set"}`}
      description="Edit consumable set details."
      tabs={setDialogTabs}
      onSave={onSave}
    />
  );
}
