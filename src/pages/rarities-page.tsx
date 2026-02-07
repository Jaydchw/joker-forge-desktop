import { useCallback, useMemo, useState } from "react";
import { GenericItemPage } from "@/components/pages/generic-item-page";
import { GenericItemCardMini } from "@/components/pages/generic-item-card-mini";
import { DialogTab } from "@/components/pages/generic-item-dialog";
import { GenericItemDialogMini } from "@/components/pages/generic-item-dialog-mini";
import { BadgePreview } from "@/components/balatro/badge-preview";
import { Input } from "@/components/ui/input";
import { useModName, useProjectData } from "@/lib/storage";
import { slugify } from "@/lib/balatro-utils";
import { RarityData } from "@/lib/types";
import { Copy, Palette, PencilSimple, Trash } from "@phosphor-icons/react";

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

export default function RaritiesPage() {
  const { data, updateRarities } = useProjectData();
  const modName = useModName();
  const [editingItem, setEditingItem] = useState<RarityData | null>(null);

  const handleUpdate = useCallback(
    (id: string, updates: Partial<RarityData>) => {
      updateRarities(
        data.rarities.map((rarity) =>
          rarity.id === id
            ? {
                ...rarity,
                ...updates,
                key: (updates.key || rarity.key || "").replace("#", ""),
                badge_colour: (
                  updates.badge_colour ||
                  rarity.badge_colour ||
                  ""
                )
                  .replace("#", "")
                  .toUpperCase(),
              }
            : rarity,
        ),
      );
    },
    [data.rarities, updateRarities],
  );

  const handleCreate = useCallback(() => {
    const newRarity: RarityData = {
      id: crypto.randomUUID(),
      key: "new_rarity",
      name: "New Rarity",
      badge_colour: DEFAULT_BADGE_COLOR,
      default_weight: 0.1,
    };
    updateRarities([...data.rarities, newRarity]);
    setEditingItem(newRarity);
  }, [data.rarities, updateRarities]);

  const handleDelete = useCallback(
    (id: string) =>
      updateRarities(data.rarities.filter((rarity) => rarity.id !== id)),
    [data.rarities, updateRarities],
  );

  const handleDuplicate = useCallback(
    (rarity: RarityData) => {
      const name = `${rarity.name} Copy`;
      const duplicated: RarityData = {
        ...rarity,
        id: crypto.randomUUID(),
        name,
        key: buildRarityKey(name),
      };
      updateRarities([...data.rarities, duplicated]);
    },
    [data.rarities, updateRarities],
  );

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
                render: (value, onChange) => {
                  const hex = normalizeHex(value);
                  const raw = hex.replace("#", "");
                  return (
                    <div className="flex items-center gap-3">
                      <div
                        className="h-9 w-9 rounded-md border border-border/60"
                        style={{ backgroundColor: hex }}
                      />
                      <Input
                        type="color"
                        value={hex}
                        onChange={(event) =>
                          onChange(event.target.value.replace("#", ""))
                        }
                        className="h-9 w-12 p-1 cursor-pointer"
                      />
                      <Input
                        value={raw}
                        onChange={(event) =>
                          onChange(event.target.value.replace("#", ""))
                        }
                        className="font-mono"
                      />
                    </div>
                  );
                },
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

  const sortOptions = useMemo(
    () => [
      {
        label: "Name",
        value: "name",
        sortFn: (a: RarityData, b: RarityData) => a.name.localeCompare(b.name),
      },
      {
        label: "Weight",
        value: "weight",
        sortFn: (a: RarityData, b: RarityData) =>
          a.default_weight - b.default_weight,
      },
      {
        label: "Key",
        value: "key",
        sortFn: (a: RarityData, b: RarityData) => a.key.localeCompare(b.key),
      },
    ],
    [],
  );

  const searchProps = useMemo(
    () => ({
      placeholder: "Search rarities by name or key...",
      searchFn: (item: RarityData, term: string) =>
        item.name.toLowerCase().includes(term) ||
        item.key.toLowerCase().includes(term),
    }),
    [],
  );

  const renderCard = useCallback(
    (item: RarityData) => (
      <GenericItemCardMini
        title={item.name}
        subtitle={item.key}
        accentColor={normalizeHex(item.badge_colour)}
        badgePreview={{
          label: item.name,
          color: normalizeHex(item.badge_colour),
        }}
        onTitleSave={(value) =>
          handleUpdate(item.id, {
            name: value,
            key: buildRarityKey(value),
          })
        }
        fields={[
          {
            id: "weight",
            label: "Weight",
            value: item.default_weight,
            editable: true,
            type: "number",
            step: 0.001,
            onSave: (value) =>
              handleUpdate(item.id, { default_weight: Number(value) }),
            formatter: (value) => Number(value || 0).toFixed(3),
          },
          {
            id: "color",
            label: "Badge",
            value: `#${item.badge_colour.replace("#", "")}`,
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
            id: "duplicate",
            label: "Duplicate",
            icon: <Copy className="h-4 w-4" />,
            onClick: () => handleDuplicate(item),
            variant: "outline",
          },
          {
            id: "delete",
            label: "Delete",
            icon: <Trash className="h-4 w-4" />,
            onClick: () => handleDelete(item.id),
            variant: "destructive",
          },
        ]}
      />
    ),
    [handleDelete, handleDuplicate, handleUpdate],
  );

  return (
    <>
      <GenericItemPage<RarityData>
        title="Rarities"
        subtitle={modName}
        items={data.rarities}
        onAddNew={handleCreate}
        addNewLabel="Create Rarity"
        searchProps={searchProps}
        sortOptions={sortOptions}
        renderCard={renderCard}
      />
      <GenericItemDialogMini
        open={!!editingItem}
        onOpenChange={(open) => !open && setEditingItem(null)}
        item={editingItem}
        title={`Edit ${editingItem?.name || "Rarity"}`}
        description="Adjust custom rarity settings."
        tabs={rarityDialogTabs}
        onSave={handleUpdate}
      />
    </>
  );
}
