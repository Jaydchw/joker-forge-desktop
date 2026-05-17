import { useMemo } from "react";
import { BadgePreview } from "@/components/balatro/badge-preview";
import { GenericItemDialogMini } from "@/components/pages/generic-item-dialog-mini";
import type { DialogTab } from "@/components/pages/generic-item-dialog";
import { GenericDialogColorPicker } from "@/components/ui/generic-dialog-color-picker";
import { Input } from "@/components/ui/input";
import { slugify } from "@/lib/balatro/balatro-utils";
import type { RarityData } from "@/lib/core/types";
import { Palette } from "@phosphor-icons/react";

const DEFAULT_BADGE_COLOR = "6A7A8B";
const VANILLA_RATES = [
  { name: "Common", weight: "0.70", color: "#009dff" },
  { name: "Uncommon", weight: "0.25", color: "#4BC292" },
  { name: "Rare", weight: "0.05", color: "#fe5f55" },
  { name: "Legendary", weight: "0.00", color: "#b26cbb" },
];

const buildRarityKey = (name: string): string => {
  const next = slugify(name);
  return next.startsWith("booster_") ? "custom_rarity" : next;
};

const normalizeHex = (value: string | undefined | null): string => {
  const raw = String(value || DEFAULT_BADGE_COLOR).replace("#", "");
  const clean = raw.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
  return `#${clean.padEnd(6, "0")}`;
};

interface EditRarityDialogProps {
  editingItem: RarityData | null;
  setEditingItem: (item: RarityData | null) => void;
  onSave: (id: string, updates: Partial<RarityData>) => void;
}

export function EditRarityDialog({
  editingItem,
  setEditingItem,
  onSave,
}: EditRarityDialogProps) {
  const rarityDialogTabs: DialogTab<RarityData>[] = useMemo(
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
                    placeholder="Mythic"
                    onChange={(event) => {
                      const nextName = event.target.value;
                      onChange(nextName);
                      setField("key", buildRarityKey(nextName));
                    }}
                  />
                ),
                validate: (val) => (!val ? "Name is required" : null),
              },
              {
                id: "key",
                type: "text",
                label: "Key",
                placeholder: "mythic",
                description: "Used as the rarity identifier",
              },
            ],
          },
          {
            id: "rates",
            label: "Shop Weight",
            fields: [
              {
                id: "default_weight",
                type: "slider",
                label: "Weight",
                min: 0,
                max: 1,
                step: 0.001,
                description:
                  "Higher values appear more frequently in the shop.",
              },
            ],
          },
          {
            id: "vanilla_rates",
            label: "Vanilla Rates",
            fields: [
              {
                id: "vanilla_rates",
                type: "custom",
                render: () => (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {VANILLA_RATES.map((rate) => (
                      <div
                        key={rate.name}
                        className="flex items-center justify-between bg-muted/10 px-3 py-2"
                      >
                        <span
                          className="font-semibold"
                          style={{ color: rate.color }}
                        >
                          {rate.name}
                        </span>
                        <span className="font-mono text-muted-foreground">
                          {rate.weight}
                        </span>
                      </div>
                    ))}
                  </div>
                ),
              },
            ],
          },
          {
            id: "colors",
            label: "Colors",
            fields: [
              {
                id: "badge_colour",
                type: "custom",
                label: "Badge Color",
                render: (value, onChange) => (
                  <GenericDialogColorPicker
                    value={value}
                    onChange={onChange}
                    defaultColor={`#${DEFAULT_BADGE_COLOR}`}
                    valueMode="without-hash"
                    placeholder={`#${DEFAULT_BADGE_COLOR}`}
                  />
                ),
              },
              {
                id: "badge_preview",
                type: "custom",
                render: (_value, _onChange, item) => {
                  const color = normalizeHex(item.badge_colour);
                  return (
                    <div className="flex items-center justify-center py-4">
                      <BadgePreview
                        label={item.name || "Rarity"}
                        color={color}
                      />
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
      title={`Edit ${editingItem?.name || "Rarity"}`}
      description="Adjust custom rarity settings."
      tabs={rarityDialogTabs}
      onSave={onSave}
    />
  );
}
